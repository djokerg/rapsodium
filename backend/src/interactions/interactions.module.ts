import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { InteractionsController } from './interactions.controller.js';
import { InteractionsService } from './interactions.service.js';

@Module({
  imports: [AuthModule],
  controllers: [InteractionsController],
  providers: [InteractionsService],
})
export class InteractionsModule {}
