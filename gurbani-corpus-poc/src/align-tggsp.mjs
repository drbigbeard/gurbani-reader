#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const options = parseArgs(process.argv.slice(2));
const [corpus, provider, enrichment] = await Promise.all([
  readJson(options.canonical), readJson(options.provider), readJson(options.enrichment)
]);
const canonicalByForm = new Map();
corpus.lines.forEach((line, index) => {
  const form = comparable(line.gurmukhi);
  if (!canonicalByForm.has(form)) canonicalByForm.set(form, []);
  canonicalByForm.get(form).push({ line, index });
});

const groups = groupProviderRecords(provider.records);
const mappings = [];
const lineTransliterations = new Map();
const unitByProviderId = new Map();

for (const group of groups.values()) {
  const referenceRecord = group.find(row => row.contentType === 'reference_gurmukhi');
  if (!referenceRecord) continue;
  const references = splitProviderLines(referenceRecord.content);
  const transliterationRecord = group.find(row => row.contentType === 'transliteration');
  const transliterations = transliterationRecord ? splitProviderLines(transliterationRecord.content, false) : [];
  const lineMappings = references.map((text, lineIndex) => resolveLine(text, lineIndex, references,
    canonicalByForm, referenceRecord.expectedAngStart));
  const mappedUnits = new Set(lineMappings.flatMap(row => row.canonicalLineId ? [row.textUnitId] : []));
  const unitId = mappedUnits.size === 1 ? [...mappedUnits][0] : null;

  for (const record of group) unitByProviderId.set(record.id, unitId);
  for (const row of lineMappings) {
    mappings.push({ providerSubsectionId: referenceRecord.subsectionId, providerRecordId: referenceRecord.id,
      compositionId: referenceRecord.compositionId, ...row });
    if (row.canonicalLineId && transliterations[row.providerLineIndex]) {
      lineTransliterations.set(row.canonicalLineId, transliterations[row.providerLineIndex]);
    }
  }
}

enrichment.lineTransliterations = [...lineTransliterations.entries()].map(([canonicalLineId, transliteration]) => ({
  canonicalLineId, transliteration
}));
enrichment.providerContent = enrichment.providerContent.map(row => {
  const textUnitId = unitByProviderId.get(row.id) ?? null;
  return { ...row, textUnitId,
    mappingStatus: textUnitId ? 'mapped_to_canonical_text_unit' : row.mappingStatus };
});
const summary = {
  providerReferenceLines: mappings.length,
  exactUnique: mappings.filter(row => row.status === 'exact_unique').length,
  exactByAng: mappings.filter(row => row.status === 'exact_by_expected_ang').length,
  ambiguous: mappings.filter(row => row.status === 'ambiguous').length,
  unmatched: mappings.filter(row => row.status === 'unmatched').length,
  lineTransliterations: enrichment.lineTransliterations.length,
  mappedProviderLayers: enrichment.providerContent.filter(row => row.mappingStatus === 'mapped_to_canonical_text_unit').length
};
await writeFile(options.output, `${JSON.stringify({ providerRelease: provider.providerRelease, summary, mappings }, null, 2)}\n`);
await writeFile(options.enrichmentOutput, `${JSON.stringify(enrichment, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

function resolveLine(text, providerLineIndex, references, index, expectedAng) {
  const candidates = index.get(comparable(text)) ?? [];
  if (candidates.length === 1) return mapped(candidates[0], text, providerLineIndex, 'exact_unique');
  if (candidates.length > 1 && expectedAng) {
    const near = candidates.filter(row => row.line.ang >= expectedAng - 2 && row.line.ang <= expectedAng + 80);
    if (near.length === 1) return mapped(near[0], text, providerLineIndex, 'exact_by_expected_ang');
  }
  return { providerLineIndex, providerText: text, canonicalLineId: null, textUnitId: null,
    status: candidates.length ? 'ambiguous' : 'unmatched', candidates: candidates.map(row => row.line.id) };
}

function mapped(candidate, providerText, providerLineIndex, status) {
  return { providerLineIndex, providerText, canonicalLineId: candidate.line.id,
    textUnitId: candidate.line.textUnitId, status, candidates: [] };
}

function groupProviderRecords(records) {
  const groups = new Map();
  for (const row of records) {
    const key = `${row.compositionId}|${row.sectionId}|${row.subsectionId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return groups;
}

function splitProviderLines(content, requireGurmukhi = true) {
  return decodeEntities(String(content))
    .replace(/<bani:[^>]*>/giu, '')
    .replace(/<br\s*\/?\s*>/giu, '\n')
    .replace(/<[^>]+>/gu, '')
    .split(/\r?\n/gu)
    .map(line => line.replace(/\s+/gu, ' ').trim())
    .filter(line => line && (!requireGurmukhi || /[\u0A00-\u0A7F]/u.test(line)));
}

function comparable(value) {
  return String(value).normalize('NFC').replace(/[\u200B-\u200D\uFEFF]/gu, '')
    .replace(/\s+/gu, ' ').trim();
}

function decodeEntities(value) {
  return value.replace(/&nbsp;/giu, ' ').replace(/&amp;/giu, '&')
    .replace(/&lt;/giu, '<').replace(/&gt;/giu, '>').replace(/&#39;/giu, "'")
    .replace(/&quot;/giu, '"');
}

function parseArgs(args) {
  const values = {
    canonical: resolve('imports/banidb-G-canonical.json'), provider: resolve('imports/tggsp-provider.json'),
    enrichment: resolve('imports/tggsp-mobile-enrichment.json'),
    output: resolve('imports/tggsp-crosswalk.json'),
    enrichmentOutput: resolve('imports/tggsp-mobile-enrichment.aligned.json')
  };
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i]; const value = args[i + 1];
    if (!flag?.startsWith('--') || value == null) throw new Error(`Invalid option near ${flag ?? '(end)'}`);
    const key = flag.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (!(key in values)) throw new Error(`Unknown option ${flag}`);
    values[key] = resolve(value);
  }
  return values;
}
async function readJson(path) { return JSON.parse(await readFile(path, 'utf8')); }
