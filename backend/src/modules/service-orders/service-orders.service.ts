import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderStatus } from '@prisma/client';

export interface CheckInDto {
  customerName: string;
  customerPhone: string;
  customerDocument?: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  color?: string;
  currentKm: number;
  fuelLevel?: string;
  customerNotes?: string;
  mechanicId?: string;
}

@Injectable()
export class ServiceOrdersService {
  constructor(private prisma: PrismaService) {}

  // Busca rápida pela placa: se o carro já veio na oficina antes, preenche os dados sozinho!
  async findVehicleByPlate(plate: string) {
    const cleanPlate = plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return this.prisma.vehicle.findUnique({
      where: { plate: cleanPlate },
      include: { customer: true },
    });
  }

  // Lista todas as OS ativas no pátio
  async findAll(user: { id: string; role: string; permissions: string[] }) {
    const canViewAll = user.role === 'ADMIN' || user.permissions.includes('orders:view_all');

    // Ordena por data de entrada (mais recente primeiro) e inclui dados do cliente, veículo, mecânico, itens e transações
    return this.prisma.serviceOrder.findMany({
      where: canViewAll ? {} : { mechanicId: user.id },
      include: {
        customer: true,
        vehicle: true,
        mechanic: { select: { id: true, name: true } },
        items: true,
        transactions: { select: { id: true, type: true, category: true } },
      },
      orderBy: { entryDate: 'desc' },
    });
  }

  // Lista mecânicos disponíveis para atribuir à OS
  async listMechanics() {
    return this.prisma.user.findMany({
      where: { isActive: true, role: 'MECHANIC' },
      select: { id: true, name: true },
    });
  }

  // Entrada de Veículo (Check-in Unificado)
  async createCheckIn(dto: CheckInDto, userId: string) {
    const cleanPlate = dto.plate.toUpperCase().replace(/[^A-Z0-9]/g, '');

    return this.prisma.$transaction(async (tx) => {
      // 1. Verifica se o veículo já existe pela placa
      let vehicle = await tx.vehicle.findUnique({
        where: { plate: cleanPlate },
        include: { customer: true },
      });

      let customerId: string;

      if (vehicle) {
        customerId = vehicle.customerId;
        // Atualiza telefone/nome do cliente caso tenha mudado
        await tx.customer.update({
          where: { id: customerId },
          data: { name: dto.customerName, phone: dto.customerPhone },
        });
      } else {
        // Cria novo cliente e veículo
        const newCustomer = await tx.customer.create({
          data: {
            name: dto.customerName,
            phone: dto.customerPhone,
            document: dto.customerDocument,
          },
        });
        customerId = newCustomer.id;

        vehicle = await tx.vehicle.create({
          data: {
            plate: cleanPlate,
            brand: dto.brand,
            model: dto.model,
            year: Number(dto.year),
            color: dto.color,
            customerId,
          },
          include: { customer: true },
        });
      }

      // 2. Cria a Ordem de Serviço no status CHECK_IN
      const order = await tx.serviceOrder.create({
        data: {
          status: OrderStatus.CHECK_IN,
          currentKm: Number(dto.currentKm),
          fuelLevel: dto.fuelLevel,
          customerNotes: dto.customerNotes,
          customerId,
          vehicleId: vehicle.id,
          mechanicId: dto.mechanicId || null,
        },
        include: { customer: true, vehicle: true },
      });

      // 3. Cria o primeiro evento na Timeline Pública do Cliente
      await tx.orderTimeline.create({
        data: {
          serviceOrderId: order.id,
          status: OrderStatus.CHECK_IN,
          description: 'Veículo recebido na oficina. Check-in realizado com sucesso.',
          isPublic: true,
          createdById: userId,
        },
      });

      return order;
    });
  }

