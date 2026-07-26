#!/usr/bin/env node
import { copyFileSync, existsSync, rmSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const inputPath = resolve(process.argv[2] ?? 'public/assets/databases/gurbani_reader_v9SQLite.db');
const outputPath = resolve(process.argv[3] ?? 'public/assets/databases/gurbani_reader_v10SQLite.db');
if (!existsSync(inputPath)) throw new Error(`v0.16 RC4 database is missing: ${inputPath}`);

for (const suffix of ['', '-wal', '-shm', '-journal']) rmSync(`${outputPath}${suffix}`, { force: true });
copyFileSync(inputPath, outputPath);

const db = new DatabaseSync(outputPath);
db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; BEGIN IMMEDIATE;');

const rows = db.prepare(`
  SELECT a.id, a.collection_code AS collectionCode, a.section_order AS sectionOrder,
    a.subsection_order AS subsectionOrder, a.provider_line_order AS providerLineOrder,
    a.anchor_line_id AS anchorLineId, a.reference_gurmukhi AS referenceGurmukhi,
    a.tggsp_transliteration AS transliteration,
    a.literal_translation_en AS literalEn, a.literal_translation_pa AS literalPa,
    a.translation_scope AS translationScope, a.mapping_status AS mappingStatus,
    (SELECT COUNT(*) FROM tggsp_line_member m WHERE m.alignment_id=a.id) AS memberCount
  FROM tggsp_line_alignment a
  ORDER BY a.collection_code, a.section_order, a.subsection_order, a.provider_line_order
`).all();

const groups = new Map();
for (const row of rows) {
  const key = `${row.collectionCode}|${row.sectionOrder}|${row.subsectionOrder}`;
  const group = groups.get(key) ?? [];
  group.push(row);
  groups.set(key, group);
}

const clear = db.prepare(`
  UPDATE tggsp_line_alignment
  SET tggsp_transliteration='', literal_translation_en='', literal_translation_pa='',
    translation_scope='none', mapping_status='passage_member_no_inferred_line_translation'
  WHERE id=?
`);
const passage = db.prepare(`
  UPDATE tggsp_line_alignment
  SET tggsp_transliteration='', literal_translation_en=?, literal_translation_pa=?,
    translation_scope='passage', mapping_status='verified_passage_boundary'
  WHERE id=?
`);
const clearTransliteration = db.prepare(`
  UPDATE tggsp_line_alignment SET tggsp_transliteration='' WHERE id=?
`);

let demotedGroups = 0;
let demotedLineTranslations = 0;
let clearedUnverifiedTransliterations = 0;
for (const group of groups.values()) {
  const content = group.filter(row => row.anchorLineId && !isHeading(row.referenceGurmukhi));
  const strictSingleReference = content.length === 1 && Number(content[0].memberCount) === 1;
  if (!strictSingleReference && !group.every(row => row.mappingStatus === 'verified_manual_line')) {
    for (const row of group) {
      if (!row.transliteration) continue;
      clearTransliteration.run(row.id);
      clearedUnverifiedTransliterations += 1;
    }
  }

  const translated = group.filter(
    row => row.translationScope === 'line' && (row.literalEn || row.literalPa),
  );
  if (!translated.length) continue;

  const strictSingleLine =
    strictSingleReference
    && translated.length === 1
    && translated[0].id === content[0].id;
  if (strictSingleLine || translated.every(row => row.mappingStatus === 'verified_manual_line')) continue;

  const target = content.at(-1) ?? group.filter(row => row.anchorLineId).at(-1);
  if (!target) continue;
  const english = translated.map(row => String(row.literalEn ?? '').trim()).filter(Boolean).join('\n');
  const panjabi = translated.map(row => String(row.literalPa ?? '').trim()).filter(Boolean).join('\n');
  for (const row of group) clear.run(row.id);
  passage.run(english, panjabi, target.id);
  demotedGroups += 1;
  demotedLineTranslations += translated.length;
}

db.prepare("INSERT OR REPLACE INTO metadata(key,value) VALUES ('schema_version','10')").run();
db.prepare("INSERT OR REPLACE INTO metadata(key,value) VALUES ('schema_release','v10')").run();
db.prepare("INSERT OR REPLACE INTO metadata(key,value) VALUES ('tggsp_alignment_release','rc5-strict-line-or-passage-v1')").run();
db.exec('COMMIT; PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode=DELETE; ANALYZE;');

const inferred = db.prepare(`
  SELECT COUNT(*) AS count
  FROM tggsp_line_alignment a
  WHERE a.translation_scope='line'
    AND (a.literal_translation_en<>'' OR a.literal_translation_pa<>'')
    AND a.mapping_status NOT IN ('verified_manual_line')
    AND (
      (SELECT COUNT(*) FROM tggsp_line_member m WHERE m.alignment_id=a.id)<>1
      OR EXISTS (
        SELECT 1 FROM tggsp_line_alignment sibling
        WHERE sibling.collection_code=a.collection_code
          AND sibling.section_order=a.section_order
          AND sibling.subsection_order=a.subsection_order
          AND sibling.anchor_line_id<>''
          AND sibling.id<>a.id
          AND sibling.reference_gurmukhi NOT GLOB 'ਸਲੋਕ*'
          AND sibling.reference_gurmukhi NOT GLOB 'ਪਉੜੀ*'
          AND sibling.reference_gurmukhi NOT GLOB 'ਰਾਗ*'
          AND sibling.reference_gurmukhi NOT GLOB 'ਮਹਲਾ*'
      )
    )
`).get()?.count ?? 0;
if (Number(inferred) !== 0)
  throw new Error(`Unverified inline TGGSP translations remain: ${inferred}`);

const integrity = db.prepare('PRAGMA integrity_check').get()?.integrity_check;
if (integrity !== 'ok') throw new Error(`SQLite integrity check failed: ${integrity}`);
db.close();

console.log(JSON.stringify({
  status: 'pass',
  database: basename(outputPath),
  schemaRelease: 'v10',
  alignmentRelease: 'rc5-strict-line-or-passage-v1',
  demotedGroups,
  demotedLineTranslations,
  clearedUnverifiedTransliterations,
  remainingUnverifiedInlineTranslations: Number(inferred),
}, null, 2));

function isHeading(value) {
  return /^(ੴ|ਰਾਗੁ?|ਮਃ|ਮਹਲਾ|ਸਲੋਕ|ਸਲੋਕੁ|ਪਉੜੀ)/u.test(String(value ?? '').trim());
}
