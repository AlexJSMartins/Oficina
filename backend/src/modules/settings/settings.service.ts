import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  private async resolveWorkshopId(userOrWorkshopId?: string): Promise<string> {
    if (userOrWorkshopId) {
      const byWorkshop = await this.prisma.workshopSettings.findUnique({
        where: { id: userOrWorkshopId },
        select: { id: true },
      });
      if (byWorkshop) return byWorkshop.id;

      const byUser = await this.prisma.user.findUnique({
        where: { id: userOrWorkshopId },
        select: { workshopId: true },
      });
      if (byUser?.workshopId) return byUser.workshopId;
    }

    const first = await this.prisma.workshopSettings.findFirst({ select: { id: true } });
    if (first) return first.id;

    const created = await this.prisma.workshopSettings.create({
      data: { name: 'Minha Oficina' },
    });
    return created.id;
  }

  async getSettings(userOrWorkshopId?: string) {
    const workshopId = await this.resolveWorkshopId(userOrWorkshopId);
    return this.prisma.workshopSettings.findUnique({
      where: { id: workshopId },
    });
  }

  async updateSettings(
    dto: {
      name?: string;
      slogan?: string;
      document?: string;
      phone?: string;
      address?: string;
      logoUrl?: string;
      primaryColor?: string;
      secondaryColor?: string;
      warrantyTerms?: string;
    },
    userOrWorkshopId?: string,
  ) {
    const workshopId = await this.resolveWorkshopId(userOrWorkshopId);

    return this.prisma.workshopSettings.update({
      where: { id: workshopId },
      data: {
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
    });
  }
}