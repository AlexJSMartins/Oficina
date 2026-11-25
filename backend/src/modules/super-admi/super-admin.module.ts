import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../../prisma/prisma.module';
import { SuperAdminService } from './super-admin.service';
import { SysAuthController, SuperAdminController } from './super-admin.controller';
import { SuperAdminGuard } from './super-admin.guard';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'oficina_super_secret_key_2026',
      signOptions: { expiresIn: '12h' },
    }),
  ],
  controllers: [SysAuthController, SuperAdminController],
  providers: [SuperAdminService, SuperAdminGuard],
  exports: [SuperAdminService],
})
export class SuperAdminModule {}