import type { CanonicalLine, Contributor, CoverageState, SearchCandidate } from '../types';

export const FIXTURE_NOTICE = 'Technical fixture only — no displayed total is a complete BaniDB corpus statistic.';

export const contributors: Contributor[] = [
  { id: 'contributor:guru-nanak-sahib', name: 'Guru Nanak Sahib', type: 'guru' }
];

export const lines: CanonicalLine[] = [
  {
    id: 'line:fixture:1', sourceWorkId: 'source:G', textUnitId: 'unit:jap:pauri-8', order: 1, ang: 2,
    contributorId: 'contributor:guru-nanak-sahib',
    gurmukhi: 'ਸੁਣਿਐ ਸਿਧ ਪੀਰ ਸੁਰਿ ਨਾਥ ॥', transliteration: 'suṇiai sidh pīr sur nāth.'
  },
  {
    id: 'line:fixture:2', sourceWorkId: 'source:G', textUnitId: 'unit:jap:pauri-8', order: 2, ang: 2,
    contributorId: 'contributor:guru-nanak-sahib',
    gurmukhi: 'ਸੁਣਿਐ ਧਰਤਿ ਧਵਲ ਆਕਾਸ ॥', transliteration: 'suṇiai dharat dhaval ākās.'
  },
  {
    id: 'line:fixture:3', sourceWorkId: 'source:G', textUnitId: 'unit:jap:pauri-8', order: 3, ang: 2,
    contributorId: 'contributor:guru-nanak-sahib',
    gurmukhi: 'ਸੁਣਿਐ ਦੀਪ ਲੋਅ ਪਾਤਾਲ ॥', transliteration: 'suṇiai dīp loa pātāl.'
  }
];

export const phoneticCandidates: Record<string, SearchCandidate[]> = {
  har: [
    { gurmukhi: 'ਹਰਿ', transliteration: 'har', note: 'Exact written form' },
    { gurmukhi: 'ਹਰ', transliteration: 'har', note: 'Different exact written form' },
    { gurmukhi: 'ਹਰੀ', transliteration: 'harī', note: 'Related pronunciation; counted separately' }
  ],
  suniai: [
    { gurmukhi: 'ਸੁਣਿਐ', transliteration: 'suṇiai', note: 'Exact form present in technical fixture' }
  ]
};

export const coverage: CoverageState[] = [
  { contentType: 'Canonical Gurmukhi', provider: 'BaniDB technical fixture', status: 'available' },
  { contentType: 'Transliteration', provider: 'Technical fixture', status: 'available' },
  { contentType: 'Literal translation', provider: 'SikhRI/TGGSP', status: 'alignment_review' },
  { contentType: 'Interpretive transcreation', provider: 'SikhRI/TGGSP', status: 'not_published' }
];
