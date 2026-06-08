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
      metadata_extracted INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_songs_folder ON songs(folder);
    CREATE INDEX IF NOT EXISTS idx_songs_title ON songs(title);
    CREATE INDEX IF NOT EXISTS idx_songs_metadata ON songs(metadata_extracted);
  `);

  // Migración suave para BDs ya existentes (que no tenían la columna)
  try {
    await db.execAsync(
      `ALTER TABLE songs ADD COLUMN metadata_extracted INTEGER NOT NULL DEFAULT 0`
    );
  } catch(err: any) {
    // columna ya existe → ignorar
    console.log('[db] metadata_extracted ya existía (ok):', String(err));
  }
  // 🆕 Verificar estructura
  const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(songs)`);
  console.log('[db] columnas de songs:', cols.map(c => c.name).join(', '));
}