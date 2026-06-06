import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';
import type { RequestWithUser } from '../common/types.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  assistantMessageSchema,
  type AssistantMessageDto,
} from './assistant.schemas.js';
import { AssistantService, type AssistantReply } from './assistant.service.js';

@Controller('assistant')
@UseGuards(AuthGuard)
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Post('message')
  message(
    @Req() req: RequestWithUser,
    @Body(new ZodValidationPipe(assistantMessageSchema))
    body: AssistantMessageDto,
  ): Promise<AssistantReply> {
    return this.assistantService.handleMessage({
      userId: req.user.id,
      text: body.text,
      context: body.context,
      limit: body.limit,
    });
  }
}
