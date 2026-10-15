import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 5;
const MAX_TRACKED_CLIENTS = 10_000;

@Injectable()
export class LoginRateLimitGuard implements CanActivate {
  private readonly attempts = new Map<string, number[]>();

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request>();

    const clientIp = request.ip || 'unknown';
    const now = Date.now();
    const cutoff = now - WINDOW_MS;

    const recentAttempts = (
      this.attempts.get(clientIp) ?? []
    ).filter((timestamp) => timestamp > cutoff);

    if (recentAttempts.length >= MAX_ATTEMPTS) {
      this.attempts.delete(clientIp);
      this.attempts.set(clientIp, recentAttempts);

      throw new HttpException(
        'Too many login attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Refresh this client's position in the LRU order.
    this.attempts.delete(clientIp);

    // Bound memory usage when new client IPs appear.
    if (
      !this.attempts.has(clientIp) &&
      this.attempts.size >= MAX_TRACKED_CLIENTS
    ) {
      const oldestClient = this.attempts.keys().next().value;

      if (oldestClient !== undefined) {
        this.attempts.delete(oldestClient);
      }
    }

    recentAttempts.push(now);
    this.attempts.set(clientIp, recentAttempts);

    return true;
  }
}
