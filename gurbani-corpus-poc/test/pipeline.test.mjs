import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, buildPipeline } from '../src/pipeline.mjs';
import { tokeniseLine, compareForm } from '../src/tokenise.mjs';
import { contributorStructuralCounts, exactFrequency, rankExactForms, relatedFormFrequency } from '../src/analyse.mjs';
import { validateCanonical } from '../src/validate.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const canonicalPath = path.join(root, 'fixtures', 'canonical.sample.json');
const providerPath = path.join(root, 'fixtures', 'provider.sample.json');
const outputDirectory = path.join(root, 'build');

test('canonical fixture validates', async () => {
  const corpus = await readJson(canonicalPath);
  assert.deepEqual(validateCanonical(corpus), { valid: true, errors: [] });
});

test('token offsets reconstruct the exact canonical substring', async () => {
  const corpus = await readJson(canonicalPath);
  for (const line of corpus.lines) {
    for (const occurrence of tokeniseLine(line, 'analysis:test')) {
      assert.equal(line.gurmukhi.slice(occurrence.startUtf16, occurrence.endUtf16), occurrence.exact);
      assert.equal(Array.from(line.gurmukhi).slice(occurrence.startCodePoint, occurrence.endCodePoint).join(''), occurrence.exact);
      assert.equal(Buffer.from(line.gurmukhi, 'utf8').subarray(occurrence.startByte, occurrence.endByte).toString('utf8'), occurrence.exact);
    }
  }
});

test('cyclic text hierarchy is rejected without hanging', async () => {
  const corpus = await readJson(canonicalPath);
  corpus.textUnits[0].parentId = corpus.textUnits[1].id;
  corpus.textUnits[1].parentId = corpus.textUnits[0].id;
  const result = validateCanonical(corpus);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.startsWith('Cycle detected')));
});

test('canonical text is preserved while comparison is NFC', () => {
  const line = { id: 'line:test', textUnitId: 'unit:test', sourceWorkId: 'source:test', gurmukhi: 'ਹਰਿ ਹਰ' };
  const occurrences = tokeniseLine(line, 'analysis:test');
  assert.equal(line.gurmukhi, 'ਹਰਿ ਹਰ');
  assert.equal(occurrences[0].compare, compareForm('ਹਰਿ'));
});

test('exact count keeps different written forms separate', () => {
  const line = { id: 'line:test', textUnitId: 'unit:test', sourceWorkId: 'source:test', gurmukhi: 'ਹਰਿ ਹਰਿ ਹਰ' };
  const index = { occurrences: tokeniseLine(line, 'analysis:test') };
  assert.equal(exactFrequency(index, 'ਹਰਿ').rawFrequency, 2);
  assert.equal(exactFrequency(index, 'ਹਰ').rawFrequency, 1);
  const related = relatedFormFrequency(index, ['ਹਰਿ', 'ਹਰ']);
  assert.equal(related.combinedRawFrequency, 3);
  assert.equal(related.includedForms.length, 2);
});

test('fixture query returns occurrences, lines and nearest units separately', async () => {
  const { index } = await buildPipeline({ canonicalPath, providerPath, outputDirectory });
  const result = exactFrequency(index, 'ਸੁਣਿਐ');
  assert.equal(result.rawFrequency, 3);
  assert.equal(result.distinctLines, 3);
  assert.equal(result.distinctNearestTextUnits, 1);
  assert.equal(result.occurrenceIds.length, 3);
});

test('crosswalk does not auto-approve text matches', async () => {
  const { crosswalk } = await buildPipeline({ canonicalPath, providerPath, outputDirectory });
  assert.equal(crosswalk[0].method, 'proposed_exact_text');
  assert.equal(crosswalk[0].status, 'review_required');
  assert.equal(crosswalk[1].method, 'proposed_whitespace_normalised');
  assert.equal(crosswalk[1].status, 'review_required');
  assert.equal(crosswalk[2].method, 'unmatched');
  assert.equal(crosswalk[2].status, 'unavailable');
});

test('analysis release is deterministic for identical inputs', async () => {
  const first = await buildPipeline({ canonicalPath, providerPath, outputDirectory });
  const second = await buildPipeline({ canonicalPath, providerPath, outputDirectory });
  assert.equal(first.report.release.id, second.report.release.id);
  assert.equal(first.report.release.inputChecksum, second.report.release.inputChecksum);
});

test('ranked exact forms retain distinct-line and unit evidence', async () => {
  const { index } = await buildPipeline({ canonicalPath, providerPath, outputDirectory });
  const ranked = rankExactForms(index);
  assert.equal(ranked[0].form, 'ਸੁਣਿਐ');
  assert.equal(ranked[0].rawFrequency, 3);
  assert.equal(ranked[0].distinctLines, 3);
});

test('contributor structural counts distinguish shabads from other units', async () => {
  const { index } = await buildPipeline({ canonicalPath, providerPath, outputDirectory });
  const [summary] = contributorStructuralCounts(index);
  assert.equal(summary.name, 'Guru Nanak Sahib');
  assert.equal(summary.shabadCount, 0);
  assert.equal(summary.attributedUnitCount, 1);
});
