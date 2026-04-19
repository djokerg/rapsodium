import { useInfiniteQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { PaginatedResult, SongWithTimestamp } from '@/types/songs';

const PAGE_SIZE = 20;

export const favoritesFeedQueryKey = ['favorites'] as const;

export function useFavoritesFeed() {
  return useInfiniteQuery({
    queryKey: favoritesFeedQueryKey,
    queryFn: ({ pageParam }) =>
      apiFetch<PaginatedResult<SongWithTimestamp>>(
        `/interactions/favorites?page=${pageParam}&limit=${PAGE_SIZE}`,
      ),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, limit, total } = lastPage.meta;
      return page * limit < total ? page + 1 : undefined;
    },
  });
}
