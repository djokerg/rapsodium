import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { PaginatedResult } from '@/types/songs';

interface FavoriteRow {
  id: string;
}

export const favoriteIdsQueryKey = ['favorite-ids'] as const;

export function useFavoriteIds() {
  return useQuery({
    queryKey: favoriteIdsQueryKey,
    queryFn: async (): Promise<Set<string>> => {
      const res = await apiFetch<PaginatedResult<FavoriteRow>>(
        '/interactions/favorites?page=1&limit=50',
      );
      return new Set(res.data.map((r) => r.id));
    },
  });
}
