import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { RecommendationsModule } from '../recommendations/recommendations.module.js';
import { AssistantController } from './assistant.controller.js';
import { AssistantService } from './assistant.service.js';
import { LlmService } from './llm.service.js';

@Module({
  // AuthModule -> AuthGuard; RecommendationsModule -> RecommenderClient (exported).
  imports: [AuthModule, RecommendationsModule],
  controllers: [AssistantController],
  providers: [AssistantService, LlmService],
})
export class AssistantModule {}
