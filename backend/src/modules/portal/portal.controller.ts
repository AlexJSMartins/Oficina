import { Controller, Get, Post, Param, Body, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderStatus } from '@prisma/client';

@Controller('portal')
export class PortalController {
  constructor(private prisma: PrismaService) {}

  @Get('tracking/:token')
  async getTrackingInfo(@Param('token') token: string) {
    const order = await this.prisma.serviceOrder.findUnique({
      where: { trackingToken: token },
      include: {
        customer: { select: { name: true, phone: true } },
        vehicle: true,
        items: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            type: true,
            description: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
          },
        },
        timeline: {
          where: { isPublic: true },
          orderBy: { createdAt: 'desc' },
          include: { medias: true },
        },
      },
    });

    if (!order) throw new NotFoundException('Ordem de serviço não encontrada.');
    return order;
  }

  @Post('tracking/:token/decision')
  async handleClientDecision(
    @Param('token') token: string,
    @Body() body: { approved: boolean; reason?: string },
  ) {
    const order = await this.prisma.serviceOrder.findUnique({
      where: { trackingToken: token },
    });

    if (!order) throw new NotFoundException('Ordem de serviço não encontrada.');
    if (order.status !== OrderStatus.WAITING_APPROVAL) {
      throw new BadRequestException('Esta Ordem de Serviço não está aguardando aprovação.');
    }

    // Busca um usuário ADMIN para registrar a ação gerada pelo portal do cliente
    const adminUser = await this.prisma.user.findFirst({
      where: { role: 'ADMIN', isActive: true },
    });

    if (!adminUser) {
      throw new BadRequestException('Nenhum administrador ativo encontrado no sistema para registrar a aprovação.');
    }

    const nextStatus = body.approved ? OrderStatus.IN_REPAIR : OrderStatus.IN_DIAGNOSIS;
    const description = body.approved
      ? `✅ Orçamento APROVADO online pelo cliente! Veículo liberado para reparação.`
      : `⚠️ Cliente solicitou revisão no orçamento: "${body.reason || 'Sem observações'}"`;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.serviceOrder.update({
        where: { id: order.id },
        data: { status: nextStatus },
      });

      await tx.orderTimeline.create({
        data: {
          serviceOrderId: order.id,
          status: nextStatus,
          description,
          isPublic: true,
          createdById: adminUser.id, // Satisfeita a exigência da string obrigatória do Prisma
        },
      });

      return updated;
    });
  }
}