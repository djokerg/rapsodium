import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import type { RequestWithUser } from '../common/types.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  updatePreferencesSchema,
  type UpdatePreferencesDto,
} from './users.schemas.js';
import {
  UsersService,
  type UserProfile,
  type Preference,
} from './users.service.js';

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getProfile(@Req() req: RequestWithUser): Promise<UserProfile> {
    return this.usersService.getProfile(req.user.id);
  }

  @Put('preferences')
  updatePreferences(
    @Req() req: RequestWithUser,
    @Body(new ZodValidationPipe(updatePreferencesSchema))
    body: UpdatePreferencesDto,
  ): Promise<Preference[]> {
    return this.usersService.replacePreferences(req.user.id, body);
  }
}
