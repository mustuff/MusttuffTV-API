
import {
  Body,
  Controller,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtGuard } from './jwt/jwt.guard';
import { RolesGuard } from './roles/roles.guard';
import { Roles } from './roles/roles.decorator';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
    role: string;
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(
    @Body()
    body: {
      email: string;
      password: string;
    },
  ) {
    const result = await this.authService.login(
      body.email,
      body.password,
    );

    if (!result) {
      throw new UnauthorizedException(
        'Invalid email or password',
      );
    }

    return {
      message: 'Login successful',
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Post('change-password')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('ADMIN')
  async changePassword(
    @Req() request: AuthenticatedRequest,
    @Body() body: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      request.user.userId,
      body.currentPassword,
      body.newPassword,
    );
  }
}
