
import 'dotenv/config';
import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET!,
    });
  }

  async validate(payload: {
    sub: string;
    email: string;
    role: string;
    tokenVersion: number;
  }) {
    if (
      !payload.sub ||
      !Number.isInteger(payload.tokenVersion)
    ) {
      throw new UnauthorizedException('Invalid access token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        tokenVersion: true,
      },
    });

    if (
      !user ||
      user.tokenVersion !== payload.tokenVersion ||
      user.email !== payload.email ||
      user.role !== payload.role
    ) {
      throw new UnauthorizedException(
        'Access token is no longer valid. Please log in again.',
      );
    }

    return {
      userId: user.id,
      email: user.email,
      role: user.role,
    };
  }
}
