import { jest } from '@jest/globals';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { ArticlesController } from './articles.controller';
import { ArticlesService } from './articles.service';
import { RolesGuard } from '../auth/roles/roles.guard';
import { ROLES_KEY } from '../auth/roles/roles.decorator';

describe('ArticlesController', () => {
  let controller: ArticlesController;
  let service: {
    create: jest.Mock;
    update: jest.Mock;
    publish: jest.Mock;
    findAll: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue({ id: 'article-1' }),
      update: jest.fn().mockResolvedValue({ id: 'article-1' }),
      publish: jest.fn().mockResolvedValue({ id: 'article-1' }),
      findAll: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ArticlesController],
      providers: [
        {
          provide: ArticlesService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<ArticlesController>(ArticlesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('passes the authenticated user ID when creating an article', async () => {
    const request = {
      user: {
        userId: 'journalist-1',
        email: 'journalist@example.com',
        role: 'JOURNALIST',
      },
    };
    const dto = {
      title: 'Sudan update',
      slug: 'sudan-update',
      content: 'News report',
    };

    await controller.create(request, dto);

    expect(service.create).toHaveBeenCalledWith(dto, 'journalist-1');
  });

  it('passes the article ID, DTO, user ID, and role when updating', async () => {
    const request = {
      user: {
        userId: 'journalist-1',
        email: 'journalist@example.com',
        role: 'JOURNALIST',
      },
    };
    const dto = { title: 'Updated report' };

    await controller.update('article-1', request, dto);

    expect(service.update).toHaveBeenCalledWith(
      'article-1',
      dto,
      'journalist-1',
      'JOURNALIST',
    );
  });

  it('restricts article creation to ADMIN, EDITOR, and JOURNALIST', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      ArticlesController.prototype.create,
    );

    expect(roles).toEqual(['ADMIN', 'EDITOR', 'JOURNALIST']);
  });

  it('restricts article publication to ADMIN and EDITOR', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      ArticlesController.prototype.publish,
    );

    expect(roles).toEqual(['ADMIN', 'EDITOR']);
  });

  it('allows the publish handler to call the service with the article ID', async () => {
    await controller.publish('article-1');

    expect(service.publish).toHaveBeenCalledWith('article-1');
  });
});

describe('Articles publish role authorization', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
    jest.spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['ADMIN', 'EDITOR']);
  });

  function canPublishAs(role: string | undefined): boolean {
    const context = {
      getHandler: () => ArticlesController.prototype.publish,
      getClass: () => ArticlesController,
      switchToHttp: () => ({
        getRequest: () => ({
          user: role ? { role } : undefined,
        }),
      }),
    } as any;

    return guard.canActivate(context);
  }

  it('allows ADMIN', () => {
    expect(canPublishAs('ADMIN')).toBe(true);
  });

  it('allows EDITOR', () => {
    expect(canPublishAs('EDITOR')).toBe(true);
  });

  it('rejects JOURNALIST', () => {
    expect(canPublishAs('JOURNALIST')).toBe(false);
  });

  it('rejects PRODUCER', () => {
    expect(canPublishAs('PRODUCER')).toBe(false);
  });

  it('rejects a missing user', () => {
    expect(canPublishAs(undefined)).toBe(false);
  });
});
