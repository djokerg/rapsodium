import {
  type PipeTransform,
  BadRequestException,
  type ArgumentMetadata,
} from '@nestjs/common';
import { type ZodSchema, type ZodError } from 'zod';

export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown, _metadata: ArgumentMetadata): T {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      const errors = this.formatErrors(result.error);
      throw new BadRequestException({ message: 'Validation failed', errors });
    }

    return result.data;
  }

  private formatErrors(error: ZodError): Record<string, string[]> {
    const formatted: Record<string, string[]> = {};
    for (const issue of error.issues) {
      const path = issue.path.join('.') || '_root';
      formatted[path] ??= [];
      formatted[path].push(issue.message);
    }
    return formatted;
  }
}