 // Mudança rápida de status no Pátio/Kanban (Com trava anti-duplicidade e baixa automática de estoque)
  async updateStatus(
    orderId: string,
    status: OrderStatus,
    description: string | undefined,
    userId: string,
  ) {
    const exists = await this.prisma.serviceOrder.findUnique({ where: { id: orderId } });
    if (!exists) throw new NotFoundException('Ordem de serviço não encontrada.');

    const descText = description || `Status atualizado para ${status}`;

    // Trava 1: Verifica se já houve exatamente o mesmo registro nos últimos 5 segundos (evita clique duplo)
    const fiveSecondsAgo = new Date(Date.now() - 5000);
    const duplicateEvent = await this.prisma.orderTimeline.findFirst({
      where: {
        serviceOrderId: orderId,
        status,
        description: descText,
        createdAt: { gte: fiveSecondsAgo },
      },
    });

    if (duplicateEvent) {
      return this.prisma.serviceOrder.findUnique({
        where: { id: orderId },
        include: { customer: true, vehicle: true },
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.serviceOrder.update({
        where: { id: orderId },
        data: {
          status,
          exitDate: status === OrderStatus.COMPLETED ? new Date() : exists.exitDate,
        },
        include: { customer: true, vehicle: true },
      });

      await tx.orderTimeline.create({
        data: {
          serviceOrderId: orderId,
          status,
          description: descText,
          isPublic: true,
          createdById: userId,
        },
      });

      return updatedOrder;
    });

    // Se a OS avançou para Em Reparação, Pronto ou Finalizado, dá baixa automática nas peças do orçamento
    if (
      status === OrderStatus.IN_REPAIR ||
      status === OrderStatus.READY_FOR_PICKUP ||
      status === OrderStatus.COMPLETED
    ) {
      await this.deductStockForOrder(orderId, userId);
    }

    return updated;
  }

  // Baixa automática de estoque quando a OS entra em reparação ou é finalizada
  async deductStockForOrder(orderId: string, userId?: string) {
    const order = await this.prisma.serviceOrder.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order || !order.items || order.items.length === 0) return;

    // Verifica se já houve baixa de estoque para esta OS (evita descontar 2 vezes)
    const existingMovements = await this.prisma.stockMovement.count({
      where: {
        serviceOrderId: order.id,
        type: 'OUT',
      },
    });

    if (existingMovements > 0) return;

    for (const item of order.items) {
      if (item.type !== 'PART' || !item.description) continue;

      // Procura a peça no catálogo pelo nome ou código
      const catalogItem = await this.prisma.catalogItem.findFirst({
        where: {
          type: 'PART',
          OR: [
            { name: { equals: item.description.trim(), mode: 'insensitive' } },
            { code: { equals: item.description.trim(), mode: 'insensitive' } },
          ],
        },
      });

      if (catalogItem) {
        const qtyToDeduct = Number(item.quantity || 1);
        const newStock = Math.max(0, catalogItem.stock - qtyToDeduct);

        await this.prisma.$transaction([
          this.prisma.catalogItem.update({
            where: { id: catalogItem.id },
            data: { stock: newStock },
          }),
          this.prisma.stockMovement.create({
            data: {
              catalogItemId: catalogItem.id,
              type: 'OUT',
              quantity: qtyToDeduct,
              reason: `Baixa automática na OS #${order.number}`,
              serviceOrderId: order.id,
              createdById: userId || 'SISTEMA',
            },
          }),
        ]);
      }
    }
  }

