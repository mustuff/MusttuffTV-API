import { jest } from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { LoginRateLimitGuard } from '../src/auth/login-rate-limit.guard';

describe('Login rate limiting (isolated)', () => {
  let app: INestApplication<App>;
  let loginMock: jest.Mock;

  beforeAll(async () => {
    loginMock = jest.fn().mockResolvedValue(null);

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
