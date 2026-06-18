import * as SQLite from 'expo-sqlite';

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  dbInstance = await SQLite.openDatabaseAsync('musicapp.db');
  await runMigrations(dbInstance);
  return dbInstance;
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