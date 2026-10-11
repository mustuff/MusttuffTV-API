import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ArticlesService } from './articles.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ArticlesService', () => {
  let service: ArticlesService;
  let prisma: {
    article: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      article: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticlesService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<ArticlesService>(ArticlesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns published articles only', async () => {
    prisma.article.findMany.mockResolvedValue([]);

    await service.findAll();

    expect(prisma.article.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'PUBLISHED' },
      }),
    );
  });

  it('assigns the authenticated user as article author', async () => {
    const dto = {
      title: 'Sudan update',
      slug: 'sudan-update',
      content: 'News report',
    };

    prisma.article.create.mockResolvedValue({
      id: 'article-1',
      ...dto,
      authorId: 'user-1',
    });

    await service.create(dto, 'user-1');

    expect(prisma.article.create).toHaveBeenCalledWith({
      data: {
        ...dto,
        authorId: 'user-1',
      },
    });
  });

  it('prevents journalists from editing another author’s article', async () => {
    prisma.article.findUnique.mockResolvedValue({
      id: 'article-1',
      authorId: 'author-1',
    });

    await expect(
      service.update(
        'article-1',
        { title: 'Changed title' },
        'journalist-2',
        'JOURNALIST',
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(prisma.article.update).not.toHaveBeenCalled();
  });

  it('returns not found when editing a missing article', async () => {
    prisma.article.findUnique.mockResolvedValue(null);

    await expect(
      service.update(
        'missing-article',
        { title: 'Changed title' },
        'user-1',
        'EDITOR',
      ),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.article.update).not.toHaveBeenCalled();
  });

  it('publishes an existing article and records its publication time', async () => {
    prisma.article.findUnique.mockResolvedValue({
      id: 'article-1',
    });
    prisma.article.update.mockImplementation(
      async (args: { data: { status: string; publishedAt: Date } }) => ({
        id: 'article-1',
        ...args.data,
      }),
    );

    const result = await service.publish('article-1');

    expect(prisma.article.update).toHaveBeenCalledWith({
      where: { id: 'article-1' },
      data: {
        status: 'PUBLISHED',
        publishedAt: expect.any(Date),
      },
    });
    expect(result.status).toBe('PUBLISHED');
    expect(result.publishedAt).toBeInstanceOf(Date);
  });
});
