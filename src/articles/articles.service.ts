import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

@Injectable()
export class ArticlesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.article.findMany({
      where: {
        status: 'PUBLISHED',
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
        country: true,
        category: true,
        media: true,
      },
      orderBy: {
        publishedAt: 'desc',
      },
    });
  }

  async create(
    createArticleDto: CreateArticleDto,
    authorId: string,
  ) {
    return this.prisma.article.create({
      data: {
        ...createArticleDto,
        authorId,
      },
    });
  }

  async update(
    id: string,
    updateArticleDto: UpdateArticleDto,
    userId: string,
    role: string,
  ) {
    const article = await this.prisma.article.findUnique({
      where: { id },
      select: {
        id: true,
        authorId: true,
      },
    });

    if (!article) {
      throw new NotFoundException('Article not found');
    }

    if (role === 'JOURNALIST' && article.authorId !== userId) {
      throw new ForbiddenException(
        'You can only edit your own articles',
      );
    }

    return this.prisma.article.update({
      where: { id },
      data: updateArticleDto,
    });
  }

  async publish(id: string) {
    const article = await this.prisma.article.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!article) {
      throw new NotFoundException('Article not found');
    }

    return this.prisma.article.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
  }
}
