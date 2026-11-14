import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { CustomersService, BulkImportRow } from './customers.service';
import { JwtAuthGuard, PermissionsGuard, RequirePermissions } from '../auth/permissions.guard';
import { PERMISSIONS } from '../auth/permissions.constants';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @RequirePermissions(PERMISSIONS.CUSTOMERS_MANAGE)
  @Get()
  findAll(@Query('search') search?: string) {
    return this.customersService.findAll(search);
  }

  @RequirePermissions(PERMISSIONS.CUSTOMERS_MANAGE)
  @Get(':id/dossier')
  getDossier(@Param('id') id: string) {
    return this.customersService.getCustomerDossier(id);
  }

  @RequirePermissions(PERMISSIONS.CUSTOMERS_MANAGE)
  @Post()
  create(@Body() body: any) {
    return this.customersService.createCustomer(body);
  }

  @RequirePermissions(PERMISSIONS.CUSTOMERS_MANAGE)
  @Post('bulk-import')
  bulkImport(@Body() body: { rows: BulkImportRow[] }, @Request() req: any) {
    return this.customersService.bulkImport(body.rows, req.user.id);
  }

  @RequirePermissions(PERMISSIONS.CUSTOMERS_MANAGE)
  @Patch(':id')
  updateCustomer(@Param('id') id: string, @Body() body: any) {
    return this.customersService.updateCustomer(id, body);
  }

  @RequirePermissions(PERMISSIONS.CUSTOMERS_MANAGE)
  @Patch('vehicle/:id')
  updateVehicle(@Param('id') id: string, @Body() body: any) {
    return this.customersService.updateVehicle(id, body);
  }

  @RequirePermissions(PERMISSIONS.CUSTOMERS_MANAGE)
  @Delete(':id')
  deleteCustomer(@Param('id') id: string) {
    return this.customersService.deleteCustomer(id);
  }

  @RequirePermissions(PERMISSIONS.CUSTOMERS_MANAGE)
  @Delete('vehicle/:id')
  deleteVehicle(@Param('id') id: string) {
    return this.customersService.deleteVehicle(id);
  }
}