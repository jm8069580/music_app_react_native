import { getDatabase } from './database';

export type SavedPlayerState = {
  queueIds: number[];
  currentSongId: number | null;
  positionMs: number;
};

/** Guarda (o reemplaza) el snapshot de la cola en la fila única id=1. */
export async function savePlayerState(
  queueIds: number[],
  currentSongId: number | null,
  positionMs: number
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO player_state (id, queue_ids, current_song_id, position_ms, updated_at)
     VALUES (1, ?, ?, ?, ?)`,
    [JSON.stringify(queueIds), currentSongId, Math.round(positionMs), Date.now()]
  );
}

export async function loadPlayerState(): Promise<SavedPlayerState | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{
    queue_ids: string;
    current_song_id: number | null;
    position_ms: number;
  }>('SELECT queue_ids, current_song_id, position_ms FROM player_state WHERE id = 1');
  if (!row) return null;
  let queueIds: number[] = [];
  try {
    queueIds = JSON.parse(row.queue_ids);
  } catch {
    queueIds = [];
  }
  return {
    queueIds,
    currentSongId: row.current_song_id,
    positionMs: row.position_ms ?? 0,
  };
}

export async function clearPlayerState(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM player_state WHERE id = 1');
}
