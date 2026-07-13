import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTggspExports, TGGSP_ATTRIBUTION } from '../src/tggsp-transform.mjs';

test('TGGSP layers remain separate and attributed', () => {
  const base = { RowID: 1, BaniCode: 'TEST', SectionId: 2, SubSectionId: 3,
    SectionSequence: 1, SubSectionSequence: 1 };
  const recordsByIndex = {
    'sikhri-banisubsection-sql-index': [
      { ...base, BaniLanguage: 'panjabi', SubSectionContent: 'ਸਤਿ ਨਾਮੁ',
        SubSectionLiteralTranslation: 'ਪੰਜਾਬੀ ਅੱਖਰੀ ਅਨੁਵਾਦ' },
      { ...base, RowID: 2, BaniLanguage: 'english', SubSectionContent: 'sati nāmu',
        SubSectionLiteralTranslation: 'Eternal Identification',
        SubSectionMeaningInterpretive: 'Interpretive layer' }
    ],
    'sikhri-baniwordrefdict-sql-index': [
      { RowID: 10, BaniLanguage: 'panjabi', WordName: 'ਸਤਿ', WordMeaning: 'ਅਰਥ' }
    ],
    'sikhri-significantwords-sql-index': []
  };
  const result = buildTggspExports({ recordsByIndex, fetchedAt: '2026-07-12T00:00:00Z',
    snapshotChecksum: 'abc123' });
  const types = result.provider.records.map(row => row.contentType);
  assert.deepEqual(types, ['reference_gurmukhi', 'literal_translation_pa', 'transliteration',
    'literal_translation_en', 'interpretive_transcreation_en']);
  assert.equal(result.provider.records.every(row => row.requiredAttribution === TGGSP_ATTRIBUTION), true);
  assert.equal(result.enrichment.glossaryEntries.length, 1);
  assert.equal(result.enrichment.termForms[0].writtenForm, 'ਸਤਿ');
});
