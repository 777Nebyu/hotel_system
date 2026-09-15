import { Module } from '@nestjs/common';
import { ContactService } from './application/contact.service';
import { ContactController } from './presentation/contact.controller';
import { AuditService } from '../../common/services/audit.service';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [ContactController],
  providers: [ContactService, AuditService],
  exports: [ContactService],
})
export class ContactModule {}
