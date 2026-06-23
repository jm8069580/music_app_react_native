import { create } from 'zustand';
import TrackPlayer, { type MediaItem } from '@rntp/player';
import type { Song } from '../../types/song';
import { playerService } from './playerService';
import { getSongsByIds } from '../db/songsRepository';
import { savePlayerState, loadPlayerState } from '../db/playerStateRepository';

let lastPositionSave = 0;
const POSITION_SAVE_INTERVAL_MS = 5000;

export type RepeatMode = 'off' | 'all' | 'one';

type PlayerState = {
  queue: Song[];
  currentIndex: number | null;
  currentSong: Song | null;
  isPlaying: boolean;
  positionMillis: number;
  durationMillis: number;
  loading: boolean;
  ready: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  /** Índices originales en orden shuffle o null si shuffle está apagado. */
  shuffledIndices: number[] | null;
  posInShuffled: number;

  init: () => Promise<void>;
  restore: () => Promise<void>;
  loadQueue: (songs: Song[], startIndex?: number) => Promise<void>;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  seekTo: (ms: number) => void;
  setLoading: (v: boolean) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
};

function shuffleIndices(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function goToIndex(idx: number, opts: { queue: Song[]; shuffle: boolean; shuffledIndices: number[] | null; posInShuffled: number }): { currentIndex: number; currentSong: Song | null; posInShuffled: number } {
  const { queue } = opts;
  if (idx < 0 || idx >= queue.length) {
    return { currentIndex: idx, currentSong: null, posInShuffled: opts.posInShuffled };
  }
  let posInShuffled = opts.posInShuffled;
  if (opts.shuffle && opts.shuffledIndices) {
    const found = opts.shuffledIndices.indexOf(idx);
    if (found >= 0) posInShuffled = found;
  }
  return { currentIndex: idx, currentSong: queue[idx] ?? null, posInShuffled };
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  queue: [],
  currentIndex: null,
  currentSong: null,
  isPlaying: false,
  positionMillis: 0,
  durationMillis: 0,
  loading: false,
  ready: false,
  shuffle: false,
  repeat: 'off',
  shuffledIndices: null,
  posInShuffled: 0,

  setLoading: (v) => set({ loading: v }),

  init: async () => {
    if (get().ready) return;
    await playerService.setup({
      onIsPlayingChange: (playing) => set({ isPlaying: playing }),
      onProgress: (positionMillis, durationMillis) => {
        set({ positionMillis, durationMillis });
        const { currentIndex, queue } = get();
        const nativeIndex = TrackPlayer.getActiveMediaItemIndex();
        if (nativeIndex !== null && nativeIndex !== currentIndex && queue[nativeIndex]) {
          set(goToIndex(nativeIndex, get()));
          persistState(positionMillis);
        }
        const now = Date.now();
        if (now - lastPositionSave > POSITION_SAVE_INTERVAL_MS) {
          lastPositionSave = now;
          persistState(positionMillis);
        }
      },
      onTrackChange: (index, item) => {
        const st = get();
        let idx = index;
        if (item?.mediaId) {
          const match = st.queue.findIndex((s) => String(s.id) === item.mediaId);
          if (match >= 0) idx = match;
        }
        set({ ...goToIndex(idx, st), loading: false });
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
      shuffle: false,
      repeat: 'off',
      shuffledIndices: null,
      posInShuffled: 0,
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

  next: () => {
    const st = get();
    const { queue, currentIndex, shuffle, shuffledIndices, repeat } = st;
    if (queue.length === 0 || currentIndex == null) return;

    if (repeat === 'one') {
      playerService.skipToIndex(currentIndex);
      return;
    }

    let nextIdx: number;

    if (shuffle && shuffledIndices) {
      const nextPos = st.posInShuffled + 1;
      if (nextPos >= shuffledIndices.length) {
        if (repeat === 'all') {
          const newShuffle = shuffleIndices(queue.length);
          nextIdx = newShuffle[0];
          set({ shuffledIndices: newShuffle, posInShuffled: 0 });
          playerService.skipToIndex(nextIdx);
          set(goToIndex(nextIdx, { ...st, shuffledIndices: newShuffle, posInShuffled: 0 }));
          return;
        }
        return;
      }
      nextIdx = shuffledIndices[nextPos];
      playerService.skipToIndex(nextIdx);
      set(goToIndex(nextIdx, { ...st, posInShuffled: nextPos }));
      return;
    }

    nextIdx = currentIndex + 1;
    if (nextIdx >= queue.length) {
      if (repeat === 'all') {
        nextIdx = 0;
      } else {
        return;
      }
    }
    playerService.skipToIndex(nextIdx);
    set(goToIndex(nextIdx, st));
  },

  previous: () => {
    const st = get();
    const { queue, currentIndex, shuffle, shuffledIndices, repeat } = st;
    if (queue.length === 0 || currentIndex == null) return;

    if (repeat === 'one') {
      playerService.skipToIndex(currentIndex);
      return;
    }

    let prevIdx: number;

    if (shuffle && shuffledIndices) {
      const prevPos = st.posInShuffled - 1;
      if (prevPos < 0) {
        if (repeat === 'all') {
          const newShuffle = shuffleIndices(queue.length);
          prevIdx = newShuffle[newShuffle.length - 1];
          set({ shuffledIndices: newShuffle, posInShuffled: newShuffle.length - 1 });
          playerService.skipToIndex(prevIdx);
          set(goToIndex(prevIdx, { ...st, shuffledIndices: newShuffle, posInShuffled: newShuffle.length - 1 }));
          return;
        }
        return;
      }
      prevIdx = shuffledIndices[prevPos];
      playerService.skipToIndex(prevIdx);
      set(goToIndex(prevIdx, { ...st, posInShuffled: prevPos }));
      return;
    }

    prevIdx = currentIndex - 1;
    if (prevIdx < 0) {
      if (repeat === 'all') {
        prevIdx = queue.length - 1;
      } else {
        return;
      }
    }
    playerService.skipToIndex(prevIdx);
    set(goToIndex(prevIdx, st));
  },

  seekTo: (ms) => playerService.seekToMs(ms),

  toggleShuffle: () => {
    const st = get();
    if (st.shuffle) {
      set({ shuffle: false, shuffledIndices: null, posInShuffled: 0 });
    } else {
      const indices = shuffleIndices(st.queue.length);
      const pos = st.currentIndex != null ? indices.indexOf(st.currentIndex) : 0;
      set({ shuffle: true, shuffledIndices: indices, posInShuffled: pos >= 0 ? pos : 0 });
    }
  },

  toggleRepeat: () => {
    const cycle: RepeatMode[] = ['off', 'all', 'one'];
    const st = get();
    const cur = cycle.indexOf(st.repeat);
    set({ repeat: cycle[(cur + 1) % cycle.length] });
  },
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
