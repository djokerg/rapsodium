import { z } from 'zod';

const preferenceItemSchema = z.object({
  genre: z
    .string()
    .transform((v) => v.trim().toLowerCase())
    .pipe(
      z
        .string()
        .min(1, 'Genre must not be empty')
        .max(100, 'Genre must be at most 100 characters'),
    ),
  weight: z
    .number()
    .min(0, 'Weight must be at least 0')
    .max(1, 'Weight must be at most 1'),
});

export const updatePreferencesSchema = z
  .array(preferenceItemSchema)
  .min(1, 'At least one preference is required')
  .max(10, 'At most 10 preferences allowed')
  .refine(
    (items) => {
      const genres = items.map((i) => i.genre);
      return new Set(genres).size === genres.length;
    },
    { message: 'Duplicate genres are not allowed' },
  );

export type UpdatePreferencesDto = z.infer<typeof updatePreferencesSchema>;
