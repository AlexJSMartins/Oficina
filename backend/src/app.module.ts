import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { CustomersModule } from './modules/customers/customers.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { ServiceOrdersModule } from './modules/service-orders/service-orders.module';
import { PortalModule } from './modules/portal/portal.module';
import { FinancialModule } from './modules/financial/financial.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { StorageModule } from './modules/storage/storage.module';

import { PortalController } from './modules/portal/portal.controller';
import { SettingsModule } from './modules/settings/settings.module';
import { CatalogModule } from './modules/catalog/catalog.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    CustomersModule,
    VehiclesModule,
    ServiceOrdersModule,
    PortalModule,
    FinancialModule,
    NotificationsModule,
    StorageModule,
    SettingsModule,
    CatalogModule,
  ],
  controllers: [AppController, PortalController],
  providers: [AppService],
})
export class AppModule {}
