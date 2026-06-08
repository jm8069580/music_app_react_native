import { getDatabase } from './database';
import type { Song } from '../../types/song';
import type { SongMetadataUpdate } from '../../types/song';

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

export async function updateSongMetadata(
  id: number,
  update: SongMetadataUpdate
): Promise<void> {
  const db = await getDatabase();
  const fields: string[] = [];
  const values: any[] = [];

  if (update.title !== undefined) { fields.push('title = ?'); values.push(update.title); }
  if (update.artist !== undefined) { fields.push('artist = ?'); values.push(update.artist); }
  if (update.album !== undefined) { fields.push('album = ?'); values.push(update.album); }
  if (update.duration_ms !== undefined) { fields.push('duration_ms = ?'); values.push(update.duration_ms); }
  if (update.artwork_uri !== undefined) { fields.push('artwork_uri = ?'); values.push(update.artwork_uri); }

  fields.push('metadata_extracted = 1');
  values.push(id);

  await db.runAsync(
    `UPDATE songs SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
}

export async function getSongsPendingMetadata(): Promise<{ id: number; uri: string }[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ id: number; uri: string }>(
    `SELECT id, uri FROM songs WHERE metadata_extracted = 0 ORDER BY added_at ASC`
  );
  return rows;
}

export async function countPendingMetadata(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) AS c FROM songs WHERE metadata_extracted = 0`
  );
  return row?.c ?? 0;
}