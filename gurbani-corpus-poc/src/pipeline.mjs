import { readFile, writeFile, mkdir, open } from 'node:fs/promises';
import path from 'node:path';
import { assertValidCanonical } from './validate.mjs';
import { createAnalysisRelease, canonicalJson, sha256 } from './model.mjs';
import { tokeniseCorpus } from './tokenise.mjs';
import { buildCrosswalk } from './crosswalk.mjs';
import { contributorStructuralCounts, rankExactForms } from './analyse.mjs';

export async function readJson(filename) {
  return JSON.parse(await readFile(filename, 'utf8'));
}

export async function buildPipeline({ canonicalPath, providerPath, outputDirectory }) {
  const [corpus, provider] = await Promise.all([
    readJson(canonicalPath),
    providerPath ? readJson(providerPath) : Promise.resolve(null)
  ]);
  assertValidCanonical(corpus);
  const release = createAnalysisRelease(corpus, provider);
  const occurrences = tokeniseCorpus(corpus, release.id);
  const crosswalk = provider ? buildCrosswalk(corpus, provider) : [];
  const fixture = Boolean(corpus.fixtureNotice || provider?.fixtureNotice);
  const index = {
    ...(fixture ? { fixtureNotice: 'Generated from technical fixtures; no statistic is a real corpus result.' } : {}),
    release,
    corpusRelease: corpus.corpusRelease,
    sourceWorks: corpus.sourceWorks,
    contributors: corpus.contributors,
    textUnits: corpus.textUnits,
    attributions: corpus.attributions,
    lines: corpus.lines,
    occurrences
  };
  index.aggregates = {
    rankedExactForms: rankExactForms(index),
    contributorStructuralCounts: contributorStructuralCounts(index)
  };
  const report = {
    status: 'succeeded',
    fixture,
    release,
    counts: {
      sourceWorks: corpus.sourceWorks.length,
      textUnits: corpus.textUnits.length,
      lines: corpus.lines.length,
      tokenOccurrences: occurrences.length,
      lexicalGurmukhiOccurrences: occurrences.filter(row => row.tokenClass === 'lexical_gurmukhi').length,
      distinctExactForms: index.aggregates.rankedExactForms.length,
      crosswalkRecords: crosswalk.length,
      crosswalkExactProposals: crosswalk.filter(row => row.method === 'proposed_exact_text').length,
      crosswalkReviewRequired: crosswalk.filter(row => row.status === 'review_required').length,
      crosswalkUnavailable: crosswalk.filter(row => row.status === 'unavailable').length
    },
    canonicalTextChecksum: sha256(canonicalJson(corpus.lines.map(row => ({ id: row.id, gurmukhi: row.gurmukhi }))))
  };

  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeTopLevelJson(path.join(outputDirectory, 'analysis-index.json'), index),
    writeFile(path.join(outputDirectory, 'crosswalk-report.json'), `${JSON.stringify({ providerRelease: provider?.providerRelease ?? null, mappings: crosswalk }, null, 2)}\n`),
    writeFile(path.join(outputDirectory, 'build-report.json'), `${JSON.stringify(report, null, 2)}\n`)
  ]);
  return { index, crosswalk, report };
}

async function writeTopLevelJson(filename, value) {
  const handle = await open(filename, 'w');
  try {
    await handle.write('{');
    let propertyIndex = 0;
    for (const [key, property] of Object.entries(value)) {
      if (propertyIndex++) await handle.write(',');
      await handle.write(`${JSON.stringify(key)}:`);
      if (Array.isArray(property)) {
        await handle.write('[');
        const batchSize = 2_000;
        for (let start = 0; start < property.length; start += batchSize) {
          const batch = property.slice(start, start + batchSize).map(row => JSON.stringify(row)).join(',');
          await handle.write(`${start ? ',' : ''}${batch}`);
        }
        await handle.write(']');
      } else {
        await handle.write(JSON.stringify(property));
      }
    }
    await handle.write('}\n');
  } finally {
    await handle.close();
  }
}
