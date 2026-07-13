import { createHash } from 'node:crypto';

export const TGGSP_PROVIDER = 'Sikh Research Institute — The Guru Granth Sahib Project';
export const TGGSP_ATTRIBUTION = 'The Guru Granth Sahib Project, Sikh Research Institute (SikhRI). Used with permission.';

const LAYERS = {
  SubSectionContent: { english: 'transliteration', panjabi: 'reference_gurmukhi' },
  SubSectionLiteralTranslation: { english: 'literal_translation_en', panjabi: 'literal_translation_pa' },
  SubSectionMeaningInterpretive: { english: 'interpretive_transcreation_en', panjabi: 'interpretive_transcreation_pa' },
  SubSectionCommentary: { english: 'commentary_en', panjabi: 'commentary_pa' },
  SubSectionPoeticalDimension: { english: 'poetical_dimension_en', panjabi: 'poetical_dimension_pa' },
  Overview: { english: 'overview_en', panjabi: 'overview_pa' }
};

export function buildTggspExports({ recordsByIndex, fetchedAt, snapshotChecksum }) {
  const releaseId = `tggsp-${fetchedAt.slice(0, 10)}-${snapshotChecksum.slice(0, 12)}`;
  const subsections = recordsByIndex['sikhri-banisubsection-sql-index'] ?? [];
  const panjabiByKey = new Map(subsections.filter(row => row.BaniLanguage === 'panjabi')
    .map(row => [subsectionKey(row), row]));
  const sectionMetadata = buildSectionMetadata(recordsByIndex['sggs2-0-banidetail-index'] ?? []);
  const providerRecords = [];
  const providerContent = [];

  for (const row of subsections) {
    const language = row.BaniLanguage;
    const reference = language === 'panjabi' ? row.SubSectionContent : panjabiByKey.get(subsectionKey(row))?.SubSectionContent;
    for (const [field, types] of Object.entries(LAYERS)) {
      const content = cleanString(row[field]);
      const contentType = types[language];
      if (!content || !contentType) continue;
      const id = `tggsp:${row.BaniCode}:${row.SectionId}:${row.SubSectionId}:${contentType}`;
      providerRecords.push({
        id, compositionId: `tggsp:bani:${row.BaniCode}`, sectionId: String(row.SectionId),
        subsectionId: String(row.SubSectionId), sectionOrder: row.SectionSequence,
        subsectionOrder: row.SubSectionSequence, referenceGurmukhi: reference ?? null,
        expectedAngStart: sectionMetadata.get(`${row.BaniCode}|${row.SectionId}`)?.pageStart ?? null,
        attributedAuthor: sectionMetadata.get(`${row.BaniCode}|${row.SectionId}`)?.author ?? null,
        attributedRag: sectionMetadata.get(`${row.BaniCode}|${row.SectionId}`)?.rag ?? null,
        contentType, content, language, requiredAttribution: TGGSP_ATTRIBUTION,
        mappingStatus: 'unmapped_provider_subsection'
      });
      providerContent.push({
        id, provider: TGGSP_PROVIDER, providerReleaseId: releaseId, contentType,
        canonicalLineId: null, textUnitId: null, content,
        attributionLabel: TGGSP_ATTRIBUTION, mappingStatus: 'unmapped_provider_subsection'
      });
    }
  }

  const glossaryEntries = [];
  const termForms = [];
  const dictionary = recordsByIndex['sikhri-baniwordrefdict-sql-index'] ?? [];
  for (const row of dictionary) {
    const headword = cleanString(row.WordName);
    if (!headword) continue;
    const language = row.BaniLanguage || 'unknown';
    const id = `tggsp:dictionary:${language}:${row.RowID}`;
    glossaryEntries.push({
      id, headword, provider: TGGSP_PROVIDER, providerReleaseId: releaseId,
      content: JSON.stringify({
        language, meaning: row.WordMeaning ?? null, meaningFootnote: row.WordMeaningFootnote ?? null,
        grammar: row.WordGrammar ?? null, grammarFootnote: row.WordGrammarFootnote ?? null,
        etymology: row.WordEtymology ?? null, etymologyFootnote: row.WordEtymologyFootnote ?? null,
        baniCode: row.BaniCode ?? null, sectionSequence: row.SectionSequence ?? null,
        subsectionSequence: row.SubSectionSequence ?? null, source: row.Source ?? null,
        rag: row.Rag ?? null, author: row.Author ?? null
      }),
      reviewStatus: 'provider_published'
    });
    if (/[਀-੿]/u.test(headword)) {
      termForms.push({ id: `tggsp:term:${language}:${row.RowID}`, glossaryEntryId: id,
        writtenForm: headword, comparisonForm: headword.normalize('NFC'),
        transliteration: null, relationType: 'provider_dictionary_headword' });
    }
  }

  for (const row of recordsByIndex['sikhri-significantwords-sql-index'] ?? []) {
    const headword = cleanString(row.WordName);
    if (!headword) continue;
    glossaryEntries.push({
      id: `tggsp:significant:${row.BaniLanguage || 'unknown'}:${row.RowID}`, headword,
      provider: TGGSP_PROVIDER, providerReleaseId: releaseId,
      content: JSON.stringify({ language: row.BaniLanguage, description: row.WordDescription,
        attributes: row.Attributes, variants: row.Variants }), reviewStatus: 'provider_published'
    });
  }

  return {
    provider: {
      providerRelease: { id: releaseId, provider: TGGSP_PROVIDER, generatedAt: fetchedAt,
        snapshotChecksum, attribution: TGGSP_ATTRIBUTION },
      records: providerRecords
    },
    enrichment: {
      providerRelease: { id: releaseId, provider: TGGSP_PROVIDER, generatedAt: fetchedAt,
        snapshotChecksum, attribution: TGGSP_ATTRIBUTION },
      lineTransliterations: [], providerContent, glossaryEntries, termForms, tokenMappings: []
    }
  };
}

export function checksumJson(value) {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}

function subsectionKey(row) { return `${row.BaniCode}|${row.SectionId}|${row.SubSectionId}`; }
function cleanString(value) { return typeof value === 'string' && value.trim() ? value : null; }

function buildSectionMetadata(details) {
  const result = new Map();
  for (const bani of details) {
    for (const section of bani.Sections ?? []) {
      result.set(`${bani.BaniCode}|${section.SectionId}`, {
        pageStart: Number.parseInt(section.PageNumberStart, 10) || null,
        author: section.Author ?? bani.Author ?? null,
        rag: bani.Rag ?? null
      });
    }
  }
  return result;
}