  // Salva MÚLTIPLAS fotos/vídeos juntas em um único evento da Timeline
  async addMediasToTimeline(
    orderId: string,
    medias: { url: string; type: 'IMAGE' | 'VIDEO' }[],
    description: string,
    userId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.serviceOrder.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundException('OS não encontrada');

      return tx.orderTimeline.create({
        data: {
          serviceOrderId: orderId,
          status: order.status,
          description: description || 'Novas mídias adicionadas pelo mecânico.',
          isPublic: true,
          createdById: userId,
          medias: {
            create: medias,
          },
        },
        include: { medias: true },
      });
    });
  }

  // Recalcula o total da OS sempre que uma peça/mão de obra ou desconto é alterado
  private async recalculateOrderTotal(tx: any, orderId: string) {
    const items = await tx.orderItem.findMany({ where: { serviceOrderId: orderId } });
    const order = await tx.serviceOrder.findUnique({ where: { id: orderId } });

    const subtotal = items.reduce((acc: number, item: any) => acc + Number(item.totalPrice), 0);
    const discount = Number(order?.discount || 0);
    const totalAmount = Math.max(0, subtotal - discount);

    return tx.serviceOrder.update({
      where: { id: orderId },
      data: { totalAmount },
      include: { customer: true, vehicle: true, items: { orderBy: { createdAt: 'asc' } } },
    });
  }

  // Busca uma OS específica com todos os itens para o modal de orçamento
  async findOneWithItems(orderId: string) {
    const order = await this.prisma.serviceOrder.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        vehicle: true,
        mechanic: { select: { id: true, name: true } },
        items: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!order) throw new NotFoundException('OS não encontrada.');
    return order;
  }

  // Adiciona Peça (PART) ou Mão de Obra (LABOR) no orçamento
 async addOrderItem(
  orderId: string,
  data: {
    type: 'PART' | 'LABOR';
    description: string;
    quantity: number;
    costPrice?: number;
    unitPrice: number;
  },
) {
  const qty = Number(data.quantity) || 1;
  const unit = Number(data.unitPrice) || 0;
  const cost = Number(data.costPrice) || 0;
  const totalPrice = qty * unit;
  const itemName = String(data.description).trim();

  return this.prisma.$transaction(async (tx) => {
    // 1. CADASTRO RÁPIDO NO CATÁLOGO: Verifica se o item já existe no banco
    if (itemName) {
      const existingCatalogItem = await tx.catalogItem.findFirst({
        where: {
          name: { equals: itemName, mode: 'insensitive' },
          type: data.type,
        },
      });

      if (!existingCatalogItem) {
        // Se não existir, cadastra automaticamente para aparecer no estoque/catálogo geral
        await tx.catalogItem.create({
          data: {
            type: data.type,
            name: itemName,
            costPrice: data.type === 'PART' ? cost : 0,
            salePrice: unit,
            stock: data.type === 'PART' ? 0 : 0, // Começa com 0 ou o que preferir
            minStock: 2,
          },
        });
      }
    }

    // 2. Adiciona o item na Ordem de Serviço (Orçamento)
    await tx.orderItem.create({
      data: {
        serviceOrderId: orderId,
        type: data.type,
        description: itemName,
        quantity: qty,
        costPrice: data.type === 'PART' ? cost : 0,
        unitPrice: unit,
        totalPrice,
      },
    });

    return this.recalculateOrderTotal(tx, orderId);
  });
}

  // Remove um item do orçamento
  async removeOrderItem(orderId: string, itemId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.orderItem.delete({ where: { id: itemId } });
      return this.recalculateOrderTotal(tx, orderId);
    });
  }

  // Aplica desconto na OS e opcionalmente já muda o status para "Aguardando Aprovação"
  async updateBudgetDiscount(
    orderId: string,
    discount: number,
    sendToApproval: boolean,
    mechanicNotes: string,
    userId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.serviceOrder.update({
        where: { id: orderId },
        data: {
          discount: Number(discount) || 0,
          mechanicNotes,
          ...(sendToApproval ? { status: OrderStatus.WAITING_APPROVAL } : {}),
        },
      });

      const updated = await this.recalculateOrderTotal(tx, orderId);

      if (sendToApproval) {
        await tx.orderTimeline.create({
          data: {
            serviceOrderId: orderId,
            status: OrderStatus.WAITING_APPROVAL,
            description: `Orçamento fechado no valor de R$ ${Number(updated.totalAmount).toFixed(2)}. Aguardando aprovação do cliente.`,
            isPublic: true,
            createdById: userId,
          },
        });
      }

      return updated;
    });
  }

  async updateMechanic(orderId: string, mechanicId: string | null) {
    return this.prisma.serviceOrder.update({
      where: { id: orderId },
      data: { mechanicId },
    });
  }

  async updateMechanicCommission(orderId: string, rate: number | null) {
    return this.prisma.serviceOrder.update({
      where: { id: orderId },
      data: { mechanicCommissionRate: rate },
    });
  }

  
}