import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { DevNotaApiService } from './devnota-api.service';
import { FiscalService } from './fiscal.service';
import { FiscalController } from './fiscal.controller';
import { XmlParserService } from './xml-parser.service';
import { InboundInvoiceService } from './inbound-invoice.service';
import { ReturnInvoiceService } from './return-invoice.service';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [PrismaModule, BillingModule],
  controllers: [FiscalController],
  providers: [
    DevNotaApiService,
    FiscalService,
    XmlParserService,
    InboundInvoiceService,
    ReturnInvoiceService,
  ],
  exports: [
    FiscalService,
    DevNotaApiService,
    XmlParserService,
    InboundInvoiceService,
    ReturnInvoiceService,
  ],
})
export class FiscalModule {}