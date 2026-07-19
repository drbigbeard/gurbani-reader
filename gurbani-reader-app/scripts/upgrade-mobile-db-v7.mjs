#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const inputPath = resolve(process.argv[2] ?? 'public/assets/databases/gurbani_reader_v6SQLite.db');
const outputPath = resolve(process.argv[3] ?? 'public/assets/databases/gurbani_reader_v7SQLite.db');
const snapshotRoot = process.argv[4] ? resolve(process.argv[4]) : null;
if (!existsSync(inputPath)) throw new Error(`v0.13 database is missing: ${inputPath}`);
mkdirSync(dirname(outputPath), { recursive: true });
for (const suffix of ['', '-wal', '-shm', '-journal']) rmSync(`${outputPath}${suffix}`, { force: true });
copyFileSync(inputPath, outputPath);

const db = new DatabaseSync(outputPath);
db.exec('PRAGMA foreign_keys=OFF; PRAGMA journal_mode=WAL; BEGIN IMMEDIATE;');
try {
  if (snapshotRoot && existsSync(resolve(snapshotRoot, 'manifest.json'))) enrichTransliterations(snapshotRoot);
  if (!columnExists('line_search_index', 'normalized_roman')) db.exec("ALTER TABLE line_search_index ADD COLUMN normalized_roman TEXT NOT NULL DEFAULT ''");
  if (!columnExists('line_search_index', 'phonetic_roman')) db.exec("ALTER TABLE line_search_index ADD COLUMN phonetic_roman TEXT NOT NULL DEFAULT ''");
  db.exec(`
    CREATE TABLE IF NOT EXISTS search_alias (
      id TEXT PRIMARY KEY NOT NULL,
      alias TEXT NOT NULL,
      normalized_alias TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      display_title TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_search_alias_normalized ON search_alias(normalized_alias);
    DROP TABLE IF EXISTS line_search_fts;
    CREATE VIRTUAL TABLE line_search_fts USING fts5(
      line_id UNINDEXED, roman, roman_phonetic, gurmukhi,
      tokenize='unicode61 remove_diacritics 2'
    );
  `);
  const update = db.prepare('UPDATE line_search_index SET normalized_roman=?,phonetic_roman=? WHERE line_id=?');
  const insertFts = db.prepare('INSERT INTO line_search_fts(line_id,roman,roman_phonetic,gurmukhi) VALUES (?,?,?,?)');
  for (const row of db.prepare(`SELECT l.id,l.gurmukhi,COALESCE(l.transliteration,'') AS transliteration FROM canonical_line l`).iterate()) {
    const roman = normalizeRoman(row.transliteration); const phonetic = phoneticRoman(roman);
    update.run(roman, phonetic, row.id); insertFts.run(row.id, roman, phonetic, row.gurmukhi);
  }
  db.exec('DELETE FROM search_alias');
  const insertAlias = db.prepare('INSERT OR IGNORE INTO search_alias(id,alias,normalized_alias,target_type,target_id,display_title) VALUES (?,?,?,?,?,?)');
  for (const row of db.prepare(`SELECT id,token,transliteration FROM bani_collection`).all()) {
    const title = preferredBaniTitle(row.transliteration, row.token);
    const aliases = new Set([row.transliteration, row.token.replaceAll('-', ' '), title, ...curatedAliases(row.token)]);
    for (const alias of aliases) if (alias) insertAlias.run(`${row.id}:${normalizeRoman(alias)}`, alias, normalizeRoman(alias), 'bani', row.id, title);
  }
  db.prepare("UPDATE source_work SET title='Dasam Bani' WHERE id='source:D'").run();
  const metadata = db.prepare('INSERT OR REPLACE INTO metadata(key,value) VALUES (?,?)');
  metadata.run('schema_version', '7'); metadata.run('schema_release', 'v7');
  metadata.run('search_model', 'normalised Roman phrase + phonetic phrase + Gurmukhi + first letters');
  db.exec('COMMIT');
} catch (error) { db.exec('ROLLBACK'); throw error; }
db.exec('PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode=DELETE; ANALYZE;');
const integrity = db.prepare('PRAGMA integrity_check').get()?.integrity_check;
if (integrity !== 'ok') throw new Error(`SQLite integrity check failed: ${integrity}`);
const sample = db.prepare(`SELECT l.gurmukhi,l.transliteration FROM line_search_fts f JOIN canonical_line l ON l.id=f.line_id WHERE line_search_fts MATCH ? AND l.gurmukhi LIKE 'ਜੋ ਮਾਗਹਿ%' LIMIT 1`).get('roman_phonetic:"j mag"*');
if (!sample) throw new Error('Regression fixture failed: jo mange did not match “ਜੋ ਮਾਗਹਿ …” in the installed reading data');
console.log(JSON.stringify({ status: 'pass', database: basename(outputPath), schemaRelease: 'v7', indexedLines: count('line_search_index'), aliases: count('search_alias'), joMange: sample }, null, 2));
db.close();

function normalizeRoman(value) { return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toLowerCase().replace(/\(([a-z])\)/gu, '$1').replace(/[^a-z\s]/gu, ' ').replace(/([aeiou])\1+/gu, '$1').replace(/\s+/gu, ' ').trim(); }
function phoneticRoman(value) { return normalizeRoman(value).split(' ').map(word => word.replace(/aa/gu,'a').replace(/ee|ii/gu,'i').replace(/oo|uu/gu,'u').replace(/ai|ae/gu,'e').replace(/au/gu,'o').replace(/ng/gu,'g').replace(/(eai|ahi|ai|ee|[aeiou])$/u,'')).join(' '); }
function preferredBaniTitle(value, token) { if (/asa\s+(ki|di)\s+v(a|aa)r/iu.test(value)) return 'Asa Di Vaar'; return String(value || token).trim(); }
function curatedAliases(token) { return ({ 'sukhmani-sahib':['Sukhmani','Sukhmani Sahib','Sukhamanee Sahib'], 'asa-di-vaar':['Asa Di Vaar','Asa Ki Vaar','Aasa Di Var','Aasa Ki Vaar'], 'kirtan-sohila':['Kirtan Sohila','Sohila Sahib'], 'japji':['Japji Sahib'], 'anand':['Anand Sahib'], 'rehras':['Rehras Sahib','Rehraas Sahib'], 'tav-prasad-savaiye':['Tav Prasad Savaiye','Tva Prasad Savaiye'], 'benti-chaupai':['Benti Chaupai','Chaupai Sahib'] }[token] ?? []); }
function columnExists(table, column) { return db.prepare(`PRAGMA table_info(${table})`).all().some(row => row.name === column); }
function count(table) { return Number(db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()?.count ?? 0); }
function enrichTransliterations(root) {
  const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8'));
  const update = db.prepare(`UPDATE canonical_line SET transliteration=? WHERE source_work_id=? AND upstream_id=? AND COALESCE(transliteration,'')=''`);
  for (const file of manifest.files.filter(row => row.kind === 'ang' && ['G','B'].includes(row.source))) {
    const body = JSON.parse(readFileSync(resolve(root, file.path), 'utf8'));
    for (const row of body.page ?? []) {
      const transliteration = String(row.transliteration?.english ?? row.transliteration?.en ?? '').trim();
      if (transliteration) update.run(transliteration, `source:${file.source}`, String(row.verseId));
    }
  }
}
