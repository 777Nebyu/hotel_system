"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.unflagUserSchema = exports.flagUserSchema = exports.sessionIdParamsSchema = exports.deactivateAccountSchema = exports.exportQuerySchema = exports.userStatusSchema = exports.forgotPasswordSchema = exports.updateProfileSchema = exports.resetPasswordSchema = exports.emailSchema = exports.refreshTokenSchema = exports.loginSchema = exports.registerSchema = exports.passwordSchema = exports.userRoleSchema = void 0;
const zod_1 = require("zod");
exports.userRoleSchema = zod_1.z.enum(['CUSTOMER', 'STAFF', 'MANAGER', 'ADMIN']);
// Passwords must be long enough and contain a number.  Keep this shared so
// registration, login/reset validation, and the API enforce the same rule.
exports.passwordSchema = zod_1.z
    .string()
    .min(8)
    .max(72)
    .regex(/\d/, 'Password must contain at least one number');
exports.registerSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: exports.passwordSchema,
    fullName: zod_1.z.string().min(2).max(100),
    phone: zod_1.z.string().min(6).max(32).optional(),
});
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: exports.passwordSchema,
});
exports.refreshTokenSchema = zod_1.z.object({
    refreshToken: zod_1.z.string().min(1),
});
exports.emailSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
});
exports.resetPasswordSchema = zod_1.z.object({
    token: zod_1.z.string().min(1),
    password: exports.passwordSchema,
});
exports.updateProfileSchema = zod_1.z
    .object({
    fullName: zod_1.z.string().min(2).max(100).optional(),
    phone: zod_1.z.string().min(6).max(32).nullable().optional(),
    currentPassword: exports.passwordSchema.optional(),
    newPassword: exports.passwordSchema.optional(),
})
    .refine((d) => !(d.newPassword && !d.currentPassword), {
    message: 'currentPassword is required when setting a newPassword',
    path: ['currentPassword'],
});
exports.forgotPasswordSchema = exports.emailSchema;
exports.userStatusSchema = zod_1.z.enum([
    'ACTIVE',
    'EMAIL_UNVERIFIED',
    'SUSPENDED',
    'DEACTIVATED',
    'DELETED',
]);
exports.exportQuerySchema = zod_1.z.object({
    type: zod_1.z.enum(['bookings', 'payments', 'reviews', 'users']),
    format: zod_1.z.enum(['csv', 'excel']).default('csv'),
    startDate: zod_1.z.string().optional(),
    endDate: zod_1.z.string().optional(),
    hotelId: zod_1.z.string().optional(),
});
exports.deactivateAccountSchema = zod_1.z.object({
    reason: zod_1.z.string().min(3).max(500).optional(),
});
exports.sessionIdParamsSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
});
exports.flagUserSchema = zod_1.z.object({
    reason: zod_1.z.string().min(3).max(500),
});
exports.unflagUserSchema = zod_1.z.object({
    reason: zod_1.z.string().min(3).max(500).optional(),
});
__exportStar(require("./catalog"), exports);
__exportStar(require("./booking"), exports);
__exportStar(require("./review"), exports);
__exportStar(require("./notification"), exports);
__exportStar(require("./coupon"), exports);
__exportStar(require("./admin"), exports);
__exportStar(require("./staff"), exports);
__exportStar(require("./contact"), exports);
