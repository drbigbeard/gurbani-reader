import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite';

const DATABASE = 'gurbani_reader_personal';
const VERSION = 1;
const sqlite = new SQLiteConnection(CapacitorSQLite);
let connection: Promise<SQLiteDBConnection> | null = null;

const PERSONAL_SCHEMA = `
CREATE TABLE IF NOT EXISTS user_state (
  key TEXT PRIMARY KEY NOT NULL,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bookmark (
  id TEXT PRIMARY KEY NOT NULL,
  reference_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS user_note (
  id TEXT PRIMARY KEY NOT NULL,
  reference_json TEXT NOT NULL,
  body TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS user_collection (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS collection_item (
  collection_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  reference_json TEXT NOT NULL,
  item_order INTEGER NOT NULL,
  PRIMARY KEY (collection_id, item_id)
);
CREATE TABLE IF NOT EXISTS saved_search (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  query_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reading_history (
  id TEXT PRIMARY KEY NOT NULL,
  reference_json TEXT NOT NULL,
  visited_at TEXT NOT NULL
);`;

export function personalStoreSupported() { return Capacitor.isNativePlatform(); }

export async function readPersonalState<T>(key: string): Promise<T | null> {
  if (!personalStoreSupported()) return null;
  const db = await openPersonalDatabase();
  const result = await db.query('SELECT value_json AS value FROM user_state WHERE key = ?', [key]);
  const raw = result.values?.[0]?.value;
  if (typeof raw !== 'string') return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

export async function writePersonalState<T>(key: string, value: T): Promise<void> {
  if (!personalStoreSupported()) return;
  const db = await openPersonalDatabase();
  await db.run(`INSERT INTO user_state(key, value_json, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
  [key, JSON.stringify(value), new Date().toISOString()]);
}

async function openPersonalDatabase(): Promise<SQLiteDBConnection> {
  if (connection) return connection;
  connection = (async () => {
    const consistent = await sqlite.checkConnectionsConsistency();
    const exists = await sqlite.isConnection(DATABASE, false);
    const db = consistent.result && exists.result
      ? await sqlite.retrieveConnection(DATABASE, false)
      : await sqlite.createConnection(DATABASE, false, 'no-encryption', VERSION, false);
    await db.open();
    await db.execute(PERSONAL_SCHEMA, true);
    return db;
  })();
  return connection;
}
