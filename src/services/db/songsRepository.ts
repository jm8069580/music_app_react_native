import { getDatabase } from './database';
import type { Song } from '../../types/song';

export async function insertSong(song: Omit<Song, 'id'>): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR IGNORE INTO songs (uri, title, artist, album, duration_ms, artwork_uri, folder, added_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      song.uri,
      song.title,
      song.artist,
      song.album,
      song.duration_ms,
      song.artwork_uri,
      song.folder,
      song.added_at,
    ]
  );
}

export async function getAllSongs(): Promise<Song[]> {
  const db = await getDatabase();
  return db.getAllAsync<Song>('SELECT * FROM songs ORDER BY title COLLATE NOCASE ASC');
}

export async function countSongs(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM songs');
  return row?.c ?? 0;
}

export async function clearSongs(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync('DELETE FROM songs');
}