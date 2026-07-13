#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { canonicalJson, sha256 } from './model.mjs';
import { assertValidCanonical } from './validate.mjs';

export function filterCanonicalCorpus(corpus, sourceIds) {
  assertValidCanonical(corpus);
  const wanted = new Set(sourceIds.map(id => id.startsWith('source:') ? id : `source:${id}`));
  const sourceWorks = corpus.sourceWorks.filter(row => wanted.has(row.id));
  if (!sourceWorks.length) throw new Error('No requested sources exist in the canonical corpus');
  const textUnits = corpus.textUnits.filter(row => wanted.has(row.sourceWorkId));
  const unitIds = new Set(textUnits.map(row => row.id));
  const lines = corpus.lines.filter(row => wanted.has(row.sourceWorkId) && unitIds.has(row.textUnitId));
  const contributorIds = new Set(lines.map(row => row.contributorId).filter(Boolean));
  const attributions = (corpus.attributions ?? []).filter(row => unitIds.has(row.targetId));
  for (const row of attributions) contributorIds.add(row.contributorId);
  const component = { parent: corpus.corpusRelease.id, sources: sourceWorks.map(row => row.upstreamId).sort() };
  const checksum = sha256(canonicalJson(component));
  const filtered = {
    corpusRelease: { ...corpus.corpusRelease, id: `banidb-filtered-${component.sources.join('').toLowerCase()}-${checksum.slice(0, 12)}`,
      parentReleaseId: corpus.corpusRelease.id, componentReleases: corpus.corpusRelease.componentReleases?.filter(row => component.sources.some(id => row.id.includes(`-${id.toLowerCase()}-`))) ?? [] },
    sourceWorks, contributors: corpus.contributors.filter(row => contributorIds.has(row.id)), textUnits,
    attributions, lines, dataGaps: (corpus.dataGaps ?? []).filter(row => component.sources.includes(row.sourceId))
  };
  assertValidCanonical(filtered);
  return filtered;
}

if (process.argv[1] && import.meta.url === new URL(`file://${resolve(process.argv[1])}`).href) {
  const input = process.argv[2];
  const sourcesIndex = process.argv.indexOf('--sources');
  const outputIndex = process.argv.indexOf('--output');
  if (!input || sourcesIndex < 0 || outputIndex < 0) throw new Error('Usage: node src/filter-corpus.mjs input.json --sources G,B,S --output output.json');
  const corpus = JSON.parse(await readFile(resolve(input), 'utf8'));
  const filtered = filterCanonicalCorpus(corpus, process.argv[sourcesIndex + 1].split(','));
  const output = resolve(process.argv[outputIndex + 1]);
  await writeFile(output, `${JSON.stringify(filtered, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ output, releaseId: filtered.corpusRelease.id, sources: filtered.sourceWorks.length,
    contributors: filtered.contributors.length, textUnits: filtered.textUnits.length, lines: filtered.lines.length }, null, 2));
}

