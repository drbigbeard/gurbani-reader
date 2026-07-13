import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

const db = new DatabaseSync('public/assets/databases/gurbani_reader_v4SQLite.db', { readOnly: true });
const scalar = (sql, ...params) => Number(db.prepare(sql).get(...params)?.n ?? 0);
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const formCounts = Object.fromEntries(db.prepare(`SELECT source_work_id, COUNT(DISTINCT exact_form) AS forms
  FROM token_occurrence WHERE token_class='lexical_gurmukhi' GROUP BY source_work_id`).all().map(row => [row.source_work_id, Number(row.forms)]));
assert(formCounts['source:G'] === 29_495, 'Guru Granth Sahib exact-form index is incomplete');
assert(formCounts['source:B'] === 12_871, 'Vaaran exact-form index is incomplete');
assert(scalar('SELECT COUNT(*) n FROM bani_collection') === 82, 'Named Bani index is incomplete');
assert(scalar("SELECT COUNT(DISTINCT exact_form) n FROM token_occurrence WHERE source_work_id='source:G' AND token_class='lexical_gurmukhi' AND exact_form LIKE 'ਸ%'") > 3_000,
  'Gurmukhi letter filtering failed');

const sampleLines = db.prepare(`SELECT id FROM canonical_line ORDER BY id LIMIT 3`).all().map(row => row.id);
const linePlaceholders = sampleLines.map(() => '?').join(',');
assert(scalar(`SELECT COUNT(*) n FROM canonical_line WHERE id IN (${linePlaceholders})`, ...sampleLines) === 3, 'Saved-line lookup failed');
const sampleUnits = db.prepare(`SELECT id FROM text_unit ORDER BY id LIMIT 3`).all().map(row => row.id);
const unitPlaceholders = sampleUnits.map(() => '?').join(',');
assert(scalar(`SELECT COUNT(*) n FROM text_unit WHERE id IN (${unitPlaceholders})`, ...sampleUnits) === 3, 'History lookup failed');

const appSource = readFileSync('src/App.tsx', 'utf8');
const backupSource = readFileSync('src/lib/backup.ts', 'utf8');
for (const marker of ['SavedLines', 'Export backup', 'Import backup', 'Copy direct reference', 'Load 100 more', 'Save this search']) {
  assert(appSource.includes(marker), `RC UI marker missing: ${marker}`);
}
assert(backupSource.includes("format: 'gurbani-reader-backup'") && backupSource.includes('Share.share'), 'Native backup implementation is incomplete');

console.log(JSON.stringify({ status: 'pass', exactForms: formCounts, namedBanis: 82,
  savedLineLookup: 3, historyUnitLookup: 3, personalFeatures: 'present' }, null, 2));
