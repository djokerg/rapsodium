import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  paginationSchema,
  searchSchema,
  songIdSchema,
  type PaginationDto,
  type SearchDto,
  type SongIdDto,
} from './songs.schemas.js';
import { SongsService } from './songs.service.js';
import type {
  SongSummary,
  SongDetail,
  PaginatedResult,
} from './songs.types.js';

@Controller('songs')
@UseGuards(AuthGuard)
export class SongsController {
  constructor(private readonly songsService: SongsService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(paginationSchema)) query: PaginationDto,
  ): Promise<PaginatedResult<SongSummary>> {
    return this.songsService.list(query.page, query.limit);
  }

  @Get('search')
  search(
    @Query(new ZodValidationPipe(searchSchema)) query: SearchDto,
  ): Promise<PaginatedResult<SongSummary>> {
    return this.songsService.search(query.q, query.page, query.limit);
  }

  @Get(':id')
  getById(
    @Param(new ZodValidationPipe(songIdSchema)) params: SongIdDto,
  ): Promise<SongDetail> {
    return this.songsService.getById(params.id);
  }
}
