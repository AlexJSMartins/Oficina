import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { BillingService, type CheckoutDto } from './billing.service';
import { JwtAuthGuard } from '../auth/permissions.guard';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  // Público — Landing Page e Checkout
  @Get('plans')
  listPublicPlans() {
    return this.billingService.listPublicPlans();
  }

  // Autenticado — Status da assinatura e consumo de notas da oficina
  @UseGuards(JwtAuthGuard)
  @Get('my-subscription')
  getMySubscription(@Request() req: any) {
    return this.billingService.getWorkshopSubscriptionStatus(req.user.workshopId);
  }

  // Autenticado (ADMIN) — Gera cobrança/assinatura no Asaas
  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  createCheckout(@Request() req: any, @Body() body: CheckoutDto) {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Apenas o administrador da oficina pode contratar planos.');
    }
    const remoteIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      '127.0.0.1';
    return this.billingService.createCheckout(req.user.workshopId, body, remoteIp);
  }

  // Autenticado — Consulta pagamento no Asaas e ativa se já foi pago
  @UseGuards(JwtAuthGuard)
  @Post('payments/:id/sync')
  syncPayment(@Request() req: any, @Param('id') id: string) {
    return this.billingService.syncPaymentStatus(req.user.workshopId, id);
  }

  // Autenticado (ADMIN) — Cancela renovação automática
  @UseGuards(JwtAuthGuard)
  @Post('cancel-subscription')
  cancelSubscription(@Request() req: any) {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Apenas o administrador da oficina pode cancelar a assinatura.');
    }
    return this.billingService.cancelRecurringSubscription(req.user.workshopId);
  }

  // Público (validado via header asaas-access-token) — Webhook Asaas
  @Post('webhooks/asaas')
  handleAsaasWebhook(
    @Headers('asaas-access-token') token: string | undefined,
    @Body() body: any,
  ) {
    return this.billingService.handleAsaasWebhook(token, body);
  }

  // Autenticado — Busca/recarrega o QR Code PIX sob demanda caso o Asaas atrase
  @UseGuards(JwtAuthGuard)
  @Get('payments/:id/pix-qrcode')
  getPixQrCode(@Request() req: any, @Param('id') id: string) {
    return this.billingService.fetchPixQrCode(req.user.workshopId, id);
  }
}