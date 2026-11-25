// backend/src/modules/fiscal/fiscal.controller.ts

import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { FiscalService } from './fiscal.service';
import { JwtAuthGuard, PermissionsGuard } from '../auth/permissions.guard';
import { InboundInvoiceService } from './inbound-invoice.service';
import { ReturnInvoiceService } from './return-invoice.service';

@Controller('fiscal')
export class FiscalController {
  constructor(
    private readonly fiscalService: FiscalService,
    private readonly inboundService: InboundInvoiceService,
    private readonly returnService: ReturnInvoiceService,
  ) {}

  // Webhook público para receber atualizações assíncronas da DevNota
  @Post('webhook')
  webhook(@Body() body: any) {
    return this.fiscalService.handleWebhook(body);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get('status')
  getStatus(@Request() req: any) {
    return this.fiscalService.getFiscalStatus(req.user.workshopId);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('company/sync')
  syncCompany(@Request() req: any, @Body() body: any) {
    return this.fiscalService.syncCompanyWithDevNota(req.user.workshopId, body);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('certificate')
  uploadCertificate(@Request() req: any, @Body() body: any) {
    return this.fiscalService.uploadCertificate(req.user.workshopId, body);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('services')
  createService(@Request() req: any, @Body() body: any) {
    return this.fiscalService.createServiceForCompany(req.user.workshopId, body);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('emit/:tipo')
  emit(
    @Request() req: any,
    @Param('tipo') tipo: 'NFE' | 'NFCE' | 'NFSE',
    @Body() body: { payload: any; meta?: any },
  ) {
    const normalizedType = String(tipo).toUpperCase() as 'NFE' | 'NFCE' | 'NFSE';
    return this.fiscalService.emitDocument(
      req.user.workshopId,
      normalizedType,
      body.payload || body,
      body.meta,
    );
  }

 @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get('invoices')
  listInvoices(
    @Request() req: any,
    @Query('tipo') tipo?: string,
    @Query('status') status?: string,
    @Query('finalidade') finalidade?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
  ) {
    return this.fiscalService.listInvoices(req.user.workshopId, {
      tipo,
      status,
      finalidade,
      startDate,
      endDate,
      search,
    });
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get('invoices/:id/xml')
  getInvoiceXml(@Request() req: any, @Param('id') id: string) {
    return this.fiscalService.fetchXml(req.user.workshopId, id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('invoices/:id/cce')
  sendCce(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { correcao: string },
  ) {
    return this.fiscalService.sendCce(req.user.workshopId, id, body.correcao);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('invoices/:id/reprocess')
  reprocessInvoice(@Request() req: any, @Param('id') id: string) {
    return this.fiscalService.reprocessInvoice(req.user.workshopId, id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get('exports')
  listExports(@Request() req: any) {
    return this.fiscalService.listExports(req.user.workshopId);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('exports')
  createExport(@Request() req: any, @Body() body: any) {
    return this.fiscalService.createExport(req.user.workshopId, body);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get('exports/:exportUuid/download')
  async downloadExport(
    @Request() req: any,
    @Param('exportUuid') exportUuid: string,
    @Res() res: Response,
  ) {
    const buffer = await this.fiscalService.downloadExportZip(req.user.workshopId, exportUuid);
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="notas-fiscais-${exportUuid.slice(0, 8)}.zip"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('invoices/:id/cancel')
  cancelInvoice(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.fiscalService.cancelInvoice(req.user.workshopId, id, body);
  }


  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get('from-service-order/:orderId/preview')
  previewFromOrder(@Request() req: any, @Param('orderId') orderId: string) {
    return this.fiscalService.prepareFromServiceOrder(req.user.workshopId, orderId);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('from-service-order/:orderId/emit/:tipo')
  emitFromOrder(
    @Request() req: any,
    @Param('orderId') orderId: string,
    @Param('tipo') tipo: 'NFE' | 'NFCE' | 'NFSE',
    @Body() body: { payload?: any },
  ) {
    return this.fiscalService.emitFromServiceOrder(req.user.workshopId, orderId, tipo, body?.payload);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get('invoices/:id/sync-pdf')
  syncAndGetPdf(@Request() req: any, @Param('id') id: string) {
    return this.fiscalService.syncAndFetchPdf(req.user.workshopId, id);
  }

  // Endpoint para emitir tanto NFE quanto NFCE a partir de uma ordem de serviço
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('from-service-order/:orderId/emit-both')
  emitBothFromOrder(
    @Request() req: any,
    @Param('orderId') orderId: string,
    @Body() body: { partsDocType?: 'NFE' | 'NFCE' },
  ) {
    return this.fiscalService.emitBothFromServiceOrder(
      req.user.workshopId,
      orderId,
      body?.partsDocType || 'NFE',
    );
  }

  // Endpoint para atualizar os dados fiscais de um cliente
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Patch('customers/:customerId/fiscal-data')
  updateCustomerFiscalData(
    @Request() req: any,
    @Param('customerId') customerId: string,
    @Body() body: any,
  ) {
    return this.fiscalService.updateCustomerFiscalData(req.user.workshopId, customerId, body);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get('exports/preview')
  previewLocalExport(
    @Request() req: any,
    @Query('tipo') tipo?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('includeCancelled') includeCancelled?: string,
  ) {
    return this.fiscalService.previewLocalExport(req.user.workshopId, {
      tipo,
      startDate,
      endDate,
      includeCancelled: includeCancelled === 'true',
    });
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('exports/local-zip')
  async downloadLocalExportZip(
    @Request() req: any,
    @Body()
    body: {
      tipo?: string;
      startDate?: string;
      endDate?: string;
      includePdf?: boolean;
      includeCancelled?: boolean;
    },
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.fiscalService.generateLocalExportZip(
      req.user.workshopId,
      body,
    );

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }
  
  // Endpoint para atualizar as configurações fiscais da oficina
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Patch('settings')
  updateFiscalSettings(@Request() req: any, @Body() body: any) {
    return this.fiscalService.updateFiscalSettings(req.user.workshopId, body);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get('inbound')
  listInbound(@Request() req: any) {
    return this.inboundService.listInboundInvoices(req.user.workshopId);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('inbound/parse-xml')
  parseInboundXml(@Request() req: any, @Body() body: { xmlContent: string }) {
    return this.inboundService.parseXmlAndMatch(req.user.workshopId, body?.xmlContent);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('inbound/confirm-import')
  confirmInboundImport(@Request() req: any, @Body() body: any) {
    return this.inboundService.confirmImport(req.user.workshopId, req.user.id, body);
  }

  // ===== SPRINT 6: MÓDULO INTELIGENTE DE DEVOLUÇÃO =====

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get('returns/inbound-list')
  listInboundForReturn(@Request() req: any) {
    return this.returnService.listInboundForReturn(req.user.workshopId);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('returns/prepare')
  prepareReturn(
    @Request() req: any,
    @Body() body: { inboundInvoiceId?: string; xmlContent?: string },
  ) {
    return this.returnService.prepareReturn(req.user.workshopId, body);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('returns/preview')
  previewReturn(@Request() req: any, @Body() body: any) {
    return this.returnService.buildReturnPreview(req.user.workshopId, body);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('returns/emit')
  emitReturn(@Request() req: any, @Body() body: any) {
    return this.returnService.emitReturnInvoice(req.user.workshopId, req.user.id, body);
  }
}