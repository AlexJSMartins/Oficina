import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderStatus } from '@prisma/client';

export interface BulkImportRow {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerDocument?: string;
  plate: string;
  brand?: string;
  model?: string;
  year?: number | string;
  color?: string;
  km?: number | string;
  serviceDate?: string;
  serviceDescription?: string;
  partsUsed?: string;
  totalAmount?: number | string;
}


@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  // 1. Lista todos os clientes com resumo financeiro e Alerta de Revisão (6 meses / 180 dias)
  async findAll(search?: string) {
    const customers = await this.prisma.customer.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } },
              { document: { contains: search } },
              {
                vehicles: {
                  some: {
                    OR: [
                      { plate: { contains: search, mode: 'insensitive' } },
                      { model: { contains: search, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            ],
          }
        : undefined,
      include: {
        vehicles: true,
        serviceOrders: {
          orderBy: { entryDate: 'desc' },
          select: {
            id: true,
            number: true,
            entryDate: true,
            currentKm: true,
            totalAmount: true,
            status: true,
            vehicleId: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180);

    return customers.map((c) => {
      const totalSpent = c.serviceOrders
        .filter((o) => o.status === OrderStatus.COMPLETED)
        .reduce((acc, o) => acc + Number(o.totalAmount || 0), 0);

      const lastOrder = c.serviceOrders[0] || null;
      const lastVisitDate = lastOrder ? new Date(lastOrder.entryDate) : null;

      // Alerta de revisão: se a última visita foi há mais de 6 meses (180 dias)
      const needsMaintenanceAlert = lastVisitDate ? lastVisitDate < sixMonthsAgo : false;
      const daysSinceLastVisit = lastVisitDate
        ? Math.floor((Date.now() - lastVisitDate.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        ...c,
        totalSpent,
        ordersCount: c.serviceOrders.length,
        lastVisitDate,
        lastKm: lastOrder?.currentKm || 0,
        needsMaintenanceAlert,
        daysSinceLastVisit,
      };
    });
  }

  // 2. Prontuário Completo do Cliente + Histórico de Veículos, Peças, KM e Mídias
  async getCustomerDossier(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        vehicles: true,
        serviceOrders: {
          orderBy: { entryDate: 'desc' },
          include: {
            vehicle: true,
            mechanic: { select: { name: true } },
            items: true,
            timeline: {
              include: { medias: true },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    });

    if (!customer) throw new NotFoundException('Cliente não encontrado.');

    // Calcula alertas por veículo individualmente (6 meses ou estimativa de +10.000 km)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180);

    const vehicleSummaries = customer.vehicles.map((v) => {
      const vOrders = customer.serviceOrders.filter((o) => o.vehicleId === v.id);
      const latestOrder = vOrders[0];
      const oldestOrder = vOrders[vOrders.length - 1];

      const lastDate = latestOrder ? new Date(latestOrder.entryDate) : null;
      const isTimeDue = lastDate ? lastDate < sixMonthsAgo : false;
      const daysSinceLast = lastDate
        ? Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      // Estima se o cliente já rodou ~10.000 km desde a última OS (média padrão de 1.200 km/mês = 40 km/dia)
      const estimatedKmDriven = daysSinceLast * 40;
      const isKmDue = estimatedKmDriven >= 10000;

      return {
        ...v,
        lastKm: latestOrder?.currentKm || 0,
        firstKm: oldestOrder?.currentKm || 0,
        lastServiceDate: lastDate,
        daysSinceLast,
        estimatedCurrentKm: (latestOrder?.currentKm || 0) + estimatedKmDriven,
        maintenanceAlert: {
          active: isTimeDue || isKmDue,
          reason: isTimeDue
            ? `Mais de 6 meses (${daysSinceLast} dias) desde a última revisão`
            : isKmDue
            ? `Estimativa de +10.000 km rodados desde o último KM (${latestOrder?.currentKm} km)`
            : null,
          nextSuggestedKm: (latestOrder?.currentKm || 0) + 10000,
        },
      };
    });

    return {
      ...customer,
      vehicleSummaries,
    };
  }

  // 3. Cadastro Manual de Cliente Único (+ Veículo Opcional com trava contra sobrescrita de placa)
  async createCustomer(dto: {
    name: string;
    phone: string;
    email?: string;
    document?: string;
    vehicle?: {
      plate: string;
      brand: string;
      model: string;
      year: number;
      color?: string;
    };
  }) {
    if (!dto.name || !dto.phone) {
      throw new BadRequestException('Nome e telefone do cliente são obrigatórios.');
    }

    const cleanPhone = String(dto.phone).replace(/\D/g, '');

    return this.prisma.$transaction(async (tx) => {
      if (dto.vehicle && dto.vehicle.plate) {
        const cleanPlate = dto.vehicle.plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (cleanPlate.length >= 6) {
          const existingVehicle = await tx.vehicle.findUnique({
            where: { plate: cleanPlate },
          });
          if (existingVehicle) {
            throw new BadRequestException(
              `A placa ${cleanPlate} já está cadastrada no sistema (${existingVehicle.brand} ${existingVehicle.model}).`,
            );
          }
        }
      }

      const customer = await tx.customer.create({
        data: {
          name: dto.name.trim(),
          phone: cleanPhone || dto.phone.trim(),
          email: dto.email?.trim() || null,
          document: dto.document?.trim() || null,
        },
      });

      if (dto.vehicle && dto.vehicle.plate) {
        const cleanPlate = dto.vehicle.plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (cleanPlate.length >= 6) {
          await tx.vehicle.create({
            data: {
              plate: cleanPlate,
              brand: dto.vehicle.brand || 'Não informada',
              model: dto.vehicle.model || 'Não informado',
              year: Number(dto.vehicle.year) || new Date().getFullYear(),
              color: dto.vehicle.color || null,
              customerId: customer.id,
            },
          });
        }
      }

      return customer;
    });
  }

  // 4. IMPORTAÇÃO EM LOTE INTELIGENTE (Excel / CSV) - Sem sobrescrever carros já existentes
  async bulkImport(rows: BulkImportRow[], userId: string) {
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      throw new BadRequestException('Nenhum dado válido enviado na planilha.');
    }

    let customersCreatedOrUpdated = 0;
    let vehiclesProcessed = 0;
    let historyOrdersCreated = 0;
    let skippedRows = 0;

    // Utilitário interno para converter valores monetários sujos (ex: "R$ 1.250,50" -> 1250.50)
    const parseMoney = (val: any): number => {
      if (typeof val === 'number') return val;
      if (!val) return 0;
      const str = String(val).replace(/[R$\s]/g, '');
      if (str.includes(',') && str.includes('.')) {
        return Number(str.replace(/\./g, '').replace(',', '.')) || 0;
      }
      if (str.includes(',')) {
        return Number(str.replace(',', '.')) || 0;
      }
      return Number(str) || 0;
    };

    // Utilitário interno para converter datas em formatos variados (DD/MM/YYYY, YYYY-MM-DD ou Serial do Excel)
    const parseFlexibleDate = (val: any): Date => {
      if (!val) return new Date();
      if (typeof val === 'number') {
        return new Date(Math.round((val - 25569) * 86400 * 1000));
      }
      const str = String(val).trim();
      const brMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
      if (brMatch) {
        const day = Number(brMatch[1]);
        const month = Number(brMatch[2]) - 1;
        const year = brMatch[3].length === 2 ? 2000 + Number(brMatch[3]) : Number(brMatch[3]);
        const d = new Date(year, month, day, 12, 0, 0);
        if (!isNaN(d.getTime())) return d;
      }
      const parsed = new Date(str);
      return isNaN(parsed.getTime()) ? new Date() : parsed;
    };

    for (const row of rows) {
      const rawName = String(row.customerName || '').trim();
      const rawPhone = String(row.customerPhone || '').replace(/\D/g, '');
      const rawPlate = String(row.plate || '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');

      // Se a linha não tiver pelo menos um Nome de Cliente ou uma Placa, ignora com segurança
      if (!rawName && !rawPlate) {
        skippedRows++;
        continue;
      }

      const safeName = rawName || `Cliente Placa ${rawPlate}`;
      const safePhone = rawPhone || '00000000000';

      try {
        await this.prisma.$transaction(async (tx) => {
          // 1. Verifica primeiro se a placa já existe no banco para preservar o dono e o modelo original
          let existingVehicle =
            rawPlate && rawPlate.length >= 6
              ? await tx.vehicle.findUnique({
                  where: { plate: rawPlate },
                  include: { customer: true },
                })
              : null;

          let customer = existingVehicle?.customer || null;

          // Se a placa não existia, procura o cliente pelo telefone ou nome
          if (!customer) {
            customer = await tx.customer.findFirst({
              where:
                safePhone !== '00000000000'
                  ? { phone: safePhone }
                  : { name: { equals: safeName, mode: 'insensitive' } },
            });
          }

          if (!customer) {
            customer = await tx.customer.create({
              data: {
                name: safeName,
                phone: safePhone,
                email: row.customerEmail ? String(row.customerEmail).trim() : null,
                document: row.customerDocument ? String(row.customerDocument).trim() : null,
              },
            });
          }
          customersCreatedOrUpdated++;

          // 2. Cria o veículo APENAS se a placa ainda não existir no banco (nunca altera marca/modelo de carros antigos)
          if (rawPlate && rawPlate.length >= 6) {
            if (!existingVehicle) {
              const cleanYear = Number(String(row.year || '').replace(/\D/g, ''));
              const safeYear =
                cleanYear >= 1950 && cleanYear <= new Date().getFullYear() + 1
                  ? cleanYear
                  : new Date().getFullYear();

              existingVehicle = await tx.vehicle.create({
                data: {
                  plate: rawPlate,
                  brand: row.brand ? String(row.brand).trim() : 'Diversos',
                  model: row.model ? String(row.model).trim() : 'Veículo Importado',
                  year: safeYear,
                  color: row.color ? String(row.color).trim() : null,
                  customerId: customer.id,
                },
                include: { customer: true },
              });
            }
            vehiclesProcessed++;

            // 3. Se a planilha tiver histórico de manutenção naquela linha, cria uma OS finalizada no histórico
            const hasHistory =
              Boolean(row.serviceDescription) ||
              Boolean(row.partsUsed) ||
              parseMoney(row.totalAmount) > 0;

            if (hasHistory) {
              const entryDate = parseFlexibleDate(row.serviceDate);
              const safeKm = Number(String(row.km || '0').replace(/\D/g, '')) || 0;
              const safeTotal = parseMoney(row.totalAmount);
              const desc = String(
                row.serviceDescription || 'Manutenção histórica importada via planilha',
              ).trim();
              const partsText = row.partsUsed ? String(row.partsUsed).trim() : '';

              const historicalOrder = await tx.serviceOrder.create({
                data: {
                  status: OrderStatus.COMPLETED,
                  entryDate,
                  exitDate: entryDate,
                  currentKm: safeKm,
                  fuelLevel: 'N/I',
                  customerNotes: `[Histórico Importado] ${desc}`,
                  mechanicNotes: partsText
                    ? `Peças/Serviços registrados na planilha: ${partsText}`
                    : desc,
                  customerId: customer.id,
                  vehicleId: existingVehicle.id,
                  totalAmount: safeTotal,
                },
              });

              // Cria o item na OS para constar no prontuário de peças/serviços
              if (safeTotal > 0 || partsText || desc) {
                await tx.orderItem.create({
                  data: {
                    serviceOrderId: historicalOrder.id,
                    type: partsText ? 'PART' : 'LABOR',
                    description: partsText ? `${desc} - Peças: ${partsText}` : desc,
                    quantity: 1,
                    costPrice: 0,
                    unitCost: 0,
                    unitPrice: safeTotal,
                    totalPrice: safeTotal,
                  },
                });
              }

              await tx.orderTimeline.create({
                data: {
                  serviceOrderId: historicalOrder.id,
                  status: OrderStatus.COMPLETED,
                  description: `Registro histórico importado de planilha (${entryDate.toLocaleDateString('pt-BR')}).`,
                  isPublic: true,
                  createdById: userId,
                },
              });

              historyOrdersCreated++;
            }
          }
        });
      } catch (err) {
        // Se uma linha específica tiver algum dado corrompido extremo, pula apenas ela sem abortar a planilha toda
        skippedRows++;
      }
    }

    return {
      message: 'Importação concluída com sucesso!',
      stats: {
        totalRowsReceived: rows.length,
        customersCreatedOrUpdated,
        vehiclesProcessed,
        historyOrdersCreated,
        skippedRows,
      },
    };
  }

  // 5. Atualizar dados do Cliente
  async updateCustomer(id: string, dto: { name?: string; phone?: string; email?: string; document?: string }) {
    return this.prisma.customer.update({
      where: { id },
      data: {
        name: dto.name,
        phone: dto.phone ? String(dto.phone).replace(/\D/g, '') : undefined,
        email: dto.email,
        document: dto.document,
      },
    });
  }

  // 6. Atualizar dados do Veículo (com trava contra placas duplicadas)
  async updateVehicle(id: string, dto: { plate?: string; brand?: string; model?: string; year?: number; color?: string }) {
    if (dto.plate) {
      const cleanPlate = dto.plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const existing = await this.prisma.vehicle.findUnique({ where: { plate: cleanPlate } });
      if (existing && existing.id !== id) {
        throw new BadRequestException(`A placa ${cleanPlate} já pertence a outro veículo no sistema.`);
      }
      dto.plate = cleanPlate;
    }

    return this.prisma.vehicle.update({
      where: { id },
      data: {
        plate: dto.plate,
        brand: dto.brand,
        model: dto.model,
        year: dto.year ? Number(dto.year) : undefined,
        color: dto.color,
      },
    });
  }

  // 7. Excluir Cliente (Deleta em cascata os veículos e histórico)
  async deleteCustomer(id: string) {
    return this.prisma.customer.delete({ where: { id } });
  }

  // 8. Excluir Veículo (Deleta em cascata o histórico daquele veículo)
  async deleteVehicle(id: string) {
    return this.prisma.vehicle.delete({ where: { id } });
  }
}