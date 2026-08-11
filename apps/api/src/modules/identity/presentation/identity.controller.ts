import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  emailSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  resetPasswordSchema,
} from '@repo/shared-types';
import type {
  EmailInput,
  LoginInput,
  RefreshTokenInput,
  RegisterInput,
  ResetPasswordInput,
} from '@repo/shared-types';
import { Public } from '../../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { IdentityService } from '../application/identity.service';

@ApiTags('identity')
@Controller('auth')
export class IdentityController {
  constructor(private readonly service: IdentityService) {}

  @Post('register')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  register(@Body(new ZodValidationPipe(registerSchema)) dto: RegisterInput) {
    return this.service.register(dto);
  }

  @Post('login')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  login(@Body(new ZodValidationPipe(loginSchema)) dto: LoginInput) {
    return this.service.login(dto);
  }

  @Post('refresh')
  @Public()
  refresh(
    @Body(new ZodValidationPipe(refreshTokenSchema)) dto: RefreshTokenInput,
  ) {
    return this.service.refresh(dto.refreshToken);
  }

  @Post('forgot-password')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  forgot(@Body(new ZodValidationPipe(emailSchema)) dto: EmailInput) {
    return this.service.requestPasswordReset(dto.email);
  }

  @Post('reset-password')
  @Public()
  reset(
    @Body(new ZodValidationPipe(resetPasswordSchema)) dto: ResetPasswordInput,
  ) {
    return this.service.resetPassword(dto.token, dto.password);
  }

  @Post('verify-email/:token')
  @Public()
  verify(@Param('token') token: string) {
    return this.service.verifyEmail(token);
  }

  @Get('me')
  @ApiBearerAuth()
  me(@Req() req: { user: { sub: string } }) {
    return this.service.profile(req.user.sub);
  }
}
