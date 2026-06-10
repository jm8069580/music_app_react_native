import { create } from 'zustand';
import type { Song } from '../../types/song';
import { playerService } from './playerService';

type PlayerState = {
  queue: Song[];
  currentIndex: number | null;
  currentSong: Song | null;
  isPlaying: boolean;
  positionMillis: number;
  durationMillis: number;
  loading: boolean;
  loadQueue: (songs: Song[], startIndex?: number) => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  togglePlay: () => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  seekTo: (ms: number) => Promise<void>;
  setLoading: (v: boolean) => void;
};

export const usePlayerStore = create<PlayerState>((set, get) => {
  // subscribe to playerService status updates
  playerService.setStatusUpdateCallback((status) => {
    set({
      isPlaying: !!status.isPlaying,
      positionMillis: status.positionMillis ?? 0,
      durationMillis: status.durationMillis ?? 0,
    });

    if (status.didJustFinish) {
      // auto-advance
      get().next();
    }
  });

  return {
    queue: [],
    currentIndex: null,
    currentSong: null,
    isPlaying: false,
    positionMillis: 0,
    durationMillis: 0,
    loading: false,

    setLoading: (v: any) => set({ loading: v }),

    loadQueue: async (songs: Song[], startIndex = 0) => {
      set({ loading: true });
      await playerService.loadQueue(songs, startIndex, (idx) => {
        set({
          queue: songs,
          currentIndex: idx,
          currentSong: songs[idx] ?? null,
          loading: false,
        });
      });
    },

    play: async () => {
      await playerService.play();
    },

    pause: async () => {
      await playerService.pause();
    },

    togglePlay: async () => {
      const { isPlaying } = get();
      if (isPlaying) await get().pause();
      else await get().play();
    },

    next: async () => {
      const { queue, currentIndex } = get();
      if (queue.length === 0) return;
      const nextIndex = (currentIndex ?? 0) + 1;
      if (nextIndex < queue.length) {
        set({ loading: true });
        await playerService.loadTrackAtIndex(queue, nextIndex, (idx) => {
          set({ currentIndex: idx, currentSong: queue[idx], loading: false });
        });
      } else {
        // reached end: pause
        await get().pause();
      }
    },

    previous: async () => {
      const { queue, currentIndex } = get();
      if (queue.length === 0) return;
      const prevIndex = Math.max(0, (currentIndex ?? 0) - 1);
      set({ loading: true });
      await playerService.loadTrackAtIndex(queue, prevIndex, (idx) => {
        set({ currentIndex: idx, currentSong: queue[idx], loading: false });
      });
    },

    seekTo: async (ms: number) => {
      await playerService.seekTo(ms);
    },
  };
});