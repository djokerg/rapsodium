import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { SongSummary } from '@/types/songs';

const LIMIT = 50;

export const recommendationsQueryKey = ['recommendations', 'popularity'] as const;

interface RecommendationsResponse {
  algorithm: 'popularity';
  data: SongSummary[];
}

export function useRecommendations() {
  return useQuery({
    queryKey: recommendationsQueryKey,
    queryFn: () =>
      apiFetch<RecommendationsResponse>(
        `/recommendations?algorithm=popularity&limit=${LIMIT}`,
      ),
  });
}
