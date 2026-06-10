import { createAudioPlayer, setAudioModeAsync, AudioPlayer, AudioStatus } from 'expo-audio';
import type { Song } from '../../types/song';

type StatusCallback = (status: {
  isPlaying?: boolean;
  positionMillis?: number;
  durationMillis?: number;
  didJustFinish?: boolean;
}) => void;

class PlayerService {
  private player: AudioPlayer | null = null;
  private statusSub: { remove: () => void } | null = null;
  private statusCb: StatusCallback = () => {};
  private currentQueue: Song[] = [];
  private currentIndex: number = 0;

  constructor() {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
    }).catch(() => {});
  }

  setStatusUpdateCallback(cb: StatusCallback) {
    this.statusCb = cb;
  }

  private onStatus(status: AudioStatus) {
    if (!status || !status.isLoaded) return;
    this.statusCb({
      isPlaying: status.playing,
      positionMillis: Math.round((status.currentTime ?? 0) * 1000),
      durationMillis: Math.round((status.duration ?? 0) * 1000),
      didJustFinish: status.didJustFinish ?? false,
    });
  }

  async unloadCurrent() {
    if (this.statusSub) {
      this.statusSub.remove();
      this.statusSub = null;
    }
    if (this.player) {
      try {
        this.player.remove();
      } catch {}
      this.player = null;
    }
  }

  async loadQueue(queue: Song[], startIndex: number, onLoaded: (index: number) => void) {
    this.currentQueue = queue;
    this.currentIndex = startIndex;
    await this.loadTrack(this.currentQueue[this.currentIndex]);
    onLoaded(this.currentIndex);
  }

  async loadTrackAtIndex(queue: Song[], index: number, onLoaded: (index: number) => void) {
    this.currentQueue = queue;
    this.currentIndex = index;
    await this.loadTrack(this.currentQueue[this.currentIndex]);
    onLoaded(this.currentIndex);
  }

  private async loadTrack(song: Song) {
    await this.unloadCurrent();
    const player = createAudioPlayer({ uri: song.uri });
    this.player = player;
    this.statusSub = player.addListener('playbackStatusUpdate', (status: AudioStatus) =>
      this.onStatus(status)
    );
    player.play();
  }

  async play() {
    if (!this.player) return;
    try {
      this.player.play();
    } catch {}
  }

  async pause() {
    if (!this.player) return;
    try {
      this.player.pause();
    } catch {}
  }

  async seekTo(ms: number) {
    if (!this.player) return;
    try {
      await this.player.seekTo(ms / 1000);
    } catch {}
  }
}

export const playerService = new PlayerService();
