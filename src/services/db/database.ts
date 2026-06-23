import * as SQLite from 'expo-sqlite';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let serialQueue = Promise.resolve();

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('musicapp.db');
      await runMigrations(db);
      return wrap(db);
    })();
  }
  return dbPromise;
}

function wrap(db: SQLite.SQLiteDatabase): SQLite.SQLiteDatabase {
  const enqueued = <T>(fn: () => Promise<T>) => {
    const op = serialQueue.then(fn, fn);
    serialQueue = op.then(() => {}, () => {});
    return op;
  };
  const run = (sql: string, params?: any[]) =>
    params !== undefined
      ? db.runAsync(sql, params)
      : db.runAsync(sql);
  const all = <T>(sql: string, params?: any[]) =>
    params !== undefined
      ? db.getAllAsync<T>(sql, params)
      : db.getAllAsync<T>(sql);
  const first = <T>(sql: string, params?: any[]) =>
    params !== undefined
      ? db.getFirstAsync<T>(sql, params)
      : db.getFirstAsync<T>(sql);
  return {
    execAsync: (sql: string) => enqueued(() => db.execAsync(sql)),
    runAsync: (sql: string, params?: any[]) =>
      enqueued(() => run(sql, params)),
    getAllAsync: <T>(sql: string, params?: any[]) =>
      enqueued(() => all<T>(sql, params)),
    getFirstAsync: <T>(sql: string, params?: any[]) =>
      enqueued(() => first<T>(sql, params)),
  } as SQLite.SQLiteDatabase;
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
      is_favorite INTEGER NOT NULL DEFAULT 0,
      lyrics TEXT
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

  await addColumnIfMissing(db, 'metadata_extracted', 'INTEGER NOT NULL DEFAULT 0');
  await addColumnIfMissing(db, 'is_favorite', 'INTEGER NOT NULL DEFAULT 0');
  await addColumnIfMissing(db, 'lyrics', 'TEXT');
}

async function addColumnIfMissing(
  db: SQLite.SQLiteDatabase,
  column: string,
  definition: string
): Promise<void> {
  const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(songs)`);
  if (cols.some((c) => c.name === column)) return;
  await db.execAsync(`ALTER TABLE songs ADD COLUMN ${column} ${definition}`);
}