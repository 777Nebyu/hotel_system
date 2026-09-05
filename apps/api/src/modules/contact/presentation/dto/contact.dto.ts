import { createZodDto } from 'nestjs-zod';
import {
  contactStatusSchema,
  contactThreadIdParamsSchema,
  createContactThreadSchema,
  sendContactMessageSchema,
  updateContactStatusSchema,
} from '@repo/shared-types';

export class CreateContactThreadDto extends createZodDto(createContactThreadSchema) {}
export class SendContactMessageDto extends createZodDto(sendContactMessageSchema) {}
export class UpdateContactStatusDto extends createZodDto(updateContactStatusSchema) {}
export class ContactThreadIdParamsDto extends createZodDto(contactThreadIdParamsSchema) {}
