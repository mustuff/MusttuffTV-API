import { jest } from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { HealthController } from '../src/health.controller';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Health endpoint (isolated HTTP test)', () => {
  let app: INestApplication<App>;
  const queryRawMock = jest.fn().mockResolvedValue([{ '?column?': 1 }]);

  beforeAll(async () => {
    const moduleFixture: TestingModule =
      await Test.createTestingModule({
        controllers: [HealthController],
        providers: [
          {
            provide: PrismaService,
            useValue: {
              $queryRaw: queryRawMock,
            },
          },
        ],
      }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    queryRawMock.mockClear();
    queryRawMock.mockResolvedValue([{ '?column?': 1 }]);
  });

  it('returns API health status and checks the database connection', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        status: 'ok',
        service: 'MusttuffTV API',
        database: 'connected',
      }),
    );
    expect(response.body.timestamp).toEqual(expect.any(String));
    expect(queryRawMock).toHaveBeenCalledTimes(1);
  });

  it('returns an error if the database health check fails', async () => {
    queryRawMock.mockRejectedValueOnce(
      new Error('Simulated database failure'),
    );

    await request(app.getHttpServer())
      .get('/health')
      .expect(500);

    expect(queryRawMock).toHaveBeenCalledTimes(1);
  });
});
