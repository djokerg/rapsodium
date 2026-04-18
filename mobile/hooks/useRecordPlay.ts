import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

interface RecordPlayVars {
  songId: string;
  listenedSeconds: number;
}

export function useRecordPlay() {
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
  });
}
