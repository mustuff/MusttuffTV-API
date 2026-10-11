import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ArticlesService } from './articles.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { JwtGuard } from '../auth/jwt/jwt.guard';
import { RolesGuard } from '../auth/roles/roles.guard';
import { Roles } from '../auth/roles/roles.decorator';

interface AuthenticatedRequest {
  user: {
    userId: string;
    email: string;
    role: string;
  };
}

@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Get()
  async findAll() {
    return this.articlesService.findAll();
  }

  @Post()
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('ADMIN', 'EDITOR', 'JOURNALIST')
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() createArticleDto: CreateArticleDto,
  ) {
    return this.articlesService.create(
      createArticleDto,
      request.user.userId,
    );
  }

  @Patch(':id')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('ADMIN', 'EDITOR', 'JOURNALIST')
  async update(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Body() updateArticleDto: UpdateArticleDto,
  ) {
    return this.articlesService.update(
      id,
      updateArticleDto,
      request.user.userId,
      request.user.role,
    );
  }

  @Post(':id/publish')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('ADMIN', 'EDITOR')
  async publish(@Param('id') id: string) {
    return this.articlesService.publish(id);
  }
}
