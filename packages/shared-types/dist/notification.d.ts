import { z } from 'zod';
export declare const notificationChannelSchema: z.ZodEnum<["EMAIL", "PUSH", "IN_APP"]>;
export type NotificationChannel = z.infer<typeof notificationChannelSchema>;
export declare const notificationIdParamsSchema: z.ZodObject<{
    notificationId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    notificationId: string;
}, {
    notificationId: string;
}>;
export type NotificationIdParams = z.infer<typeof notificationIdParamsSchema>;
export declare const notificationsQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    pageSize: number;
}, {
    page?: number | undefined;
    pageSize?: number | undefined;
}>;
export type NotificationsQuery = z.infer<typeof notificationsQuerySchema>;
export declare const updateNotificationPreferenceSchema: z.ZodObject<{
    type: z.ZodString;
    channel: z.ZodDefault<z.ZodEnum<["EMAIL", "PUSH", "IN_APP"]>>;
    enabled: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    type: string;
    channel: "EMAIL" | "PUSH" | "IN_APP";
    enabled: boolean;
}, {
    type: string;
    enabled: boolean;
    channel?: "EMAIL" | "PUSH" | "IN_APP" | undefined;
}>;
export type UpdateNotificationPreferenceInput = z.infer<typeof updateNotificationPreferenceSchema>;
export declare const registerPushTokenSchema: z.ZodObject<{
    token: z.ZodString;
}, "strip", z.ZodTypeAny, {
    token: string;
}, {
    token: string;
}>;
export type RegisterPushTokenInput = z.infer<typeof registerPushTokenSchema>;
//# sourceMappingURL=notification.d.ts.map