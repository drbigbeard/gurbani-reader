#!/usr/bin/env node
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

const db = new DatabaseSync('public/assets/databases/gurbani_reader_v5SQLite.db', { readOnly: true });
const scalar = (sql, ...params) => Number(db.prepare(sql).get(...params)?.n ?? 0);
const text = (sql, ...params) => String(db.prepare(sql).get(...params)?.value ?? '');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

assert(db.prepare('PRAGMA integrity_check').get()?.integrity_check === 'ok', 'SQLite integrity check failed');
assert(text("SELECT value FROM metadata WHERE key='schema_release'") === 'v5', 'Reading database is not schema v5');
assert(scalar('SELECT COUNT(*) n FROM tggsp_collection') === 70, 'Published TGGSP reading catalogue is incomplete');
assert(scalar("SELECT COUNT(*) n FROM tggsp_collection WHERE collection_type='ceremonial'") === 5, 'Ceremonial TGGSP catalogue is incomplete');
assert(scalar('SELECT COUNT(*) n FROM tggsp_collection_section') === 320, 'TGGSP section order is incomplete');
assert(scalar('SELECT COUNT(*) n FROM tggsp_line_alignment') >= 4_000, 'Verified TGGSP line alignment coverage regressed');
assert(scalar("SELECT COUNT(*) n FROM tggsp_line_alignment WHERE literal_translation_en<>''") >= 3_400, 'Inline literal translation coverage regressed');
assert(scalar('SELECT COUNT(*) n FROM tggsp_line_term') >= 23_000, 'Inline etymology coverage regressed');
assert(scalar('SELECT COUNT(*) n FROM bani_line_crosswalk WHERE canonical_line_id IS NOT NULL') >= 18_700, 'Named-Bani crosswalk coverage regressed');

assert(scalar(`SELECT COUNT(*) n FROM tggsp_line_member m
  LEFT JOIN tggsp_line_alignment a ON a.id=m.alignment_id
  LEFT JOIN canonical_line l ON l.id=m.canonical_line_id
  WHERE a.id IS NULL OR l.id IS NULL`) === 0, 'TGGSP alignment has orphaned rows');
assert(scalar(`SELECT COUNT(*) n FROM tggsp_line_member m
  JOIN tggsp_line_alignment a ON a.id=m.alignment_id
  JOIN canonical_line l ON l.id=m.canonical_line_id
  WHERE l.text_unit_id<>a.text_unit_id`) === 0, 'TGGSP line escaped its verified Sabad boundary');
assert(scalar(`SELECT COUNT(*) n FROM tggsp_line_member m
  JOIN tggsp_line_alignment a ON a.id=m.alignment_id
  WHERE m.is_anchor=1 AND m.canonical_line_id<>a.anchor_line_id`) === 0, 'Translation anchor invariant failed');

const ceremonySections = new Map(db.prepare(`SELECT collection_code AS code,COUNT(*) AS n
  FROM tggsp_collection_section WHERE collection_code IN ('IntCer','ASWC1','ASWC2','ASFC','BANC')
  GROUP BY collection_code`).all().map(row => [String(row.code), Number(row.n)]));
for (const [code, expected] of Object.entries({ IntCer: 5, ASWC1: 3, ASWC2: 6, ASFC: 7, BANC: 4 })) {
  assert(ceremonySections.get(code) === expected, `${code} ceremony section order is incomplete`);
  assert(scalar("SELECT COUNT(*) n FROM tggsp_line_alignment WHERE collection_code=? AND literal_translation_en<>''", code) > 20,
    `${code} has no usable inline translations`);
}
assert(scalar("SELECT COUNT(*) n FROM tggsp_collection_section WHERE collection_code='SuhiM'") === 4, 'Lava must retain all four supplied sections');
assert(scalar("SELECT COUNT(DISTINCT x.line_order) n FROM bani_line_crosswalk x JOIN tggsp_line_member m ON m.canonical_line_id=x.canonical_line_id AND m.is_anchor=1 JOIN tggsp_line_alignment a ON a.id=m.alignment_id WHERE x.bani_id='bani:banidb:90' AND a.literal_translation_en<>''") >= 240,
  'Asa Ki Vaar named-Bani view has lost inline TGGSP translations');

const appSource = readFileSync('src/App.tsx', 'utf8');
const controlsSource = readFileSync('src/components/TextControls.tsx', 'utf8');
const navigationSource = readFileSync('src/lib/navigation.ts', 'utf8');
const gatewaySource = readFileSync('src/lib/mobile-gateway.ts', 'utf8');
for (const marker of ['tggsp-badge', 'TGGSP readings', 'Ceremonial readings', 'line-etymology', 'tggspTranslation']) {
  assert(appSource.includes(marker), `RC3 UI marker missing: ${marker}`);
}
assert(controlsSource.includes('> Translation</label>'), 'Inline Translation toggle is missing or mislabeled');
assert(!navigationSource.includes('NativeApp.exitApp'), 'Android back gesture can still exit the app');
assert(gatewaySource.includes('start+=400'), 'Large named-Bani enrichment is not safely batched for Android SQLite');

console.log(JSON.stringify({ status: 'pass', publishedTggspReadings: 70, ceremonialReadings: 5,
  verifiedLineAlignments: scalar('SELECT COUNT(*) n FROM tggsp_line_alignment'),
  inlineTranslations: scalar("SELECT COUNT(*) n FROM tggsp_line_alignment WHERE literal_translation_en<>''"),
  inlineTerms: scalar('SELECT COUNT(*) n FROM tggsp_line_term'),
  asaKiVaarTranslatedAnchors: scalar("SELECT COUNT(DISTINCT x.line_order) n FROM bani_line_crosswalk x JOIN tggsp_line_member m ON m.canonical_line_id=x.canonical_line_id AND m.is_anchor=1 JOIN tggsp_line_alignment a ON a.id=m.alignment_id WHERE x.bani_id='bani:banidb:90' AND a.literal_translation_en<>''") }, null, 2));
