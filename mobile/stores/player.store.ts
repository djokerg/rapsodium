import { create } from 'zustand';

interface PlayerTrack {
  id: string;
  title: string;
  artist: string;
  previewUrl: string;
  coverUrl: string | null;
  durationSec: number;
}

interface PlayerState {
  currentTrack: PlayerTrack | null;
  isPlaying: boolean;
  positionSec: number;
  listenedSeconds: number;
  playTrack: (track: PlayerTrack) => void;
  togglePlay: () => void;
  updatePosition: (positionSec: number) => void;
  incrementListened: (seconds: number) => void;
  stop: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  currentTrack: null,
  isPlaying: false,
  positionSec: 0,
  listenedSeconds: 0,
  playTrack: (track) =>
    set({
      currentTrack: track,
      isPlaying: true,
      positionSec: 0,
      listenedSeconds: 0,
    }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  updatePosition: (positionSec) => set({ positionSec }),
  incrementListened: (seconds) =>
    set((state) => ({ listenedSeconds: state.listenedSeconds + seconds })),
  stop: () =>
    set({
      currentTrack: null,
      isPlaying: false,
      positionSec: 0,
      listenedSeconds: 0,
    }),
}));
