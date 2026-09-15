import { z } from 'zod';

const id = z.string().min(1);

export const contactStatusSchema = z.enum(['OPEN', 'CLOSED']);
export type ContactStatus = z.infer<typeof contactStatusSchema>;

export const createContactThreadSchema = z.object({
  subject: z.string().min(3).max(200),
  message: z.string().min(2).max(4000),
  bookingId: id.optional(),
});
export type CreateContactThreadInput = z.infer<typeof createContactThreadSchema>;

export const sendContactMessageSchema = z.object({
  content: z.string().min(1).max(4000),
});
export type SendContactMessageInput = z.infer<typeof sendContactMessageSchema>;

export const updateContactStatusSchema = z.object({
  status: contactStatusSchema,
});
export type UpdateContactStatusInput = z.infer<typeof updateContactStatusSchema>;

export const contactThreadIdParamsSchema = z.object({
  threadId: id,
});
export type ContactThreadIdParams = z.infer<typeof contactThreadIdParamsSchema>;
