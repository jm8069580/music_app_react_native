import * as SQLite from 'expo-sqlite';

// Memoizamos la PROMESA (no la instancia ya resuelta) para que la apertura y
// las migraciones ocurran una sola vez aunque varios consumidores llamen a
// getDatabase() en el mismo tick (favoritos + metadatos + scanner al arrancar).
// Si no, se abren varias conexiones en paralelo y prepareAsync puede ejecutarse
// sobre un handle nativo nulo → NullPointerException.
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('musicapp.db');
      await runMigrations(db);
      return db;
    })();
  }
  return dbPromise;
}

async function runMigrations(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uri TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      artist TEXT,
      album TEXT,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      artwork_uri TEXT,
      folder TEXT,
      added_at INTEGER NOT NULL,
      metadata_extracted INTEGER NOT NULL DEFAULT 0,
      is_favorite INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_songs_folder ON songs(folder);
    CREATE INDEX IF NOT EXISTS idx_songs_title ON songs(title);
    CREATE INDEX IF NOT EXISTS idx_songs_metadata ON songs(metadata_extracted);
    CREATE INDEX IF NOT EXISTS idx_songs_favorite ON songs(is_favorite);

    CREATE TABLE IF NOT EXISTS playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS playlist_songs (
      playlist_id INTEGER NOT NULL,
      song_id INTEGER NOT NULL,
      position INTEGER NOT NULL,
      PRIMARY KEY (playlist_id, song_id),
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
      FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_playlist_songs_playlist ON playlist_songs(playlist_id, position);

    CREATE TABLE IF NOT EXISTS player_state (
      id INTEGER PRIMARY KEY,
      queue_ids TEXT NOT NULL,
      current_song_id INTEGER,
      position_ms INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );
  `);

  // Migraciones suaves para BDs ya existentes (que no tenían la columna).
  await addColumnIfMissing(db, 'metadata_extracted', 'INTEGER NOT NULL DEFAULT 0');
  await addColumnIfMissing(db, 'is_favorite', 'INTEGER NOT NULL DEFAULT 0');
}

/**
 * Añade una columna a `songs` solo si aún no existe (idempotente).
 * Evita el ALTER TABLE que falla cuando la columna ya está presente.
 */
async function addColumnIfMissing(
  db: SQLite.SQLiteDatabase,
  column: string,
  definition: string
): Promise<void> {
  const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(songs)`);
  if (cols.some((c) => c.name === column)) return;
  await db.execAsync(`ALTER TABLE songs ADD COLUMN ${column} ${definition}`);
}