import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { StorageModule } from '../../common/storage/storage.module';
import { InvoiceService } from './application/invoice.service';
import { InvoiceListener } from './infrastructure/invoice.listener';

@Module({
  imports: [EmailModule, StorageModule],
  providers: [InvoiceService, InvoiceListener],
  exports: [InvoiceService],
})
export class InvoiceModule {}
