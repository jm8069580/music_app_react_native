import * as FileSystem from 'expo-file-system/legacy';
import { getSongsWithLyrics, getSongByUri, updateLyrics } from '../db/songsRepository';

const BACKUP_FILE = FileSystem.documentDirectory + 'melodix-lyrics-backup.json';

export type LyricsBackupEntry = {
  uri: string;
  title: string;
  lyrics: string;
};

export type LyricsBackup = {
  version: number;
  exportedAt: number;
  count: number;
  songs: LyricsBackupEntry[];
};

export async function exportLyricsBackup(): Promise<string | null> {
  try {
    const songs = await getSongsWithLyrics();
    if (songs.length === 0) return null;

    const backup: LyricsBackup = {
      version: 1,
      exportedAt: Date.now(),
      count: songs.length,
      songs: songs.map((s) => ({
        uri: s.uri,
        title: s.title,
        lyrics: s.lyrics ?? '',
      })),
    };

    await FileSystem.writeAsStringAsync(BACKUP_FILE, JSON.stringify(backup, null, 2), {
      encoding: FileSystem.EncodingType.UTF8,
    });

    return BACKUP_FILE;
  } catch (err) {
    console.warn('[lyricsBackup] Error exporting:', err);
    return null;
  }
}

export type ImportResult = {
  restored: number;
  skipped: number;
  errors: number;
};

export async function importLyricsBackup(fileUri?: string): Promise<ImportResult | null> {
  try {
    const uri = fileUri ?? BACKUP_FILE;
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return null;

    const raw = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    const backup: LyricsBackup = JSON.parse(raw);

    if (!backup?.songs || !Array.isArray(backup.songs)) {
      console.warn('[lyricsBackup] Invalid backup format');
      return null;
    }

    let restored = 0;
    let skipped = 0;
    let errors = 0;

    for (const entry of backup.songs) {
      try {
        if (!entry.uri || !entry.lyrics) { skipped++; continue; }
        const song = await getSongByUri(entry.uri);
        if (!song) { skipped++; continue; }
        await updateLyrics(song.id, entry.lyrics);
        restored++;
      } catch {
        errors++;
      }
    }

    return { restored, skipped, errors };
  } catch (err) {
    console.warn('[lyricsBackup] Error importing:', err);
    return null;
  }
}
