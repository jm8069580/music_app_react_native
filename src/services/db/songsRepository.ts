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

export type SortField = 'title' | 'artist' | 'album' | 'duration_ms' | 'added_at';

export async function getAllSongs(sort: SortField = 'title'): Promise<Song[]> {
  const db = await getDatabase();
  const collate = sort === 'title' || sort === 'artist' || sort === 'album' ? ' COLLATE NOCASE' : '';
  return db.getAllAsync<Song>(
    `SELECT * FROM songs ORDER BY ${sort}${collate} ASC`
  );
}

export async function searchSongs(query: string, sort: SortField = 'title'): Promise<Song[]> {
  const db = await getDatabase();
  const like = `%${query}%`;
  const collate = sort === 'title' || sort === 'artist' || sort === 'album' ? ' COLLATE NOCASE' : '';
  return db.getAllAsync<Song>(
    `SELECT * FROM songs WHERE title LIKE ? OR artist LIKE ? OR album LIKE ? ORDER BY ${sort}${collate} ASC`,
    [like, like, like]
  );
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

export async function getSongById(id: number): Promise<Song | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Song>('SELECT * FROM songs WHERE id = ?', [id]);
  return row ?? null;
}

export async function updateLyrics(id: number, lyrics: string | null): Promise<void> {
  const db = await getDatabase();
  const value = lyrics && lyrics.trim().length > 0 ? lyrics : null;
  await db.runAsync('UPDATE songs SET lyrics = ? WHERE id = ?', [value, id]);
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

export async function getAllUris(): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ uri: string }>('SELECT uri FROM songs');
  return rows.map((r) => r.uri);
}

export async function removeSongsByUris(uris: string[]): Promise<void> {
  if (uris.length === 0) return;
  const db = await getDatabase();
  const placeholders = uris.map(() => '?').join(',');
  await db.runAsync(`DELETE FROM songs WHERE uri IN (${placeholders})`, uris);
}

export async function countSongsWithoutArtwork(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ c: number }>(
    "SELECT COUNT(*) AS c FROM songs WHERE artwork_uri IS NULL"
  );
  return row?.c ?? 0;
}

export async function resetMissingArtwork(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ c: number }>(
    "SELECT COUNT(*) AS c FROM songs WHERE artwork_uri IS NULL AND metadata_extracted = 1"
  );
  const count = row?.c ?? 0;
  if (count > 0) {
    await db.runAsync(
      "UPDATE songs SET metadata_extracted = 0 WHERE artwork_uri IS NULL AND metadata_extracted = 1"
    );
  }
  return count;
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