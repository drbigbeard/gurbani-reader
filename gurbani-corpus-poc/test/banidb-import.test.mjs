import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalFromBaniDbPages, snapshotManifest } from '../src/banidb-import.mjs';
import { validateCanonical } from '../src/validate.mjs';

const response = {
  source: { sourceId: 'G', unicode: 'ਗੁਰੂ ਗ੍ਰੰਥ ਸਾਹਿਬ', english: 'Guru Granth Sahib Ji', pageNo: 1 },
  count: 2, navigation: { previous: null, next: 2 },
  page: [
    { verseId: 1, shabadId: 1, verse: { gurmukhi: 'ik oa(n)kaar', unicode: 'ੴ ਸਤਿ ਨਾਮੁ' },
      pageNo: 1, lineNo: 1, updated: '2026-01-01 00:00:00',
      writer: { writerId: 1, unicode: 'ਗੁਰੂ ਨਾਨਕ ਸਾਹਿਬ', english: 'Guru Nanak Sahib' },
      raag: { raagId: 0, unicode: null, english: null } },
    { verseId: 2, shabadId: 1, verse: { gurmukhi: 'karta purakh', unicode: 'ਕਰਤਾ ਪੁਰਖੁ' },
      pageNo: 1, lineNo: 2, updated: '2026-01-01 00:00:00',
      writer: { writerId: 1, unicode: 'ਗੁਰੂ ਨਾਨਕ ਸਾਹਿਬ', english: 'Guru Nanak Sahib' },
      raag: { raagId: 0, unicode: null, english: null } }
  ]
};

test('BaniDB Ang response becomes valid canonical corpus without altering Unicode text', () => {
  const pages = [{ pageNo: 1, response }];
  const manifest = snapshotManifest({ sourceId: 'G', pages, fetchedAt: '2026-07-12T00:00:00Z' });
  const corpus = canonicalFromBaniDbPages({ sourceId: 'G', pages, fetchedAt: '2026-07-12T00:00:00Z',
    releaseId: 'banidb-test', manifestChecksum: manifest.checksum });
  assert.equal(validateCanonical(corpus).valid, true);
  assert.equal(corpus.lines[0].gurmukhi, response.page[0].verse.unicode);
  assert.equal(corpus.lines[1].textUnitId, corpus.lines[0].textUnitId);
  assert.equal(corpus.textUnits.length, 1);
  assert.equal(corpus.contributors[0].name, 'Guru Nanak Sahib');
});

test('BaniDB snapshot manifest is deterministic for identical raw responses', () => {
  const pages = [{ pageNo: 1, response }];
  const one = snapshotManifest({ sourceId: 'G', pages, fetchedAt: '2026-07-12T00:00:00Z' });
  const two = snapshotManifest({ sourceId: 'G', pages, fetchedAt: '2026-07-12T00:00:00Z' });
  assert.equal(one.checksum, two.checksum);
  assert.equal(one.verseCount, 2);
});

test('empty upstream Unicode is recorded as a gap and never fabricated', () => {
  const withGap = structuredClone(response);
  withGap.page.push({ verseId: 3, shabadId: 2, verse: { gurmukhi: '', unicode: '' }, pageNo: 1, lineNo: 3,
    writer: { writerId: 1, english: 'Guru Nanak Sahib' }, raag: { raagId: 0 } });
  const pages = [{ pageNo: 1, response: withGap }];
  const corpus = canonicalFromBaniDbPages({ sourceId: 'G', pages, fetchedAt: '2026-07-12T00:00:00Z',
    releaseId: 'banidb-test-gap', manifestChecksum: 'gap' });
  assert.equal(corpus.lines.length, 2);
  assert.deepEqual(corpus.dataGaps[0], { sourceId: 'G', upstreamVerseId: '3', upstreamShabadId: '2', pageNo: 1,
    field: 'verse.unicode', reason: 'empty_upstream_canonical_text', disposition: 'excluded_from_unicode_analysis' });
});
