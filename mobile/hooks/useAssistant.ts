import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { AssistantReply, VibeProfile } from '@/types/assistant';

interface SendVars {
  text: string;
  context: VibeProfile;
}

/**
 * Sends a chat message + the current VibeProfile to the stateless assistant
 * endpoint and returns the reply, updated context, and fresh recommendations.
 */
export function useAssistant() {
  return useMutation<AssistantReply, Error, SendVars>({
    mutationFn: ({ text, context }) =>
      apiFetch<AssistantReply>('/assistant/message', {
        method: 'POST',
        body: { text, context },
      }),
  });
}
