import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { SongSummary } from '@/types/songs';

const LIMIT = 50;

export type Algorithm = 'popularity' | 'content' | 'collaborative';

// Backend only implements 'popularity' in Phase A; the other two are UI stubs.
const IMPLEMENTED: ReadonlySet<Algorithm> = new Set(['popularity']);

export const isAlgorithmImplemented = (algorithm: Algorithm): boolean =>
  IMPLEMENTED.has(algorithm);

interface RecommendationsResponse {
  algorithm: Algorithm;
  data: SongSummary[];
}

export const recommendationsQueryKey = (algorithm: Algorithm) =>
  ['recommendations', algorithm] as const;

export function useRecommendations(algorithm: Algorithm) {
  return useQuery({
    queryKey: recommendationsQueryKey(algorithm),
    queryFn: () =>
      apiFetch<RecommendationsResponse>(
        `/recommendations?algorithm=${algorithm}&limit=${LIMIT}`,
      ),
    enabled: isAlgorithmImplemented(algorithm),
  });
}
