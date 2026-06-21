import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { ListeningInsights } from '@/types/insights';

export type InsightsRangeOption = 30 | 90 | 365;

export const insightsQueryKey = (days: InsightsRangeOption) =>
  ['insights', days] as const;

export function useInsights(days: InsightsRangeOption) {
  return useQuery({
    queryKey: insightsQueryKey(days),
    queryFn: () => apiFetch<ListeningInsights>(`/insights?days=${days}`),
  });
}
