import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';

const path = 'public/assets/databases/gurbani_reader_v5SQLite.db';
if (!existsSync(path)) throw new Error(`Reading database is missing: ${path}`);

const db = new DatabaseSync(path, { readOnly: true });
const scalar = (sql, key = 'n', ...params) => Number(db.prepare(sql).get(...params)?.[key] ?? 0);
const assert = (condition, message) => { if (!condition) throw new Error(message); };

assert(db.prepare('PRAGMA integrity_check').get()?.integrity_check === 'ok', 'SQLite integrity check failed');
assert(scalar('SELECT COUNT(*) n FROM canonical_line') === 68_138, 'Unexpected canonical line count');
assert(scalar('SELECT COUNT(*) n FROM text_unit') > 6_000, 'Text-unit index is incomplete');
assert(scalar("SELECT COUNT(DISTINCT text_unit_id) n FROM provider_content WHERE text_unit_id IS NOT NULL") === 948,
  'Unexpected TGGSP mapped-Sabad count');
assert(scalar(`SELECT COUNT(*) n FROM provider_content p LEFT JOIN text_unit u ON u.id = p.text_unit_id
  WHERE p.text_unit_id IS NOT NULL AND u.id IS NULL`) === 0, 'TGGSP contains orphan mappings');

const expectedLayers = [
  'commentary_en', 'commentary_pa', 'interpretive_transcreation_en', 'interpretive_transcreation_pa',
  'literal_translation_en', 'literal_translation_pa', 'poetical_dimension_en', 'poetical_dimension_pa',
  'reference_gurmukhi', 'transliteration'
];
const knownLayers = db.prepare(`SELECT content_type FROM provider_content
  WHERE text_unit_id = 'unit:banidb:G:shabad:1724' ORDER BY content_type`).all().map(row => row.content_type);
assert(JSON.stringify(knownLayers) === JSON.stringify(expectedLayers), 'Known TGGSP mapping does not expose all ten layers');

assert(scalar("SELECT COUNT(*) n FROM canonical_line WHERE lower(transliteration) LIKE '%naam%'") > 0,
  'Roman-spelling search probe for naam failed');
assert(scalar("SELECT COUNT(*) n FROM line_search_index WHERE initials_gurmukhi <> ''") === 68_138,
  'Gurmukhi first-letter index is incomplete');
assert(scalar("SELECT COUNT(*) n FROM line_search_index WHERE initials_latin <> ''") > 10_000,
  'Latin first-letter index is incomplete');
assert(scalar(`SELECT COUNT(DISTINCT text_unit_id) n FROM canonical_line
  WHERE contributor_id IN ('contributor:banidb:22','contributor:banidb:49')`) === 939,
  'Combined Bhai Gurdas presentation count is incomplete');

const topForm = db.prepare(`SELECT comparison_form FROM token_occurrence
  WHERE token_class = 'lexical_gurmukhi' GROUP BY comparison_form ORDER BY COUNT(*) DESC LIMIT 1`).get()?.comparison_form;
const topRaag = db.prepare(`SELECT raag FROM canonical_line WHERE raag IS NOT NULL AND raag <> ''
  GROUP BY raag ORDER BY COUNT(*) DESC LIMIT 1`).get()?.raag;
const scoped = db.prepare(`SELECT COUNT(*) n FROM token_occurrence t JOIN canonical_line l ON l.id = t.line_id
  WHERE t.token_class = 'lexical_gurmukhi' AND t.comparison_form = ? AND l.raag = ?`).get(topForm, topRaag)?.n;
assert(Number(scoped) > 0, 'Scoped exact-frequency query failed');

const sourceRows = db.prepare('SELECT id, title FROM source_work ORDER BY id').all();
console.log(JSON.stringify({
  status: 'pass', canonicalLines: 68_138, sources: sourceRows, mappedTggspSabads: 948,
  knownTggspLayers: knownLayers.length, combinedBhaiGurdasPassages: 939, scopedFrequencyProbe: Number(scoped)
}, null, 2));
