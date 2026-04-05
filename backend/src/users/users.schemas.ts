import { z } from 'zod';

const genreSchema = z
  .string()
  .transform((v) => v.trim().toLowerCase())
  .pipe(
    z
      .string()
      .min(1, 'Genre must not be empty')
      .max(100, 'Genre must be at most 100 characters'),
  );

export const updatePreferencesSchema = z
  .array(genreSchema)
  .min(1, 'At least one genre is required')
  .max(10, 'At most 10 genres allowed')
  .refine(
    (genres) => new Set(genres).size === genres.length,
    { message: 'Duplicate genres are not allowed' },
  );

export type UpdatePreferencesDto = z.infer<typeof updatePreferencesSchema>;
