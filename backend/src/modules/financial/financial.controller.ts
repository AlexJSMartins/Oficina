import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { FinancialService, BulkFinancialRow } from './financial.service';
import { JwtAuthGuard, PermissionsGuard, RequirePermissions } from '../auth/permissions.guard';
import { PERMISSIONS } from '../auth/permissions.constants';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PERMISSIONS.FINANCIAL_MANAGE)
@Controller('financial')
export class FinancialController {
  constructor(private readonly financialService: FinancialService) {}

  @Get('dashboard')
  getDashboard(
    @Request() req: any,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.financialService.getDashboardData(
      {
        month: month ? Number(month) : undefined,
        year: year ? Number(year) : undefined,
        startDate,
        endDate,
        workshopId: req.user.workshopId,
      },
      req.user.workshopId,
    );
  }

  @Post('settle-order/:orderId')
  settleOrder(
    @Param('orderId') orderId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    return this.financialService.settleServiceOrder(orderId, body, req.user.id);
  }

  @Post('transactions')
  createTransaction(@Body() body: any, @Request() req: any) {
    return this.financialService.createTransaction(body, req.user.id, req.user.workshopId);
  }

  @Post('bulk-import')
  bulkImport(@Body() body: { rows: BulkFinancialRow[] }, @Request() req: any) {
    return this.financialService.bulkImport(body.rows, req.user.id, req.user.workshopId);
  }

  @Delete('transactions/:id')
  deleteTransaction(@Param('id') id: string) {
    return this.financialService.deleteTransaction(id);
  }

  @Get('productivity')
  getProductivity(
    @Request() req: any,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.financialService.getMechanicProductivity(
      {
        month: month ? Number(month) : undefined,
        year: year ? Number(year) : undefined,
        startDate,
        endDate,
        workshopId: req.user.workshopId,
      },
      req.user.workshopId,
    );
  }
}