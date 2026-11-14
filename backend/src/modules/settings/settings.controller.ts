import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard, PermissionsGuard } from '../auth/permissions.guard';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // Rota pública para carregar logo e cores no Portal do Cliente, Login e PDFs
  @Get()
  getSettings() {
    return this.settingsService.getSettings();
  }

  // Rota protegida para salvar o perfil da oficina
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Patch()
  updateSettings(@Body() body: any) {
    return this.settingsService.updateSettings(body);
  }
}