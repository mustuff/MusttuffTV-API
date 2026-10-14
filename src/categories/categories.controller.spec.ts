import { jest } from '@jest/globals';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { RolesGuard } from '../auth/roles/roles.guard';
import { ROLES_KEY } from '../auth/roles/roles.decorator';

describe('CategoriesController', () => {
  let controller: CategoriesController;
  let service: { create: jest.Mock; findAll: jest.Mock };

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue({
        id: 'test-category-id',
        name: 'Politics',
        slug: 'politics',
      }),
      findAll: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [
        {
          provide: CategoriesService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<CategoriesController>(CategoriesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should pass the category name and slug to the service', async () => {
    const body = { name: 'Politics', slug: 'politics' };

    await controller.create(body);

    expect(service.create).toHaveBeenCalledWith('Politics', 'politics');
  });

  it('should restrict category creation to ADMIN and EDITOR roles', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      CategoriesController.prototype.create,
    );

    expect(roles).toEqual(['ADMIN', 'EDITOR']);
  });
});

describe('Categories role authorization', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  function canCreateAs(role: string): boolean {
    const handler = CategoriesController.prototype.create;
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN', 'EDITOR']);

    const request = { user: { role } };
    const context = {
      getHandler: () => handler,
      getClass: () => CategoriesController,
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as any;

    return guard.canActivate(context);
  }

  it('allows ADMIN', () => {
    expect(canCreateAs('ADMIN')).toBe(true);
  });

  it('allows EDITOR', () => {
    expect(canCreateAs('EDITOR')).toBe(true);
  });

  it('rejects JOURNALIST', () => {
    expect(canCreateAs('JOURNALIST')).toBe(false);
  });

  it('rejects PRODUCER', () => {
    expect(canCreateAs('PRODUCER')).toBe(false);
  });

  it('rejects a missing user', () => {
    const reflector = new Reflector();
    const guard = new RolesGuard(reflector);
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN', 'EDITOR']);

    const context = {
      getHandler: () => CategoriesController.prototype.create,
      getClass: () => CategoriesController,
      switchToHttp: () => ({
        getRequest: () => ({ user: undefined }),
      }),
    } as any;

    expect(guard.canActivate(context)).toBe(false);
  });
});
