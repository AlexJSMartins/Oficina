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
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.financialService.getDashboardData({
      month: month ? Number(month) : undefined,
      year: year ? Number(year) : undefined,
      startDate,
      endDate,
    });
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
    return this.financialService.createTransaction(body, req.user.id);
  }

  @Post('bulk-import')
  bulkImport(@Body() body: { rows: BulkFinancialRow[] }, @Request() req: any) {
    return this.financialService.bulkImport(body.rows, req.user.id);
  }

  @Delete('transactions/:id')
  deleteTransaction(@Param('id') id: string) {
    return this.financialService.deleteTransaction(id);
  }

  // Rota para obter a produtividade dos mecânicos
  @Get('productivity')
  getProductivity(
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.financialService.getMechanicProductivity({
      month: month ? Number(month) : undefined,
      year: year ? Number(year) : undefined,
      startDate,
      endDate,
    });
  }
}