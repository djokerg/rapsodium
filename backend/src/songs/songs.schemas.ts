import { z } from 'zod';

const positiveInt = z
  .string()
  .transform(Number)
  .pipe(z.number().int().positive());

export const paginationSchema = z.object({
  page: positiveInt.optional().default(1),
  limit: positiveInt
    .pipe(z.number().max(50, 'Limit must be at most 50'))
    .optional()
    .default(20),
});

export type PaginationDto = z.infer<typeof paginationSchema>;

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
