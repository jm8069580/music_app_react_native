import { getDatabase } from './database';
import type { Song, NewSong } from '../../types/song';
import type { SongMetadataUpdate } from '../../types/song';

export async function insertSong(song: NewSong): Promise<void> {
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

/** Devuelve las canciones de los IDs dados, en el MISMO orden que `ids`. */
export async function getSongsByIds(ids: number[]): Promise<Song[]> {
  if (ids.length === 0) return [];
  const db = await getDatabase();
  const placeholders = ids.map(() => '?').join(',');
  const rows = await db.getAllAsync<Song>(
    `SELECT * FROM songs WHERE id IN (${placeholders})`,
    ids
  );
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids
    .map((id) => byId.get(id))
    .filter((s): s is Song => s != null);
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

// --- Favoritos ---

export async function getFavoriteSongs(): Promise<Song[]> {
  const db = await getDatabase();
  return db.getAllAsync<Song>(
    'SELECT * FROM songs WHERE is_favorite = 1 ORDER BY title COLLATE NOCASE ASC'
  );
}

export async function getFavoriteIds(): Promise<number[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ id: number }>(
    'SELECT id FROM songs WHERE is_favorite = 1'
  );
  return rows.map((r) => r.id);
}

export async function setFavorite(id: number, favorite: boolean): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE songs SET is_favorite = ? WHERE id = ?', [
    favorite ? 1 : 0,
    id,
  ]);
}