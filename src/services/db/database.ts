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
      added_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_songs_folder ON songs(folder);
    CREATE INDEX IF NOT EXISTS idx_songs_title ON songs(title);
  `);
}