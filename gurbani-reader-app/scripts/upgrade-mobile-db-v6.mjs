#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const BANI_DEFINITIONS = {
  4: { token: 'jaap', sourceWorkId: 'source:D' },
  5: { token: 'shabad-hazare-patshahi-10', sourceWorkId: 'source:D' },
  6: { token: 'tav-prasad-savaiye', sourceWorkId: 'source:D' },
  9: { token: 'benti-chaupai', sourceWorkId: 'source:D' },
  21: { token: 'rehras', sourceWorkId: 'source:G' },
  23: { token: 'kirtan-sohila', sourceWorkId: 'source:G' },
  24: { token: 'ardas', sourceWorkId: 'source:G' }
};

const inputPath = resolve(process.argv[2] ?? 'public/assets/databases/gurbani_reader_v5SQLite.db');
const outputPath = resolve(process.argv[3] ?? 'public/assets/databases/gurbani_reader_v6SQLite.db');
const snapshotRoot = resolve(process.argv[4] ?? '../../v013-banidb-snapshot');
if (!existsSync(inputPath)) throw new Error(`v0.12 database is missing: ${inputPath}`);
if (!existsSync(resolve(snapshotRoot, 'manifest.json'))) throw new Error(`v0.13 BaniDB snapshot is missing: ${snapshotRoot}`);
mkdirSync(dirname(outputPath), { recursive: true });
for (const suffix of ['-wal', '-shm', '-journal']) rmSync(`${outputPath}${suffix}`, { force: true });
copyFileSync(inputPath, outputPath);

const manifest = readJson(resolve(snapshotRoot, 'manifest.json'));
const db = new DatabaseSync(outputPath);
db.exec('PRAGMA foreign_keys=OFF; PRAGMA journal_mode=WAL;');
db.exec(`
  CREATE TABLE IF NOT EXISTS line_translation (
    canonical_line_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    language TEXT NOT NULL,
    content TEXT NOT NULL,
    source_key TEXT NOT NULL,
    snapshot_sha256 TEXT NOT NULL,
    PRIMARY KEY (canonical_line_id, provider, language)
  );
  CREATE INDEX IF NOT EXISTS idx_line_translation_content ON line_translation(provider, language, content);
`);
if (!columnExists('bani_collection_line', 'translation_bdb_en')) db.exec("ALTER TABLE bani_collection_line ADD COLUMN translation_bdb_en TEXT NOT NULL DEFAULT ''");

const allAngRows = manifest.files.filter(row => row.kind === 'ang').flatMap(file => {
  const body = readJson(resolve(snapshotRoot, file.path));
  return (body.page ?? []).map(row => ({ ...row, snapshotSha256: file.sha256, snapshotSource: file.url, snapshotSourceWork: file.source }));
});
const baniFiles = new Map(manifest.files.filter(row => row.kind === 'bani').map(file => [Number(file.id), file]));
const selectedBanis = [4, 5, 6, 9, 21, 23, 24].map(id => {
  const file = baniFiles.get(id);
  if (!file) throw new Error(`Snapshot is missing SGPC Bani ${id}`);
  return { id, file, body: readJson(resolve(snapshotRoot, file.path)), definition: BANI_DEFINITIONS[id] };
});
const selectedForms = new Set(selectedBanis.flatMap(bani => bani.body.verses ?? []).map(entry => comparable(entry.verse?.verse?.unicode)).filter(Boolean));
const dasamRows = allAngRows.filter(row => row.snapshotSourceWork === 'D' && selectedForms.has(comparable(row.verse?.unicode)));
const existingRows = allAngRows.filter(row => ['G', 'B', 'S'].includes(row.snapshotSourceWork));
const releaseId = `banidb-v013-${manifest.generatedAt.slice(0, 10)}-${manifest.sha256.slice(0, 12)}`;
const analysisReleaseId = `analysis:v013:${manifest.sha256.slice(0, 16)}`;

