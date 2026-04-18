import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { SongDetail } from '@/types/songs';

export function useSong(id: string) {
  return useQuery({
    queryKey: ['song', id],
    queryFn: () => apiFetch<SongDetail>(`/songs/${id}`),
    enabled: Boolean(id),
  });
}
