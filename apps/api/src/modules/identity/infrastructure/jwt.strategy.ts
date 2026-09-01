import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Role } from '../../../generated/prisma/client';

/**
 * The shape of `req.user` injected by the JwtAuthGuard.
 *
 * - `hotelId` is present only for users with role === 'MANAGER'.
 *   Every downstream resource-scope guard that needs to verify hotel ownership
 *   reads this field from the token instead of making an extra DB query.
 * - `family` is the token-family ID used for refresh-token compromise detection.
 */
export interface JwtUser {
  sub: string;
  email: string;
  role: Role;
  /** Present only for MANAGER role — the hotel this manager is responsible for. */
  hotelId?: string;
  /** Refresh-token family ID for session management. */
  family: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('jwt.accessSecret'),
    });
  }

  validate(payload: JwtUser): JwtUser {
    return payload;
  }
}
