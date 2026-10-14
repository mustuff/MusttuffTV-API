import { jest } from '@jest/globals';
import {
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { CategoriesController } from '../src/categories/categories.controller';
import { CategoriesService } from '../src/categories/categories.service';
import { JwtGuard } from '../src/auth/jwt/jwt.guard';

describe('Category authorization (isolated HTTP test)', () => {
  let app: INestApplication<App>;
  let createMock: ReturnType<typeof jest.fn>;

  const testAuthGuard = {
    canActivate: (context: any) => {
      const req = context.switchToHttp().getRequest();
      const authorization = req.headers.authorization;

      if (!authorization || !authorization.startsWith('Bearer ')) {
        throw new UnauthorizedException();
      }

      const token = authorization.slice('Bearer '.length);
      const roles: Record<string, string> = {
        'test-admin': 'ADMIN',
        'test-editor': 'EDITOR',
        'test-journalist': 'JOURNALIST',
        'test-producer': 'PRODUCER',
      };

      const role = roles[token];

      if (!role) {
        throw new UnauthorizedException();
      }

      req.user = {
        userId: `isolated-${role.toLowerCase()}`,
        email: `${role.toLowerCase()}@example.test`,
        role,
      };

      return true;
    },
  };

  beforeAll(async () => {
    createMock = jest.fn().mockResolvedValue({
      id: 'isolated-test-category',
      name: 'Test Politics',
      slug: 'test-politics',
    });

    const moduleFixture: TestingModule =
      await Test.createTestingModule({
        controllers: [CategoriesController],
        providers: [
          {
            provide: CategoriesService,
            useValue: {
              create: createMock,
              findAll: jest.fn().mockResolvedValue([]),
            },
          },
        ],
      })
        .overrideGuard(JwtGuard)
        .useValue(testAuthGuard)
        .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    createMock.mockClear();
  });

  it('rejects requests without a bearer token', async () => {
    await request(app.getHttpServer())
      .post('/categories')
      .send({ name: 'Test Politics', slug: 'test-politics' })
      .expect(401);

    expect(createMock).not.toHaveBeenCalled();
  });

  it('allows ADMIN without writing to a database', async () => {
    await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', 'Bearer test-admin')
      .send({ name: 'Test Politics', slug: 'test-politics' })
      .expect(201);

    expect(createMock).toHaveBeenCalledWith(
      'Test Politics',
      'test-politics',
    );
  });

  it('allows EDITOR without writing to a database', async () => {
    await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', 'Bearer test-editor')
      .send({ name: 'Test Politics', slug: 'test-politics' })
      .expect(201);

    expect(createMock).toHaveBeenCalledWith(
      'Test Politics',
      'test-politics',
    );
  });

  it('rejects JOURNALIST', async () => {
    await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', 'Bearer test-journalist')
      .send({ name: 'Test Politics', slug: 'test-politics' })
      .expect(403);

    expect(createMock).not.toHaveBeenCalled();
  });

  it('rejects PRODUCER', async () => {
    await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', 'Bearer test-producer')
      .send({ name: 'Test Politics', slug: 'test-politics' })
      .expect(403);

    expect(createMock).not.toHaveBeenCalled();
  });

  it('rejects an invalid slug for an authorized role', async () => {
    await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', 'Bearer test-admin')
      .send({ name: 'Test Politics', slug: 'Invalid Slug!' })
      .expect(400);

    expect(createMock).not.toHaveBeenCalled();
  });
});
