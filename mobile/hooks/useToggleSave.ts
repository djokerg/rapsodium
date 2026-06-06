import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { favoriteIdsQueryKey } from './useFavoriteIds';

interface ToggleSaveVars {
  songId: string;
  isSaved: boolean;
}

interface ToggleContext {
  previous: Set<string> | undefined;
}

export function useToggleSave() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, ToggleSaveVars, ToggleContext>({
    mutationFn: async ({ songId, isSaved }) => {
      if (isSaved) {
        await apiFetch(`/interactions?songId=${songId}&eventType=save`, {
          method: 'DELETE',
        });
      } else {
        await apiFetch('/interactions', {
          method: 'POST',
          body: { songId, eventType: 'save' },
        });
      }
    },
    onMutate: async ({ songId, isSaved }) => {
      await queryClient.cancelQueries({ queryKey: favoriteIdsQueryKey });
      const previous =
        queryClient.getQueryData<Set<string>>(favoriteIdsQueryKey);

      queryClient.setQueryData<Set<string>>(favoriteIdsQueryKey, (old) => {
        const next = new Set(old ?? []);
        if (isSaved) {
          next.delete(songId);
        } else {
          next.add(songId);
        }
        return next;
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(favoriteIdsQueryKey, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: favoriteIdsQueryKey });
      void queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
  });
}
