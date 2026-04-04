import { Body, Controller, Post, UsePipes } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import {
  registerSchema,
  loginSchema,
  type RegisterDto,
  type LoginDto,
} from './auth.schemas.js';
import type { AuthResponse } from './auth.types.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UsePipes(new ZodValidationPipe(registerSchema))
  register(@Body() body: RegisterDto): Promise<AuthResponse> {
    return this.authService.register(body);
  }

  @Post('login')
  @UsePipes(new ZodValidationPipe(loginSchema))
  login(@Body() body: LoginDto): Promise<AuthResponse> {
    return this.authService.login(body);
  }
}
