import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import Joi from 'joi';
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
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        JWT_SECRET: Joi.string().min(32).required(),
        PORT: Joi.number().port().default(3000),
      }),
    }),
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
