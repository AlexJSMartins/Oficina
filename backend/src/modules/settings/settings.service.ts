import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getSettings() {
    let settings = await this.prisma.workshopSettings.findUnique({
      where: { id: 'default' },
    });

    if (!settings) {
      settings = await this.prisma.workshopSettings.create({
        data: { id: 'default' },
      });
    }

    return settings;
  }

  async updateSettings(dto: {
    name?: string;
    slogan?: string;
    document?: string;
    phone?: string;
    address?: string;
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    warrantyTerms?: string;
  }) {
    return this.prisma.workshopSettings.upsert({
      where: { id: 'default' },
      update: {
        name: dto.name,
        slogan: dto.slogan,
        document: dto.document,
        phone: dto.phone,
        address: dto.address,
        logoUrl: dto.logoUrl,
        primaryColor: dto.primaryColor,
        secondaryColor: dto.secondaryColor,
        warrantyTerms: dto.warrantyTerms,
      },
      create: {
        id: 'default',
        name: dto.name || 'Oficina Pro',
        slogan: dto.slogan,
        document: dto.document,
        phone: dto.phone,
        address: dto.address,
        logoUrl: dto.logoUrl,
        primaryColor: dto.primaryColor || '#0f172a',
        secondaryColor: dto.secondaryColor || '#16a34a',
        warrantyTerms: dto.warrantyTerms,
      },
    });
  }
}