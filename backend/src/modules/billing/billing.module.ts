import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from '../../prisma/prisma.module';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { AsaasApiService } from './asaas-api.service';
import { SubscriptionLockInterceptor } from './subscription-lock.interceptor';

@Module({
  imports: [PrismaModule],
  controllers: [BillingController],
  providers: [
    BillingService,
    AsaasApiService,
    {
      // Interceptor global para bloquear acesso a rotas de gravação quando a assinatura do usuário estiver expirada
      provide: APP_INTERCEPTOR,
      useClass: SubscriptionLockInterceptor,
    },
  ],
  exports: [BillingService, AsaasApiService],
})
export class BillingModule {}