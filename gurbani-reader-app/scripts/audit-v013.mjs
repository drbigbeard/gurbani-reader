import fs from 'node:fs';
import initSqlJs from 'sql.js';

const root = new URL('../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); console.log(`PASS  ${message}`); };
const SQL = await initSqlJs();
const db = new SQL.Database(fs.readFileSync(new URL('public/assets/databases/gurbani_reader_v6SQLite.db', root)));
const scalar = sql => db.exec(sql)[0]?.values?.[0]?.[0] ?? 0;

assert(String(scalar("SELECT value FROM metadata WHERE key='schema_release'")) === 'v6', 'v0.13 reading-data schema is installed');
assert(Number(scalar('SELECT COUNT(*) FROM canonical_line')) > 69100, 'complete installed readings plus selected Dasam lines are present');
assert(Number(scalar("SELECT COUNT(*) FROM canonical_line WHERE source_work_id='source:D'")) > 1000, 'selected SGPC Dasam reading lines are present');
assert(Number(scalar("SELECT COUNT(*) FROM line_translation WHERE provider='banidb' AND language='en'")) > 68900, 'BaniDB English translations are indexed per canonical line');
assert(Number(scalar('SELECT COUNT(*) FROM bani_collection WHERE upstream_id IN (4,5,6,9,21,24)')) === 6, 'all six agreed SGPC readings are present');
assert(Number(scalar("SELECT COUNT(*) FROM bani_collection WHERE upstream_id IN (4,5,6,9) AND attribution_label LIKE '%length=s%'")) === 4, 'Dasam readings explicitly use SGPC length=s snapshots');
assert(Number(scalar("SELECT COUNT(*) FROM bani_collection WHERE upstream_id IN (21,24) AND source_work_id='source:G'")) === 2, 'Rehras and Ardas remain compiled readings rather than wholly Dasam-labelled');
assert(Number(scalar('SELECT COUNT(*) FROM tggsp_collection')) === 70, 'all published TGGSP English collections remain included');
assert(Number(scalar("SELECT COUNT(*) FROM tggsp_collection WHERE code IN ('BANC','IntCer','ASWC1','ASWC2','SuhiM','ASFC')")) === 6, 'the complete TGGSP life-event path is present');
assert(Number(scalar("SELECT COUNT(*) FROM tggsp_line_alignment WHERE translation_scope='passage' AND literal_translation_en<>''")) > 50, 'TGGSP whole-passage translations remain explicitly preserved');

const app = read('src/App.tsx');
const controls = read('src/components/TextControls.tsx');
const gateway = read('src/lib/mobile-gateway.ts');
const navigation = read('src/lib/navigation.ts');
assert(controls.includes("'off' | 'banidb' | 'tggsp'") || read('src/lib/persistence.ts').includes("'off' | 'banidb' | 'tggsp'"), 'translation has exactly Off, BaniDB and TGGSP-where-available states');
assert(app.includes("preferences.translationSource === 'tggsp'") && app.includes("preferences.translationSource === 'banidb'"), 'reader applies the selected translation provider');
assert(app.includes('showPassageTranslation') && app.includes('!hasTggspTranslation'), 'TGGSP passage translations stay at their supplied anchor without line-level substitution');
assert(gateway.includes('line_translation') && gateway.includes('translation_bdb_en'), 'canonical and compiled-reading BaniDB translations reach the reader');
assert(controls.includes('Gurmukhi weight') && controls.includes('TGGSP word details'), 'font weight and accurately named TGGSP word details are exposed');
assert(controls.includes('popover-close') && navigation.includes('gurbani:close-overlay'), 'reader panels are dismissible and Android Back closes them first');
assert(app.includes(`small>/{maxAng}`) && app.includes('home-reader-row'), 'Ang totals and compact reading shortcuts are implemented');
assert(app.includes('tggspLifeEventOrder') && app.includes('Life events · ordered'), 'TGGSP life-event navigation is ordered and filterable');
assert(!app.includes('Named, daily'), 'the ambiguous Daily label is removed');

console.log('\nv0.13 audit passed.');
