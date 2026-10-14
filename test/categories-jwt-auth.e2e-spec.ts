import { jest } from '@jest/globals';
import {
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { CategoriesController } from '../src/categories/categories.controller';
import { CategoriesService } from '../src/categories/categories.service';
import { JwtGuard } from '../src/auth/jwt/jwt.guard';
import { JwtStrategy } from '../src/auth/jwt/jwt.strategy';
import { RolesGuard } from '../src/auth/roles/roles.guard';
import { PrismaService } from '../src/prisma/prisma.service';

const TEST_SECRET =
  'isolated-only-test-secret-not-for-production-123456789';

type TestUser = {
  id: string;
  email: string;
  role: string;
  tokenVersion: number;
};

describe('Category authorization with real JWT strategy (isolated)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let createMock: ReturnType<typeof jest.fn>;
  let userLookupMock: ReturnType<typeof jest.fn>;
  let originalJwtSecret: string | undefined;

  const users: Record<string, TestUser> = {
    'user-admin': {
      id: 'user-admin',
      email: 'admin@example.test',
      role: 'ADMIN',
      tokenVersion: 0,
    },
    'user-editor': {
      id: 'user-editor',
      email: 'editor@example.test',
      role: 'EDITOR',
      tokenVersion: 0,
    },
    'user-journalist': {
      id: 'user-journalist',
      email: 'journalist@example.test',
      role: 'JOURNALIST',
      tokenVersion: 0,
    },
    'user-producer': {
      id: 'user-producer',
      email: 'producer@example.test',
      role: 'PRODUCER',
      tokenVersion: 0,
    },
  };

  beforeAll(async () => {
    originalJwtSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = TEST_SECRET;

    userLookupMock = jest.fn(async (args: any) => {
      const user = users[args.where.id];
      return user ? { ...user } : null;
    });

    createMock = jest.fn().mockResolvedValue({
      id: 'isolated-category',
      name: 'Test Politics',
      slug: 'test-politics',
    });

    const moduleFixture: TestingModule =
      await Test.createTestingModule({
        imports: [
          PassportModule.register({ defaultStrategy: 'jwt' }),
          JwtModule.register({
            secret: TEST_SECRET,
            signOptions: { expiresIn: '1h' },
          }),
        ],
        controllers: [CategoriesController],
        providers: [
          JwtStrategy,
          JwtGuard,
          RolesGuard,
          {
            provide: PrismaService,
            useValue: {
              user: { findUnique: userLookupMock },
            },
          },
          {
            provide: CategoriesService,
            useValue: {
              create: createMock,
              findAll: jest.fn().mockResolvedValue([]),
            },
          },
        ],
      }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    jwtService = moduleFixture.get(JwtService);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }

    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }
  });

  beforeEach(() => {
    createMock.mockClear();
    userLookupMock.mockClear();
  });

  async function makeToken(
    user: TestUser,
    overrides: Record<string, unknown> = {},
    options: Record<string, unknown> = {},
  ): Promise<string> {
    return jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        tokenVersion: user.tokenVersion,
        ...overrides,
      },
      options as any,
    );
  }

  function postCategory(token?: string) {
    let req = request(app.getHttpServer())
      .post('/categories')
      .send({
        name: 'Test Politics',
        slug: 'test-politics',
      });

    if (token) {
      req = req.set('Authorization', `Bearer ${token}`);
    }

    return req;
  }

  it('rejects a missing bearer token', async () => {
    await postCategory().expect(401);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('rejects a token signed with the wrong secret', async () => {
    const token = await new JwtService({
      secret: 'different-isolated-secret-not-the-same',
    }).signAsync({
      sub: users['user-admin'].id,
      email: users['user-admin'].email,
      role: users['user-admin'].role,
      tokenVersion: users['user-admin'].tokenVersion,
    });

    await postCategory(token).expect(401);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('allows ADMIN through the real JWT and role guards', async () => {
    const token = await makeToken(users['user-admin']);

    await postCategory(token).expect(201);

    expect(userLookupMock).toHaveBeenCalled();
    expect(createMock).toHaveBeenCalledWith(
      'Test Politics',
      'test-politics',
    );
  });

  it('allows EDITOR through the real JWT and role guards', async () => {
    const token = await makeToken(users['user-editor']);

    await postCategory(token).expect(201);

    expect(userLookupMock).toHaveBeenCalled();
    expect(createMock).toHaveBeenCalledWith(
      'Test Politics',
      'test-politics',
    );
  });

  it('rejects JOURNALIST without calling category creation', async () => {
    const token = await makeToken(users['user-journalist']);

    await postCategory(token).expect(403);

    expect(userLookupMock).toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
  });

  it('rejects PRODUCER without calling category creation', async () => {
    const token = await makeToken(users['user-producer']);

    await postCategory(token).expect(403);

    expect(userLookupMock).toHaveBeenCalled();
    expect(createMock).not.toHaveBeenCalled();
  });

  it('rejects a user who no longer exists', async () => {
    const missingUser: TestUser = {
      id: 'deleted-user',
      email: 'deleted@example.test',
      role: 'ADMIN',
      tokenVersion: 0,
    };
    const token = await makeToken(missingUser);

    await postCategory(token).expect(401);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('rejects a stale tokenVersion', async () => {
    const token = await makeToken(users['user-admin'], {
      tokenVersion: 99,
    });

    await postCategory(token).expect(401);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('rejects a token whose role differs from the current user role', async () => {
    const token = await makeToken(users['user-admin'], {
      role: 'EDITOR',
    });

    await postCategory(token).expect(401);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('rejects a token whose email differs from the current user email', async () => {
    const token = await makeToken(users['user-admin'], {
      email: 'changed@example.test',
    });

    await postCategory(token).expect(401);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('rejects an expired token', async () => {
    const token = await makeToken(
      users['user-admin'],
      {},
      { expiresIn: '-1s' },
    );

    await postCategory(token).expect(401);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('rejects invalid category slugs even for ADMIN', async () => {
    const token = await makeToken(users['user-admin']);

    await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Politics',
        slug: 'Invalid Slug!',
      })
      .expect(400);

    expect(createMock).not.toHaveBeenCalled();
  });
});
