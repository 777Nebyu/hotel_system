import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { IdentityService } from './application/identity.service';
import { IdentityController } from './presentation/identity.controller';
import { JwtStrategy } from './infrastructure/jwt.strategy';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [IdentityController],
  providers: [IdentityService, JwtStrategy],
  exports: [IdentityService],
})
export class IdentityModule {}
