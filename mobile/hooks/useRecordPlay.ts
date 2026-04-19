import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { historyQueryKey } from './useHistory';

interface RecordPlayVars {
  songId: string;
  listenedSeconds: number;
}

export function useRecordPlay() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, RecordPlayVars>({
    mutationFn: async ({ songId, listenedSeconds }) => {
      await apiFetch('/interactions', {
        method: 'POST',
        body: {
          songId,
          eventType: 'play',
          listenedSeconds: Math.max(0, Math.floor(listenedSeconds)),
        },
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: historyQueryKey });
    },
  });
}
