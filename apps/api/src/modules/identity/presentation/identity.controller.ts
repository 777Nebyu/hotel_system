import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import {
  deactivateAccountSchema,
  emailSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  resetPasswordSchema,
  sessionIdParamsSchema,
  updateProfileSchema,
} from '@repo/shared-types';
import type {
  DeactivateAccountInput,
  EmailInput,
  LoginInput,
  RefreshTokenInput,
  RegisterInput,
  ResetPasswordInput,
  SessionIdParams,
  UpdateProfileInput,
} from '@repo/shared-types';
import { Public } from '../../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { IdentityService } from '../application/identity.service';
import type { JwtUser } from '../infrastructure/jwt.strategy';

@ApiTags('identity')
@Controller('auth')
export class IdentityController {
  constructor(private readonly service: IdentityService) {}

  @Post('register')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  register(
    @Body(new ZodValidationPipe(registerSchema)) dto: RegisterInput,
    @Req() req: Request,
  ) {
    return this.service.register(dto, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
  }

  @Post('login')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  login(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginInput,
    @Req() req: Request,
  ) {
    return this.service.login(dto, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
  }

  @Post('refresh')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  refresh(
    @Body(new ZodValidationPipe(refreshTokenSchema)) dto: RefreshTokenInput,
    @Req() req: Request,
  ) {
    return this.service.refresh(dto.refreshToken, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
  }

  @Post('logout')
  @ApiBearerAuth()
  logout(@Req() req: { user: JwtUser }) {
    return this.service.logout(req.user.sub, req.user.sessionId);
  }

  @Get('sessions')
  @ApiBearerAuth()
  listSessions(@Req() req: { user: JwtUser }) {
    return this.service.listSessions(req.user.sub, req.user.sessionId);
  }

  @Delete('sessions/:id')
  @ApiBearerAuth()
  revokeSession(
    @Param(new ZodValidationPipe(sessionIdParamsSchema)) params: SessionIdParams,
    @Req() req: { user: JwtUser },
  ) {
    return this.service.revokeSession(req.user.sub, params.id);
  }

  @Delete('sessions')
  @ApiBearerAuth()
  revokeAllOtherSessions(@Req() req: { user: JwtUser }) {
    return this.service.revokeAllOtherSessions(
      req.user.sub,
      req.user.sessionId,
    );
  }

  @Post('forgot-password')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  forgot(@Body(new ZodValidationPipe(emailSchema)) dto: EmailInput) {
    return this.service.requestPasswordReset(dto.email);
  }

  @Post('reset-password')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  reset(
    @Body(new ZodValidationPipe(resetPasswordSchema)) dto: ResetPasswordInput,
  ) {
    return this.service.resetPassword(dto.token, dto.password);
  }

  @Post('verify-email/:token')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  verify(@Param('token') token: string) {
    return this.service.verifyEmail(token);
  }

  @Get('me')
  @ApiBearerAuth()
  me(@Req() req: { user: { sub: string } }) {
    return this.service.profile(req.user.sub);
  }

  @Patch('me')
  @ApiBearerAuth()
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  updateProfile(
    @Body(new ZodValidationPipe(updateProfileSchema)) dto: UpdateProfileInput,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.updateProfile(req.user.sub, dto);
  }

  @Post('me/photo')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @UseInterceptors(
    FileInterceptor('photo', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadPhoto(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.updateProfilePhoto(req.user.sub, file);
  }

  @Post('me/deactivate')
  @ApiBearerAuth()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  deactivate(
    @Body(new ZodValidationPipe(deactivateAccountSchema))
    dto: DeactivateAccountInput,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.deactivateAccount(req.user.sub, dto);
  }

  @Delete('me')
  @ApiBearerAuth()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  deleteAccount(@Req() req: { user: { sub: string } }) {
    return this.service.deleteAccount(req.user.sub);
  }
}
