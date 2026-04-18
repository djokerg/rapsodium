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
