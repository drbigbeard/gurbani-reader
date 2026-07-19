export type Screen =
  | "home"
  | "read"
  | "sabad"
  | "bani"
  | "search"
  | "word"
  | "browse"
  | "contributor"
  | "raag"
  | "tggsp"
  | "glossary"
  | "saved"
  | "settings"
  | "sources";
export type SearchMode = "auto" | "theme";

export interface SearchFilters {
  sourceWorkId: "all" | string;
  raag: string;
  contributorId: string;
  tggspOnly: boolean;
  tggspCoverage?: "" | "any" | "translation" | "word-analysis" | "extended";
  providerContentTypes: string[];
}

export interface CanonicalLine {
  id: string;
  sourceWorkId: string;
  textUnitId: string;
  order: number;
  ang: number;
  gurmukhi: string;
  transliteration: string;
  bdbTranslation?: string;
  contributorId: string;
  contributorName?: string;
  providerLayers?: ProviderLayer[];
  raagId?: string;
  raag?: string;
  tggspTranslation?: string;
  tggspTransliteration?: string;
  tggspTranslationPa?: string;
  tggspTranslationScope?: "line" | "passage" | "none";
  tggspCollectionCode?: string;
  tggspPassageId?: string;
  tggspPassageMemberCount?: number;
  tggspPassageAnchorId?: string;
  tggspTerms?: TggspLineTerm[];
}

export interface TggspLineTerm {
  id: string;
  headword: string;
  transliteration: string;
  meaningEn: string;
  grammarEn: string;
  etymologyEn: string;
  meaningPa: string;
  grammarPa: string;
  etymologyPa: string;
}

export interface ProviderLayer {
  id: string;
  contentType: string;
  content: string;
  attributionLabel: string;
  mappingStatus: string;
}

export interface TextUnitSummary {
  id: string;
  sourceWorkId: string;
  title: string;
  contributorId: string;
  contributorName: string;
  firstAng: number;
  lastAng: number;
  lineCount: number;
  preview: string;
  transliteration: string;
  raag: string;
  tggspAvailable?: boolean;
}

export interface ShabadView extends TextUnitSummary {
  lines: CanonicalLine[];
  providerLayers: ProviderLayer[];
}

export type SearchResultType = "sabad" | "translation" | "glossary" | "theme";

export interface CorpusSearchResult {
  id: string;
  resultType: SearchResultType;
  textUnitId: string | null;
  sourceWorkId: string | null;
  title: string;
  subtitle: string;
  gurmukhi: string;
  transliteration: string;
  english: string;
  ang: number | null;
  contributorName: string;
  lineId: string | null;
  matchKind: "text" | "phonetic" | "first-letters" | "analysis" | "theme";
  providerContentTypes?: string[];
  searchScore?: number;
}

export interface CorpusSearchResponse {
  query: string;
  mode: "gurmukhi" | "latin" | "english" | "first-letters" | "theme";
  results: CorpusSearchResult[];
  candidateForms: SearchCandidate[];
}

export interface ConcordancePage {
  total: number;
  offset: number;
  limit: number;
  matches: CanonicalLine[];
}

export interface ProviderCoverage {
  totalLayers: number;
  mappedLayers: number;
  unmappedLayers: number;
  mappedTextUnits: number;
  unmappedGroups: number;
}

export interface ProviderAnalysis {
  id: string;
  title: string;
  mappingStatus: string;
  layers: ProviderLayer[];
}

export interface RelatedForm {
  form: string;
  relationType: string;
  provider: string;
}

export interface RaagSummary {
  id: string;
  name: string;
  unitCount: number;
  lineCount: number;
}

export interface RaagContributorSummary {
  id: string;
  name: string;
  unitCount: number;
}

export interface BaniSummary {
  id: string;
  token: string;
  sourceWorkId: string;
  gurmukhi: string;
  transliteration: string;
  verseCount: number;
  attributionLabel: string;
  tggspAvailable?: boolean;
  tggspTranslatedLines?: number;
}

export interface BaniLine {
  id: string;
  sourceWorkId: string;
  textUnitId: string;
  order: number;
  ang: number;
  headerLevel: number;
  paragraphNumber: number | null;
  gurmukhi: string;
  transliteration: string;
  contributorId: string;
  contributorName?: string;
  tggspTranslation?: string;
  tggspTranslationScope?: "line" | "passage" | "none";
  tggspCollectionCode?: string;
  tggspTerms?: TggspLineTerm[];
}

export interface BaniSection {
  order: number;
  title: string;
  author: string;
  firstLineOrder: number;
}
export interface BaniView extends BaniSummary {
  lines: BaniLine[];
  introduction?: string;
  sections?: BaniSection[];
  collectionType?: "bani" | "composition" | "ceremonial";
}

export interface TggspCollectionSummary {
  code: string;
  titleEn: string;
  titlePa: string;
  collectionType: "composition" | "ceremonial";
  collectionOrder: number;
  sectionCount: number;
  translatedLineCount: number;
}

export interface GroupedFrequency {
  forms: Array<{ form: string; frequency: number }>;
  totalFrequency: number;
  distinctLines: number;
  distinctUnits: number;
}

export interface CorpusInfo {
  buildKind: string;
  corpusReleaseId: string;
  providerReleaseId: string;
  lineCount: number;
  occurrenceCount: number;
}

export interface SourceWorkOption {
  id: string;
  title: string;
  maxAng: number;
}

export interface RankedForm {
  form: string;
  frequency: number;
  distinctLines: number;
}
export interface FrequencyPage {
  total: number;
  offset: number;
  limit: number;
  forms: RankedForm[];
}
export interface ContributorSummary {
  id: string;
  name: string;
  type: string;
  unitCount: number;
  lineCount: number;
}
export interface GlossaryResult {
  id: string;
  headword: string;
  transliteration?: string;
  meaningEn?: string;
  grammarEn?: string;
  etymologyEn?: string;
  meaningPa?: string;
  grammarPa?: string;
  etymologyPa?: string;
  frequency?: number;
  matchKind?: "gurmukhi" | "roman" | "english-concept";
  content: string;
  provider: string;
  reviewStatus: string;
}

export interface Contributor {
  id: string;
  name: string;
  type: "guru" | "bhagat" | "bhatt" | "author";
}

export interface SearchCandidate {
  gurmukhi: string;
  transliteration: string;
  note: string;
}

export interface WordStats {
  query: string;
  verified: boolean;
  rawFrequency: number | null;
  distinctLines: number | null;
  distinctUnits: number | null;
  perTenThousand: number | null;
  matches: CanonicalLine[];
}

export interface CoverageState {
  contentType: string;
  provider: string;
  status: "available" | "not_published" | "not_available" | "alignment_review";
}
