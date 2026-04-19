import { z } from 'zod';

export const ALGORITHMS = ['popularity'] as const;
export type Algorithm = (typeof ALGORITHMS)[number];

const positiveInt = z
  .string()
  .transform(Number)
  .pipe(z.number().int().positive());

export const recommendationsQuerySchema = z.object({
  algorithm: z.enum(ALGORITHMS).optional().default('popularity'),
  genre: z.string().min(1).max(100).optional(),
  limit: positiveInt
    .pipe(z.number().max(50, 'Limit must be at most 50'))
    .optional()
    .default(20),
});

export type RecommendationsQueryDto = z.infer<typeof recommendationsQuerySchema>;
