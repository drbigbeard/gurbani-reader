import fs from 'node:fs';
import process from 'node:process';
import initSqlJs from 'sql.js';

const root = new URL('../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); console.log(`PASS  ${message}`); };
const SQL = await initSqlJs();
const db = new SQL.Database(fs.readFileSync(new URL('public/assets/databases/gurbani_reader_v5SQLite.db', root)));
const scalar = sql => db.exec(sql)[0]?.values?.[0]?.[0] ?? 0;

assert(Number(scalar('SELECT COUNT(*) FROM canonical_line')) > 68000, 'complete installed reading data is present');
assert(Number(scalar("SELECT COUNT(*) FROM tggsp_line_alignment WHERE literal_translation_en<>''")) > 3000, 'TGGSP literal translations are present');
assert(Number(scalar('SELECT COUNT(*) FROM tggsp_line_term')) > 20000, 'TGGSP word analysis is present');
assert(Number(scalar("SELECT COUNT(*) FROM tggsp_collection WHERE code IN ('AKV','ASahib')")) === 2, 'Asa Di Vaar and Anand Sahib TGGSP collections are present');
assert(Number(scalar("SELECT COUNT(*) FROM tggsp_line_alignment a WHERE a.translation_scope='passage' AND (SELECT COUNT(*) FROM tggsp_line_alignment grouped WHERE grouped.collection_code=a.collection_code AND grouped.section_id=a.section_id AND grouped.subsection_id=a.subsection_id)>1")) > 50, 'multi-line passage translations remain explicitly modelled');
assert(Number(scalar("SELECT COUNT(DISTINCT headword) FROM tggsp_line_term WHERE lower(transliteration) LIKE 'nam%'")) > 2, 'Roman dictionary query can return multiple Nam forms');
assert(Number(scalar("SELECT COUNT(DISTINCT headword) FROM tggsp_line_term WHERE lower(meaning_en) LIKE '%love%' OR lower(etymology_en) LIKE '%love%'")) > 5, 'experimental English concept query can suggest multiple Gurbani terms');

const app = read('src/App.tsx');
const gateway = read('src/lib/mobile-gateway.ts');
const controls = read('src/components/TextControls.tsx');
const navigation = read('src/lib/navigation.ts');
assert(app.includes('Live shortlist') && app.includes('Customise Home'), 'live search and customisable Home are wired');
assert(app.includes('Experimental concept') && app.includes('Roman spelling'), 'dictionary modes are clearly represented');
assert(app.includes('Asa Di Vaar') && app.includes("replace(/Di/gi,'Ki')"), 'Asa Di/Ki Vaar aliases are searchable');
assert(controls.includes('showWordAnalysis') && controls.includes('tggspLanguage'), 'TGGSP layers and language are independently controlled');
assert(gateway.includes('tggspPassageMemberCount') && gateway.includes('literal_translation_pa'), 'passage scope and Panjabi literal translation are carried to the reader');
assert(navigation.includes("NativeApp.addListener('backButton'"), 'Android back gesture is handled by in-app history');

console.log('\nv0.12 audit passed.');
process.exit(0);
