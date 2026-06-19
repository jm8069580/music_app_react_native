import { create } from 'zustand';
import type { Song } from '../../types/song';
import { playerService } from './playerService';
import { getSongsByIds } from '../db/songsRepository';
import { savePlayerState, loadPlayerState } from '../db/playerStateRepository';

// Throttle para no escribir en SQLite en cada tick de progreso (~cada segundo).
let lastPositionSave = 0;
const POSITION_SAVE_INTERVAL_MS = 5000;

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
  /** Restaura la cola guardada (en pausa). Llamar tras init() al arrancar. */
  restore: () => Promise<void>;
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
      onProgress: (positionMillis, durationMillis) => {
        set({ positionMillis, durationMillis });
        // Persistir posición con throttle mientras suena.
        const now = Date.now();
        if (now - lastPositionSave > POSITION_SAVE_INTERVAL_MS) {
          lastPositionSave = now;
          persistState(positionMillis);
        }
      },
      onTrackChange: (index) => {
        const { queue } = get();
        set({
          currentIndex: index,
          currentSong: queue[index] ?? null,
          loading: false,
        });
        // Nueva pista → guardar índice y posición a 0.
        persistState(0);
      },
    });
    set({ ready: true });
  },

  restore: async () => {
    const saved = await loadPlayerState();
    if (!saved || saved.queueIds.length === 0) return;
    const songs = await getSongsByIds(saved.queueIds);
    if (songs.length === 0) return;
    let idx = songs.findIndex((s) => s.id === saved.currentSongId);
    if (idx < 0) idx = 0;
    set({
      queue: songs,
      currentIndex: idx,
      currentSong: songs[idx] ?? null,
      positionMillis: saved.positionMs,
      durationMillis: songs[idx]?.duration_ms ?? 0,
    });
    await playerService.restoreQueue(songs, idx, saved.positionMs);
  },

  loadQueue: async (songs, startIndex = 0) => {
    set({ loading: true, queue: songs });
    await playerService.loadQueue(songs, startIndex);
    set({
      currentIndex: startIndex,
      currentSong: songs[startIndex] ?? null,
      loading: false,
    });
    persistState(0);
  },

  play: () => playerService.play(),

  pause: () => {
    playerService.pause();
    persistState(get().positionMillis);
  },

  togglePlay: () => {
    if (get().isPlaying) get().pause();
    else get().play();
  },

  // La navegación de cola y el auto-avance al terminar son nativos:
  // el índice/canción se actualizan vía el evento MediaItemTransition.
  next: () => playerService.skipToNext(),

  previous: () => playerService.skipToPrevious(),

  seekTo: (ms) => playerService.seekToMs(ms),
}));

/**
 * Guarda el snapshot de la cola en SQLite (fire-and-forget). Lee el estado
 * actual del store; ignora errores para no romper la reproducción.
 */
function persistState(positionMs: number): void {
  const { queue, currentSong } = usePlayerStore.getState();
  if (!currentSong || queue.length === 0) return;
  savePlayerState(queue.map((s) => s.id), currentSong.id, positionMs).catch(() => {});
}
