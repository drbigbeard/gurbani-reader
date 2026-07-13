#!/usr/bin/env node
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaults = {
  input: resolve(projectRoot, '../gurbani-corpus-poc/build/analysis-index.json'),
  enrichment: resolve(projectRoot, 'fixtures/mobile-enrichment.sample.json'),
  // Capacitor Community SQLite discovers bundled databases by this required suffix.
  output: resolve(projectRoot, 'public/assets/databases/gurbani_corpusSQLite.db')
};
const options = parseArgs(process.argv.slice(2), defaults);
const index = JSON.parse(readFileSync(options.input, 'utf8'));
const enrichment = options.enrichment ? JSON.parse(readFileSync(options.enrichment, 'utf8')) : {};
const schema = readFileSync(resolve(projectRoot, 'src/lib/mobile-corpus-v1.sql'), 'utf8');

validateIndex(index);
mkdirSync(dirname(options.output), { recursive: true });
rmSync(options.output, { force: true });

const db = new DatabaseSync(options.output);
try {
  db.exec(schema);
  db.exec('BEGIN IMMEDIATE');
  insertMetadata(db, index, enrichment);
  insertCorpus(db, index, enrichment);
  insertEnrichment(db, enrichment, index);
  db.exec('COMMIT');
  db.exec('PRAGMA optimize');
} catch (error) {
  try { db.exec('ROLLBACK'); } catch { /* transaction may not have started */ }
  throw error;
} finally {
  db.close();
}

const reportDb = new DatabaseSync(options.output, { readOnly: true });
const report = Object.fromEntries([
  ['sourceWorks', 'source_work'], ['textUnits', 'text_unit'], ['contributors', 'contributor'],
  ['lines', 'canonical_line'], ['occurrences', 'token_occurrence'], ['providerContent', 'provider_content'],
  ['glossaryEntries', 'glossary_entry'], ['termForms', 'term_form']
].map(([label, table]) => [label, reportDb.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count]));
const integrity = reportDb.prepare('PRAGMA integrity_check').get().integrity_check;
reportDb.close();

console.log(JSON.stringify({ output: options.output, integrity, ...report }, null, 2));

function insertMetadata(database, corpus, extra) {
  const put = database.prepare('INSERT OR REPLACE INTO metadata(key, value) VALUES (?, ?)');
  const values = {
    schema_version: '1',
    corpus_release_id: corpus.release.corpusReleaseId,
    analysis_release_id: corpus.release.id,
    provider_release_id: extra.providerRelease?.id ?? corpus.release.providerReleaseId ?? 'not-loaded',
    ontology_version: corpus.release.ontologyVersion,
    tokeniser_version: corpus.release.tokeniserVersion,
    normalisation_version: corpus.release.normalisationVersion,
    input_checksum: corpus.release.inputChecksum,
    fixture_notice: corpus.fixtureNotice ?? '',
    build_kind: corpus.fixtureNotice ? 'technical_fixture' : 'authorised_snapshot'
  };
  for (const [key, value] of Object.entries(values)) put.run(key, String(value ?? ''));
}

