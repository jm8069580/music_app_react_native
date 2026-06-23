import TrackPlayer, {
  Event,
  PlayerCommand,
  type MediaItem,
} from '@rntp/player';
import type { Song } from '../../types/song';

/**
 * Callbacks que el store registra para reflejar el estado nativo del player.
 * RNTP maneja la cola, el auto-avance y los controles de lockscreen/notificación
 * de forma nativa, así que aquí solo "escuchamos" y reenviamos al store.
 */
export type PlayerEvents = {
  onIsPlayingChange?: (playing: boolean) => void;
  onProgress?: (positionMs: number, durationMs: number) => void;
  onTrackChange?: (index: number, item: MediaItem | null) => void;
};

function songToMediaItem(song: Song): MediaItem {
  return {
    mediaId: String(song.id),
    url: song.uri,
    title: song.title,
    artist: song.artist ?? undefined,
    albumTitle: song.album ?? undefined,
    artworkUrl: song.artwork_uri ?? undefined,
    duration: song.duration_ms ? song.duration_ms / 1000 : undefined,
  };
}

class PlayerService {
  private isSetup = false;
  private subs: { remove: () => void }[] = [];

  /**
   * Inicializa el player nativo (una sola vez, en foreground en Android) y
   * suscribe los eventos. Idempotente: setupPlayer() lanza si se llama dos veces.
   */
  async setup(events: PlayerEvents): Promise<void> {
    if (this.isSetup) return;

    try {
      TrackPlayer.setupPlayer({
        contentType: 'music',
        handleAudioBecomingNoisy: true,
        android: {
          // Mantiene la CPU despierta para reproducción de archivos locales.
          wakeMode: 'local',
        },
      });
    } catch {
      // Ya estaba inicializado (p. ej. tras un fast-refresh): seguimos.
    }
    this.isSetup = true;

    // Controles remotos (lockscreen / notificación / auriculares). 'native'
    // los resuelve sin pasar por JS, así que funcionan en background.
    TrackPlayer.setCommands({
      capabilities: [
        PlayerCommand.PlayPause,
        PlayerCommand.Next,
        PlayerCommand.Previous,
        PlayerCommand.Seek,
      ],
      handling: 'native',
    });

    this.subs.push(
      TrackPlayer.addEventListener(Event.IsPlayingChanged, ({ playing }) => {
        events.onIsPlayingChange?.(playing);
      }),
      TrackPlayer.addEventListener(
        Event.PlaybackProgressUpdated,
        ({ position, duration }) => {
          events.onProgress?.(
            Math.round(position * 1000),
            Math.round(duration * 1000)
          );
        }
      ),
      // Cubre tanto el next/previous manual como el auto-avance nativo al
      // terminar una pista.
      TrackPlayer.addEventListener(Event.MediaItemTransition, ({ index, item }) => {
        events.onTrackChange?.(index, item);
      })
    );
  }

  async loadQueue(songs: Song[], startIndex: number): Promise<void> {
    TrackPlayer.setMediaItems(songs.map(songToMediaItem), startIndex);
    TrackPlayer.play();
  }

  /**
   * Restaura una cola guardada SIN reproducir: deja la pista lista en pausa,
   * posicionada en `startIndex` y desplazada a `positionMs`. Para el arranque
   * de la app (cola persistente).
   */
  async restoreQueue(
    songs: Song[],
    startIndex: number,
    positionMs: number
  ): Promise<void> {
    TrackPlayer.setMediaItems(songs.map(songToMediaItem), startIndex);
    if (positionMs > 0) TrackPlayer.seekTo(positionMs / 1000);
  }

  play() {
    TrackPlayer.play();
  }

  pause() {
    TrackPlayer.pause();
  }

  skipToNext() {
    TrackPlayer.skipToNext();
  }

  skipToPrevious() {
    TrackPlayer.skipToPrevious();
  }

  skipToIndex(index: number) {
    TrackPlayer.skipToIndex(index);
  }

  seekToMs(ms: number) {
    TrackPlayer.seekTo(ms / 1000);
  }
}

export const playerService = new PlayerService();
