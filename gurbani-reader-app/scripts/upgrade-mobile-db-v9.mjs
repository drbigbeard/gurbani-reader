#!/usr/bin/env node
import { copyFileSync, existsSync, rmSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const inputPath = resolve(process.argv[2] ?? 'public/assets/databases/gurbani_reader_v8SQLite.db');
const outputPath = resolve(process.argv[3] ?? 'public/assets/databases/gurbani_reader_v9SQLite.db');
if (!existsSync(inputPath)) throw new Error(`v0.15 database is missing: ${inputPath}`);

for (const suffix of ['', '-wal', '-shm', '-journal']) rmSync(`${outputPath}${suffix}`, { force: true });
copyFileSync(inputPath, outputPath);

const db = new DatabaseSync(outputPath);
db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; BEGIN IMMEDIATE;');

const rows = db.prepare(`
  SELECT id, collection_code AS collectionCode, section_order AS sectionOrder,
    subsection_order AS subsectionOrder, provider_line_order AS providerLineOrder,
    reference_gurmukhi AS referenceGurmukhi,
    literal_translation_en AS literalEn, literal_translation_pa AS literalPa,
    translation_scope AS translationScope
  FROM tggsp_line_alignment
  ORDER BY collection_code, section_order, subsection_order, provider_line_order
`).all();

const groups = new Map();
for (const row of rows) {
  const key = `${row.collectionCode}|${row.sectionOrder}|${row.subsectionOrder}`;
  const group = groups.get(key) ?? [];
  group.push(row);
  groups.set(key, group);
}

const update = db.prepare(`
  UPDATE tggsp_line_alignment
  SET literal_translation_en=?, literal_translation_pa=?, translation_scope=?, mapping_status=?
  WHERE id=?
`);
let repairedHeadingAlignments = 0;

for (const group of groups.values()) {
  const heading = group.find(row => Number(row.providerLineOrder) === 0);
  const firstContent = group.find(row => Number(row.providerLineOrder) === 1);
  if (!heading || !firstContent) continue;
  if (heading.literalEn || heading.literalPa) continue;
  if (!isHeadingReference(heading.referenceGurmukhi)) continue;

  const moveEnglish = isTranslatedHeading(firstContent.literalEn);
  const movePanjabi = isTranslatedHeading(firstContent.literalPa);
  if (!moveEnglish && !movePanjabi) continue;

  const headingEnglish = moveEnglish ? firstContent.literalEn : '';
  const headingPanjabi = movePanjabi ? firstContent.literalPa : '';
  const contentEnglish = moveEnglish ? '' : firstContent.literalEn;
  const contentPanjabi = movePanjabi ? '' : firstContent.literalPa;

  update.run(
    headingEnglish,
    headingPanjabi,
    headingEnglish || headingPanjabi ? 'line' : 'none',
    'verified_heading_translation',
    heading.id,
  );
  update.run(
    contentEnglish,
    contentPanjabi,
    contentEnglish || contentPanjabi ? firstContent.translationScope : 'none',
    contentEnglish || contentPanjabi ? 'verified_exact_within_unit' : 'verified_no_line_translation',
    firstContent.id,
  );
  repairedHeadingAlignments += 1;
}

db.prepare("INSERT OR REPLACE INTO metadata(key,value) VALUES ('schema_version','9')").run();
db.prepare("INSERT OR REPLACE INTO metadata(key,value) VALUES ('schema_release','v9')").run();
db.prepare("INSERT OR REPLACE INTO metadata(key,value) VALUES ('tggsp_alignment_release','rc4-heading-safe-v1')").run();
db.exec('COMMIT; PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode=DELETE; ANALYZE;');

const remaining = findShiftedHeadings(db);
if (remaining.length) {
  throw new Error(`TGGSP heading translations remain attached to content lines: ${remaining.join(', ')}`);
}
const integrity = db.prepare('PRAGMA integrity_check').get()?.integrity_check;
if (integrity !== 'ok') throw new Error(`SQLite integrity check failed: ${integrity}`);
db.close();

console.log(JSON.stringify({
  status: 'pass',
  database: basename(outputPath),
  schemaRelease: 'v9',
  repairedHeadingAlignments,
  remainingShiftedHeadings: remaining.length,
}, null, 2));

function findShiftedHeadings(database) {
  const all = database.prepare(`
    SELECT collection_code AS collectionCode, section_order AS sectionOrder,
      subsection_order AS subsectionOrder, provider_line_order AS providerLineOrder,
      reference_gurmukhi AS referenceGurmukhi,
      literal_translation_en AS literalEn, literal_translation_pa AS literalPa
    FROM tggsp_line_alignment
    ORDER BY collection_code, section_order, subsection_order, provider_line_order
  `).all();
  const byGroup = new Map();
  for (const row of all) {
    const key = `${row.collectionCode}|${row.sectionOrder}|${row.subsectionOrder}`;
    const group = byGroup.get(key) ?? [];
    group.push(row);
    byGroup.set(key, group);
  }
  return [...byGroup.entries()].flatMap(([key, group]) => {
    const heading = group.find(row => Number(row.providerLineOrder) === 0);
    const firstContent = group.find(row => Number(row.providerLineOrder) === 1);
    return heading
      && firstContent
      && isHeadingReference(heading.referenceGurmukhi)
      && !heading.literalEn
      && !heading.literalPa
      && (isTranslatedHeading(firstContent.literalEn) || isTranslatedHeading(firstContent.literalPa))
      ? [key]
      : [];
  });
}

function isHeadingReference(value) {
  return /^(ੴ|ਰਾਗੁ?|ਮਃ|ਮਹਲਾ|ਸਲੋਕ|ਸਲੋਕੁ|ਪਉੜੀ)/u.test(String(value ?? '').trim());
}

function isTranslatedHeading(value) {
  const text = String(value ?? '').trim();
  return /^(salok|pauri|rag|raag|mahala|first embodiment|second embodiment|third embodiment|fourth embodiment|fifth embodiment|ninth embodiment)/iu.test(text)
    || /^(ਸਲੋਕ|ਪਉੜੀ|ਰਾਗ|ਮਹਲਾ)/u.test(text);
}
