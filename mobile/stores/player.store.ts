import { create } from 'zustand';

interface PlayerState {
  queue: string[];
  setQueue: (ids: string[]) => void;
  clearQueue: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  queue: [],
  setQueue: (ids) => set({ queue: ids }),
  clearQueue: () => set({ queue: [] }),
}));
