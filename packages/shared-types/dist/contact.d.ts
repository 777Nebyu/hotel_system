import { z } from 'zod';
export declare const contactStatusSchema: z.ZodEnum<["OPEN", "CLOSED"]>;
export type ContactStatus = z.infer<typeof contactStatusSchema>;
export declare const createContactThreadSchema: z.ZodObject<{
    subject: z.ZodString;
    message: z.ZodString;
    bookingId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    message: string;
    subject: string;
    bookingId?: string | undefined;
}, {
    message: string;
    subject: string;
    bookingId?: string | undefined;
}>;
export type CreateContactThreadInput = z.infer<typeof createContactThreadSchema>;
export declare const sendContactMessageSchema: z.ZodObject<{
    content: z.ZodString;
}, "strip", z.ZodTypeAny, {
    content: string;
}, {
    content: string;
}>;
export type SendContactMessageInput = z.infer<typeof sendContactMessageSchema>;
export declare const updateContactStatusSchema: z.ZodObject<{
    status: z.ZodEnum<["OPEN", "CLOSED"]>;
}, "strip", z.ZodTypeAny, {
    status: "OPEN" | "CLOSED";
}, {
    status: "OPEN" | "CLOSED";
}>;
export type UpdateContactStatusInput = z.infer<typeof updateContactStatusSchema>;
export declare const contactThreadIdParamsSchema: z.ZodObject<{
    threadId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    threadId: string;
}, {
    threadId: string;
}>;
export type ContactThreadIdParams = z.infer<typeof contactThreadIdParamsSchema>;
//# sourceMappingURL=contact.d.ts.map