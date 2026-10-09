
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async findUserByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async validateUser(email: string, password: string) {
    const user = await this.findUserByEmail(email);

    if (!user) {
      return null;
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tokenVersion: user.tokenVersion,
    };
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);

    if (!user) {
      return null;
    }

    const { tokenVersion, ...publicUser } = user;

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
      tokenVersion,
    });

    return {
      accessToken,
      user: publicUser,
    };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.role !== 'ADMIN') {
      throw new UnauthorizedException(
        'Administrator authentication required',
      );
    }

    const currentPasswordMatches = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );

    if (!currentPasswordMatches) {
      throw new UnauthorizedException(
        'Current password is incorrect',
      );
    }

    const samePassword = await bcrypt.compare(
      newPassword,
      user.passwordHash,
    );

    if (samePassword) {
      throw new BadRequestException(
        'New password must be different from the current password',
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    const result = await this.prisma.user.updateMany({
      where: {
        id: user.id,
        tokenVersion: user.tokenVersion,
      },
      data: {
        passwordHash,
        tokenVersion: { increment: 1 },
      },
    });

    if (result.count !== 1) {
      throw new UnauthorizedException(
        'Password change could not be completed; please log in again',
      );
    }

    return {
      message:
        'Password changed successfully. Please log in again.',
    };
  }
}