db.exec('BEGIN IMMEDIATE');
try {
  db.exec('DELETE FROM line_translation');
  const canonicalByUpstream = new Map(db.prepare(`SELECT id,upstream_id AS upstreamId FROM canonical_line WHERE source_work_id IN ('source:G','source:B') AND upstream_id IS NOT NULL`).all().map(row => [String(row.upstreamId), String(row.id)]));
  const insertTranslation = db.prepare(`INSERT OR REPLACE INTO line_translation(canonical_line_id,provider,language,content,source_key,snapshot_sha256) VALUES (?,?,?,?,?,?)`);
  const updateTransliteration = db.prepare(`UPDATE canonical_line SET transliteration=? WHERE id=? AND COALESCE(transliteration,'')=''`);
  for (const row of existingRows) {
    const lineId = canonicalByUpstream.get(String(row.verseId));
    const content = clean(row.translation?.en?.bdb);
    if (lineId && content) insertTranslation.run(lineId, 'banidb', 'en', content, row.snapshotSource, row.snapshotSha256);
    const transliteration = clean(row.transliteration?.english || row.transliteration?.en);
    if (lineId && transliteration) updateTransliteration.run(transliteration, lineId);
  }

  const corpusRelease = String(db.prepare("SELECT value FROM metadata WHERE key='corpus_release_id'").get()?.value ?? releaseId);
  db.prepare(`INSERT OR REPLACE INTO source_work(id,upstream_id,title,profile,corpus_release_id) VALUES ('source:D','D','Dasam Bani — selected SGPC readings','selected_readings',?)`).run(corpusRelease);
  importDasamRows(dasamRows, insertTranslation, analysisReleaseId);
  replaceSelectedBanis(selectedBanis);
  rebuildSelectedCrosswalk(selectedBanis.map(row => `bani:banidb:${row.id}`));
  rebuildLineSearchIndex();
  const metadata = db.prepare('INSERT OR REPLACE INTO metadata(key,value) VALUES (?,?)');
  metadata.run('schema_version', '6');
  metadata.run('schema_release', 'v6');
  metadata.run('banidb_v013_release_id', releaseId);
  metadata.run('banidb_v013_snapshot_checksum', manifest.sha256);
  metadata.run('reader_source_model', 'Guru Granth Sahib + combined Vaaran Bhai Gurdas + selected SGPC Dasam readings');
  metadata.run('translation_model', 'off | BaniDB | TGGSP where available');
  db.exec('COMMIT');
} catch (error) {
  db.exec('ROLLBACK');
  throw error;
}
db.exec('PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode=DELETE; ANALYZE;');
const integrity = db.prepare('PRAGMA integrity_check').get()?.integrity_check;
if (integrity !== 'ok') throw new Error(`SQLite integrity check failed: ${integrity}`);
const report = {
  status: 'pass', database: basename(outputPath), schemaRelease: 'v6',
  canonicalLines: count('canonical_line'), selectedDasamLines: count('canonical_line', "source_work_id='source:D'"),
  baniDbLineTranslations: count('line_translation', "provider='banidb' AND language='en'"),
  selectedSgpcReadings: count('bani_collection', 'upstream_id IN (4,5,6,9,21,23,24)'),
  selectedReadingLines: count('bani_collection_line', 'bani_id IN (\'bani:banidb:4\',\'bani:banidb:5\',\'bani:banidb:6\',\'bani:banidb:9\',\'bani:banidb:21\',\'bani:banidb:23\',\'bani:banidb:24\')'),
  selectedCrosswalks: count('bani_line_crosswalk', "bani_id IN ('bani:banidb:4','bani:banidb:5','bani:banidb:6','bani:banidb:9','bani:banidb:21','bani:banidb:23','bani:banidb:24') AND canonical_line_id IS NOT NULL"),
  snapshotChecksum: manifest.sha256
};
db.close();
console.log(JSON.stringify(report, null, 2));

