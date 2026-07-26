#!/usr/bin/env node
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const db = new DatabaseSync(new URL('public/assets/databases/gurbani_reader_v9SQLite.db', root).pathname, { readOnly: true });
const app = readFileSync(new URL('src/App.tsx', root), 'utf8');
const gateway = readFileSync(new URL('src/lib/mobile-gateway.ts', root), 'utf8');
const css = readFileSync(new URL('src/v016rc4.css', root), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
  console.log(`PASS  ${message}`);
};

assert(
  db.prepare("SELECT value FROM metadata WHERE key='schema_release'").get()?.value === 'v9',
  'RC4 database schema is installed',
);
assert(
  db.prepare("SELECT value FROM metadata WHERE key='tggsp_alignment_release'").get()?.value === 'rc4-heading-safe-v1',
  'heading-safe TGGSP alignment release is installed',
);

const shiftedHeadings = db.prepare(`
  WITH grouped AS (
    SELECT collection_code, section_order, subsection_order,
      MAX(CASE WHEN provider_line_order=0 THEN reference_gurmukhi END) heading,
      MAX(CASE WHEN provider_line_order=0 THEN COALESCE(literal_translation_en,'') || COALESCE(literal_translation_pa,'') END) heading_translation,
      MAX(CASE WHEN provider_line_order=1 THEN COALESCE(literal_translation_en,'') || COALESCE(literal_translation_pa,'') END) first_translation
    FROM tggsp_line_alignment
    GROUP BY collection_code, section_order, subsection_order
  )
  SELECT COUNT(*) count FROM grouped
  WHERE heading GLOB 'ਸਲੋਕ*' AND heading_translation='' AND
    (LOWER(first_translation) LIKE 'salok%' OR first_translation LIKE 'ਸਲੋਕ%')
`).get()?.count;
assert(Number(shiftedHeadings) === 0, 'translated TGGSP headings are not shifted onto the following Gurbani line');

assert(
  gateway.includes('id: "reading:anand-short"')
    && gateway.includes('b.line_order <= 28 OR b.paragraph_number = 43')
    && Number(db.prepare(`
      SELECT COUNT(*) count FROM bani_collection_line
      WHERE bani_id=(SELECT id FROM bani_collection WHERE token='anand')
        AND (line_order<=28 OR paragraph_number=43)
    `).get()?.count) === 35,
  'short Anand is a separate derived reading ending with the final Pauri',
);
assert(
  app.includes('const dailyOrder = [')
    && app.includes('"anand",\n    "rehras"')
    && !app.slice(app.indexOf('const dailyOrder = ['), app.indexOf('];', app.indexOf('const dailyOrder = ['))).includes('"anand-short"'),
  'Nitnem uses full Anand Sahib rather than short Anand',
);
assert(
  gateway.includes('code: "AnandSanskar"')
    && gateway.includes('["ASWC1", "SuhiM", "ASWC2"].map'),
  'Anand Sanskar preserves opening readings, Laavan and concluding readings as one ordered ceremony',
);
assert(
  app.includes('"salokm9"') && app.includes('"anand-short"'),
  'commonly read ordering includes Salok Mahalla 9 and short Anand',
);
assert(
  css.includes('@media (max-width: 430px)') && css.includes('.home-reader-row .ang-jump'),
  'narrow iPhone Ang and Continue Reading layout has an explicit responsive rule',
);
assert(
  css.includes('.bani-star.saved') && css.includes('font-variation-settings: "FILL" 1'),
  'Saved Banis use a filled accent star without a filled row background',
);
assert(
  css.includes('.saved-tabs') && css.includes('overflow: visible'),
  'all Library destinations are visible rather than hidden off-screen',
);

db.close();
console.log('\nv0.16 RC4 product and data audit passed.');
