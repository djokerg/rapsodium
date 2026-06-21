import { z } from 'zod';

const positiveInt = z
  .string()
  .transform(Number)
  .pipe(z.number().int().positive());

/** Smallest window we'll compute a taste shift over (needs two comparable halves). */
export const MIN_INSIGHTS_DAYS = 7;
export const MAX_INSIGHTS_DAYS = 365;
export const DEFAULT_INSIGHTS_DAYS = 90;

export const insightsQuerySchema = z.object({
  days: positiveInt
    .pipe(
      z
        .number()
        .min(
          MIN_INSIGHTS_DAYS,
          `Window must be at least ${MIN_INSIGHTS_DAYS} days`,
        )
        .max(
          MAX_INSIGHTS_DAYS,
          `Window must be at most ${MAX_INSIGHTS_DAYS} days`,
        ),
    )
    .optional()
    .default(DEFAULT_INSIGHTS_DAYS),
});

export type InsightsQueryDto = z.infer<typeof insightsQuerySchema>;
