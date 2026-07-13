#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dbPath = resolve(process.argv[2] ?? 'public/assets/databases/gurbani_reader_v5SQLite.db');
const snapshotRoot = resolve(process.argv[3] ?? '../gurbani-corpus-poc/imports');
if (!existsSync(dbPath)) throw new Error(`Reading database is missing: ${dbPath}`);

const provider = JSON.parse(readFileSync(resolve(snapshotRoot, 'tggsp-provider.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(resolve(snapshotRoot, 'tggsp-manifest.json'), 'utf8'));
const catalogue = readIndex('sikhri-bani-sql-index');
const details = readIndex('sggs2-0-banidetail-index');
const dictionary = readIndex('sikhri-baniwordrefdict-sql-index');
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');

db.exec(`
CREATE TABLE IF NOT EXISTS tggsp_collection (
  code TEXT PRIMARY KEY NOT NULL,
  title_en TEXT NOT NULL,
  title_pa TEXT NOT NULL,
  navigation_title TEXT NOT NULL,
  collection_type TEXT NOT NULL,
  collection_order INTEGER NOT NULL,
  introduction_en TEXT NOT NULL,
  introduction_pa TEXT NOT NULL,
  provider_release_id TEXT NOT NULL,
  attribution_label TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tggsp_collection_section (
  collection_code TEXT NOT NULL,
  section_id INTEGER NOT NULL,
  section_order INTEGER NOT NULL,
  title_en TEXT NOT NULL,
  title_pa TEXT NOT NULL,
  author_en TEXT NOT NULL,
  author_pa TEXT NOT NULL,
  first_ang INTEGER,
  last_ang INTEGER,
  mapped_unit_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (collection_code, section_id),
  FOREIGN KEY (collection_code) REFERENCES tggsp_collection(code)
);
CREATE TABLE IF NOT EXISTS tggsp_line_alignment (
  id TEXT PRIMARY KEY NOT NULL,
  collection_code TEXT NOT NULL,
  section_id INTEGER NOT NULL,
  subsection_id INTEGER NOT NULL,
  section_order INTEGER NOT NULL,
  subsection_order INTEGER NOT NULL,
  provider_line_order INTEGER NOT NULL,
  text_unit_id TEXT NOT NULL,
  anchor_line_id TEXT NOT NULL,
  reference_gurmukhi TEXT NOT NULL,
  tggsp_transliteration TEXT NOT NULL,
  literal_translation_en TEXT NOT NULL,
  literal_translation_pa TEXT NOT NULL,
  translation_scope TEXT NOT NULL,
  mapping_status TEXT NOT NULL,
  FOREIGN KEY (collection_code) REFERENCES tggsp_collection(code),
  FOREIGN KEY (text_unit_id) REFERENCES text_unit(id),
  FOREIGN KEY (anchor_line_id) REFERENCES canonical_line(id)
);
CREATE TABLE IF NOT EXISTS tggsp_line_member (
  alignment_id TEXT NOT NULL,
  canonical_line_id TEXT NOT NULL,
  member_order INTEGER NOT NULL,
  is_anchor INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (alignment_id, canonical_line_id),
  FOREIGN KEY (alignment_id) REFERENCES tggsp_line_alignment(id),
  FOREIGN KEY (canonical_line_id) REFERENCES canonical_line(id)
);
CREATE TABLE IF NOT EXISTS tggsp_line_term (
  id TEXT PRIMARY KEY NOT NULL,
  collection_code TEXT NOT NULL,
  canonical_line_id TEXT NOT NULL,
  word_id INTEGER NOT NULL,
  headword TEXT NOT NULL,
  transliteration TEXT NOT NULL,
  meaning_en TEXT NOT NULL,
  grammar_en TEXT NOT NULL,
  etymology_en TEXT NOT NULL,
  meaning_pa TEXT NOT NULL,
  grammar_pa TEXT NOT NULL,
  etymology_pa TEXT NOT NULL,
  FOREIGN KEY (collection_code) REFERENCES tggsp_collection(code),
  FOREIGN KEY (canonical_line_id) REFERENCES canonical_line(id)
);
CREATE TABLE IF NOT EXISTS bani_line_crosswalk (
  bani_id TEXT NOT NULL,
  line_order INTEGER NOT NULL,
  canonical_line_id TEXT,
  text_unit_id TEXT,
  mapping_status TEXT NOT NULL,
  PRIMARY KEY (bani_id, line_order),
  FOREIGN KEY (bani_id) REFERENCES bani_collection(id),
  FOREIGN KEY (canonical_line_id) REFERENCES canonical_line(id),
  FOREIGN KEY (text_unit_id) REFERENCES text_unit(id)
);
CREATE INDEX IF NOT EXISTS idx_tggsp_alignment_anchor ON tggsp_line_alignment(anchor_line_id, collection_code);
CREATE INDEX IF NOT EXISTS idx_tggsp_alignment_collection ON tggsp_line_alignment(collection_code, section_order, subsection_order, provider_line_order);
CREATE INDEX IF NOT EXISTS idx_tggsp_member_line ON tggsp_line_member(canonical_line_id, alignment_id);
CREATE INDEX IF NOT EXISTS idx_tggsp_term_line ON tggsp_line_term(canonical_line_id, collection_code);
CREATE INDEX IF NOT EXISTS idx_bani_crosswalk_line ON bani_line_crosswalk(canonical_line_id, bani_id);
`);

const releaseId = provider.providerRelease?.id ?? `tggsp-${manifest.fetchedAt?.slice(0, 10) ?? 'snapshot'}`;
const attribution = provider.providerRelease?.attribution ?? 'The Guru Granth Sahib Project, Sikh Research Institute (SikhRI). Used with permission.';
const catalogueByCode = pairByLanguage(catalogue.filter(row => row.IsPublished === true));
const detailsByCode = pairByLanguage(details.filter(row => catalogueByCode.has(row.BaniCode)));
const ceremonialCodes = new Set(['IntCer', 'ASWC1', 'ASWC2', 'ASFC', 'BANC']);
const collectionRows = [];
const sectionRows = [];
const sectionSequenceMap = new Map();

for (const [code, languages] of catalogueByCode) {
  const en = languages.english ?? languages.panjabi;
  const pa = languages.panjabi ?? languages.english;
  collectionRows.push({ code, titleEn: clean(en.BaniName), titlePa: clean(pa.BaniName),
    navigationTitle: clean(en.NavBaniName || en.BaniName), type: ceremonialCodes.has(code) ? 'ceremonial' : 'composition',
    order: number(en.BaniSequence), introductionEn: plain(en.Introduction), introductionPa: plain(pa.Introduction) });
  const detailLanguages = detailsByCode.get(code) ?? {};
  const detailEn = detailLanguages.english ?? detailLanguages.panjabi;
  const detailPa = detailLanguages.panjabi ?? detailLanguages.english;
  const paSections = new Map((detailPa?.Sections ?? []).map(section => [number(section.SectionId), section]));
  for (const section of detailEn?.Sections ?? []) {
    const sectionId = number(section.SectionId); const paSection = paSections.get(sectionId) ?? section;
    const sequence = number(section.SectionSequence);
    sectionSequenceMap.set(`${code}|${sequence}`, sectionId);
    sectionRows.push({ code, sectionId, order: sequence, titleEn: clean(section.SectionName), titlePa: clean(paSection.SectionName),
      authorEn: clean(section.Author), authorPa: clean(paSection.Author), firstAng: nullableNumber(section.PageNumberStart),
      lastAng: nullableNumber(section.PageNumberEnd) });
  }
}

const existingUnitByProviderId = new Map(db.prepare('SELECT id, text_unit_id FROM provider_content WHERE text_unit_id IS NOT NULL').all()
  .map(row => [String(row.id), String(row.text_unit_id)]));
const canonicalStatement = db.prepare(`SELECT id, text_unit_id AS textUnitId, line_order AS lineOrder, ang, gurmukhi
  FROM canonical_line WHERE text_unit_id = ? ORDER BY ang, line_order, id`);
const canonicalCache = new Map();
const groups = groupProviderRecords(provider.records.filter(row => catalogueByCode.has(compositionCode(row.compositionId))));
const alignmentRows = [];
const memberRows = [];
const alignmentsByLocation = new Map();
const mappedUnitsBySection = new Map();

for (const records of groups.values()) {
  const reference = records.find(row => row.contentType === 'reference_gurmukhi');
  if (!reference) continue;
  const code = compositionCode(reference.compositionId);
  const textUnitId = existingUnitByProviderId.get(reference.id);
  if (!textUnitId) continue;
  const canonical = cachedCanonical(textUnitId);
  const refs = providerLines(reference.content, true).filter(line => !isCitation(line));
  const mapped = refs.map((text, index) => ({ text, index, canonical: resolveWithinUnit(text, canonical) }))
    .filter(row => row.canonical.length > 0);
  if (!mapped.length) continue;
  const english = providerLines(records.find(row => row.contentType === 'literal_translation_en')?.content ?? '', false);
  const panjabi = providerLines(records.find(row => row.contentType === 'literal_translation_pa')?.content ?? '', false);
  const transliteration = providerLines(records.find(row => row.contentType === 'transliteration')?.content ?? '', false).filter(line => !/^[-–—]\s*Guru Granth Sahib/iu.test(line));
  const englishMap = alignTranslations(refs, english);
  const panjabiMap = alignTranslations(refs, panjabi);
  const transliterationMap = alignTranslations(refs, transliteration);
  const fallbackEnglish = english.length && !englishMap ? english.join('\n') : '';
  const fallbackPanjabi = panjabi.length && !panjabiMap ? panjabi.join('\n') : '';
  const lastMappedIndex = mapped.at(-1)?.index;
  for (const row of mapped) {
    const literalEn = englishMap?.get(row.index) ?? (row.index === lastMappedIndex ? fallbackEnglish : '');
    const literalPa = panjabiMap?.get(row.index) ?? (row.index === lastMappedIndex ? fallbackPanjabi : '');
    const scope = (fallbackEnglish || fallbackPanjabi) && row.index === lastMappedIndex ? 'passage' : literalEn || literalPa ? 'line' : 'none';
    const anchor = row.canonical.at(-1);
    const id = `${reference.id}:line:${row.index}`;
    alignmentRows.push({ id, code, sectionId: number(reference.sectionId), subsectionId: number(reference.subsectionId),
      sectionOrder: number(reference.sectionOrder), subsectionOrder: number(reference.subsectionOrder), providerLineOrder: row.index,
      textUnitId, anchorLineId: anchor.id, reference: row.text, transliteration: transliterationMap?.get(row.index) ?? '',
      literalEn, literalPa, scope, status: row.canonical.length === 1 ? 'verified_exact_within_unit' : 'verified_exact_range_within_unit' });
    row.canonical.forEach((line, memberOrder) => memberRows.push({ alignmentId: id, canonicalLineId: line.id,
      memberOrder, isAnchor: memberOrder === row.canonical.length - 1 ? 1 : 0 }));
    const locationKey = `${code}|${number(reference.sectionOrder)}|${number(reference.subsectionOrder)}`;
    const location = alignmentsByLocation.get(locationKey) ?? [];
    location.push({ ...row, id, code, canonicalLineIds: row.canonical.map(line => line.id) });
    alignmentsByLocation.set(locationKey, location);
  }
  const sectionKey = `${code}|${number(reference.sectionId)}`;
  const units = mappedUnitsBySection.get(sectionKey) ?? new Set(); units.add(textUnitId); mappedUnitsBySection.set(sectionKey, units);
}

const englishTerms = new Map(dictionary.filter(row => row.BaniLanguage === 'english' && row.WordId != null)
  .map(row => [`${row.BaniCode ?? ''}|${row.WordId}`, row]));
const termRows = [];
for (const term of dictionary) {
  if (term.BaniLanguage !== 'panjabi' || !term.BaniCode || !catalogueByCode.has(term.BaniCode) || !term.WordName) continue;
  const location = alignmentsByLocation.get(`${term.BaniCode}|${number(term.SectionSequence)}|${number(term.SubSectionSequence)}`) ?? [];
  const matching = location.filter(row => comparable(row.text).includes(comparable(term.WordName)));
  if (!matching.length) continue;
  const english = englishTerms.get(`${term.BaniCode}|${term.WordId}`);
  const lineIds = [...new Set(matching.flatMap(row => row.canonicalLineIds))];
  for (const lineId of lineIds) termRows.push({ id: `tggsp:term-line:${term.BaniCode}:${term.RowID}:${lineId}`,
    code: term.BaniCode, canonicalLineId: lineId, wordId: number(term.WordId), headword: clean(term.WordName),
    transliteration: clean(english?.Spelling || english?.WordName), meaningEn: clean(english?.WordMeaning), grammarEn: clean(english?.WordGrammar),
    etymologyEn: clean(english?.WordEtymology), meaningPa: clean(term.WordMeaning), grammarPa: clean(term.WordGrammar), etymologyPa: clean(term.WordEtymology) });
}

const crosswalkRows = buildBaniCrosswalk();
db.exec('BEGIN IMMEDIATE');
try {
  for (const table of ['tggsp_line_term','tggsp_line_member','tggsp_line_alignment','tggsp_collection_section','tggsp_collection','bani_line_crosswalk']) db.exec(`DELETE FROM ${table}`);
  const insertCollection = db.prepare(`INSERT INTO tggsp_collection(code,title_en,title_pa,navigation_title,collection_type,collection_order,introduction_en,introduction_pa,provider_release_id,attribution_label) VALUES (?,?,?,?,?,?,?,?,?,?)`);
  for (const row of collectionRows) insertCollection.run(row.code,row.titleEn,row.titlePa,row.navigationTitle,row.type,row.order,row.introductionEn,row.introductionPa,releaseId,attribution);
  const insertSection = db.prepare(`INSERT INTO tggsp_collection_section(collection_code,section_id,section_order,title_en,title_pa,author_en,author_pa,first_ang,last_ang,mapped_unit_count) VALUES (?,?,?,?,?,?,?,?,?,?)`);
  for (const row of sectionRows) insertSection.run(row.code,row.sectionId,row.order,row.titleEn,row.titlePa,row.authorEn,row.authorPa,row.firstAng,row.lastAng,mappedUnitsBySection.get(`${row.code}|${row.sectionId}`)?.size ?? 0);
  const insertAlignment = db.prepare(`INSERT INTO tggsp_line_alignment(id,collection_code,section_id,subsection_id,section_order,subsection_order,provider_line_order,text_unit_id,anchor_line_id,reference_gurmukhi,tggsp_transliteration,literal_translation_en,literal_translation_pa,translation_scope,mapping_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const row of alignmentRows) insertAlignment.run(row.id,row.code,row.sectionId,row.subsectionId,row.sectionOrder,row.subsectionOrder,row.providerLineOrder,row.textUnitId,row.anchorLineId,row.reference,row.transliteration,row.literalEn,row.literalPa,row.scope,row.status);
  const insertMember = db.prepare('INSERT INTO tggsp_line_member(alignment_id,canonical_line_id,member_order,is_anchor) VALUES (?,?,?,?)');
  for (const row of memberRows) insertMember.run(row.alignmentId,row.canonicalLineId,row.memberOrder,row.isAnchor);
  const insertTerm = db.prepare(`INSERT OR IGNORE INTO tggsp_line_term(id,collection_code,canonical_line_id,word_id,headword,transliteration,meaning_en,grammar_en,etymology_en,meaning_pa,grammar_pa,etymology_pa) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const row of termRows) insertTerm.run(row.id,row.code,row.canonicalLineId,row.wordId,row.headword,row.transliteration,row.meaningEn,row.grammarEn,row.etymologyEn,row.meaningPa,row.grammarPa,row.etymologyPa);
  const insertCrosswalk = db.prepare('INSERT INTO bani_line_crosswalk(bani_id,line_order,canonical_line_id,text_unit_id,mapping_status) VALUES (?,?,?,?,?)');
  for (const row of crosswalkRows) insertCrosswalk.run(row.baniId,row.lineOrder,row.canonicalLineId,row.textUnitId,row.status);
  const metadata = db.prepare('INSERT OR REPLACE INTO metadata(key,value) VALUES (?,?)');
  metadata.run('provider_release_id',releaseId); metadata.run('tggsp_snapshot_checksum',manifest.checksum ?? ''); metadata.run('schema_release','v5');
  db.exec('COMMIT');
} catch (error) {
  db.exec('ROLLBACK');
  throw error;
}
db.exec('PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode = DELETE; ANALYZE;');
const integrity = db.prepare('PRAGMA integrity_check').get()?.integrity_check;
if (integrity !== 'ok') throw new Error(`SQLite integrity check failed: ${integrity}`);
console.log(JSON.stringify({ status: 'pass', publishedCollections: collectionRows.length, ceremonialCollections: collectionRows.filter(row => row.type === 'ceremonial').length,
  collectionSections: sectionRows.length, lineAlignments: alignmentRows.length, translatedLineAlignments: alignmentRows.filter(row => row.literalEn).length,
  alignedLineMembers: memberRows.length, lineTerms: termRows.length, baniCrosswalks: crosswalkRows.filter(row => row.canonicalLineId).length,
  providerReleaseId: releaseId, snapshotChecksum: manifest.checksum }, null, 2));

function buildBaniCrosswalk() {
  const rows = db.prepare(`SELECT bani_id AS baniId,line_order AS lineOrder,paragraph_number AS paragraphNumber,gurmukhi FROM bani_collection_line ORDER BY bani_id,line_order`).all();
  const canonical = db.prepare(`SELECT id,text_unit_id AS textUnitId,line_order AS lineOrder,ang,gurmukhi FROM canonical_line WHERE source_work_id='source:G' ORDER BY ang,line_order,id`).all();
  const unitsByForm = new Map();
  for (const line of canonical) { const key = comparable(line.gurmukhi); const list = unitsByForm.get(key) ?? []; list.push(line); unitsByForm.set(key,list); }
  const grouped = new Map();
  for (const row of rows) { const key = `${row.baniId}|${row.paragraphNumber ?? row.lineOrder}`; const list = grouped.get(key) ?? []; list.push(row); grouped.set(key,list); }
  const result = [];
  for (const group of grouped.values()) {
    const scores = new Map();
    for (const row of group) for (const candidate of unitsByForm.get(comparable(row.gurmukhi)) ?? []) scores.set(candidate.textUnitId,(scores.get(candidate.textUnitId) ?? 0)+1);
    const ranked = [...scores].sort((a,b)=>b[1]-a[1]); const bestUnit = ranked[0] && (!ranked[1] || ranked[0][1] > ranked[1][1]) ? ranked[0][0] : null;
    for (const row of group) {
      const candidates = (unitsByForm.get(comparable(row.gurmukhi)) ?? []).filter(line => !bestUnit || line.textUnitId === bestUnit);
      const candidate = candidates.length === 1 ? candidates[0] : null;
      result.push({ baniId: row.baniId, lineOrder: row.lineOrder, canonicalLineId: candidate?.id ?? null,
        textUnitId: candidate?.textUnitId ?? bestUnit, status: candidate ? 'verified_exact_within_paragraph_unit' : bestUnit ? 'unit_only' : 'unmapped' });
    }
  }
  return result;
}
function readIndex(name) { const directory = resolve(snapshotRoot,'tggsp-raw',name); return readdirSync(directory).filter(file=>file.endsWith('.json')).sort().flatMap(file=>JSON.parse(readFileSync(resolve(directory,file),'utf8')).value ?? []); }
function pairByLanguage(rows) { const result = new Map(); for (const row of rows) { const pair = result.get(row.BaniCode) ?? {}; pair[row.BaniLanguage] = row; result.set(row.BaniCode,pair); } return result; }
function groupProviderRecords(records) { const result = new Map(); for (const row of records) { const key=`${row.compositionId}|${row.sectionId}|${row.subsectionId}`; const group=result.get(key)??[];group.push(row);result.set(key,group); } return result; }
function compositionCode(id) { return String(id).replace(/^tggsp:bani:/u,''); }
function cachedCanonical(textUnitId) { let rows=canonicalCache.get(textUnitId);if(!rows){rows=canonicalStatement.all(textUnitId);canonicalCache.set(textUnitId,rows);}return rows; }
function resolveWithinUnit(text, canonical) { const exact=canonical.filter(line=>comparable(line.gurmukhi)===comparable(text));if(exact.length===1)return exact;const loose=canonical.filter(line=>looseComparable(line.gurmukhi)===looseComparable(text));if(loose.length===1)return loose;const ranges=[];for(let start=0;start<canonical.length;start+=1)for(let length=2;length<=5&&start+length<=canonical.length;length+=1){const slice=canonical.slice(start,start+length);if(comparable(slice.map(line=>line.gurmukhi).join(''))===comparable(text)||looseComparable(slice.map(line=>line.gurmukhi).join(''))===looseComparable(text))ranges.push(slice);}return ranges.length===1?ranges[0]:[]; }
function alignTranslations(refs, translations) { if(!translations.length)return new Map();if(refs.length===translations.length)return new Map(refs.map((_,index)=>[index,translations[index]]));const difference=refs.length-translations.length;if(difference>0&&difference<=2&&refs.slice(0,difference).every(isHeading))return new Map(translations.map((value,index)=>[index+difference,value]));return null; }
function providerLines(content, requireGurmukhi) { return plain(content,true).split(/\r?\n/gu).map(line=>line.replace(/\s+/gu,' ').trim()).filter(line=>line&&(!requireGurmukhi||/[਀-੿]/u.test(line))); }
function isCitation(line) { return /^[-–—]\s*ਗੁਰੂ ਗ੍ਰੰਥ ਸਾਹਿਬ/u.test(line); }
function isHeading(line) { return /^(ੴ|ਰਾਗੁ?|ਮਃ|ਮਹਲਾ|ਸਲੋਕ|ਸਲੋਕੁ|ਪਉੜੀ|ਆਸਾ|ਤਿਲੰਗ|ਬਿਲਾਵਲੁ|ਸੋਰਠਿ|ਮਾਰੂ|ਸੂਹੀ|ਰਾਮਕਲੀ|ਵਡਹੰਸੁ|ਸਿਰੀਰਾਗੁ)/u.test(line); }
function comparable(value) { return String(value).normalize('NFC').replace(/\u0A4D/gu,'\u0A51').replace(/[\u200B-\u200D\uFEFF\u00A0\s]/gu,''); }
function looseComparable(value) { return comparable(value).replace(/[।॥|]/gu,''); }
function plain(value, preserveLines=false) { const text=clean(value).replace(/<bani:[^>]*>/giu,'').replace(/<br\s*\/?\s*>/giu,'\n').replace(/<[^>]+>/gu,' ').replace(/&nbsp;/giu,' ').replace(/&amp;/giu,'&').replace(/&lt;/giu,'<').replace(/&gt;/giu,'>').replace(/&#39;/giu,"'").replace(/&quot;/giu,'"');return preserveLines?text.replace(/[ \t]+/gu,' '):text.replace(/\s+/gu,' ').trim(); }
function clean(value) { return typeof value==='string'?value.trim():''; }
function number(value) { return Number.parseInt(String(value??0),10)||0; }
function nullableNumber(value) { const parsed=Number.parseInt(String(value??''),10);return Number.isFinite(parsed)?parsed:null; }
