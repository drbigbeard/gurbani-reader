#!/usr/bin/env node
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';

const databasePath = resolve(process.argv[2] ?? 'public/assets/databases/gurbani_reader_v4SQLite.db');
const db = new DatabaseSync(databasePath);
const lexical = value => Array.from(String(value ?? '').matchAll(/[\p{L}\p{M}]+/gu), match => match[0]);
const initials = value => lexical(value).map(token => [...token][0] ?? '').join('').normalize('NFC');
const latinInitials = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/gu, '')
  .toLowerCase().match(/[a-z]+/gu)?.map(token => token[0]).join('') ?? '';

try {
  db.exec(`PRAGMA foreign_keys = OFF;
    CREATE TABLE IF NOT EXISTS line_search_index (
      line_id TEXT PRIMARY KEY NOT NULL, source_work_id TEXT NOT NULL,
      initials_gurmukhi TEXT NOT NULL, initials_latin TEXT NOT NULL,
      FOREIGN KEY (line_id) REFERENCES canonical_line(id),
      FOREIGN KEY (source_work_id) REFERENCES source_work(id));
    CREATE INDEX IF NOT EXISTS idx_line_search_gurmukhi ON line_search_index(source_work_id, initials_gurmukhi);
    CREATE INDEX IF NOT EXISTS idx_line_search_latin ON line_search_index(source_work_id, initials_latin);`);
  db.exec('BEGIN IMMEDIATE');
  // One reader-facing Vaaran source; contributor attribution remains untouched.
  db.prepare(`UPDATE canonical_line SET source_work_id = 'source:B' WHERE source_work_id = 'source:S'`).run();
  db.prepare(`UPDATE text_unit SET source_work_id = 'source:B' WHERE source_work_id = 'source:S'`).run();
  db.prepare(`UPDATE token_occurrence SET source_work_id = 'source:B' WHERE source_work_id = 'source:S'`).run();
  db.prepare(`UPDATE source_work SET title = 'Vaaran Bhai Gurdas' WHERE id = 'source:B'`).run();
  db.prepare(`DELETE FROM source_work WHERE id = 'source:S'`).run();
  db.exec('DELETE FROM line_search_index');
  const insert = db.prepare(`INSERT INTO line_search_index
    (line_id, source_work_id, initials_gurmukhi, initials_latin) VALUES (?, ?, ?, ?)`);
  const rows = db.prepare(`SELECT id, source_work_id, gurmukhi, transliteration FROM canonical_line`).all();
  for (const row of rows) insert.run(row.id, row.source_work_id, initials(row.gurmukhi), latinInitials(row.transliteration));
  db.prepare(`INSERT OR REPLACE INTO metadata(key, value) VALUES ('schema_version', '4')`).run();
  db.prepare(`INSERT OR REPLACE INTO metadata(key, value) VALUES ('reader_source_model', 'G + combined Vaaran Bhai Gurdas')`).run();
  db.exec('COMMIT');
  db.exec('PRAGMA foreign_keys = ON');
  console.log(JSON.stringify({ databasePath, indexedLines: rows.length,
    sources: db.prepare(`SELECT COUNT(*) AS count FROM source_work`).get().count,
    vaaranContributors: db.prepare(`SELECT COUNT(DISTINCT contributor_id) AS count FROM canonical_line WHERE source_work_id = 'source:B'`).get().count,
    integrity: db.prepare('PRAGMA integrity_check').get().integrity_check }, null, 2));
} catch (error) {
  try { db.exec('ROLLBACK'); } catch { /* no active transaction */ }
  throw error;
} finally { db.close(); }