function insertCorpus(database, corpus, extra) {
  const lineTransliterations = new Map((extra.lineTransliterations ?? []).map(row => [row.canonicalLineId, row.transliteration]));
  const source = database.prepare(`INSERT INTO source_work
    (id, upstream_id, title, profile, corpus_release_id) VALUES (?, ?, ?, ?, ?)`);
  for (const row of corpus.sourceWorks) source.run(row.id, row.upstreamId ?? null, row.title, row.profile, corpus.release.corpusReleaseId);

  const contributor = database.prepare(`INSERT INTO contributor
    (id, preferred_name, contributor_type) VALUES (?, ?, ?)`);
  for (const row of corpus.contributors) contributor.run(row.id, row.name, row.type);

  const unit = database.prepare(`INSERT INTO text_unit
    (id, upstream_id, source_work_id, parent_id, unit_type, unit_order, title, review_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  const pending = [...corpus.textUnits];
  const inserted = new Set();
  while (pending.length) {
    const start = pending.length;
    for (let i = pending.length - 1; i >= 0; i -= 1) {
      const row = pending[i];
      if (row.parentId && !inserted.has(row.parentId)) continue;
      unit.run(row.id, row.upstreamId ?? null, row.sourceWorkId, row.parentId ?? null,
        row.unitType, row.order, row.title ?? null, row.reviewStatus ?? 'unclassified');
      inserted.add(row.id);
      pending.splice(i, 1);
    }
    if (pending.length === start) throw new Error(`Unresolved text-unit parents: ${pending.map(row => row.id).join(', ')}`);
  }

  const attribution = database.prepare(`INSERT INTO attribution
    (id, contributor_id, target_type, target_id, role, review_status) VALUES (?, ?, ?, ?, ?, ?)`);
  for (const row of corpus.attributions ?? []) attribution.run(row.id, row.contributorId, row.targetType, row.targetId, row.role, row.status);

  const line = database.prepare(`INSERT INTO canonical_line
    (id, upstream_id, source_work_id, text_unit_id, contributor_id, line_order, ang, line_class, gurmukhi, transliteration, raag_id, raag)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const row of corpus.lines) line.run(row.id, row.upstreamId ?? null, row.sourceWorkId, row.textUnitId,
    row.contributorId ?? null, row.order, row.ang ?? null, row.lineClass,
    row.gurmukhi, lineTransliterations.get(row.id) ?? row.transliteration ?? null,
    row.raagId ?? null, row.raag ?? null);

  const occurrence = database.prepare(`INSERT INTO token_occurrence
    (id, line_id, text_unit_id, source_work_id, token_position, exact_form, comparison_form,
     token_class, start_utf16, end_utf16, analysis_release_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const row of corpus.occurrences) occurrence.run(row.id, row.lineId, row.textUnitId, row.sourceWorkId,
    row.position, row.exact, row.compare, row.tokenClass, row.startUtf16, row.endUtf16, row.analysisReleaseId);
}

function insertEnrichment(database, extra, corpus) {
  const providerRelease = extra.providerRelease?.id ?? corpus.release.providerReleaseId ?? 'not-loaded';
  const provider = database.prepare(`INSERT INTO provider_content
    (id, provider, provider_release_id, content_type, canonical_line_id, text_unit_id,
     content, attribution_label, mapping_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const row of extra.providerContent ?? []) provider.run(row.id, row.provider, row.providerReleaseId ?? providerRelease,
    row.contentType, row.canonicalLineId ?? null, row.textUnitId ?? null, row.content,
    row.attributionLabel, row.mappingStatus);

  const glossary = database.prepare(`INSERT INTO glossary_entry
    (id, headword, provider, provider_release_id, content, review_status) VALUES (?, ?, ?, ?, ?, ?)`);
  for (const row of extra.glossaryEntries ?? []) glossary.run(row.id, row.headword, row.provider,
    row.providerReleaseId ?? providerRelease, row.content, row.reviewStatus);

  const term = database.prepare(`INSERT INTO term_form
    (id, glossary_entry_id, written_form, comparison_form, transliteration, relation_type)
    VALUES (?, ?, ?, ?, ?, ?)`);
  for (const row of extra.termForms ?? []) term.run(row.id, row.glossaryEntryId ?? null, row.writtenForm,
    row.comparisonForm ?? row.writtenForm.normalize('NFC'), row.transliteration ?? null, row.relationType);

  const mapping = database.prepare(`INSERT INTO token_mapping
    (id, term_form_id, occurrence_id, canonical_line_id, mapping_type, review_status)
    VALUES (?, ?, ?, ?, ?, ?)`);
  for (const row of extra.tokenMappings ?? []) mapping.run(row.id, row.termFormId, row.occurrenceId ?? null,
    row.canonicalLineId ?? null, row.mappingType, row.reviewStatus);
}

function validateIndex(index) {
  for (const key of ['release', 'sourceWorks', 'contributors', 'textUnits', 'lines', 'occurrences']) {
    if (index[key] == null) throw new Error(`Analysis index is missing ${key}`);
  }
  if (!index.release.id || !index.release.corpusReleaseId) throw new Error('Analysis release metadata is incomplete');
}

function parseArgs(args, fallback) {
  const result = { ...fallback };
  for (let i = 0; i < args.length; i += 1) {
    const flag = args[i];
    if (!['--input', '--enrichment', '--output'].includes(flag)) throw new Error(`Unknown option: ${flag}`);
    const value = args[++i];
    if (!value) throw new Error(`Missing value for ${flag}`);
    result[flag.slice(2)] = resolve(process.cwd(), value);
  }
  return result;
}
