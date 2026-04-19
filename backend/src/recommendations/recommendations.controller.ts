import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import type { RequestWithUser } from '../common/types.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  recommendationsQuerySchema,
  type RecommendationsQueryDto,
} from './recommendations.schemas.js';
import {
  RecommendationsService,
  type RecommendationResult,
} from './recommendations.service.js';

@Controller('recommendations')
@UseGuards(AuthGuard)
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) {}

  @Get()
  recommend(
    @Req() req: RequestWithUser,
    @Query(new ZodValidationPipe(recommendationsQuerySchema))
    query: RecommendationsQueryDto,
  ): Promise<RecommendationResult> {
    return this.recommendationsService.recommend({
      userId: req.user.id,
      algorithm: query.algorithm,
      limit: query.limit,
    });
  }
}
