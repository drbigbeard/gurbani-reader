import { lines, phoneticCandidates } from '../data/fixture';
import type { BaniSummary, BaniView, CanonicalLine, ConcordancePage, ContributorSummary, CorpusInfo, CorpusSearchResponse, GlossaryResult, GroupedFrequency, ProviderAnalysis, ProviderCoverage, RaagContributorSummary, RaagSummary, RankedForm, RelatedForm, SearchCandidate, SearchFilters, SearchMode, ShabadView, SourceWorkOption, TextUnitSummary, WordStats } from '../types';
import { MobileCorpusGateway } from './mobile-gateway';

const lexicalTokens = (line: CanonicalLine): string[] =>
  Array.from(line.gurmukhi.matchAll(/[\p{L}\p{M}]+/gu), match => match[0].normalize('NFC'));

export interface CorpusGateway {
  resolveCandidates(query: string): Promise<SearchCandidate[]>;
  exactWordStats(gurmukhi: string, filters?: SearchFilters): Promise<WordStats>;
  getLines(ang?: number, sourceWorkId?: string): Promise<CanonicalLine[]>;
  sources(): Promise<SourceWorkOption[]>;
  corpusInfo(): Promise<CorpusInfo>;
  rankedForms(limit?: number, sourceWorkId?: string): Promise<RankedForm[]>;
  contributorSummaries(limit?: number, sourceWorkId?: string): Promise<ContributorSummary[]>;
  glossary(query: string, limit?: number): Promise<GlossaryResult[]>;
  getTextUnit(textUnitId: string): Promise<ShabadView>;
  contributorUnits(contributorId: string, sourceWorkId?: string, limit?: number, offset?: number): Promise<TextUnitSummary[]>;
  searchCorpus(query: string, filters?: SearchFilters, limit?: number, mode?: SearchMode): Promise<CorpusSearchResponse>;
  concordance(gurmukhi: string, filters?: SearchFilters, limit?: number, offset?: number): Promise<ConcordancePage>;
  providerCoverage(): Promise<ProviderCoverage>;
  unmappedProviderAnalyses(limit?: number, offset?: number): Promise<ProviderAnalysis[]>;
  relatedForms(gurmukhi: string, sourceWorkId?: string, limit?: number): Promise<RelatedForm[]>;
  groupedFrequency(forms: string[], filters?: SearchFilters): Promise<GroupedFrequency>;
  raagSummaries(sourceWorkId?: string): Promise<RaagSummary[]>;
  raagContributorSummaries(raag: string, sourceWorkId?: string): Promise<RaagContributorSummary[]>;
  raagUnits(raag: string, sourceWorkId?: string, limit?: number, offset?: number, contributorId?: string): Promise<TextUnitSummary[]>;
  namedBanis(sourceWorkId?: string): Promise<BaniSummary[]>;
  getBani(baniId: string): Promise<BaniView>;
}

