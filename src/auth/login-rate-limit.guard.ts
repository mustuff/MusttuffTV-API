import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { RedisRateLimitService } from './redis-rate-limit.service';

const MAX_ATTEMPTS = 5;

@Injectable()
export class LoginRateLimitGuard implements CanActivate {
  constructor(
    private readonly rateLimitService: RedisRateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request>();

    const clientIp = request.ip || 'unknown';
    const attempts =
      await this.rateLimitService.incrementLoginAttempts(clientIp);

    if (attempts > MAX_ATTEMPTS) {
      throw new HttpException(
        'Too many login attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
