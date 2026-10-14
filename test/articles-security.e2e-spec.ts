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

import { ArticlesController } from '../src/articles/articles.controller';
import { ArticlesService } from '../src/articles/articles.service';
import { JwtGuard } from '../src/auth/jwt/jwt.guard';
import { JwtStrategy } from '../src/auth/jwt/jwt.strategy';
import { RolesGuard } from '../src/auth/roles/roles.guard';
import { PrismaService } from '../src/prisma/prisma.service';

const TEST_SECRET =
  'isolated-only-test-secret-not-for-production-123456789';

type TestRole = 'ADMIN' | 'EDITOR' | 'JOURNALIST' | 'PRODUCER';

type TestUser = {
  id: string;
  email: string;
  role: TestRole;
  tokenVersion: number;
};

describe('Article authorization and protected fields (isolated)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let originalJwtSecret: string | undefined;

  let userLookupMock: ReturnType<typeof jest.fn>;
  let createMock: ReturnType<typeof jest.fn>;
  let updateMock: ReturnType<typeof jest.fn>;
  let publishMock: ReturnType<typeof jest.fn>;
  let findAllMock: ReturnType<typeof jest.fn>;

  const users: Record<TestRole, TestUser> = {
    ADMIN: {
      id: 'article-admin',
      email: 'admin@example.test',
      role: 'ADMIN',
      tokenVersion: 0,
    },
    EDITOR: {
      id: 'article-editor',
      email: 'editor@example.test',
      role: 'EDITOR',
      tokenVersion: 0,
    },
    JOURNALIST: {
      id: 'article-journalist',
      email: 'journalist@example.test',
      role: 'JOURNALIST',
      tokenVersion: 0,
    },
    PRODUCER: {
      id: 'article-producer',
      email: 'producer@example.test',
      role: 'PRODUCER',
      tokenVersion: 0,
    },
  };

  beforeAll(async () => {
    originalJwtSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = TEST_SECRET;

    userLookupMock = jest.fn(async (args: any) => {
      const user = Object.values(users).find(
        (candidate) => candidate.id === args.where.id,
      );
      return user ? { ...user } : null;
    });

    createMock = jest.fn().mockResolvedValue({
      id: 'isolated-article',
      title: 'Test report',
      slug: 'test-report',
      content: 'Isolated test content',
    });

    updateMock = jest.fn().mockResolvedValue({
      id: 'isolated-article',
      title: 'Updated test report',
    });

    publishMock = jest.fn().mockResolvedValue({
      id: 'isolated-article',
      status: 'PUBLISHED',
    });

    findAllMock = jest.fn().mockResolvedValue([]);

    const moduleFixture: TestingModule =
      await Test.createTestingModule({
        imports: [
          PassportModule.register({ defaultStrategy: 'jwt' }),
          JwtModule.register({
            secret: TEST_SECRET,
            signOptions: { expiresIn: '1h' },
          }),
        ],
        controllers: [ArticlesController],
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
            provide: ArticlesService,
            useValue: {
              create: createMock,
              update: updateMock,
              publish: publishMock,
              findAll: findAllMock,
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
    userLookupMock.mockClear();
    createMock.mockClear();
    updateMock.mockClear();
    publishMock.mockClear();
    findAllMock.mockClear();
  });

  async function makeToken(user: TestUser): Promise<string> {
    return jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
    });
  }

  const validArticle = {
    title: 'Test report',
    slug: 'test-report',
    content: 'Isolated test content',
  };

  function postArticle(token?: string, body = validArticle) {
    let req = request(app.getHttpServer())
      .post('/articles')
      .send(body);

    if (token) {
      req = req.set('Authorization', `Bearer ${token}`);
    }

    return req;
  }

  function publishArticle(id: string, token?: string) {
    let req = request(app.getHttpServer())
      .post(`/articles/${id}/publish`);

    if (token) {
      req = req.set('Authorization', `Bearer ${token}`);
    }

    return req;
  }

  it('rejects article creation without a bearer token', async () => {
    await postArticle().expect(401);
    expect(createMock).not.toHaveBeenCalled();
  });

  it.each(['ADMIN', 'EDITOR', 'JOURNALIST'] as const)(
    'allows %s to create an article',
    async (role) => {
      const user = users[role];
      const token = await makeToken(user);

      await postArticle(token).expect(201);

      expect(createMock).toHaveBeenCalledWith(
        validArticle,
        user.id,
      );
    },
  );

  it('rejects PRODUCER from creating articles', async () => {
    const token = await makeToken(users.PRODUCER);

    await postArticle(token).expect(403);

    expect(createMock).not.toHaveBeenCalled();
  });

  it('rejects attempts to set authorId during article creation', async () => {
    const token = await makeToken(users.JOURNALIST);

    await postArticle(token, {
      ...validArticle,
      authorId: users.ADMIN.id,
    }).expect(400);

    expect(createMock).not.toHaveBeenCalled();
  });

  it.each(['ADMIN', 'EDITOR'] as const)(
    'allows %s to publish an article',
    async (role) => {
      const token = await makeToken(users[role]);

      await publishArticle('isolated-article', token).expect(201);

      expect(publishMock).toHaveBeenCalledWith('isolated-article');
    },
  );

  it.each(['JOURNALIST', 'PRODUCER'] as const)(
    'rejects %s from publishing an article',
    async (role) => {
      const token = await makeToken(users[role]);

      await publishArticle('isolated-article', token).expect(403);

      expect(publishMock).not.toHaveBeenCalled();
    },
  );

  it('rejects publishing without a bearer token', async () => {
    await publishArticle('isolated-article').expect(401);
    expect(publishMock).not.toHaveBeenCalled();
  });

  it('rejects attempts to change status through the update endpoint', async () => {
    const token = await makeToken(users.EDITOR);

    await request(app.getHttpServer())
      .patch('/articles/isolated-article')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Updated title', status: 'PUBLISHED' })
      .expect(400);

    expect(updateMock).not.toHaveBeenCalled();
  });

  it('rejects attempts to change authorId through the update endpoint', async () => {
    const token = await makeToken(users.EDITOR);

    await request(app.getHttpServer())
      .patch('/articles/isolated-article')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Updated title',
        authorId: users.ADMIN.id,
      })
      .expect(400);

    expect(updateMock).not.toHaveBeenCalled();
  });
});