function importDasamRows(rows, insertTranslation, tokenAnalysisReleaseId) {
  const contributors = new Map();
  const units = new Map();
  for (const row of rows) {
    const writerId = row.writer?.writerId;
    const contributorId = writerId == null ? null : `contributor:banidb:D:${writerId}`;
    if (contributorId) contributors.set(contributorId, { name: clean(row.writer?.english || row.writer?.unicode) || `BaniDB writer ${writerId}`, type: classifyContributor(row.writer?.english) });
    const unitId = `unit:banidb:D:shabad:${row.shabadId}`;
    units.set(unitId, { upstream: String(row.shabadId), order: number(row.shabadId), title: `Shabad ${row.shabadId}` });
  }
  const insertContributor = db.prepare('INSERT OR IGNORE INTO contributor(id,preferred_name,contributor_type) VALUES (?,?,?)');
  for (const [id, value] of contributors) insertContributor.run(id, value.name, value.type);
  const insertUnit = db.prepare(`INSERT OR IGNORE INTO text_unit(id,upstream_id,source_work_id,parent_id,unit_type,unit_order,title,review_status) VALUES (?,?,'source:D',NULL,'shabad',?,?,'selected_sgpc_reading')`);
  for (const [id, value] of units) insertUnit.run(id, value.upstream, value.order, value.title);
  const insertAttribution = db.prepare(`INSERT OR IGNORE INTO attribution(id,contributor_id,target_type,target_id,role,review_status) VALUES (?,?, 'textUnit',?,'writer_attribution','imported_from_banidb')`);
  const insertLine = db.prepare(`INSERT OR IGNORE INTO canonical_line(id,upstream_id,source_work_id,text_unit_id,contributor_id,line_order,ang,line_class,gurmukhi,transliteration,raag_id,raag) VALUES (?,?,'source:D',?,?,?,?,'canonical_verse',?,?,?,?)`);
  const insertToken = db.prepare(`INSERT OR IGNORE INTO token_occurrence(id,line_id,text_unit_id,source_work_id,token_position,exact_form,comparison_form,token_class,start_utf16,end_utf16,analysis_release_id) VALUES (?,?,?,'source:D',?,?,?,?,?,?,?)`);
  for (const row of rows) {
    const lineId = `line:banidb:D:${row.verseId}`;
    const unitId = `unit:banidb:D:shabad:${row.shabadId}`;
    const contributorId = row.writer?.writerId == null ? null : `contributor:banidb:D:${row.writer.writerId}`;
    if (contributorId) insertAttribution.run(`attribution:banidb:D:${row.shabadId}:${row.writer.writerId}`, contributorId, unitId);
    insertLine.run(lineId, String(row.verseId), unitId, contributorId, number(row.lineNo), number(row.pageNo), clean(row.verse?.unicode), clean(row.transliteration?.english || row.transliteration?.en), row.raag?.raagId == null ? null : String(row.raag.raagId), clean(row.raag?.english || row.raag?.unicode));
    const translation = clean(row.translation?.en?.bdb);
    if (translation) insertTranslation.run(lineId, 'banidb', 'en', translation, row.snapshotSource, row.snapshotSha256);
    for (const token of lexical(row.verse?.unicode)) insertToken.run(`token:${lineId}:${token.position}`, lineId, unitId, token.position, token.value, token.value.normalize('NFC'), 'lexical_gurmukhi', token.start, token.end, tokenAnalysisReleaseId);
  }
}

function replaceSelectedBanis(rows) {
  const removeCrosswalk = db.prepare('DELETE FROM bani_line_crosswalk WHERE bani_id=?');
  const removeLines = db.prepare('DELETE FROM bani_collection_line WHERE bani_id=?');
  const removeBani = db.prepare('DELETE FROM bani_collection WHERE id=?');
  const insertBani = db.prepare(`INSERT INTO bani_collection(id,upstream_id,token,source_work_id,gurmukhi,transliteration,verse_count,attribution_label,snapshot_sha256) VALUES (?,?,?,?,?,?,?,?,?)`);
  const insertLine = db.prepare(`INSERT INTO bani_collection_line(bani_id,line_order,upstream_verse_id,header_level,paragraph_number,gurmukhi,transliteration,translation_bdb_en) VALUES (?,?,?,?,?,?,?,?)`);
  for (const row of rows) {
    const id = `bani:banidb:${row.id}`;
    removeCrosswalk.run(id); removeLines.run(id); removeBani.run(id);
    const info = row.body.baniInfo ?? {};
    insertBani.run(id, row.id, row.definition.token, row.definition.sourceWorkId, clean(info.unicode), clean(info.english || info.en), row.body.verses?.length ?? 0, 'BaniDB SGPC reading (length=s)', row.file.sha256);
    for (const [lineOrder, entry] of (row.body.verses ?? []).entries()) {
      const verse = entry.verse ?? {};
      insertLine.run(id, lineOrder, verse.verseId ?? null, number(entry.header), entry.paragraph ?? null,
        clean(verse.verse?.unicode), clean(verse.transliteration?.english || verse.transliteration?.en), clean(verse.translation?.en?.bdb));
    }
  }
}

