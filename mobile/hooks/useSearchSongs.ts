import { useInfiniteQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { PaginatedResult, SongSummary } from '@/types/songs';

const PAGE_SIZE = 20;

export function useSearchSongs(query: string) {
  const trimmed = query.trim();

  return useInfiniteQuery({
    queryKey: ['search', trimmed],
    queryFn: ({ pageParam }) =>
      apiFetch<PaginatedResult<SongSummary>>(
        `/songs/search?q=${encodeURIComponent(trimmed)}&page=${pageParam}&limit=${PAGE_SIZE}`,
      ),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, limit, total } = lastPage.meta;
      return page * limit < total ? page + 1 : undefined;
    },
    enabled: trimmed.length > 0,
  });
}
