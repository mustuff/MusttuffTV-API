import {
  ExecutionContext,
  HttpException,
} from '@nestjs/common';
import { jest } from '@jest/globals';
import { LoginRateLimitGuard } from './login-rate-limit.guard';

describe('LoginRateLimitGuard', () => {
  let guard: LoginRateLimitGuard;
  let now: number;

  function contextFor(ip: string): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ ip }),
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    guard = new LoginRateLimitGuard();
    now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('allows five attempts and rejects the sixth with HTTP 429', () => {
    const context = contextFor('192.0.2.10');

    for (let attempt = 0; attempt < 5; attempt++) {
      expect(guard.canActivate(context)).toBe(true);
    }

    try {
      guard.canActivate(context);
      fail('Expected the sixth attempt to be rejected');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(429);
    }
  });

  it('tracks different client IPs independently', () => {
    const firstClient = contextFor('192.0.2.11');
    const secondClient = contextFor('192.0.2.12');

    for (let attempt = 0; attempt < 5; attempt++) {
      guard.canActivate(firstClient);
    }

    expect(() => guard.canActivate(firstClient)).toThrow(HttpException);
    expect(guard.canActivate(secondClient)).toBe(true);
  });

  it('allows attempts again after the 60-second window expires', () => {
    const context = contextFor('192.0.2.13');

    for (let attempt = 0; attempt < 5; attempt++) {
      guard.canActivate(context);
    }

    expect(() => guard.canActivate(context)).toThrow(HttpException);

    now += 60_001;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('keeps tracked clients within the configured bound', () => {
    const internalGuard = guard as unknown as {
      attempts: Map<string, number[]>;
    };

    for (let client = 0; client < 10_001; client++) {
      guard.canActivate(contextFor(`192.0.2.${client}`));
    }

    expect(internalGuard.attempts.size).toBeLessThanOrEqual(10_000);
  });
});
