#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { canonicalJson, sha256 } from './model.mjs';
import { assertValidCanonical } from './validate.mjs';

export function mergeCanonicalCorpora(corpora, generatedAt = new Date().toISOString()) {
  if (corpora.length < 1) throw new Error('At least one canonical corpus is required');
  for (const corpus of corpora) assertValidCanonical(corpus);
  const releaseParts = corpora.map(corpus => ({ id: corpus.corpusRelease.id, checksum: corpus.corpusRelease.manifestChecksum }));
  const checksum = sha256(canonicalJson(releaseParts));
  const merged = {
    corpusRelease: {
      id: `banidb-multi-${generatedAt.slice(0, 10)}-${checksum.slice(0, 12)}`,
      upstream: 'BaniDB API v2',
      generatedAt,
      sourceUrl: 'https://api.banidb.com/v2/',
      manifestChecksum: checksum,
      componentReleases: releaseParts
    },
    sourceWorks: unique(corpora.flatMap(corpus => corpus.sourceWorks)),
    contributors: unique(corpora.flatMap(corpus => corpus.contributors)),
    textUnits: unique(corpora.flatMap(corpus => corpus.textUnits)),
    attributions: unique(corpora.flatMap(corpus => corpus.attributions ?? [])),
    lines: unique(corpora.flatMap(corpus => corpus.lines)),
    dataGaps: corpora.flatMap(corpus => corpus.dataGaps ?? [])
  };
  assertValidCanonical(merged);
  return merged;
}

function unique(rows) {
  const found = new Map();
  for (const row of rows) {
    const existing = found.get(row.id);
    if (existing && canonicalJson(existing) !== canonicalJson(row)) throw new Error(`Conflicting canonical record: ${row.id}`);
    found.set(row.id, row);
  }
  return [...found.values()];
}

if (process.argv[1] && import.meta.url === new URL(`file://${resolve(process.argv[1])}`).href) {
  const args = process.argv.slice(2);
  const outputFlag = args.indexOf('--output');
  if (outputFlag < 0 || !args[outputFlag + 1]) throw new Error('Usage: node src/merge-corpora.mjs <canonical.json>... --output <merged.json>');
  const inputPaths = args.slice(0, outputFlag).map(path => resolve(path));
  if (!inputPaths.length) throw new Error('No input corpora supplied');
  const outputPath = resolve(args[outputFlag + 1]);
  const corpora = await Promise.all(inputPaths.map(async path => JSON.parse(await readFile(path, 'utf8'))));
  const merged = mergeCanonicalCorpora(corpora);
  await writeFile(outputPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ output: outputPath, releaseId: merged.corpusRelease.id, sources: merged.sourceWorks.length,
    contributors: merged.contributors.length, textUnits: merged.textUnits.length, lines: merged.lines.length }, null, 2));
}
