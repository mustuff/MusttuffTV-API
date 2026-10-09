
import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      omit: {
        passwordHash: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async create(createUserDto: CreateUserDto) {
    const passwordHash = await bcrypt.hash(
      createUserDto.password,
      12,
    );

    const user = await this.prisma.user.create({
      data: {
        email: createUserDto.email,
        passwordHash,
        name: createUserDto.name,
        role: createUserDto.role,
      },
      omit: {
        passwordHash: true,
      },
    });

    return user;
  }
}
