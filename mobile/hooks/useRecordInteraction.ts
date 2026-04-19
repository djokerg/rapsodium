import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { historyQueryKey } from './useHistory';

type EventType = 'play' | 'skip';

interface RecordInteractionVars {
  songId: string;
  eventType: EventType;
  listenedSeconds: number;
}

export function useRecordInteraction() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, RecordInteractionVars>({
    mutationFn: async ({ songId, eventType, listenedSeconds }) => {
      await apiFetch('/interactions', {
        method: 'POST',
        body: {
          songId,
          eventType,
          listenedSeconds: Math.max(0, Math.floor(listenedSeconds)),
        },
      });
    },
    onSuccess: (_data, vars) => {
      if (vars.eventType === 'play') {
        void queryClient.invalidateQueries({ queryKey: historyQueryKey });
      }
    },
  });
}
