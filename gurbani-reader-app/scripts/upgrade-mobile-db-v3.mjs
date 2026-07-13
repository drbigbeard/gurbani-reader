#!/usr/bin/env node
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const databasePath = resolve(process.argv[2] ?? 'public/assets/databases/gurbani_corpus_v3SQLite.db');
const snapshotPath = resolve(process.argv[3] ?? '../gurbani-corpus-poc/imports/banidb-banis.json');
const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'));
if (snapshot.format !== 'banidb-bani-collections-v1') throw new Error('Unsupported BaniDB Bani snapshot');
const collections = snapshot.collections.filter(row => row.sourceId === 'G');
const db = new DatabaseSync(databasePath);
try {
  db.exec(`PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS bani_collection (
      id TEXT PRIMARY KEY NOT NULL, upstream_id INTEGER NOT NULL, token TEXT NOT NULL,
      source_work_id TEXT NOT NULL, gurmukhi TEXT NOT NULL, transliteration TEXT,
      verse_count INTEGER NOT NULL, attribution_label TEXT NOT NULL, snapshot_sha256 TEXT NOT NULL,
      FOREIGN KEY (source_work_id) REFERENCES source_work(id));
    CREATE TABLE IF NOT EXISTS bani_collection_line (
      bani_id TEXT NOT NULL, line_order INTEGER NOT NULL, upstream_verse_id INTEGER,
      header_level INTEGER NOT NULL DEFAULT 0, paragraph_number INTEGER,
      gurmukhi TEXT NOT NULL, transliteration TEXT, PRIMARY KEY (bani_id, line_order),
      FOREIGN KEY (bani_id) REFERENCES bani_collection(id));
    CREATE INDEX IF NOT EXISTS idx_bani_source ON bani_collection(source_work_id, upstream_id);
    CREATE INDEX IF NOT EXISTS idx_bani_line_order ON bani_collection_line(bani_id, line_order);`);
  db.exec('BEGIN IMMEDIATE');
  db.exec('DELETE FROM bani_collection_line; DELETE FROM bani_collection;');
  const insertCollection = db.prepare(`INSERT INTO bani_collection
    (id, upstream_id, token, source_work_id, gurmukhi, transliteration, verse_count, attribution_label, snapshot_sha256)
    VALUES (?, ?, ?, 'source:G', ?, ?, ?, 'BaniDB (banidb.com)', ?)`);
  const insertLine = db.prepare(`INSERT INTO bani_collection_line
    (bani_id, line_order, upstream_verse_id, header_level, paragraph_number, gurmukhi, transliteration)
    VALUES (?, ?, ?, ?, ?, ?, ?)`);
  let lineCount = 0;
  for (const collection of collections) {
    const id = `bani:banidb:${collection.id}`;
    insertCollection.run(id, collection.id, collection.token, collection.gurmukhi,
      collection.transliteration ?? '', collection.verses.length, snapshot.sha256 ?? 'not-recorded');
    for (const line of collection.verses) {
      insertLine.run(id, line.order, line.verseId, line.header ?? 0, line.paragraph ?? null,
        line.gurmukhi, line.transliteration ?? '');
      lineCount += 1;
    }
  }
  db.prepare(`INSERT OR REPLACE INTO metadata(key, value) VALUES ('schema_version', '3')`).run();
  db.prepare(`INSERT OR REPLACE INTO metadata(key, value) VALUES ('banidb_banis_snapshot_sha256', ?)`).run(snapshot.sha256 ?? 'not-recorded');
  db.exec('COMMIT');
  console.log(JSON.stringify({ databasePath, snapshotPath, collections: collections.length, lines: lineCount,
    excludedOutsideScope: snapshot.collections.length - collections.length,
    integrity: db.prepare('PRAGMA integrity_check').get().integrity_check }, null, 2));
} catch (error) {
  try { db.exec('ROLLBACK'); } catch { /* no active transaction */ }
  throw error;
} finally { db.close(); }
