import { jest } from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { LoginRateLimitGuard } from '../src/auth/login-rate-limit.guard';
import { RedisRateLimitService } from '../src/auth/redis-rate-limit.service';

describe('Login rate limiting (isolated)', () => {
  let app: INestApplication<App>;
  let loginMock: jest.Mock;
  let attemptCounts: Map<string, number>;

  beforeAll(async () => {
    loginMock = jest.fn().mockResolvedValue(null);
    attemptCounts = new Map<string, number>();

    const moduleFixture: TestingModule =
      await Test.createTestingModule({
        controllers: [AuthController],
        providers: [
          {
            provide: AuthService,
            useValue: {
              login: loginMock,
            },
          },
          LoginRateLimitGuard,
          {
            provide: RedisRateLimitService,
            useValue: {
              incrementLoginAttempts: jest.fn(async (ip: string) => {
                const count = (attemptCounts.get(ip) ?? 0) + 1;
                attemptCounts.set(ip, count);
                return count;
              }),
            },
          },
        ],
      }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    loginMock.mockClear();
    attemptCounts.clear();
  });

  it('allows five login attempts and rejects the sixth with 429', async () => {
    for (let attempt = 1; attempt <= 5; attempt++) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'editor@example.test',
          password: 'incorrect-test-password',
        })
        .expect(401);
    }

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'editor@example.test',
        password: 'incorrect-test-password',
      })
      .expect(429);

    expect(loginMock).toHaveBeenCalledTimes(5);
  });
});
