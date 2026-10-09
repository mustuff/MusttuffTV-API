
import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { RolesGuard } from '../auth/roles/roles.guard';

@Module({
  providers: [UsersService, RolesGuard],
  controllers: [UsersController],
})
export class UsersModule {}
