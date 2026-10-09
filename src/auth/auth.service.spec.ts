import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

jest.unstable_mockModule('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const bcrypt = await import('bcrypt');
const { AuthService } = await import('./auth.service');

describe('AuthService', () => {
  let service: AuthService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const mockJwtService = {
    signAsync: jest.fn(),
  };

  const adminUser = {
    id: 'admin-123',
    email: 'admin@mustufftv.com',
    name: 'Administrator',
    role: 'ADMIN',
    passwordHash: 'old-hash',
    tokenVersion: 0,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('changePassword', () => {
    it('should reject when the user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.changePassword('missing-user', 'old-pass', 'new-pass-123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject a user who is not an administrator', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...adminUser,
        role: 'JOURNALIST',
      });

      await expect(
        service.changePassword('journalist-123', 'old-pass', 'new-pass-123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject an incorrect current password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(adminUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword('admin-123', 'wrong-pass', 'new-pass-123'),
      ).rejects.toThrow(
        new UnauthorizedException('Current password is incorrect'),
      );

      expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
    });

    it('should reject reusing the current password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(adminUser);
      (bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      await expect(
        service.changePassword('admin-123', 'old-pass', 'old-pass'),
      ).rejects.toThrow(
        new BadRequestException(
          'New password must be different from the current password',
        ),
      );

      expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
    });

    it('should hash the new password and increment tokenVersion', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(adminUser);
      (bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');
      mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });

      await expect(
        service.changePassword('admin-123', 'old-pass', 'new-pass-123'),
      ).resolves.toEqual({
        message: 'Password changed successfully. Please log in again.',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('new-pass-123', 12);
      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'admin-123',
          tokenVersion: 0,
        },
        data: {
          passwordHash: 'new-hash',
          tokenVersion: { increment: 1 },
        },
      });
    });

    it('should reject if the database update affects no user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(adminUser);
      (bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hash');
      mockPrisma.user.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.changePassword('admin-123', 'old-pass', 'new-pass-123'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
