#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { consonantIndexText, looseGurmukhi, normalizeGurmukhi, normalizeRoman, phoneticIndexText } from '../src/lib/search-core.ts';

const inputPath = resolve(process.argv[2] ?? 'public/assets/databases/gurbani_reader_v7SQLite.db');
const outputPath = resolve(process.argv[3] ?? 'public/assets/databases/gurbani_reader_v8SQLite.db');
const buildingPath = `${outputPath}.building`;
if (!existsSync(inputPath)) throw new Error(`v0.14 database is missing: ${inputPath}`);
mkdirSync(dirname(outputPath), { recursive: true });
for (const suffix of ['', '-wal', '-shm', '-journal']) rmSync(`${buildingPath}${suffix}`, { force: true });
copyFileSync(inputPath, buildingPath);

const db = new DatabaseSync(buildingPath);
try {
  db.exec('PRAGMA foreign_keys=OFF; PRAGMA journal_mode=WAL; BEGIN IMMEDIATE;');
  addColumn('line_search_index', 'consonant_roman', "TEXT NOT NULL DEFAULT ''");
  addColumn('line_search_index', 'loose_gurmukhi', "TEXT NOT NULL DEFAULT ''");
  db.exec(`
    DROP TABLE IF EXISTS line_search_fts;
    CREATE VIRTUAL TABLE line_search_fts USING fts5(
      line_id UNINDEXED,
      text_unit_id UNINDEXED,
      roman,
      roman_phonetic,
      roman_consonants,
      gurmukhi,
      gurmukhi_loose,
      initials_gurmukhi,
      initials_latin,
      tokenize='unicode61 remove_diacritics 2',
      prefix='2 3 4'
    );
    CREATE TABLE IF NOT EXISTS stable_line_reference (
      canonical_line_id TEXT PRIMARY KEY NOT NULL REFERENCES canonical_line(id),
      source_work_id TEXT NOT NULL,
      upstream_id TEXT,
      portable_id TEXT NOT NULL UNIQUE
    );
    DELETE FROM stable_line_reference;
    CREATE TABLE IF NOT EXISTS provider_line_coverage (
      canonical_line_id TEXT PRIMARY KEY NOT NULL REFERENCES canonical_line(id),
      has_sikhri_translation INTEGER NOT NULL DEFAULT 0,
      has_sikhri_terms INTEGER NOT NULL DEFAULT 0,
      has_banidb_translation INTEGER NOT NULL DEFAULT 0
    );
    DELETE FROM provider_line_coverage;
  `);

  const update = db.prepare('UPDATE line_search_index SET normalized_roman=?,phonetic_roman=?,consonant_roman=?,loose_gurmukhi=? WHERE line_id=?');
  const insertFts = db.prepare(`INSERT INTO line_search_fts(
    line_id,text_unit_id,roman,roman_phonetic,roman_consonants,gurmukhi,gurmukhi_loose,initials_gurmukhi,initials_latin
  ) VALUES (?,?,?,?,?,?,?,?,?)`);
  const insertStable = db.prepare('INSERT INTO stable_line_reference(canonical_line_id,source_work_id,upstream_id,portable_id) VALUES (?,?,?,?)');
  for (const row of db.prepare(`SELECT l.id,l.text_unit_id,l.source_work_id,l.upstream_id,l.gurmukhi,
      COALESCE(l.transliteration,'') AS transliteration,COALESCE(i.initials_gurmukhi,'') AS initials_gurmukhi,
      COALESCE(i.initials_latin,'') AS initials_latin
    FROM canonical_line l JOIN line_search_index i ON i.line_id=l.id`).iterate()) {
    const roman = normalizeRoman(row.transliteration);
    const phonetic = phoneticIndexText(row.transliteration);
    const consonants = consonantIndexText(row.transliteration);
    const gurmukhi = normalizeGurmukhi(row.gurmukhi);
    const loose = looseGurmukhi(gurmukhi);
    update.run(roman, phonetic, consonants, loose, row.id);
    insertFts.run(row.id, row.text_unit_id, roman, phonetic, consonants, gurmukhi, loose, row.initials_gurmukhi, row.initials_latin);
    const portable = row.upstream_id ? `${row.source_work_id}:${row.upstream_id}` : row.id;
    insertStable.run(row.id, row.source_work_id, row.upstream_id, portable);
  }
  db.exec(`
    INSERT INTO provider_line_coverage(canonical_line_id,has_sikhri_translation,has_sikhri_terms,has_banidb_translation)
    SELECT l.id,
      CASE WHEN EXISTS (
        SELECT 1 FROM tggsp_line_member m JOIN tggsp_line_alignment a ON a.id=m.alignment_id
        WHERE m.canonical_line_id=l.id AND (a.literal_translation_en<>'' OR a.literal_translation_pa<>'')
      ) THEN 1 ELSE 0 END,
      CASE WHEN EXISTS (SELECT 1 FROM tggsp_line_term t WHERE t.canonical_line_id=l.id) THEN 1 ELSE 0 END,
      CASE WHEN EXISTS (
        SELECT 1 FROM line_translation t WHERE t.canonical_line_id=l.id AND t.provider='banidb' AND t.language='en'
      ) THEN 1 ELSE 0 END
    FROM canonical_line l;
  `);
  const metadata = db.prepare('INSERT OR REPLACE INTO metadata(key,value) VALUES (?,?)');
  metadata.run('schema_version', '8');
  metadata.run('schema_release', 'v8');
  metadata.run('search_model', 'ranked normalised, phonetic, consonant, tolerant Gurmukhi and first-letter search');
  metadata.run('reading_profile', 'SGPC');
  metadata.run('personal_reference_model', 'portable source-work plus upstream line id');
  db.exec('COMMIT');
  db.exec('PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode=DELETE; ANALYZE;');
  const integrity = db.prepare('PRAGMA integrity_check').get()?.integrity_check;
  if (integrity !== 'ok') throw new Error(`SQLite integrity check failed: ${integrity}`);
  if (count('line_search_fts') !== count('canonical_line')) throw new Error('Not every canonical line reached the v8 search index');
  db.close();
  for (const suffix of ['', '-wal', '-shm', '-journal']) rmSync(`${outputPath}${suffix}`, { force: true });
  renameSync(buildingPath, outputPath);
  console.log(JSON.stringify({ status: 'pass', database: basename(outputPath), schemaRelease: 'v8', indexedLines: countFromFile(outputPath, 'line_search_fts') }, null, 2));
} catch (error) {
  try { db.exec('ROLLBACK'); } catch { /* transaction may already be closed */ }
  db.close();
  for (const suffix of ['', '-wal', '-shm', '-journal']) rmSync(`${buildingPath}${suffix}`, { force: true });
  throw error;
}

function addColumn(table, column, definition) {
  if (!db.prepare(`PRAGMA table_info(${table})`).all().some(row => row.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function count(table) {
  return Number(db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()?.count ?? 0);
}

function countFromFile(file, table) {
  const check = new DatabaseSync(file, { readOnly: true });
  const value = Number(check.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()?.count ?? 0);
  check.close();
  return value;
}
