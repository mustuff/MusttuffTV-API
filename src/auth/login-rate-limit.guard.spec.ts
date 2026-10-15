import {
  ExecutionContext,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { jest } from '@jest/globals';
import { LoginRateLimitGuard } from './login-rate-limit.guard';
import { RedisRateLimitService } from './redis-rate-limit.service';

describe('LoginRateLimitGuard', () => {
  let guard: LoginRateLimitGuard;
  let counts: Map<string, number>;
  let incrementLoginAttempts: ReturnType<typeof jest.fn>;

  function contextFor(ip: string): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ ip }),
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    counts = new Map<string, number>();

    incrementLoginAttempts = jest.fn(async (ip: string) => {
      const nextCount = (counts.get(ip) ?? 0) + 1;
      counts.set(ip, nextCount);
      return nextCount;
    });

    guard = new LoginRateLimitGuard({
      incrementLoginAttempts,
    } as unknown as RedisRateLimitService);
  });

  it('allows five attempts and rejects the sixth with HTTP 429', async () => {
    const context = contextFor('192.0.2.10');

    for (let attempt = 0; attempt < 5; attempt++) {
      await expect(guard.canActivate(context)).resolves.toBe(true);
    }

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 429,
    });
    expect(incrementLoginAttempts).toHaveBeenCalledTimes(6);
  });

  it('tracks different client IPs independently', async () => {
    const firstClient = contextFor('192.0.2.11');
    const secondClient = contextFor('192.0.2.12');

    for (let attempt = 0; attempt < 5; attempt++) {
      await guard.canActivate(firstClient);
    }

    await expect(guard.canActivate(firstClient)).rejects.toBeInstanceOf(
      HttpException,
    );

    await expect(
      guard.canActivate(secondClient),
    ).resolves.toBe(true);
  });

  it('fails closed when Redis protection is unavailable', async () => {
    incrementLoginAttempts.mockRejectedValueOnce(
      new ServiceUnavailableException(
        'Login protection is temporarily unavailable.',
      ),
    );

    await expect(
      guard.canActivate(contextFor('192.0.2.13')),
    ).rejects.toMatchObject({
      status: 503,
    });
  });

  it('uses the request IP rather than a forwarded header', async () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          ip: '192.0.2.14',
          headers: {
            'x-forwarded-for': '203.0.113.99',
          },
        }),
      }),
    } as unknown as ExecutionContext;

    await guard.canActivate(context);

    expect(incrementLoginAttempts).toHaveBeenCalledWith('192.0.2.14');
  });
});
