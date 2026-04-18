import { useInfiniteQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { PaginatedResult, SongSummary } from '@/types/songs';

const PAGE_SIZE = 20;

export function useSongs() {
  return useInfiniteQuery({
    queryKey: ['songs'],
    queryFn: ({ pageParam }) =>
      apiFetch<PaginatedResult<SongSummary>>(
        `/songs?page=${pageParam}&limit=${PAGE_SIZE}`,
      ),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, limit, total } = lastPage.meta;
      return page * limit < total ? page + 1 : undefined;
    },
  });
}
