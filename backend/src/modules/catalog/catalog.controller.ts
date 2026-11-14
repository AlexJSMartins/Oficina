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
import { CatalogService } from './catalog.service';
import { JwtAuthGuard } from '../auth/permissions.guard';

@UseGuards(JwtAuthGuard)
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('search')
  search(@Query('q') q?: string) {
    return this.catalogService.searchCatalog(q || '');
  }

  @Get('inventory')
  getInventory() {
    return this.catalogService.getInventory();
  }

  @Post('items')
  createItem(@Body() body: any, @Request() req: any) {
    return this.catalogService.createItem(body, req.user.id);
  }

  @Patch('items/:id')
  updateItem(@Param('id') id: string, @Body() body: any) {
    return this.catalogService.updateItem(id, body);
  }

  @Delete('items/:id')
  deleteItem(@Param('id') id: string) {
    return this.catalogService.deleteItem(id);
  }

  @Post('items/:id/stock')
  adjustStock(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.catalogService.adjustStock(id, body, req.user.id);
  }

  @Post('defects')
  registerDefect(@Body() body: any, @Request() req: any) {
    return this.catalogService.registerDefect(body, req.user.id);
  }

  @Get('suppliers')
  getSuppliers() {
    return this.catalogService.getAllSuppliers();
  }

  @Post('suppliers')
  createSupplier(@Body() body: any) {
    return this.catalogService.createSupplier(body);
  }

  @Patch('suppliers/:id')
  updateSupplier(@Param('id') id: string, @Body() body: any) {
    return this.catalogService.updateSupplier(id, body);
  }

  @Delete('suppliers/:id')
  deleteSupplier(@Param('id') id: string) {
    return this.catalogService.deleteSupplier(id);
  }

  @Post('bulk-import')
  bulkImport(@Body() body: { rows: any[] }, @Request() req: any) {
    return this.catalogService.bulkImport(body.rows, req.user.id);
  }
}