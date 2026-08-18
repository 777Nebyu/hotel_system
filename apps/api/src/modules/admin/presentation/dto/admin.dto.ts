import { createZodDto } from 'nestjs-zod';
import {
  adminBookingsQuerySchema,
  adminHotelsQuerySchema,
  adminPaymentsQuerySchema,
  adminReviewsQuerySchema,
  adminUsersQuerySchema,
  auditLogsQuerySchema,
  reassignManagerSchema,
  reportParamsSchema,
  reportQuerySchema,
  setUserActiveSchema,
  settingParamsSchema,
  updateHotelStatusSchema,
  updateUserRoleSchema,
  upsertSettingSchema,
  userIdParamsSchema,
} from '@repo/shared-types';

export class AdminUsersQueryDto extends createZodDto(adminUsersQuerySchema) {}
export class UpdateUserRoleDto extends createZodDto(updateUserRoleSchema) {}
export class SetUserActiveDto extends createZodDto(setUserActiveSchema) {}
export class UserIdParamsDto extends createZodDto(userIdParamsSchema) {}

export class AdminHotelsQueryDto extends createZodDto(adminHotelsQuerySchema) {}
export class UpdateHotelStatusDto extends createZodDto(
  updateHotelStatusSchema,
) {}
export class ReassignManagerDto extends createZodDto(reassignManagerSchema) {}

export class AdminBookingsQueryDto extends createZodDto(
  adminBookingsQuerySchema,
) {}
export class AdminPaymentsQueryDto extends createZodDto(
  adminPaymentsQuerySchema,
) {}

export class AdminReviewsQueryDto extends createZodDto(
  adminReviewsQuerySchema,
) {}

export class SettingParamsDto extends createZodDto(settingParamsSchema) {}
export class UpsertSettingDto extends createZodDto(upsertSettingSchema) {}

export class AuditLogsQueryDto extends createZodDto(auditLogsQuerySchema) {}

export class ReportParamsDto extends createZodDto(reportParamsSchema) {}
export class ReportQueryDto extends createZodDto(reportQuerySchema) {}
