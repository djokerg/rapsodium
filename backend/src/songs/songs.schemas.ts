import { z } from 'zod';
import {
  paginationSchema,
  type PaginationDto,
} from '../common/pagination.schema.js';

export { paginationSchema, type PaginationDto };

export const searchSchema = paginationSchema.extend({
  q: z
    .string()
    .trim()
    .min(1, 'Search query must not be empty')
    .max(200, 'Search query too long'),
});

export type SearchDto = z.infer<typeof searchSchema>;

export const songIdSchema = z.object({
  id: z.string().uuid('Invalid song ID'),
});

export type SongIdDto = z.infer<typeof songIdSchema>;
