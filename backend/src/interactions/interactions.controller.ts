import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import {
  paginationSchema,
  type PaginationDto,
} from '../common/pagination.schema.js';
import type { RequestWithUser } from '../common/types.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import type { PaginatedResult } from '../songs/songs.types.js';
import {
  createInteractionSchema,
  deleteInteractionSchema,
  type CreateInteractionDto,
  type DeleteInteractionDto,
} from './interactions.schemas.js';
import { InteractionsService } from './interactions.service.js';
import type { Interaction, SongWithTimestamp } from './interactions.types.js';

@Controller('interactions')
@UseGuards(AuthGuard)
export class InteractionsController {
  constructor(private readonly interactionsService: InteractionsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Req() req: RequestWithUser,
    @Body(new ZodValidationPipe(createInteractionSchema))
    body: CreateInteractionDto,
  ): Promise<Interaction> {
    return this.interactionsService.create(req.user.id, body);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Req() req: RequestWithUser,
    @Query(new ZodValidationPipe(deleteInteractionSchema))
    query: DeleteInteractionDto,
  ): Promise<void> {
    await this.interactionsService.remove(
      req.user.id,
      query.songId,
      query.eventType,
    );
  }

  @Get('favorites')
  getFavorites(
    @Req() req: RequestWithUser,
    @Query(new ZodValidationPipe(paginationSchema)) query: PaginationDto,
  ): Promise<PaginatedResult<SongWithTimestamp>> {
    return this.interactionsService.getFavorites(
      req.user.id,
      query.page,
      query.limit,
    );
  }

  @Get('history')
  getHistory(
    @Req() req: RequestWithUser,
    @Query(new ZodValidationPipe(paginationSchema)) query: PaginationDto,
  ): Promise<PaginatedResult<SongWithTimestamp>> {
    return this.interactionsService.getHistory(
      req.user.id,
      query.page,
      query.limit,
    );
  }
}
