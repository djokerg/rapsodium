import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { RecommendationsController } from './recommendations.controller.js';
import { RecommendationsService } from './recommendations.service.js';
import { RecommenderClient } from './recommender.client.js';

@Module({
  imports: [AuthModule],
  controllers: [RecommendationsController],
  providers: [RecommendationsService, RecommenderClient],
})
export class RecommendationsModule {}
