import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health.controller';
import { ArticlesModule } from './articles/articles.module';
import { UsersModule } from './users/users.module';
import { CountriesModule } from './countries/countries.module';
import { CategoriesModule } from './categories/categories.module';
import { MediaModule } from './media/media.module';
import { LiveStreamsModule } from './live-streams/live-streams.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    ArticlesModule,
    UsersModule,
    CountriesModule,
    CategoriesModule,
    MediaModule,
    LiveStreamsModule,
    AuthModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
