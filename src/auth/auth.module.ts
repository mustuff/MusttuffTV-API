import 'dotenv/config';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt/jwt.strategy';
import { LoginRateLimitGuard } from './login-rate-limit.guard';
import { RedisRateLimitService } from './redis-rate-limit.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: {
        expiresIn: '1d',
      },
    }),
  ],
  providers: [AuthService, JwtStrategy, LoginRateLimitGuard, RedisRateLimitService],
  controllers: [AuthController],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