function rebuildSelectedCrosswalk(baniIds) {
  const placeholders = baniIds.map(() => '?').join(',');
  const rows = db.prepare(`SELECT bani_id AS baniId,line_order AS lineOrder,paragraph_number AS paragraphNumber,gurmukhi FROM bani_collection_line WHERE bani_id IN (${placeholders}) ORDER BY bani_id,line_order`).all(...baniIds);
  const canonical = db.prepare(`SELECT id,text_unit_id AS textUnitId,line_order AS lineOrder,ang,gurmukhi,source_work_id AS sourceWorkId FROM canonical_line WHERE source_work_id IN ('source:G','source:D') ORDER BY source_work_id,ang,line_order,id`).all();
  const byForm = new Map();
  for (const line of canonical) { const key = comparable(line.gurmukhi); const list = byForm.get(key) ?? []; list.push(line); byForm.set(key, list); }
  const grouped = new Map();
  for (const row of rows) { const key = `${row.baniId}|${row.paragraphNumber ?? row.lineOrder}`; const list = grouped.get(key) ?? []; list.push(row); grouped.set(key, list); }
  const insert = db.prepare('INSERT INTO bani_line_crosswalk(bani_id,line_order,canonical_line_id,text_unit_id,mapping_status) VALUES (?,?,?,?,?)');
  for (const group of grouped.values()) {
    const scores = new Map();
    for (const row of group) for (const candidate of byForm.get(comparable(row.gurmukhi)) ?? []) scores.set(candidate.textUnitId, (scores.get(candidate.textUnitId) ?? 0) + 1);
    const ranked = [...scores].sort((left, right) => right[1] - left[1]);
    const bestUnit = ranked[0] && (!ranked[1] || ranked[0][1] > ranked[1][1]) ? ranked[0][0] : null;
    for (const row of group) {
      let candidates = byForm.get(comparable(row.gurmukhi)) ?? [];
      if (bestUnit) candidates = candidates.filter(line => line.textUnitId === bestUnit);
      const candidate = candidates.length === 1 ? candidates[0] : null;
      insert.run(row.baniId, row.lineOrder, candidate?.id ?? null, candidate?.textUnitId ?? bestUnit,
        candidate ? 'verified_exact_within_paragraph_unit' : bestUnit ? 'unit_only' : 'unmapped');
    }
  }
}

function rebuildLineSearchIndex() {
  db.exec('DELETE FROM line_search_index');
  const insert = db.prepare('INSERT INTO line_search_index(line_id,source_work_id,initials_gurmukhi,initials_latin) VALUES (?,?,?,?)');
  for (const row of db.prepare('SELECT id,source_work_id AS sourceWorkId,gurmukhi,transliteration FROM canonical_line').all()) insert.run(row.id, row.sourceWorkId, initials(row.gurmukhi), latinInitials(row.transliteration));
}

function lexical(value) {
  const result = [];
  for (const match of String(value ?? '').matchAll(/[\p{L}\p{M}]+/gu)) result.push({ value: match[0], position: result.length, start: match.index, end: match.index + match[0].length });
  return result;
}
function initials(value) { return lexical(value).map(token => [...token.value][0] ?? '').join('').normalize('NFC'); }
function latinInitials(value) { return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toLowerCase().match(/[a-z]+/gu)?.map(token => token[0]).join('') ?? ''; }
function classifyContributor(name = '') { return /guru/iu.test(name) ? 'guru' : /bhagat|sheikh|sant/iu.test(name) ? 'bhagat' : /bhatt/iu.test(name) ? 'bhatt' : 'contributor'; }
function columnExists(table, column) { return db.prepare(`PRAGMA table_info(${table})`).all().some(row => row.name === column); }
function count(table, where = '1=1') { return Number(db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${where}`).get()?.count ?? 0); }
function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function comparable(value) { return String(value ?? '').normalize('NFC').replace(/\u0A4D/gu, '\u0A51').replace(/[\u200B-\u200D\uFEFF\u00A0\s]/gu, '').replace(/[।॥|]/gu, ''); }
function clean(value) { return typeof value === 'string' ? value.trim() : ''; }
function number(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
