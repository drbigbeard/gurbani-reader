import test from 'node:test';
import assert from 'node:assert/strict';
import { filterCanonicalCorpus } from '../src/filter-corpus.mjs';

test('filter retains only selected source records and referenced contributors', () => {
  const corpus = {
    corpusRelease: { id: 'release:all', upstream: 'BaniDB', generatedAt: '2026-01-01', sourceUrl: 'https://api.banidb.com', manifestChecksum: 'x' },
    sourceWorks: ['G', 'D'].map(id => ({ id: `source:${id}`, upstreamId: id, title: id, profile: 'verse_corpus' })),
    contributors: ['1', '2'].map(id => ({ id: `contributor:${id}`, upstreamId: id, name: id, type: 'contributor' })),
    textUnits: ['G', 'D'].map((id, index) => ({ id: `unit:${id}`, upstreamId: id, sourceWorkId: `source:${id}`, parentId: null, unitType: 'shabad', order: index, title: id, reviewStatus: 'unclassified' })),
    attributions: [],
    lines: ['G', 'D'].map((id, index) => ({ id: `line:${id}`, upstreamId: id, sourceWorkId: `source:${id}`, textUnitId: `unit:${id}`, contributorId: `contributor:${index + 1}`, order: 1, ang: 1, lineClass: 'canonical_verse', gurmukhi: 'ਸਤਿ', transliteration: null }))
  };
  const filtered = filterCanonicalCorpus(corpus, ['G']);
  assert.deepEqual(filtered.sourceWorks.map(row => row.id), ['source:G']);
  assert.deepEqual(filtered.contributors.map(row => row.id), ['contributor:1']);
  assert.deepEqual(filtered.lines.map(row => row.id), ['line:G']);
});
