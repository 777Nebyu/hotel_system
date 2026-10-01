import { z } from 'zod';
export declare const EMAIL_REGEX: RegExp;
export declare const emailFieldSchema: z.ZodEffects<z.ZodString, string, string>;
export type EmailInput = z.infer<typeof emailFieldSchema>;
//# sourceMappingURL=email.d.ts.map