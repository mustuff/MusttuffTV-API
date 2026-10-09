import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LiveStreamsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.liveStream.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findLive() {
    return this.prisma.liveStream.findMany({
      where: {
        isLive: true,
      },
      orderBy: {
        startedAt: 'desc',
      },
    });
  }

  async create(title: string, description?: string, streamUrl?: string) {
    return this.prisma.liveStream.create({
      data: {
        title,
        description,
        streamUrl,
      },
    });
  }

  async start(id: string) {
    return this.prisma.liveStream.update({
      where: {
        id,
      },
      data: {
        isLive: true,
        startedAt: new Date(),
        endedAt: null,
      },
    });
  }

  async end(id: string) {
    return this.prisma.liveStream.update({
      where: {
        id,
      },
      data: {
        isLive: false,
        endedAt: new Date(),
      },
    });
  }
}
