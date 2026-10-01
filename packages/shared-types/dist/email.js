"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailFieldSchema = exports.EMAIL_REGEX = void 0;
const zod_1 = require("zod");
// Strict RFC 5322 compliant email regex with valid TLD requirement (>= 2 alpha chars)
exports.EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
// Single source of truth for every user-supplied email address in the product.
// Kept in its own module (no internal imports) so `index.ts` and feature modules
// such as `booking.ts` can both use it without forming an import cycle.
exports.emailFieldSchema = zod_1.z
    .string()
    .trim()
    .min(1, 'Email address is required')
    .max(254, 'Email address must not exceed 254 characters')
    .email('Invalid email address format')
    .refine((val) => {
    if (!exports.EMAIL_REGEX.test(val))
        return false;
    const atIndex = val.indexOf('@');
    if (atIndex <= 0)
        return false;
    const localPart = val.slice(0, atIndex);
    const domainPart = val.slice(atIndex + 1);
    if (localPart.startsWith('.') || localPart.endsWith('.'))
        return false;
    if (localPart.includes('..') || domainPart.includes('..'))
        return false;
    return true;
}, {
    message: 'Please enter a valid email address with a proper domain (e.g. name@example.com)',
});
