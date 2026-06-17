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
  ready: boolean;
  init: () => Promise<void>;
  loadQueue: (songs: Song[], startIndex?: number) => Promise<void>;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  seekTo: (ms: number) => void;
  setLoading: (v: boolean) => void;
};

export const usePlayerStore = create<PlayerState>((set, get) => ({
  queue: [],
  currentIndex: null,
  currentSong: null,
  isPlaying: false,
  positionMillis: 0,
  durationMillis: 0,
  loading: false,
  ready: false,

  setLoading: (v) => set({ loading: v }),

  /**
   * Inicializa el player nativo y conecta los eventos al store.
   * Llamar una vez al arrancar la app (en foreground).
   */
  init: async () => {
    if (get().ready) return;
    await playerService.setup({
      onIsPlayingChange: (playing) => set({ isPlaying: playing }),
      onProgress: (positionMillis, durationMillis) =>
        set({ positionMillis, durationMillis }),
      onTrackChange: (index) => {
        const { queue } = get();
        set({
          currentIndex: index,
          currentSong: queue[index] ?? null,
          loading: false,
        });
      },
    });
    set({ ready: true });
  },

  loadQueue: async (songs, startIndex = 0) => {
    set({ loading: true, queue: songs });
    await playerService.loadQueue(songs, startIndex);
    set({
      currentIndex: startIndex,
      currentSong: songs[startIndex] ?? null,
      loading: false,
    });
  },

  play: () => playerService.play(),

  pause: () => playerService.pause(),

  togglePlay: () => {
    if (get().isPlaying) playerService.pause();
    else playerService.play();
  },

  // La navegación de cola y el auto-avance al terminar son nativos:
  // el índice/canción se actualizan vía el evento MediaItemTransition.
  next: () => playerService.skipToNext(),

  previous: () => playerService.skipToPrevious(),

  seekTo: (ms) => playerService.seekToMs(ms),
}));
