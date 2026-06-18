import {
  getSongsPendingMetadata,
  updateSongMetadata,
} from '../db/songsRepository';
import { extractMetadata } from './metadataExtractor';

type ProgressListener = (current: number, total: number) => void;

class MetadataBackgroundService {
  private running = false;
  private cancelled = false;
  private listeners = new Set<ProgressListener>();
  private current = 0;
  private total = 0;

  isRunning() {
    return this.running;
  }

  getProgress() {
    return { current: this.current, total: this.total };
  }

  subscribe(listener: ProgressListener): () => void {
    this.listeners.add(listener);
    // emitir estado actual al suscribirse
    listener(this.current, this.total);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    this.listeners.forEach((l) => l(this.current, this.total));
  }

  async start() {
    if (this.running) return;
    this.running = true;
    this.cancelled = false;

    try {
      const pending = await getSongsPendingMetadata();
      this.total = pending.length;
      this.current = 0;
      this.emit();

      // La extracción es I/O-bound (leer el archivo en chunks), así que
      // procesar varias canciones a la vez solapa esperas y acelera bastante.
      const CONCURRENCY = 4;
      let next = 0;
      const worker = async () => {
        while (!this.cancelled) {
          const i = next++;
          if (i >= pending.length) break;
          const song = pending[i];
          try {
            const update = await extractMetadata(song.id, song.uri);
            await updateSongMetadata(song.id, update);
          } catch {
            // Una canción que falle no debe frenar al resto.
          }
          this.current++;
          this.emit();
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, pending.length) }, worker)
      );
    } catch (err) {
      console.warn('[metadataBackgroundService] error:', err);
    } finally {
      this.running = false;
      this.total = 0;
      this.current = 0;
      this.emit();
    }
  }

  stop() {
    this.cancelled = true;
  }
}

export const metadataService = new MetadataBackgroundService();