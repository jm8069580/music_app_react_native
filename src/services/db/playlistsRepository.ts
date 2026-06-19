import { getDatabase } from './database';
import type { Song } from '../../types/song';
import type { Playlist, PlaylistWithCount } from '../../types/playlist';

export async function createPlaylist(name: string): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    'INSERT INTO playlists (name, created_at) VALUES (?, ?)',
    [name.trim(), Date.now()]
  );
  return result.lastInsertRowId;
}

export async function getPlaylists(): Promise<PlaylistWithCount[]> {
  const db = await getDatabase();
  return db.getAllAsync<PlaylistWithCount>(
    `SELECT p.id, p.name, p.created_at,
            COUNT(ps.song_id) AS song_count
       FROM playlists p
       LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id
      GROUP BY p.id
      ORDER BY p.created_at DESC`
  );
}

export async function getPlaylist(id: number): Promise<Playlist | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Playlist>(
    'SELECT id, name, created_at FROM playlists WHERE id = ?',
    [id]
  );
  return row ?? null;
}

export async function renamePlaylist(id: number, name: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE playlists SET name = ? WHERE id = ?', [name.trim(), id]);
}

export async function deletePlaylist(id: number): Promise<void> {
  const db = await getDatabase();
  // playlist_songs se borra en cascada (FOREIGN KEY ON DELETE CASCADE).
  await db.runAsync('DELETE FROM playlists WHERE id = ?', [id]);
}

/** Canciones de una playlist, en su orden (position ascendente). */
export async function getPlaylistSongs(playlistId: number): Promise<Song[]> {
  const db = await getDatabase();
  return db.getAllAsync<Song>(
    `SELECT s.*
       FROM playlist_songs ps
       JOIN songs s ON s.id = ps.song_id
      WHERE ps.playlist_id = ?
      ORDER BY ps.position ASC`,
    [playlistId]
  );
}

/** Añade una canción al final de la playlist. Idempotente (PK compuesta). */
export async function addSongToPlaylist(
  playlistId: number,
  songId: number
): Promise<void> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ next: number }>(
    'SELECT COALESCE(MAX(position), -1) + 1 AS next FROM playlist_songs WHERE playlist_id = ?',
    [playlistId]
  );
  await db.runAsync(
    'INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?)',
    [playlistId, songId, row?.next ?? 0]
  );
}

export async function removeSongFromPlaylist(
  playlistId: number,
  songId: number
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?',
    [playlistId, songId]
  );
}
