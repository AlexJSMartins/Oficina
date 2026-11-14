import 'multer';
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
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { extname } from 'path';
import { ServiceOrdersService, type CheckInDto } from './service-orders.service';
import { StorageService } from '../storage/storage.service';
import { JwtAuthGuard, PermissionsGuard, RequirePermissions } from '../auth/permissions.guard';
import { PERMISSIONS } from '../auth/permissions.constants';
import { OrderStatus } from '@prisma/client';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('service-orders')
export class ServiceOrdersController {
  constructor(
    private readonly serviceOrdersService: ServiceOrdersService,
    private readonly storageService: StorageService,
  ) {}

  @Get()
  findAll(@Request() req: any) {
    return this.serviceOrdersService.findAll(req.user);
  }

  @Get('mechanics')
  listMechanics() {
    return this.serviceOrdersService.listMechanics();
  }

  @Get('lookup-plate')
  lookupPlate(@Query('plate') plate: string) {
    return this.serviceOrdersService.findVehicleByPlate(plate);
  }

  @RequirePermissions(PERMISSIONS.ORDERS_CHECKIN)
  @Post('check-in')
  createCheckIn(@Body() dto: CheckInDto, @Request() req: any) {
    return this.serviceOrdersService.createCheckIn(dto, req.user.id);
  }

  @RequirePermissions(PERMISSIONS.ORDERS_DIAGNOSIS)
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: OrderStatus; description?: string },
    @Request() req: any,
  ) {
    return this.serviceOrdersService.updateStatus(id, body.status, body.description, req.user.id);
  }

  // =========================================================
  // UPLOAD DE MÚLTIPLAS FOTOS/VÍDEOS DE UMA SÓ VEZ (ATÉ 10 ARQUIVOS)
  // =========================================================
  @RequirePermissions(PERMISSIONS.ORDERS_DIAGNOSIS)
  @Post(':id/media')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      limits: { fileSize: 25 * 1024 * 1024 }, // Máx 25MB por arquivo
    }),
  )
  async uploadMedias(
    @Param('id') orderId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('description') description: string,
    @Request() req: any,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Nenhum arquivo recebido.');
    }

    const uploadedMedias: { url: string; type: 'IMAGE' | 'VIDEO' }[] = [];

    for (const file of files) {
      let mediaType: 'IMAGE' | 'VIDEO' = 'IMAGE';
      let finalBuffer = file.buffer;
      let finalMimeType = file.mimetype;
      let finalExt = extname(file.originalname) || '';

      if (file.mimetype.startsWith('image/')) {
        mediaType = 'IMAGE';
        const optimized = await this.storageService.optimizeImageBuffer(
          file.buffer,
          file.mimetype,
          finalExt,
        );
        finalBuffer = optimized.buffer;
        finalMimeType = optimized.mimetype;
        finalExt = optimized.extension;
      } else if (file.mimetype.startsWith('video/')) {
        mediaType = 'VIDEO';
        const optimized = await this.storageService.optimizeVideoBuffer(
          file.buffer,
          file.mimetype,
          finalExt,
        );
        finalBuffer = optimized.buffer;
        finalMimeType = optimized.mimetype;
        finalExt = optimized.extension;
      }

      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const filename = `${uniqueSuffix}${finalExt}`;

      const publicUrl = await this.storageService.uploadBufferToR2(
        finalBuffer,
        finalMimeType,
        filename,
        `os-medias/${orderId}`,
      );

      uploadedMedias.push({ url: publicUrl, type: mediaType });
    }

    return this.serviceOrdersService.addMediasToTimeline(
      orderId,
      uploadedMedias,
      description,
      req.user.id,
    );
  }

  @Get(':id/details')
  getOrderDetails(@Param('id') id: string) {
    return this.serviceOrdersService.findOneWithItems(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.serviceOrdersService.findOneWithItems(id);
  }

  @RequirePermissions(PERMISSIONS.BUDGETS_MANAGE)
  @Post(':id/items')
  addOrderItem(
    @Param('id') id: string,
    @Body()
    body: {
      type: 'PART' | 'LABOR';
      description: string;
      quantity: number;
      costPrice?: number;
      unitPrice: number;
    },
  ) {
    return this.serviceOrdersService.addOrderItem(id, body);
  }

  @RequirePermissions(PERMISSIONS.BUDGETS_MANAGE)
  @Patch(':id/items/:itemId/remove')
  removeOrderItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.serviceOrdersService.removeOrderItem(id, itemId);
  }

  @RequirePermissions(PERMISSIONS.BUDGETS_MANAGE)
  @Patch(':id/budget')
  updateBudget(
    @Param('id') id: string,
    @Body() body: { discount: number; sendToApproval?: boolean; mechanicNotes?: string },
    @Request() req: any,
  ) {
    return this.serviceOrdersService.updateBudgetDiscount(
      id,
      body.discount,
      Boolean(body.sendToApproval),
      body.mechanicNotes || '',
      req.user.id,
    );
  }

  @Patch(':id/mechanic')
  updateMechanic(@Param('id') id: string, @Body('mechanicId') mechanicId: string) {
    return this.serviceOrdersService.updateMechanic(id, mechanicId || null);
  }

  @Patch(':id/commission')
  updateCommissionRate(@Param('id') id: string, @Body('rate') rate: number | null) {
    return this.serviceOrdersService.updateMechanicCommission(id, rate);
  }
}