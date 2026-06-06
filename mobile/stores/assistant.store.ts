import { create } from 'zustand';
import {
  EMPTY_VIBE_PROFILE,
  type AssistantReply,
  type ChatMessage,
  type VibeProfile,
} from '@/types/assistant';
import type { SongSummary } from '@/types/songs';

/**
 * In-memory state for the assistant chat. Nothing is persisted — this is the
 * "vibe-at-a-time" source of truth (docs/assistant.md §9.3). `context` is sent
 * with every request and replaced by the server's returned context.
 */
interface AssistantState {
  context: VibeProfile;
  messages: ChatMessage[];
  songs: SongSummary[];
  addUserMessage: (text: string) => void;
  addAssistantMessage: (text: string) => void;
  applyReply: (reply: AssistantReply) => void;
  reset: () => void;
}

let messageCounter = 0;
const nextId = (): string => `m${++messageCounter}`;

export const useAssistantStore = create<AssistantState>((set) => ({
  context: EMPTY_VIBE_PROFILE,
  messages: [],
  songs: [],

  addUserMessage: (text) =>
    set((state) => ({
      messages: [...state.messages, { id: nextId(), role: 'user', text }],
    })),

  addAssistantMessage: (text) =>
    set((state) => ({
      messages: [...state.messages, { id: nextId(), role: 'assistant', text }],
    })),

  applyReply: (reply) =>
    set((state) => ({
      messages: [
        ...state.messages,
        { id: nextId(), role: 'assistant', text: reply.reply },
      ],
      context: reply.context,
      songs: reply.songs,
    })),

  reset: () => set({ context: EMPTY_VIBE_PROFILE, messages: [], songs: [] }),
}));
