import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeCanonicalCorpora } from '../src/merge-corpora.mjs';

const corpus = source => ({
  corpusRelease: { id: `release:${source}`, upstream: 'BaniDB API v2', generatedAt: '2026-01-01T00:00:00Z', sourceUrl: 'https://api.banidb.com/v2/', manifestChecksum: source },
  sourceWorks: [{ id: `source:${source}`, upstreamId: source, title: source, profile: 'verse_corpus' }],
  contributors: [{ id: 'contributor:1', upstreamId: '1', name: 'Shared', type: 'contributor' }],
  textUnits: [{ id: `unit:${source}`, upstreamId: '1', sourceWorkId: `source:${source}`, parentId: null, unitType: 'shabad', order: 1, title: null, reviewStatus: 'unclassified' }],
  attributions: [],
  lines: [{ id: `line:${source}`, upstreamId: '1', sourceWorkId: `source:${source}`, textUnitId: `unit:${source}`, contributorId: 'contributor:1', order: 1, ang: 1, lineClass: 'canonical_verse', gurmukhi: 'ਸਤਿ', transliteration: null }]
});

test('canonical corpora merge without duplicating shared contributors', () => {
  const merged = mergeCanonicalCorpora([corpus('G'), corpus('B')], '2026-01-02T00:00:00Z');
  assert.equal(merged.sourceWorks.length, 2);
  assert.equal(merged.contributors.length, 1);
  assert.equal(merged.lines.length, 2);
  assert.equal(merged.corpusRelease.componentReleases.length, 2);
});
