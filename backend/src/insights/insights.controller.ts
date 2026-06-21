import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import type { RequestWithUser } from '../common/types.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  insightsQuerySchema,
  type InsightsQueryDto,
} from './insights.schemas.js';
import { InsightsService } from './insights.service.js';
import type { ListeningInsights } from './insights.types.js';

@Controller('insights')
@UseGuards(AuthGuard)
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  @Get()
  getInsights(
    @Req() req: RequestWithUser,
    @Query(new ZodValidationPipe(insightsQuerySchema)) query: InsightsQueryDto,
  ): Promise<ListeningInsights> {
    return this.insightsService.getInsights(req.user.id, query.days);
  }
}