class FixtureCorpusGateway implements CorpusGateway {
  async resolveCandidates(query: string): Promise<SearchCandidate[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];
    if (/^[\u0A00-\u0A7F]+$/u.test(trimmed)) {
      return [{ gurmukhi: trimmed.normalize('NFC'), transliteration: '', note: 'Direct Gurmukhi query' }];
    }
    return phoneticCandidates[trimmed.toLowerCase()] ?? [];
  }

  async exactWordStats(gurmukhi: string): Promise<WordStats> {
    const query = gurmukhi.normalize('NFC');
    const matches = lines.filter(line => lexicalTokens(line).includes(query));
    const rawFrequency = lines.reduce(
      (total, line) => total + lexicalTokens(line).filter(token => token === query).length,
      0
    );
    const eligible = lines.flatMap(lexicalTokens).length;
    const hasFixtureEvidence = rawFrequency > 0;
    return {
      query,
      verified: false,
      rawFrequency: hasFixtureEvidence ? rawFrequency : null,
      distinctLines: hasFixtureEvidence ? matches.length : null,
      distinctUnits: hasFixtureEvidence ? new Set(matches.map(line => line.textUnitId)).size : null,
      perTenThousand: hasFixtureEvidence && eligible ? rawFrequency / eligible * 10_000 : null,
      matches
    };
  }

  async getLines(): Promise<CanonicalLine[]> {
    return lines;
  }
  async sources(): Promise<SourceWorkOption[]> { return [{ id: 'source:G', title: 'Guru Granth Sahib', maxAng: 1430 }]; }

  async corpusInfo(): Promise<CorpusInfo> { return { buildKind: 'technical_fixture', corpusReleaseId: 'fixture', providerReleaseId: 'not-loaded', lineCount: lines.length, occurrenceCount: lines.flatMap(lexicalTokens).length }; }
  async rankedForms(limit = 20): Promise<RankedForm[]> {
    const counts = new Map<string, { frequency: number; lineIds: Set<string> }>();
    for (const line of lines) for (const form of lexicalTokens(line)) { const row = counts.get(form) ?? { frequency: 0, lineIds: new Set<string>() }; row.frequency += 1; row.lineIds.add(line.id); counts.set(form, row); }
    return [...counts].map(([form, row]) => ({ form, frequency: row.frequency, distinctLines: row.lineIds.size })).sort((a, b) => b.frequency - a.frequency).slice(0, limit);
  }
  async contributorSummaries(): Promise<ContributorSummary[]> { return [{ id: 'contributor:guru-nanak-sahib', name: 'Guru Nanak Sahib', type: 'guru', unitCount: 1, lineCount: lines.length }]; }
  async glossary(): Promise<GlossaryResult[]> { return []; }
  async getTextUnit(textUnitId: string): Promise<ShabadView> {
    const unitLines = lines.filter(line => line.textUnitId === textUnitId);
    return { id: textUnitId, sourceWorkId: unitLines[0]?.sourceWorkId ?? 'source:G', title: 'Fixture Sabad', contributorId: unitLines[0]?.contributorId ?? '', contributorName: 'Guru Nanak Sahib', firstAng: unitLines[0]?.ang ?? 1, lastAng: unitLines.at(-1)?.ang ?? 1, lineCount: unitLines.length, preview: unitLines[0]?.gurmukhi ?? '', transliteration: unitLines[0]?.transliteration ?? '', raag: 'Unclassified', lines: unitLines, providerLayers: [] };
  }
  async contributorUnits(contributorId: string): Promise<TextUnitSummary[]> {
    const unitIds = [...new Set(lines.filter(line => line.contributorId === contributorId).map(line => line.textUnitId))];
    return Promise.all(unitIds.map(async id => { const unit = await this.getTextUnit(id); const { lines: _lines, providerLayers: _layers, ...summary } = unit; return summary; }));
  }
  async searchCorpus(query: string): Promise<CorpusSearchResponse> {
    const trimmed = query.trim();
    const results = lines.filter(line => line.gurmukhi.includes(trimmed) || line.transliteration.toLowerCase().includes(trimmed.toLowerCase())).map(line => ({ id: `fixture:${line.id}`, resultType: 'sabad' as const, textUnitId: line.textUnitId, sourceWorkId: line.sourceWorkId, title: 'Fixture Sabad', subtitle: `Ang ${line.ang}`, gurmukhi: line.gurmukhi, transliteration: line.transliteration, english: '', ang: line.ang, contributorName: 'Guru Nanak Sahib', lineId: line.id, matchKind: 'text' as const }));
    return { query: trimmed, mode: /^[\u0A00-\u0A7F]/u.test(trimmed) ? 'gurmukhi' : 'latin', results, candidateForms: await this.resolveCandidates(trimmed) };
  }
  async concordance(gurmukhi: string, _filters?: SearchFilters, limit = 50, offset = 0): Promise<ConcordancePage> {
    const matches = lines.filter(line => lexicalTokens(line).includes(gurmukhi.normalize('NFC')));
    return { total: matches.length, offset, limit, matches: matches.slice(offset, offset + limit) };
  }
  async providerCoverage(): Promise<ProviderCoverage> { return { totalLayers: 0, mappedLayers: 0, unmappedLayers: 0, mappedTextUnits: 0, unmappedGroups: 0 }; }
  async unmappedProviderAnalyses(): Promise<ProviderAnalysis[]> { return []; }
  async relatedForms(): Promise<RelatedForm[]> { return []; }
  async groupedFrequency(forms: string[]): Promise<GroupedFrequency> {
    const components = await Promise.all(forms.map(async form => ({ form, frequency: (await this.exactWordStats(form)).rawFrequency ?? 0 })));
    return { forms: components, totalFrequency: components.reduce((sum, row) => sum + row.frequency, 0), distinctLines: 0, distinctUnits: 0 };
  }
  async raagSummaries(): Promise<RaagSummary[]> { return []; }
  async raagContributorSummaries(): Promise<RaagContributorSummary[]> { return []; }
  async raagUnits(): Promise<TextUnitSummary[]> { return []; }
  async namedBanis(): Promise<BaniSummary[]> { return []; }
  async getBani(): Promise<BaniView> { throw new Error('Named Banis are not available in the fixture'); }
}

