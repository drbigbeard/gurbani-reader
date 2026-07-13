#!/usr/bin/env node
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const databasePath = resolve(process.argv[2] ?? 'public/assets/databases/gurbani_corpusSQLite.db');
const corpusPath = resolve(process.argv[3] ?? '../gurbani-corpus-poc/imports/banidb-GBS-canonical.json');
const corpus = JSON.parse(readFileSync(corpusPath, 'utf8'));
const db = new DatabaseSync(databasePath);
try {
  const columns = new Set(db.prepare(`PRAGMA table_info(canonical_line)`).all().map(row => row.name));
  if (!columns.has('raag_id')) db.exec(`ALTER TABLE canonical_line ADD COLUMN raag_id TEXT`);
  if (!columns.has('raag')) db.exec(`ALTER TABLE canonical_line ADD COLUMN raag TEXT`);
  db.exec('BEGIN IMMEDIATE');
  const update = db.prepare(`UPDATE canonical_line SET raag_id = ?, raag = ? WHERE id = ?`);
  let updated = 0;
  for (const line of corpus.lines) {
    const result = update.run(line.raagId ?? null, line.raag ?? null, line.id);
    updated += Number(result.changes);
  }
  db.exec(`INSERT OR REPLACE INTO metadata(key, value) VALUES ('schema_version', '2')`);
  db.exec('COMMIT');
  db.exec(`CREATE INDEX IF NOT EXISTS idx_line_source_raag ON canonical_line(source_work_id, raag)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_term_form_glossary ON term_form(glossary_entry_id)`);
  console.log(JSON.stringify({ databasePath, corpusPath, updated,
    raags: db.prepare(`SELECT COUNT(DISTINCT raag) AS count FROM canonical_line WHERE raag IS NOT NULL AND raag <> ''`).get().count,
    integrity: db.prepare('PRAGMA integrity_check').get().integrity_check }, null, 2));
} catch (error) {
  try { db.exec('ROLLBACK'); } catch { /* no active transaction */ }
  throw error;
} finally { db.close(); }
