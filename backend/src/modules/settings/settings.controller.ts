import { Controller, Get, Patch, Body, UseGuards, Request, Query } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard, PermissionsGuard } from '../auth/permissions.guard';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // Se vier logado (Painel Admin), pega a oficina do usuário; se for público, aceita ?workshopId=
  @UseGuards(JwtAuthGuard)
  @Get()
  getSettings(@Request() req: any, @Query('workshopId') workshopId?: string) {
    const target = req.user?.workshopId || req.user?.id || workshopId;
    return this.settingsService.getSettings(target);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Patch()
  updateSettings(@Request() req: any, @Body() body: any) {
    const target = req.user?.workshopId || req.user?.id;
    return this.settingsService.updateSettings(body, target);
  }
}