interface ApiEnvelope<T> {
  data: T;
  meta: {
    fixture: boolean;
    analysisReleaseId: string;
    corpusReleaseId: string;
  };
}

type ApiWordStats = Omit<WordStats, 'matches'> & { eligibleLexicalTokens: number; occurrenceIds: string[] };

export class HttpCorpusGateway implements CorpusGateway {
  constructor(private readonly baseUrl: string) {}

  async resolveCandidates(query: string): Promise<SearchCandidate[]> {
    const response = await this.get<ApiEnvelope<SearchCandidate[]>>(`/v1/search/candidates?q=${encodeURIComponent(query)}`);
    return response.data;
  }

  async exactWordStats(gurmukhi: string): Promise<WordStats> {
    const encoded = encodeURIComponent(gurmukhi);
    const [stats, concordance] = await Promise.all([
      this.get<ApiEnvelope<ApiWordStats>>(`/v1/words/${encoded}/stats`),
      this.get<ApiEnvelope<CanonicalLine[]>>(`/v1/words/${encoded}/concordance`)
    ]);
    return { ...stats.data, matches: concordance.data };
  }

  async getLines(): Promise<CanonicalLine[]> {
    const response = await this.get<ApiEnvelope<CanonicalLine[]>>('/v1/lines');
    return response.data;
  }
  async sources(): Promise<SourceWorkOption[]> { throw new Error('Sources endpoint is not available'); }

  async corpusInfo(): Promise<CorpusInfo> { throw new Error('Corpus information endpoint is not available'); }
  async rankedForms(): Promise<RankedForm[]> { throw new Error('Rankings endpoint is not available'); }
  async contributorSummaries(): Promise<ContributorSummary[]> { throw new Error('Contributor endpoint is not available'); }
  async glossary(): Promise<GlossaryResult[]> { throw new Error('Glossary endpoint is not available'); }
  async getTextUnit(): Promise<ShabadView> { throw new Error('Text-unit endpoint is not available'); }
  async contributorUnits(): Promise<TextUnitSummary[]> { throw new Error('Contributor units endpoint is not available'); }
  async searchCorpus(): Promise<CorpusSearchResponse> { throw new Error('Corpus search endpoint is not available'); }
  async concordance(): Promise<ConcordancePage> { throw new Error('Concordance endpoint is not available'); }
  async providerCoverage(): Promise<ProviderCoverage> { throw new Error('Provider coverage endpoint is not available'); }
  async unmappedProviderAnalyses(): Promise<ProviderAnalysis[]> { throw new Error('Provider analysis endpoint is not available'); }
  async relatedForms(): Promise<RelatedForm[]> { throw new Error('Related forms endpoint is not available'); }
  async groupedFrequency(): Promise<GroupedFrequency> { throw new Error('Grouped frequency endpoint is not available'); }
  async raagSummaries(): Promise<RaagSummary[]> { throw new Error('Raag endpoint is not available'); }
  async raagContributorSummaries(): Promise<RaagContributorSummary[]> { throw new Error('Raag contributor endpoint is not available'); }
  async raagUnits(): Promise<TextUnitSummary[]> { throw new Error('Raag units endpoint is not available'); }
  async namedBanis(): Promise<BaniSummary[]> { throw new Error('Named Banis endpoint is not available'); }
  async getBani(): Promise<BaniView> { throw new Error('Named Bani endpoint is not available'); }

  private async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl.replace(/\/$/u, '')}${path}`, {
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) {
      throw new Error(`Corpus API request failed with status ${response.status}`);
    }
    return response.json() as Promise<T>;
  }
}

const apiUrl = import.meta.env.VITE_CORPUS_API_URL?.trim();
export const corpusGateway: CorpusGateway = MobileCorpusGateway.supported()
  ? new MobileCorpusGateway()
  : apiUrl
    ? new HttpCorpusGateway(apiUrl)
    : new FixtureCorpusGateway();
