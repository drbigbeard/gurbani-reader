import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite';
import { lines, phoneticCandidates } from '../data/fixture';
import type { BaniSummary, BaniView, CanonicalLine, ConcordancePage, ContributorSummary, CorpusInfo, CorpusSearchResult, CorpusSearchResponse, FrequencyPage, GlossaryResult, GroupedFrequency, ProviderAnalysis, ProviderCoverage, ProviderLayer, RaagContributorSummary, RaagSummary, RankedForm, RelatedForm, SearchCandidate, SearchFilters, SearchMode, ShabadView, SourceWorkOption, TextUnitSummary, TggspCollectionSummary, TggspLineTerm, WordStats } from '../types';
import { MOBILE_DATABASE_NAME, MOBILE_SCHEMA_SQL, MOBILE_SCHEMA_VERSION } from './mobile-schema';

type DatabaseRow = Record<string, unknown>;
const BHAI_GURDAS_CONTRIBUTORS = ['contributor:banidb:22', 'contributor:banidb:49'];
const COMBINED_BHAI_GURDAS_ID = 'contributor:combined:bhai-gurdas';

export class MobileCorpusGateway {
  private readonly sqlite = new SQLiteConnection(CapacitorSQLite);
  private connection: Promise<SQLiteDBConnection> | null = null;

  static supported(): boolean {
    return Capacitor.isNativePlatform();
  }

  async resolveCandidates(query: string): Promise<SearchCandidate[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];
    if (/^[\u0A00-\u0A7F]+$/u.test(trimmed)) {
      return [{ gurmukhi: trimmed.normalize('NFC'), transliteration: '', note: 'Direct Gurmukhi query' }];
    }

    const fixture = phoneticCandidates[trimmed.toLowerCase()];
    if (fixture) return fixture;
    const db = await this.db();
    const result = await db.query(
      `SELECT DISTINCT written_form AS gurmukhi, COALESCE(transliteration, '') AS transliteration,
              relation_type AS note
       FROM term_form WHERE lower(transliteration) = lower(?) ORDER BY written_form`,
      [trimmed]
    );
    return (result.values ?? []) as SearchCandidate[];
  }

  async exactWordStats(gurmukhi: string, filters: SearchFilters = defaultSearchFilters()): Promise<WordStats> {
    const db = await this.db();
    const compare = gurmukhi.normalize('NFC');
    const facets = searchFacetSql(filters, 'l');
    const [summary, eligible, matches] = await Promise.all([
      db.query(
        `SELECT COUNT(*) AS rawFrequency, COUNT(DISTINCT line_id) AS distinctLines,
                COUNT(DISTINCT text_unit_id) AS distinctUnits
         FROM token_occurrence t JOIN canonical_line l ON l.id = t.line_id
         WHERE t.token_class = 'lexical_gurmukhi' AND t.comparison_form = ? ${facets.clause}`,
        [compare, ...facets.params]
      ),
      db.query(`SELECT COUNT(*) AS count FROM token_occurrence t JOIN canonical_line l ON l.id = t.line_id
        WHERE t.token_class = 'lexical_gurmukhi' ${facets.clause}`, [...facets.params]),
      db.query(
        `SELECT DISTINCT l.id, l.source_work_id AS sourceWorkId, l.text_unit_id AS textUnitId,
                l.line_order AS 'order', l.ang, l.gurmukhi,
                COALESCE(l.transliteration, '') AS transliteration,
                COALESCE(l.contributor_id, '') AS contributorId,
                COALESCE((SELECT preferred_name FROM contributor c WHERE c.id = l.contributor_id), '') AS contributorName
         FROM canonical_line l JOIN token_occurrence t ON t.line_id = l.id
         WHERE t.token_class = 'lexical_gurmukhi' AND t.comparison_form = ? ${facets.clause}
         ORDER BY l.source_work_id, l.ang, l.line_order LIMIT 200`,
        [compare, ...facets.params]
      )
    ]);
    const row = first(summary.values);
    const raw = numberValue(row.rawFrequency);
    const denominator = numberValue(first(eligible.values).count);
    return {
      query: gurmukhi,
      verified: true,
      rawFrequency: raw || null,
      distinctLines: raw ? numberValue(row.distinctLines) : null,
      distinctUnits: raw ? numberValue(row.distinctUnits) : null,
      perTenThousand: raw && denominator ? raw / denominator * 10_000 : null,
      matches: (matches.values ?? []) as unknown as CanonicalLine[]
    };
  }

  async getLines(ang = 1, sourceWorkId = 'source:G'): Promise<CanonicalLine[]> {
    const db = await this.db();
    const result = await db.query(
      `SELECT id, source_work_id AS sourceWorkId, text_unit_id AS textUnitId,
              line_order AS 'order', ang, gurmukhi, COALESCE(transliteration, '') AS transliteration,
              COALESCE(contributor_id, '') AS contributorId,
              COALESCE((SELECT preferred_name FROM contributor c WHERE c.id = canonical_line.contributor_id), '') AS contributorName
       FROM canonical_line WHERE source_work_id = ? AND ang = ? ORDER BY line_order LIMIT 120`, [sourceWorkId, ang]
    );
    const rows = (result.values ?? []) as unknown as CanonicalLine[];
    if (!rows.length) return rows;
    const units = [...new Set(rows.map(row => row.textUnitId))];
    const placeholders = units.map(() => '?').join(',');
    const layers = await db.query(
      `SELECT id, text_unit_id AS textUnitId, content_type AS contentType, content,
              attribution_label AS attributionLabel, mapping_status AS mappingStatus
       FROM provider_content WHERE text_unit_id IN (${placeholders}) ORDER BY content_type`, units
    );
    const byUnit = new Map<string, ProviderLayer[]>();
    for (const raw of layers.values ?? []) {
      const layer = raw as unknown as ProviderLayer & { textUnitId: string };
      const list = byUnit.get(layer.textUnitId) ?? [];
      list.push(layer); byUnit.set(layer.textUnitId, list);
    }
    return this.enrichTggsp(rows.map(row => ({ ...row, providerLayers: byUnit.get(row.textUnitId) ?? [] })));
  }

  async getTextUnit(textUnitId: string): Promise<ShabadView> {
    const db = await this.db();
    const [unitResult, lineResult, layerResult] = await Promise.all([
      db.query(`SELECT u.id, u.source_work_id AS sourceWorkId, COALESCE(u.title, 'Shabad') AS title,
          COALESCE(MIN(l.contributor_id), '') AS contributorId,
          COALESCE(MIN(c.preferred_name), 'Unknown contributor') AS contributorName,
          COALESCE(MIN(l.ang), 1) AS firstAng, COALESCE(MAX(l.ang), 1) AS lastAng,
          COUNT(l.id) AS lineCount, COALESCE(MIN(l.raag), 'Unclassified') AS raag
        FROM text_unit u JOIN canonical_line l ON l.text_unit_id = u.id
        LEFT JOIN contributor c ON c.id = l.contributor_id
        WHERE u.id = ? GROUP BY u.id`, [textUnitId]),
      db.query(`SELECT l.id, l.source_work_id AS sourceWorkId, l.text_unit_id AS textUnitId,
          l.line_order AS 'order', l.ang, l.gurmukhi, COALESCE(l.transliteration, '') AS transliteration,
          COALESCE(l.contributor_id, '') AS contributorId, COALESCE(c.preferred_name, '') AS contributorName
        FROM canonical_line l LEFT JOIN contributor c ON c.id = l.contributor_id
        WHERE l.text_unit_id = ? ORDER BY l.ang, l.line_order, l.id`, [textUnitId]),
      db.query(`SELECT id, content_type AS contentType, content, attribution_label AS attributionLabel,
          mapping_status AS mappingStatus FROM provider_content
        WHERE text_unit_id = ? OR canonical_line_id IN (SELECT id FROM canonical_line WHERE text_unit_id = ?)
        ORDER BY content_type, id`, [textUnitId, textUnitId])
    ]);
    const unit = first(unitResult.values);
    if (!unit.id) throw new Error(`Text unit not found: ${textUnitId}`);
    const unitLines = await this.enrichTggsp((lineResult.values ?? []) as unknown as CanonicalLine[]);
    return {
      id: String(unit.id), sourceWorkId: String(unit.sourceWorkId), title: String(unit.title),
      contributorId: String(unit.contributorId), contributorName: String(unit.contributorName),
      firstAng: numberValue(unit.firstAng), lastAng: numberValue(unit.lastAng),
      lineCount: numberValue(unit.lineCount), preview: unitLines[0]?.gurmukhi ?? '',
      transliteration: unitLines[0]?.transliteration ?? '', raag: String(unit.raag), lines: unitLines,
      providerLayers: (layerResult.values ?? []) as unknown as ProviderLayer[]
    };
  }

  async contributorUnits(contributorId: string, sourceWorkId = 'source:G', limit = 50, offset = 0): Promise<TextUnitSummary[]> {
    const db = await this.db();
    const contributorClause = contributorId === COMBINED_BHAI_GURDAS_ID
      ? `l.contributor_id IN (${BHAI_GURDAS_CONTRIBUTORS.map(() => '?').join(',')})` : 'l.contributor_id = ?';
    const contributorParams = contributorId === COMBINED_BHAI_GURDAS_ID ? BHAI_GURDAS_CONTRIBUTORS : [contributorId];
    const result = await db.query(`SELECT u.id, u.source_work_id AS sourceWorkId,
        COALESCE(u.title, 'Shabad') AS title, ? AS contributorId,
        ${contributorId === COMBINED_BHAI_GURDAS_ID ? "'Bhai Gurdas Ji'" : "COALESCE(c.preferred_name, 'Unknown contributor')"} AS contributorName,
        MIN(l.ang) AS firstAng, MAX(l.ang) AS lastAng, COUNT(l.id) AS lineCount,
        COALESCE(MIN(l.raag), 'Unclassified') AS raag,
        COALESCE((SELECT x.gurmukhi FROM canonical_line x WHERE x.text_unit_id = u.id ORDER BY x.ang, x.line_order LIMIT 1), '') AS preview,
        COALESCE((SELECT x.transliteration FROM canonical_line x WHERE x.text_unit_id = u.id ORDER BY x.ang, x.line_order LIMIT 1), '') AS transliteration
      FROM text_unit u JOIN canonical_line l ON l.text_unit_id = u.id
      LEFT JOIN contributor c ON c.id = ?
      WHERE u.source_work_id = ? AND ${contributorClause}
      GROUP BY u.id ORDER BY firstAng, u.unit_order LIMIT ? OFFSET ?`,
      [contributorId, contributorId, sourceWorkId, ...contributorParams, limit, offset]);
    return (result.values ?? []).map(textUnitSummary);
  }

  async searchCorpus(query: string, filters: SearchFilters = defaultSearchFilters(), limit = 60, mode: SearchMode = 'auto'): Promise<CorpusSearchResponse> {
    const db = await this.db();
    const trimmed = query.trim();
    if (!trimmed) return filters.tggspOnly ? this.tggspAvailableSearch(filters, limit) : { query: '', mode: 'latin', results: [], candidateForms: [] };
    const isGurmukhi = /[\u0A00-\u0A7F]/u.test(trimmed);
    if (mode === 'theme') return this.themeSearch(trimmed, filters, limit);
    const facets = searchFacetSql(filters, 'l');
    const normalizedRoman = latinFold(trimmed);
    const phonetic = phoneticRoman(normalizedRoman);
    const lineSql = isGurmukhi ? `l.gurmukhi LIKE ?` : `l.id IN (
      SELECT line_id FROM line_search_fts WHERE line_search_fts MATCH ? ORDER BY rank LIMIT 800
    )`;
    const lineParams = isGurmukhi ? [`%${trimmed.normalize('NFC')}%`] : [ftsRomanQuery(normalizedRoman, phonetic)];
    const lineResult = await db.query(`SELECT l.id AS lineId, l.text_unit_id AS textUnitId,
        l.source_work_id AS sourceWorkId, l.ang, l.gurmukhi,
        COALESCE(l.transliteration, '') AS transliteration,
        COALESCE(c.preferred_name, '') AS contributorName, COALESCE(u.title, 'Shabad') AS title,
        COALESCE((SELECT group_concat(DISTINCT pc.content_type) FROM provider_content pc WHERE pc.text_unit_id = l.text_unit_id), '') AS providerTypes
      FROM canonical_line l JOIN text_unit u ON u.id = l.text_unit_id
      LEFT JOIN contributor c ON c.id = l.contributor_id
      WHERE (${lineSql}) ${facets.clause} ORDER BY CASE l.source_work_id WHEN 'source:G' THEN 0 ELSE 1 END, l.ang, l.line_order LIMIT ?`,
      [...lineParams, ...facets.params, Math.max(limit * 8, 240)]);

    const seenUnits = new Set<string>();
    const candidateMap = new Map<string, SearchCandidate>();
    const sabadResults: CorpusSearchResult[] = [];
    for (const raw of lineResult.values ?? []) {
      const row = raw as DatabaseRow;
      if (!isGurmukhi && !transliterationMatches(String(row.transliteration), trimmed)) continue;
      for (const candidate of alignedCandidates(String(row.gurmukhi), String(row.transliteration), trimmed)) {
        candidateMap.set(candidate.gurmukhi, candidate);
      }
      const unitId = String(row.textUnitId);
      if (seenUnits.has(unitId)) continue;
      seenUnits.add(unitId);
      sabadResults.push({ id: `search:sabad:${unitId}`, resultType: 'sabad', textUnitId: unitId,
        sourceWorkId: String(row.sourceWorkId), title: String(row.title),
        subtitle: `${String(row.contributorName)} · Ang ${numberValue(row.ang)}`,
        gurmukhi: String(row.gurmukhi), transliteration: String(row.transliteration), english: '',
        ang: numberValue(row.ang), contributorName: String(row.contributorName), lineId: String(row.lineId),
        matchKind: !isGurmukhi && latinFold(String(row.transliteration)).includes(normalizedRoman) ? 'text' : 'phonetic', providerContentTypes: splitProviderTypes(row.providerTypes) });
      if (sabadResults.length >= limit) break;
    }

    const initialField = isGurmukhi ? 'idx.initials_gurmukhi' : 'idx.initials_latin';
    const initialQuery = isGurmukhi ? trimmed.normalize('NFC').replaceAll(' ', '') : latinFold(trimmed).replaceAll(' ', '');
    const initialResult = initialQuery ? await db.query(`SELECT l.id AS lineId, l.text_unit_id AS textUnitId,
        l.source_work_id AS sourceWorkId, l.ang, l.gurmukhi, COALESCE(l.transliteration, '') AS transliteration,
        COALESCE(c.preferred_name, '') AS contributorName, COALESCE(u.title, 'Shabad') AS title,
        COALESCE((SELECT group_concat(DISTINCT pc.content_type) FROM provider_content pc WHERE pc.text_unit_id = l.text_unit_id), '') AS providerTypes
      FROM line_search_index idx JOIN canonical_line l ON l.id = idx.line_id
      JOIN text_unit u ON u.id = l.text_unit_id LEFT JOIN contributor c ON c.id = l.contributor_id
      WHERE (${initialField} LIKE ? OR ${initialField} LIKE ?) ${facets.clause}
      ORDER BY CASE l.source_work_id WHEN 'source:G' THEN 0 ELSE 1 END, l.ang, l.line_order LIMIT ?`,
      [`${initialQuery}%`, `%${initialQuery}%`, ...facets.params, limit]) : { values: [] };
    const initialResults: CorpusSearchResult[] = [];
    for (const raw of initialResult.values ?? []) {
      const row = raw as DatabaseRow; const unitId = String(row.textUnitId);
      if (seenUnits.has(unitId)) continue; seenUnits.add(unitId);
      initialResults.push({ id: `search:initials:${String(row.lineId)}`, resultType: 'sabad', textUnitId: unitId,
        sourceWorkId: String(row.sourceWorkId), title: String(row.title),
        subtitle: `${String(row.contributorName)} · Ang ${numberValue(row.ang)} · first-letter match`,
        gurmukhi: String(row.gurmukhi), transliteration: String(row.transliteration), english: '',
        ang: numberValue(row.ang), contributorName: String(row.contributorName), lineId: String(row.lineId),
        matchKind: 'first-letters', providerContentTypes: splitProviderTypes(row.providerTypes) });
    }

    if (isGurmukhi) {
      const forms = await db.query(`SELECT t.comparison_form AS gurmukhi, COUNT(*) AS frequency
        FROM token_occurrence t JOIN canonical_line l ON l.id = t.line_id
        WHERE t.token_class = 'lexical_gurmukhi' AND t.comparison_form LIKE ? ${facets.clause}
        GROUP BY t.comparison_form ORDER BY frequency DESC LIMIT 12`,
        [`${trimmed.normalize('NFC')}%`, ...facets.params]);
      for (const row of forms.values ?? []) candidateMap.set(String(row.gurmukhi), {
        gurmukhi: String(row.gurmukhi), transliteration: '', note: `${numberValue(row.frequency).toLocaleString()} exact occurrences`
      });
    }

    const providerTypeFilter = filters.providerContentTypes.length
      ? `AND p.content_type IN (${filters.providerContentTypes.map(() => '?').join(',')})` : '';
    const englishFacets = searchFacetSql(filters, 'l');
    const englishResult = !isGurmukhi ? await db.query(`SELECT p.id, p.text_unit_id AS textUnitId,
        p.content_type AS contentType, p.content, u.source_work_id AS sourceWorkId,
        COALESCE(u.title, 'Analysed Shabad') AS title,
        COALESCE(MIN(l.ang), 1) AS ang, COALESCE(MIN(c.preferred_name), '') AS contributorName,
        COALESCE(MIN(l.id), '') AS lineId,
        COALESCE((SELECT x.gurmukhi FROM canonical_line x WHERE x.text_unit_id = p.text_unit_id ORDER BY x.ang, x.line_order LIMIT 1), '') AS gurmukhi,
        COALESCE((SELECT group_concat(DISTINCT pc.content_type) FROM provider_content pc WHERE pc.text_unit_id = p.text_unit_id), '') AS providerTypes
      FROM provider_content p JOIN text_unit u ON u.id = p.text_unit_id
      LEFT JOIN canonical_line l ON l.text_unit_id = u.id LEFT JOIN contributor c ON c.id = l.contributor_id
      WHERE p.content_type LIKE '%_en' AND lower(p.content) LIKE ? ${providerTypeFilter} ${englishFacets.clause}
      GROUP BY p.id ORDER BY CASE u.source_work_id WHEN 'source:G' THEN 0 ELSE 1 END, ang LIMIT ?`,
      [`%${trimmed.toLowerCase()}%`, ...filters.providerContentTypes, ...englishFacets.params, limit]) : { values: [] };
    const translationResults: CorpusSearchResult[] = (englishResult.values ?? []).map(row => ({
      id: `search:translation:${String(row.id)}`, resultType: 'translation', textUnitId: String(row.textUnitId),
      sourceWorkId: String(row.sourceWorkId), title: String(row.title),
      subtitle: `${String(row.contentType).replaceAll('_', ' ')} · Ang ${numberValue(row.ang)}`,
      gurmukhi: String(row.gurmukhi), transliteration: '', english: plainText(String(row.content)),
      ang: numberValue(row.ang), contributorName: String(row.contributorName), lineId: String(row.lineId),
      matchKind: 'analysis', providerContentTypes: splitProviderTypes(row.providerTypes).length ? splitProviderTypes(row.providerTypes) : ['tggsp-linked']
    }));
    const linkedEnglishResult = !isGurmukhi ? await db.query(`SELECT l.id AS lineId,l.text_unit_id AS textUnitId,
        l.source_work_id AS sourceWorkId,l.ang,l.gurmukhi,COALESCE(l.transliteration,'') AS transliteration,
        COALESCE(c.preferred_name,'') AS contributorName,COALESCE(u.title,'Shabad') AS title,
        COALESCE(MIN(CASE WHEN lower(tt.meaning_en) LIKE ? THEN tt.meaning_en END),
          MIN(CASE WHEN lower(a.literal_translation_en) LIKE ? THEN a.literal_translation_en END),'') AS content
      FROM canonical_line l JOIN text_unit u ON u.id=l.text_unit_id LEFT JOIN contributor c ON c.id=l.contributor_id
      LEFT JOIN tggsp_line_term tt ON tt.canonical_line_id=l.id
      LEFT JOIN tggsp_line_member tm ON tm.canonical_line_id=l.id LEFT JOIN tggsp_line_alignment a ON a.id=tm.alignment_id
      WHERE (lower(tt.meaning_en) LIKE ? OR lower(tt.etymology_en) LIKE ? OR lower(a.literal_translation_en) LIKE ?) ${englishFacets.clause}
      GROUP BY l.id ORDER BY CASE l.source_work_id WHEN 'source:G' THEN 0 ELSE 1 END,l.ang,l.line_order LIMIT ?`,
      [`%${trimmed.toLowerCase()}%`,`%${trimmed.toLowerCase()}%`,`%${trimmed.toLowerCase()}%`,`%${trimmed.toLowerCase()}%`,`%${trimmed.toLowerCase()}%`,...englishFacets.params,limit]) : { values: [] };
    const linkedResults: CorpusSearchResult[]=(linkedEnglishResult.values??[]).map(row=>({id:`search:tggsp-linked:${String(row.lineId)}`,resultType:'translation',textUnitId:String(row.textUnitId),sourceWorkId:String(row.sourceWorkId),title:String(row.title),subtitle:`${String(row.contributorName)} · Ang ${numberValue(row.ang)} · TGGSP linked meaning`,gurmukhi:String(row.gurmukhi),transliteration:String(row.transliteration),english:String(row.content),ang:numberValue(row.ang),contributorName:String(row.contributorName),lineId:String(row.lineId),matchKind:'analysis',providerContentTypes:['literal_translation_en']}));
    const baniDbEnglishResult = !isGurmukhi ? await db.query(`SELECT l.id AS lineId,l.text_unit_id AS textUnitId,
        l.source_work_id AS sourceWorkId,l.ang,l.gurmukhi,COALESCE(l.transliteration,'') AS transliteration,
        COALESCE(c.preferred_name,'') AS contributorName,COALESCE(u.title,'Shabad') AS title,t.content
      FROM line_translation t JOIN canonical_line l ON l.id=t.canonical_line_id
      JOIN text_unit u ON u.id=l.text_unit_id LEFT JOIN contributor c ON c.id=l.contributor_id
      WHERE t.provider='banidb' AND t.language='en' AND lower(t.content) LIKE ? ${englishFacets.clause}
      ORDER BY CASE l.source_work_id WHEN 'source:G' THEN 0 ELSE 1 END,l.ang,l.line_order LIMIT ?`,
      [`%${trimmed.toLowerCase()}%`,...englishFacets.params,limit]) : { values: [] };
    const baniDbResults:CorpusSearchResult[]=(baniDbEnglishResult.values??[]).map(row=>({id:`search:banidb-translation:${String(row.lineId)}`,resultType:'translation',textUnitId:String(row.textUnitId),sourceWorkId:String(row.sourceWorkId),title:String(row.title),subtitle:`${String(row.contributorName)} · Ang ${numberValue(row.ang)} · BaniDB translation`,gurmukhi:String(row.gurmukhi),transliteration:String(row.transliteration),english:String(row.content),ang:numberValue(row.ang),contributorName:String(row.contributorName),lineId:String(row.lineId),matchKind:'analysis',providerContentTypes:[]}));
    const allAnalysis=[...linkedResults,...baniDbResults,...translationResults];
    return { query: trimmed, mode: isGurmukhi ? 'gurmukhi' : allAnalysis.length > sabadResults.length ? 'english' : 'latin',
      results: [...sabadResults, ...initialResults, ...allAnalysis].slice(0, limit), candidateForms: [...candidateMap.values()].slice(0, 12) };
  }

  async concordance(gurmukhi: string, filters: SearchFilters = defaultSearchFilters(), limit = 50, offset = 0): Promise<ConcordancePage> {
    const db = await this.db();
    const compare = gurmukhi.normalize('NFC');
    const facets = searchFacetSql(filters, 'l');
    const [countResult, matchResult] = await Promise.all([
      db.query(`SELECT COUNT(DISTINCT t.line_id) AS total FROM token_occurrence t
        JOIN canonical_line l ON l.id = t.line_id
        WHERE t.token_class = 'lexical_gurmukhi' AND t.comparison_form = ? ${facets.clause}`, [compare, ...facets.params]),
      db.query(`SELECT DISTINCT l.id, l.source_work_id AS sourceWorkId, l.text_unit_id AS textUnitId,
          l.line_order AS 'order', l.ang, l.gurmukhi, COALESCE(l.transliteration, '') AS transliteration,
          COALESCE(l.contributor_id, '') AS contributorId, COALESCE(c.preferred_name, '') AS contributorName
        FROM canonical_line l JOIN token_occurrence t ON t.line_id = l.id
        LEFT JOIN contributor c ON c.id = l.contributor_id
        WHERE t.token_class = 'lexical_gurmukhi' AND t.comparison_form = ? ${facets.clause}
        ORDER BY l.source_work_id, l.ang, l.line_order LIMIT ? OFFSET ?`, [compare, ...facets.params, limit, offset])
    ]);
    return { total: numberValue(first(countResult.values).total), offset, limit,
      matches: (matchResult.values ?? []) as unknown as CanonicalLine[] };
  }

  async providerCoverage(): Promise<ProviderCoverage> {
    const db = await this.db();
    const result = await db.query(`SELECT COUNT(*) AS totalLayers,
        SUM(CASE WHEN text_unit_id IS NOT NULL THEN 1 ELSE 0 END) AS mappedLayers,
        SUM(CASE WHEN text_unit_id IS NULL THEN 1 ELSE 0 END) AS unmappedLayers,
        COUNT(DISTINCT text_unit_id) AS mappedTextUnits,
        COUNT(DISTINCT CASE WHEN text_unit_id IS NULL THEN substr(id, 1, length(id) - length(content_type) - 1) END) AS unmappedGroups
      FROM provider_content`);
    const row = first(result.values);
    return { totalLayers: numberValue(row.totalLayers), mappedLayers: numberValue(row.mappedLayers),
      unmappedLayers: numberValue(row.unmappedLayers), mappedTextUnits: numberValue(row.mappedTextUnits),
      unmappedGroups: numberValue(row.unmappedGroups) };
  }

  async unmappedProviderAnalyses(limit = 20, offset = 0): Promise<ProviderAnalysis[]> {
    const db = await this.db();
    const groupsResult = await db.query(`SELECT substr(id, 1, length(id) - length(content_type) - 1) AS groupId,
        MIN(mapping_status) AS mappingStatus FROM provider_content
      WHERE text_unit_id IS NULL GROUP BY groupId ORDER BY groupId LIMIT ? OFFSET ?`, [limit, offset]);
    const groups = (groupsResult.values ?? []).map(row => ({ id: String(row.groupId), status: String(row.mappingStatus) }));
    if (!groups.length) return [];
    const placeholders = groups.map(() => '?').join(',');
    const layerResult = await db.query(`SELECT substr(id, 1, length(id) - length(content_type) - 1) AS groupId,
        id, content_type AS contentType, content, attribution_label AS attributionLabel,
        mapping_status AS mappingStatus FROM provider_content
      WHERE substr(id, 1, length(id) - length(content_type) - 1) IN (${placeholders})
      ORDER BY groupId, content_type`, groups.map(group => group.id));
    const byGroup = new Map<string, ProviderLayer[]>();
    for (const row of layerResult.values ?? []) {
      const groupId = String(row.groupId);
      const list = byGroup.get(groupId) ?? [];
      list.push({ id: String(row.id), contentType: String(row.contentType), content: String(row.content),
        attributionLabel: String(row.attributionLabel), mappingStatus: String(row.mappingStatus) });
      byGroup.set(groupId, list);
    }
    return groups.map(group => ({ id: group.id, title: providerGroupTitle(group.id), mappingStatus: group.status,
      layers: byGroup.get(group.id) ?? [] }));
  }

  async relatedForms(gurmukhi: string, sourceWorkId = 'source:G', limit = 30): Promise<RelatedForm[]> {
    const db = await this.db();
    const result = await db.query(`SELECT DISTINCT related.written_form AS form,
        related.relation_type AS relationType, glossary.provider
      FROM term_form seed JOIN term_form related ON related.glossary_entry_id = seed.glossary_entry_id
      JOIN glossary_entry glossary ON glossary.id = seed.glossary_entry_id
      WHERE seed.comparison_form = ? AND related.written_form <> ? AND related.written_form <> ''
      ORDER BY related.written_form LIMIT ?`, [gurmukhi.normalize('NFC'), gurmukhi, limit]);
    const curated = (result.values ?? []).map(row => ({ form: String(row.form), relationType: String(row.relationType), provider: String(row.provider) }));
    if (curated.length >= limit) return curated;
    const base = [...gurmukhi.normalize('NFC')].slice(0, Math.max(1, [...gurmukhi].length - 1)).join('');
    const suggestions = await db.query(`SELECT comparison_form AS form, COUNT(*) AS frequency
      FROM token_occurrence WHERE (? = 'all' OR source_work_id = ?) AND token_class = 'lexical_gurmukhi'
        AND comparison_form LIKE ? AND comparison_form <> ?
      GROUP BY comparison_form ORDER BY frequency DESC LIMIT ?`, [sourceWorkId, sourceWorkId, `${base}%`, gurmukhi, limit - curated.length]);
    const seen = new Set(curated.map(row => row.form));
    return [...curated, ...(suggestions.values ?? []).flatMap(row => {
      const form = String(row.form);
      if (seen.has(form)) return [];
      return [{ form, relationType: `unreviewed source-prefix candidate · ${numberValue(row.frequency).toLocaleString()} occurrences`, provider: 'BaniDB analytical index' }];
    })];
  }

  async groupedFrequency(forms: string[], filters: SearchFilters = defaultSearchFilters()): Promise<GroupedFrequency> {
    const uniqueForms = [...new Set(forms.map(form => form.normalize('NFC')).filter(Boolean))];
    if (!uniqueForms.length) return { forms: [], totalFrequency: 0, distinctLines: 0, distinctUnits: 0 };
    const db = await this.db();
    const placeholders = uniqueForms.map(() => '?').join(',');
    const facets = searchFacetSql(filters, 'l');
    const [componentResult, totalResult] = await Promise.all([
      db.query(`SELECT t.comparison_form AS form, COUNT(*) AS frequency FROM token_occurrence t
        JOIN canonical_line l ON l.id = t.line_id
        WHERE t.token_class = 'lexical_gurmukhi' AND t.comparison_form IN (${placeholders}) ${facets.clause}
        GROUP BY t.comparison_form ORDER BY frequency DESC`, [...uniqueForms, ...facets.params]),
      db.query(`SELECT COUNT(*) AS totalFrequency, COUNT(DISTINCT t.line_id) AS distinctLines,
          COUNT(DISTINCT t.text_unit_id) AS distinctUnits FROM token_occurrence t
        JOIN canonical_line l ON l.id = t.line_id
        WHERE t.token_class = 'lexical_gurmukhi' AND t.comparison_form IN (${placeholders}) ${facets.clause}`,
        [...uniqueForms, ...facets.params])
    ]);
    const counts = new Map((componentResult.values ?? []).map(row => [String(row.form), numberValue(row.frequency)]));
    const total = first(totalResult.values);
    return { forms: uniqueForms.map(form => ({ form, frequency: counts.get(form) ?? 0 })),
      totalFrequency: numberValue(total.totalFrequency), distinctLines: numberValue(total.distinctLines),
      distinctUnits: numberValue(total.distinctUnits) };
  }

  async raagSummaries(sourceWorkId = 'source:G'): Promise<RaagSummary[]> {
    const db = await this.db();
    const result = await db.query(`SELECT COALESCE(raag_id, raag) AS id, raag AS name,
        COUNT(DISTINCT text_unit_id) AS unitCount, COUNT(id) AS lineCount
      FROM canonical_line WHERE (? = 'all' OR source_work_id = ?) AND raag IS NOT NULL AND raag <> '' AND raag <> 'No Raag'
      GROUP BY raag_id, raag ORDER BY MIN(ang), raag`, [sourceWorkId, sourceWorkId]);
    return (result.values ?? []).map(row => ({ id: String(row.id), name: String(row.name),
      unitCount: numberValue(row.unitCount), lineCount: numberValue(row.lineCount) }));
  }

  async raagContributorSummaries(raag: string, sourceWorkId = 'source:G'): Promise<RaagContributorSummary[]> {
    const db = await this.db();
    const result = await db.query(`SELECT c.id, c.preferred_name AS name,
        COUNT(DISTINCT l.text_unit_id) AS unitCount
      FROM canonical_line l JOIN contributor c ON c.id = l.contributor_id
      WHERE l.source_work_id = ? AND l.raag = ? GROUP BY c.id
      ORDER BY c.preferred_name COLLATE NOCASE`, [sourceWorkId, raag]);
    return (result.values ?? []).map(row => ({ id: String(row.id), name: String(row.name), unitCount: numberValue(row.unitCount) }));
  }

  async raagUnits(raag: string, sourceWorkId = 'source:G', limit = 50, offset = 0, contributorId?: string): Promise<TextUnitSummary[]> {
    const db = await this.db();
    const result = await db.query(`SELECT u.id, u.source_work_id AS sourceWorkId,
        COALESCE(u.title, 'Shabad') AS title, COALESCE(MIN(l.contributor_id), '') AS contributorId,
        COALESCE(MIN(c.preferred_name), 'Unknown contributor') AS contributorName,
        MIN(l.ang) AS firstAng, MAX(l.ang) AS lastAng, COUNT(l.id) AS lineCount,
        COALESCE(MIN(l.raag), 'Unclassified') AS raag,
        COALESCE((SELECT x.gurmukhi FROM canonical_line x WHERE x.text_unit_id = u.id ORDER BY x.ang, x.line_order LIMIT 1), '') AS preview,
        COALESCE((SELECT x.transliteration FROM canonical_line x WHERE x.text_unit_id = u.id ORDER BY x.ang, x.line_order LIMIT 1), '') AS transliteration
      FROM text_unit u JOIN canonical_line l ON l.text_unit_id = u.id
      LEFT JOIN contributor c ON c.id = l.contributor_id
      WHERE u.source_work_id = ? AND l.raag = ? ${contributorId ? 'AND l.contributor_id = ?' : ''}
      GROUP BY u.id ORDER BY firstAng, u.unit_order LIMIT ? OFFSET ?`,
      contributorId ? [sourceWorkId, raag, contributorId, limit, offset] : [sourceWorkId, raag, limit, offset]);
    return (result.values ?? []).map(textUnitSummary);
  }

  async namedBanis(sourceWorkId = 'source:G'): Promise<BaniSummary[]> {
    const db = await this.db();
    const result = await db.query(`SELECT id, token, source_work_id AS sourceWorkId, gurmukhi,
      COALESCE(transliteration, '') AS transliteration, verse_count AS verseCount,
      attribution_label AS attributionLabel,
      COALESCE((SELECT COUNT(DISTINCT x.line_order) FROM bani_line_crosswalk x
        JOIN tggsp_line_member m ON m.canonical_line_id=x.canonical_line_id AND m.is_anchor=1
        JOIN tggsp_line_alignment a ON a.id=m.alignment_id
        WHERE x.bani_id=bani_collection.id AND a.literal_translation_en<>''),0) AS tggspTranslatedLines
      FROM bani_collection
      WHERE (? = 'all' OR source_work_id = ?) ORDER BY upstream_id`, [sourceWorkId, sourceWorkId]);
    return (result.values ?? []).map(row => ({ id: String(row.id), token: String(row.token),
      sourceWorkId: String(row.sourceWorkId), gurmukhi: String(row.gurmukhi),
      transliteration: String(row.transliteration), verseCount: numberValue(row.verseCount),
      attributionLabel: String(row.attributionLabel), tggspTranslatedLines: numberValue(row.tggspTranslatedLines),
      tggspAvailable: numberValue(row.tggspTranslatedLines) > 0 }));
  }

  async getBani(baniId: string): Promise<BaniView> {
    if (baniId.startsWith('tggsp:collection:')) return this.getTggspCollection(baniId.slice('tggsp:collection:'.length));
    const db = await this.db();
    const [summaryResult, linesResult] = await Promise.all([
      db.query(`SELECT id, token, source_work_id AS sourceWorkId, gurmukhi,
        COALESCE(transliteration, '') AS transliteration, verse_count AS verseCount,
        attribution_label AS attributionLabel FROM bani_collection WHERE id = ?`, [baniId]),
      db.query(`SELECT COALESCE(c.id,'bani-line:'||b.bani_id||':'||b.line_order) AS id,
        COALESCE(c.source_work_id,(SELECT source_work_id FROM bani_collection WHERE id=b.bani_id)) AS sourceWorkId, COALESCE(c.text_unit_id,'') AS textUnitId,
        b.line_order AS 'order', COALESCE(c.ang,0) AS ang, b.header_level AS headerLevel,
        b.paragraph_number AS paragraphNumber, b.gurmukhi, COALESCE(b.transliteration,'') AS transliteration,
        COALESCE(NULLIF(b.translation_bdb_en,''),(SELECT content FROM line_translation t WHERE t.canonical_line_id=c.id AND t.provider='banidb' AND t.language='en'),'') AS bdbTranslation,
        COALESCE(c.contributor_id,'') AS contributorId, COALESCE(k.preferred_name,'') AS contributorName
        FROM bani_collection_line b LEFT JOIN bani_line_crosswalk x ON x.bani_id=b.bani_id AND x.line_order=b.line_order
        LEFT JOIN canonical_line c ON c.id=x.canonical_line_id LEFT JOIN contributor k ON k.id=c.contributor_id
        WHERE b.bani_id=? ORDER BY b.line_order`, [baniId])
    ]);
    const row = first(summaryResult.values);
    if (!row.id) throw new Error(`Named Bani not found: ${baniId}`);
    const lines = await this.enrichTggsp((linesResult.values ?? []) as unknown as CanonicalLine[]);
    const translated = lines.filter(line => line.tggspTranslation).length;
    return { id: String(row.id), token: String(row.token), sourceWorkId: String(row.sourceWorkId),
      gurmukhi: String(row.gurmukhi), transliteration: String(row.transliteration),
      verseCount: numberValue(row.verseCount), attributionLabel: String(row.attributionLabel),
      tggspAvailable: translated > 0, tggspTranslatedLines: translated, collectionType: 'bani',
      lines: lines.map((line, index) => ({ ...line, order: numberValue(line.order),
        headerLevel: numberValue((linesResult.values ?? [])[index]?.headerLevel),
        paragraphNumber: (linesResult.values ?? [])[index]?.paragraphNumber == null ? null : numberValue((linesResult.values ?? [])[index]?.paragraphNumber) })) };
  }

  async tggspCollections(): Promise<TggspCollectionSummary[]> {
    const db = await this.db();
    const result = await db.query(`SELECT c.code,c.title_en AS titleEn,c.title_pa AS titlePa,
      c.collection_type AS collectionType,c.collection_order AS collectionOrder,
      COUNT(DISTINCT s.section_id) AS sectionCount,
      COUNT(DISTINCT CASE WHEN a.literal_translation_en<>'' THEN a.anchor_line_id END) AS translatedLineCount
      FROM tggsp_collection c LEFT JOIN tggsp_collection_section s ON s.collection_code=c.code
      LEFT JOIN tggsp_line_alignment a ON a.collection_code=c.code
      GROUP BY c.code ORDER BY c.collection_order,c.title_en`);
    return (result.values ?? []).map(row => ({ code:String(row.code),titleEn:preferredReadingTitle(String(row.titleEn)),titlePa:String(row.titlePa),
      collectionType:String(row.collectionType) as TggspCollectionSummary['collectionType'],collectionOrder:numberValue(row.collectionOrder),
      sectionCount:numberValue(row.sectionCount),translatedLineCount:numberValue(row.translatedLineCount) }));
  }

  async getTggspCollection(code: string): Promise<BaniView> {
    const db = await this.db();
    const [collectionResult, sectionResult, lineResult] = await Promise.all([
      db.query(`SELECT code,title_en AS titleEn,title_pa AS titlePa,collection_type AS collectionType,
        introduction_en AS introduction,attribution_label AS attributionLabel FROM tggsp_collection WHERE code=?`,[code]),
      db.query(`SELECT section_order AS 'order',title_en AS title,author_en AS author FROM tggsp_collection_section
        WHERE collection_code=? ORDER BY section_order`,[code]),
      db.query(`SELECT a.id AS alignmentId,c.id,c.source_work_id AS sourceWorkId,c.text_unit_id AS textUnitId,c.ang,
        c.gurmukhi,COALESCE(c.transliteration,'') AS transliteration,COALESCE(c.contributor_id,'') AS contributorId,
        COALESCE(k.preferred_name,'') AS contributorName,a.section_order AS sectionOrder,
        a.subsection_order AS subsectionOrder,a.provider_line_order AS providerLineOrder,m.member_order AS memberOrder
        FROM tggsp_line_alignment a JOIN tggsp_line_member m ON m.alignment_id=a.id
        JOIN canonical_line c ON c.id=m.canonical_line_id LEFT JOIN contributor k ON k.id=c.contributor_id
        WHERE a.collection_code=? ORDER BY a.section_order,a.subsection_order,a.provider_line_order,m.member_order`,[code])
    ]);
    const collection = first(collectionResult.values);
    if (!collection.code) throw new Error(`TGGSP reading not found: ${code}`);
    // Do not deduplicate canonical IDs globally: ceremony compilations may
    // intentionally repeat a line in a later supplied section.
    const ordered = (lineResult.values ?? []) as DatabaseRow[];
    const enriched = await this.enrichTggsp(ordered.map((raw,index)=>({ id:String(raw.id),sourceWorkId:String(raw.sourceWorkId),
      textUnitId:String(raw.textUnitId),order:index,ang:numberValue(raw.ang),gurmukhi:String(raw.gurmukhi),
      transliteration:String(raw.transliteration),contributorId:String(raw.contributorId),contributorName:String(raw.contributorName) })),code);
    const firstOrderBySection = new Map<number,number>();
    ordered.forEach((raw,index)=>{const order=numberValue(raw.sectionOrder);if(!firstOrderBySection.has(order))firstOrderBySection.set(order,index);});
    return { id:`tggsp:collection:${code}`,token:code,sourceWorkId:'source:G',gurmukhi:String(collection.titlePa),
      transliteration:preferredReadingTitle(String(collection.titleEn)),verseCount:enriched.length,attributionLabel:String(collection.attributionLabel),
      tggspAvailable:enriched.some(line=>line.tggspTranslation),tggspTranslatedLines:enriched.filter(line=>line.tggspTranslation).length,
      introduction:String(collection.introduction),collectionType:String(collection.collectionType) as BaniView['collectionType'],
      sections:(sectionResult.values??[]).flatMap(row=>{const firstLineOrder=firstOrderBySection.get(numberValue(row.order));return firstLineOrder===undefined?[]:[{order:numberValue(row.order),title:String(row.title),author:String(row.author),firstLineOrder}];}),
      lines:enriched.map((line,index)=>({ ...line,order:index,headerLevel:firstOrderBySection.has(numberValue(ordered[index]?.sectionOrder))&&firstOrderBySection.get(numberValue(ordered[index]?.sectionOrder))===index?2:0,paragraphNumber:numberValue(ordered[index]?.sectionOrder) })) };
  }

  private async enrichTggsp(lines: CanonicalLine[], preferredCode = ''): Promise<CanonicalLine[]> {
    const canonicalIds = [...new Set(lines.map(line=>line.id).filter(id=>id&&!id.startsWith('bani-line:')))];
    if (!canonicalIds.length) return lines;
    const db = await this.db(); const translationRows:DatabaseRow[]=[];const termRows:DatabaseRow[]=[];const bdbRows:DatabaseRow[]=[];
    // Android SQLite commonly limits a statement to 999 bound variables.
    // Large named Banis (for example Sukhmani Sahib) must therefore be enriched
    // in bounded batches instead of failing after the reader has opened.
    for(let start=0;start<canonicalIds.length;start+=400){const batch=canonicalIds.slice(start,start+400);const placeholders=batch.map(()=>'?').join(',');
      const [translationResult,termResult,bdbResult] = await Promise.all([
        db.query(`SELECT m.canonical_line_id AS lineId,a.id AS passageId,a.anchor_line_id AS anchorId,
          (SELECT COUNT(*) FROM tggsp_line_member mx WHERE mx.alignment_id=a.id) AS memberCount,
          a.collection_code AS collectionCode,a.tggsp_transliteration AS tggspTransliteration,a.literal_translation_en AS translation,
          a.literal_translation_pa AS translationPa,a.translation_scope AS translationScope,
          c.collection_type AS collectionType,c.collection_order AS collectionOrder
          FROM tggsp_line_member m JOIN tggsp_line_alignment a ON a.id=m.alignment_id
          JOIN tggsp_collection c ON c.code=a.collection_code
          WHERE a.translation_scope<>'passage' AND (a.tggsp_transliteration<>'' OR a.literal_translation_en<>'' OR a.literal_translation_pa<>'') AND m.canonical_line_id IN (${placeholders})
          UNION ALL
          SELECT visible.canonical_line_id AS lineId,passage.id AS passageId,passage.anchor_line_id AS anchorId,
          (SELECT COUNT(DISTINCT grouped_member.canonical_line_id) FROM tggsp_line_alignment grouped
            JOIN tggsp_line_member grouped_member ON grouped_member.alignment_id=grouped.id
            WHERE grouped.collection_code=passage.collection_code AND grouped.section_id=passage.section_id AND grouped.subsection_id=passage.subsection_id) AS memberCount,
          passage.collection_code AS collectionCode,current.tggsp_transliteration AS tggspTransliteration,
          passage.literal_translation_en AS translation,passage.literal_translation_pa AS translationPa,
          passage.translation_scope AS translationScope,c.collection_type AS collectionType,c.collection_order AS collectionOrder
          FROM tggsp_line_member visible JOIN tggsp_line_alignment current ON current.id=visible.alignment_id
          JOIN tggsp_line_alignment passage ON passage.collection_code=current.collection_code
            AND passage.section_id=current.section_id AND passage.subsection_id=current.subsection_id AND passage.translation_scope='passage'
          JOIN tggsp_collection c ON c.code=passage.collection_code
          WHERE visible.canonical_line_id IN (${placeholders})`,[...batch,...batch]),
        db.query(`SELECT id,collection_code AS collectionCode,canonical_line_id AS lineId,headword,transliteration,
          meaning_en AS meaningEn,grammar_en AS grammarEn,etymology_en AS etymologyEn,
          meaning_pa AS meaningPa,grammar_pa AS grammarPa,etymology_pa AS etymologyPa
          FROM tggsp_line_term WHERE canonical_line_id IN (${placeholders}) ORDER BY lineId,headword`,batch),
        db.query(`SELECT canonical_line_id AS lineId,content FROM line_translation WHERE provider='banidb' AND language='en' AND canonical_line_id IN (${placeholders})`,batch)
      ]);translationRows.push(...(translationResult.values??[]));termRows.push(...(termResult.values??[]));bdbRows.push(...(bdbResult.values??[]));}
    translationRows.sort((left,right)=>{
      const preferred=(row:DatabaseRow)=>String(row.collectionCode)===preferredCode?0:String(row.collectionType)==='composition'?1:2;
      return String(left.lineId).localeCompare(String(right.lineId))||preferred(left)-preferred(right)||numberValue(left.collectionOrder)-numberValue(right.collectionOrder);
    });
    const translations=new Map<string,DatabaseRow>();
    for(const row of translationRows)if(!translations.has(String(row.lineId)))translations.set(String(row.lineId),row);
    const terms=new Map<string,TggspLineTerm[]>();
    for(const row of termRows){const lineId=String(row.lineId);const selected=translations.get(lineId);if(selected&&String(row.collectionCode)!==String(selected.collectionCode))continue;const list=terms.get(lineId)??[];const term={id:String(row.id),headword:String(row.headword),transliteration:String(row.transliteration),meaningEn:String(row.meaningEn),grammarEn:String(row.grammarEn),etymologyEn:String(row.etymologyEn),meaningPa:String(row.meaningPa),grammarPa:String(row.grammarPa),etymologyPa:String(row.etymologyPa)};if(!list.some(item=>item.headword===term.headword&&item.meaningEn===term.meaningEn))list.push(term);terms.set(lineId,list);}
    const bdbTranslations=new Map(bdbRows.map(row=>[String(row.lineId),String(row.content)]));
    return lines.map(line=>{const translation=translations.get(line.id);return {...line,
      bdbTranslation:line.bdbTranslation||bdbTranslations.get(line.id),
      tggspTranslation:translation?String(translation.translation):undefined,
      tggspTransliteration:translation?String(translation.tggspTransliteration):undefined,
      tggspTranslationPa:translation?String(translation.translationPa):undefined,
      tggspTranslationScope:translation?String(translation.translationScope) as CanonicalLine['tggspTranslationScope']:undefined,
      tggspCollectionCode:translation?String(translation.collectionCode):undefined,
      tggspPassageId:translation?String(translation.passageId):undefined,
      tggspPassageAnchorId:translation?String(translation.anchorId):undefined,
      tggspPassageMemberCount:translation?numberValue(translation.memberCount):undefined,
      tggspTerms:terms.get(line.id)??[]};});
  }

  async sources(): Promise<SourceWorkOption[]> {
    const db = await this.db();
    const result = await db.query(`SELECT s.id, s.title, COALESCE(MAX(l.ang), 1) AS maxAng FROM source_work s LEFT JOIN canonical_line l ON l.source_work_id = s.id GROUP BY s.id ORDER BY CASE s.id WHEN 'source:G' THEN 0 ELSE 1 END, s.title`);
    return (result.values ?? []).map(row => ({ id: String(row.id),
      title: String(row.id) === 'source:B' ? 'Vaaran Bhai Gurdas Ji' : String(row.id) === 'source:D' ? 'Dasam Bani · selected SGPC readings' : String(row.title), maxAng: numberValue(row.maxAng) }));
  }

  async corpusInfo(): Promise<CorpusInfo> {
    const db = await this.db();
    const metadata = await db.query(`SELECT key, value FROM metadata`);
    const values = new Map((metadata.values ?? []).map(row => [String(row.key), String(row.value)]));
    const counts = await db.query(`SELECT (SELECT COUNT(*) FROM canonical_line) AS lineCount, (SELECT COUNT(*) FROM token_occurrence) AS occurrenceCount`);
    const row = first(counts.values);
    return { buildKind: values.get('build_kind') ?? 'unknown', corpusReleaseId: values.get('corpus_release_id') ?? '', providerReleaseId: values.get('provider_release_id') ?? '', lineCount: numberValue(row.lineCount), occurrenceCount: numberValue(row.occurrenceCount) };
  }

  async rankedForms(limit = 30, sourceWorkId = 'source:G'): Promise<RankedForm[]> {
    const db = await this.db();
    const result = await db.query(`SELECT exact_form AS form, COUNT(*) AS frequency, COUNT(DISTINCT line_id) AS distinctLines FROM token_occurrence WHERE source_work_id = ? AND token_class = 'lexical_gurmukhi' GROUP BY exact_form ORDER BY frequency DESC, exact_form LIMIT ?`, [sourceWorkId, limit]);
    return (result.values ?? []).map(row => ({ form: String(row.form), frequency: numberValue(row.frequency), distinctLines: numberValue(row.distinctLines) }));
  }

  async rankedFormsPage(sourceWorkId = 'source:G', letter = '', limit = 100, offset = 0): Promise<FrequencyPage> {
    const db = await this.db();
    const clause = letter ? 'AND exact_form LIKE ?' : '';
    const base = [sourceWorkId, sourceWorkId, ...(letter ? [`${letter}%`] : [])];
    const [count, rows] = await Promise.all([
      db.query(`SELECT COUNT(*) AS total FROM (SELECT exact_form FROM token_occurrence
        WHERE (? = 'all' OR source_work_id = ?) AND token_class = 'lexical_gurmukhi' ${clause} GROUP BY exact_form)`, base),
      db.query(`SELECT exact_form AS form, COUNT(*) AS frequency, COUNT(DISTINCT line_id) AS distinctLines
        FROM token_occurrence WHERE (? = 'all' OR source_work_id = ?) AND token_class = 'lexical_gurmukhi' ${clause}
        GROUP BY exact_form ORDER BY frequency DESC, exact_form LIMIT ? OFFSET ?`, [...base, limit, offset])
    ]);
    return { total: numberValue(first(count.values).total), offset, limit,
      forms: (rows.values ?? []).map(row => ({ form: String(row.form), frequency: numberValue(row.frequency), distinctLines: numberValue(row.distinctLines) })) };
  }

  async linesByIds(ids: string[]): Promise<CanonicalLine[]> {
    if (!ids.length) return [];
    const db = await this.db(); const placeholders = ids.map(() => '?').join(',');
    const result = await db.query(`SELECT l.id, l.source_work_id AS sourceWorkId, l.text_unit_id AS textUnitId,
      l.line_order AS 'order', l.ang, l.gurmukhi, COALESCE(l.transliteration, '') AS transliteration,
      COALESCE(l.contributor_id, '') AS contributorId, COALESCE(c.preferred_name, '') AS contributorName
      FROM canonical_line l LEFT JOIN contributor c ON c.id = l.contributor_id WHERE l.id IN (${placeholders})`, ids);
    const byId = new Map((result.values ?? []).map(row => [String(row.id), row as unknown as CanonicalLine]));
    return ids.flatMap(id => byId.get(id) ? [byId.get(id)!] : []);
  }

  async textUnitsByIds(ids: string[]): Promise<TextUnitSummary[]> {
    if (!ids.length) return [];
    const db = await this.db(); const placeholders = ids.map(() => '?').join(',');
    const result = await db.query(`SELECT u.id, u.source_work_id AS sourceWorkId, COALESCE(u.title, 'Shabad') AS title,
      COALESCE(MIN(l.contributor_id), '') AS contributorId, COALESCE(MIN(c.preferred_name), '') AS contributorName,
      MIN(l.ang) AS firstAng, MAX(l.ang) AS lastAng, COUNT(l.id) AS lineCount, COALESCE(MIN(l.raag), 'Unclassified') AS raag,
      COALESCE((SELECT x.gurmukhi FROM canonical_line x WHERE x.text_unit_id=u.id ORDER BY x.ang,x.line_order LIMIT 1),'') AS preview,
      COALESCE((SELECT x.transliteration FROM canonical_line x WHERE x.text_unit_id=u.id ORDER BY x.ang,x.line_order LIMIT 1),'') AS transliteration
      FROM text_unit u JOIN canonical_line l ON l.text_unit_id=u.id LEFT JOIN contributor c ON c.id=l.contributor_id
      WHERE u.id IN (${placeholders}) GROUP BY u.id`, ids);
    const byId = new Map((result.values ?? []).map(row => [String(row.id), textUnitSummary(row)]));
    return ids.flatMap(id => byId.get(id) ? [byId.get(id)!] : []);
  }

  async contributorSummaries(limit = 1000, sourceWorkId = 'source:G'): Promise<ContributorSummary[]> {
    const db = await this.db();
    const result = await db.query(`SELECT c.id, c.preferred_name AS name, c.contributor_type AS type, COUNT(DISTINCT l.text_unit_id) AS unitCount, COUNT(l.id) AS lineCount FROM contributor c JOIN canonical_line l ON l.contributor_id = c.id WHERE (? = 'all' OR l.source_work_id = ?) GROUP BY c.id ORDER BY c.preferred_name COLLATE NOCASE LIMIT ?`, [sourceWorkId, sourceWorkId, limit]);
    const rows = (result.values ?? []).map(row => ({ id: String(row.id), name: String(row.name), type: String(row.type), unitCount: numberValue(row.unitCount), lineCount: numberValue(row.lineCount) }));
    const gurdasRows = rows.filter(row => BHAI_GURDAS_CONTRIBUTORS.includes(row.id));
    if (!gurdasRows.length) return rows;
    return [...rows.filter(row => !BHAI_GURDAS_CONTRIBUTORS.includes(row.id)), {
      id: COMBINED_BHAI_GURDAS_ID, name: 'Bhai Gurdas Ji', type: 'author',
      unitCount: gurdasRows.reduce((sum, row) => sum + row.unitCount, 0),
      lineCount: gurdasRows.reduce((sum, row) => sum + row.lineCount, 0)
    }].sort((a, b) => a.name.localeCompare(b.name)).slice(0, limit);
  }

  async glossary(query: string, limit = 20): Promise<GlossaryResult[]> {
    const db = await this.db();
    const normal = query.trim().normalize('NFC');
    if (!normal) return [];
    const gurmukhi = /[\u0A00-\u0A7F]/u.test(normal);
    const pattern = `%${normal.toLowerCase()}%`;
    const termResult = await db.query(`SELECT MIN(id) AS id,headword,MIN(transliteration) AS transliteration,
        MIN(meaning_en) AS meaningEn,MIN(grammar_en) AS grammarEn,MIN(etymology_en) AS etymologyEn,
        MIN(meaning_pa) AS meaningPa,MIN(grammar_pa) AS grammarPa,MIN(etymology_pa) AS etymologyPa,
        COUNT(DISTINCT canonical_line_id) AS frequency,
        CASE WHEN ?=1 THEN 'gurmukhi' WHEN lower(MIN(transliteration)) LIKE ? THEN 'roman' ELSE 'english-concept' END AS matchKind
      FROM tggsp_line_term
      WHERE (?=1 AND headword LIKE ?) OR (?=0 AND (lower(transliteration) LIKE ? OR lower(meaning_en) LIKE ? OR lower(etymology_en) LIKE ?))
      GROUP BY headword,meaning_en,grammar_en,etymology_en
      ORDER BY CASE WHEN headword=? OR lower(MIN(transliteration))=lower(?) THEN 0 WHEN lower(MIN(transliteration)) LIKE lower(?) THEN 1 ELSE 2 END,
        frequency DESC,headword LIMIT ?`,
      [gurmukhi ? 1 : 0, pattern, gurmukhi ? 1 : 0, `${normal}%`, gurmukhi ? 1 : 0, pattern, pattern, pattern,
        normal, normal, `${normal}%`, limit]);
    const rows: GlossaryResult[] = (termResult.values ?? []).map(row => ({
      id: String(row.id), headword: String(row.headword), transliteration: String(row.transliteration ?? ''),
      meaningEn: String(row.meaningEn ?? ''), grammarEn: String(row.grammarEn ?? ''), etymologyEn: String(row.etymologyEn ?? ''),
      meaningPa: String(row.meaningPa ?? ''), grammarPa: String(row.grammarPa ?? ''), etymologyPa: String(row.etymologyPa ?? ''),
      frequency: numberValue(row.frequency), matchKind: String(row.matchKind) as GlossaryResult['matchKind'], content: '',
      provider: 'Sikh Research Institute — The Guru Granth Sahib Project', reviewStatus: 'provider_published'
    }));
    if (rows.length || gurmukhi) return rows;
    const fallback = await db.query(`SELECT id,headword,content,provider,review_status AS reviewStatus,
        CASE WHEN lower(headword) LIKE ? THEN 'roman' ELSE 'english-concept' END AS matchKind
      FROM glossary_entry WHERE lower(headword) LIKE ? OR lower(content) LIKE ? LIMIT ?`,
      [`${normal.toLowerCase()}%`, pattern, pattern, limit]);
    return (fallback.values ?? []).map(row => ({ id:String(row.id),headword:String(row.headword),content:String(row.content),provider:String(row.provider),reviewStatus:String(row.reviewStatus),matchKind:String(row.matchKind) as GlossaryResult['matchKind'] }));
  }

  private async tggspAvailableSearch(filters: SearchFilters, limit: number): Promise<CorpusSearchResponse> {
    const db = await this.db();
    const facets = searchFacetSql(filters, 'l');
    const result = await db.query(`SELECT u.id AS textUnitId, u.source_work_id AS sourceWorkId,
        COALESCE(u.title, 'Analysed Shabad') AS title, MIN(l.id) AS lineId, MIN(l.ang) AS ang,
        COALESCE(MIN(c.preferred_name), '') AS contributorName,
        COALESCE((SELECT x.gurmukhi FROM canonical_line x WHERE x.text_unit_id = u.id ORDER BY x.ang, x.line_order LIMIT 1), '') AS gurmukhi,
        COALESCE((SELECT x.transliteration FROM canonical_line x WHERE x.text_unit_id = u.id ORDER BY x.ang, x.line_order LIMIT 1), '') AS transliteration,
        group_concat(DISTINCT p.content_type) AS providerTypes
      FROM text_unit u JOIN canonical_line l ON l.text_unit_id = u.id
      LEFT JOIN contributor c ON c.id = l.contributor_id JOIN provider_content p ON p.text_unit_id = u.id
      WHERE 1 = 1 ${facets.clause} GROUP BY u.id
      ORDER BY MIN(l.ang), u.id LIMIT ?`, [...facets.params, limit]);
    const results: CorpusSearchResult[] = (result.values ?? []).map(row => ({
      id: `search:tggsp-available:${String(row.textUnitId)}`, resultType: 'translation',
      textUnitId: String(row.textUnitId), sourceWorkId: String(row.sourceWorkId), title: String(row.title),
      subtitle: `${String(row.contributorName)} · Ang ${numberValue(row.ang)} · TGGSP analysis available`,
      gurmukhi: String(row.gurmukhi), transliteration: String(row.transliteration), english: '',
      ang: numberValue(row.ang), contributorName: String(row.contributorName), lineId: String(row.lineId),
      matchKind: 'analysis', providerContentTypes: splitProviderTypes(row.providerTypes).length ? splitProviderTypes(row.providerTypes) : ['tggsp-linked']
    }));
    return { query: '', mode: 'english', results, candidateForms: [] };
  }

  private async themeSearch(query: string, filters: SearchFilters, limit: number): Promise<CorpusSearchResponse> {
    const db = await this.db();
    const key = latinFold(query);
    const curated: Record<string, string[]> = {
      compassion: ['compassion', 'compassionate', 'mercy'],
      contentment: ['contentment', 'contented', 'satisfaction'],
      calmness: ['calm', 'stillness', 'peace'],
      humility: ['humility', 'humble'],
      courage: ['courage', 'fearless']
    };
    const terms = curated[key] ?? [key];
    const clauses = terms.map(() => `lower(p.content) LIKE ?`).join(' OR ');
    const facets = searchFacetSql(filters, 'l', false);
    const providerTypeFilter = filters.providerContentTypes.length
      ? `AND p.content_type IN (${filters.providerContentTypes.map(() => '?').join(',')})` : '';
    const result = await db.query(`SELECT p.id, p.text_unit_id AS textUnitId, p.content_type AS contentType,
        p.content, u.source_work_id AS sourceWorkId, COALESCE(u.title, 'Analysed Shabad') AS title,
        COALESCE(MIN(l.ang), 1) AS ang, COALESCE(MIN(c.preferred_name), '') AS contributorName,
        COALESCE((SELECT x.gurmukhi FROM canonical_line x WHERE x.text_unit_id = p.text_unit_id
          ORDER BY x.ang, x.line_order LIMIT 1), '') AS gurmukhi
      FROM provider_content p JOIN text_unit u ON u.id = p.text_unit_id
      LEFT JOIN canonical_line l ON l.text_unit_id = u.id LEFT JOIN contributor c ON c.id = l.contributor_id
      WHERE p.content_type IN
        ('literal_translation_en','interpretive_transcreation_en','commentary_en','poetical_dimension_en')
        AND (${clauses}) ${providerTypeFilter} ${facets.clause} GROUP BY p.id ORDER BY ang LIMIT ?`,
      [...terms.map(term => `%${term}%`), ...filters.providerContentTypes, ...facets.params, limit]);
    const results: CorpusSearchResult[] = (result.values ?? []).map(row => ({
      id: `search:theme:${String(row.id)}`, resultType: 'theme', textUnitId: String(row.textUnitId),
      sourceWorkId: String(row.sourceWorkId), title: String(row.title),
      subtitle: `Experimental theme · TGGSP ${String(row.contentType).replaceAll('_', ' ')} · Ang ${numberValue(row.ang)}`,
      gurmukhi: String(row.gurmukhi), transliteration: '', english: plainText(String(row.content)),
      ang: numberValue(row.ang), contributorName: String(row.contributorName), lineId: null,
      matchKind: 'theme', providerContentTypes: [String(row.contentType)]
    }));
    return { query, mode: 'theme', results, candidateForms: [] };
  }

  async close(): Promise<void> {
    if (!this.connection) return;
    const db = await this.connection;
    await db.close();
    await this.sqlite.closeConnection(MOBILE_DATABASE_NAME, false);
    this.connection = null;
  }

  private db(): Promise<SQLiteDBConnection> {
    if (!this.connection) this.connection = this.open();
    return this.connection;
  }

  private async open(): Promise<SQLiteDBConnection> {
    const installed = await this.sqlite.isDatabase(MOBILE_DATABASE_NAME);
    if (!installed.result) {
      await this.sqlite.copyFromAssets(false);
    }
    const consistency = await this.sqlite.checkConnectionsConsistency();
    const existing = await this.sqlite.isConnection(MOBILE_DATABASE_NAME, false);
    const db = consistency.result && existing.result
      ? await this.sqlite.retrieveConnection(MOBILE_DATABASE_NAME, false)
      : await this.sqlite.createConnection(MOBILE_DATABASE_NAME, false, 'no-encryption', MOBILE_SCHEMA_VERSION, false);
    await db.open();
    await this.ensureSchemaV2(db);
    await db.execute(MOBILE_SCHEMA_SQL, true);
    await db.run(`INSERT OR REPLACE INTO metadata(key, value) VALUES (?, ?)`, ['schema_version', String(MOBILE_SCHEMA_VERSION)]);
    await this.seedTechnicalFixture(db);
    return db;
  }

  private async ensureSchemaV2(db: SQLiteDBConnection): Promise<void> {
    const columns = await db.query(`PRAGMA table_info(canonical_line)`);
    const names = new Set((columns.values ?? []).map(row => String(row.name)));
    if (!names.has('raag_id')) await db.execute(`ALTER TABLE canonical_line ADD COLUMN raag_id TEXT`, true);
    if (!names.has('raag')) await db.execute(`ALTER TABLE canonical_line ADD COLUMN raag TEXT`, true);
  }

  private async seedTechnicalFixture(db: SQLiteDBConnection): Promise<void> {
    const existing = await db.query(`SELECT COUNT(*) AS count FROM canonical_line`);
    if (numberValue(first(existing.values).count) > 0) return;
    await db.run(`INSERT OR IGNORE INTO source_work(id, upstream_id, title, profile, corpus_release_id) VALUES (?, ?, ?, ?, ?)`,
      ['source:G', 'G', 'Guru Granth Sahib', 'verse_corpus', 'fixture-corpus-2026-07-12']);
    await db.run(`INSERT OR IGNORE INTO contributor(id, preferred_name, contributor_type) VALUES (?, ?, ?)`,
      ['contributor:guru-nanak-sahib', 'Guru Nanak Sahib', 'guru']);
    await db.run(`INSERT OR IGNORE INTO text_unit(id, upstream_id, source_work_id, parent_id, unit_type, unit_order, title, review_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['unit:jap', 'fixture-jap', 'source:G', null, 'bani', 1, 'Jap', 'fixture']);
    await db.run(`INSERT OR IGNORE INTO text_unit(id, upstream_id, source_work_id, parent_id, unit_type, unit_order, title, review_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['unit:jap:pauri-8', 'fixture-jap-p8', 'source:G', 'unit:jap', 'pauri', 8, 'Pauri 8', 'fixture']);

    for (const line of lines) {
      await db.run(
        `INSERT OR IGNORE INTO canonical_line(id, upstream_id, source_work_id, text_unit_id, contributor_id,
          line_order, ang, line_class, gurmukhi, transliteration) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [line.id, line.id, line.sourceWorkId, line.textUnitId, line.contributorId, line.order, line.ang, 'canonical_verse', line.gurmukhi, line.transliteration]
      );
      const tokens = [...line.gurmukhi.matchAll(/[\p{L}\p{M}]+|[^\s]/gu)];
      for (const [position, match] of tokens.entries()) {
        const exact = match[0];
        const lexical = /^[\u0A00-\u0A7F]+$/u.test(exact) && /[\p{L}\p{M}]/u.test(exact);
        await db.run(
          `INSERT OR IGNORE INTO token_occurrence(id, line_id, text_unit_id, source_work_id, token_position,
            exact_form, comparison_form, token_class, start_utf16, end_utf16, analysis_release_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [`occurrence:${line.id}:${position}`, line.id, line.textUnitId, line.sourceWorkId, position, exact,
            exact.normalize('NFC'), lexical ? 'lexical_gurmukhi' : 'punctuation', match.index, match.index + exact.length,
            'analysis:fixture-mobile']
        );
      }
    }
    for (const candidates of Object.values(phoneticCandidates)) {
      for (const candidate of candidates) {
        await db.run(
          `INSERT OR IGNORE INTO term_form(id, glossary_entry_id, written_form, comparison_form, transliteration, relation_type)
           VALUES (?, NULL, ?, ?, ?, ?)`,
          [`term:${candidate.gurmukhi}`, candidate.gurmukhi, candidate.gurmukhi.normalize('NFC'), candidate.transliteration, candidate.note]
        );
      }
    }
    await db.run(`INSERT OR REPLACE INTO metadata(key, value) VALUES ('fixture_seeded', 'true')`);
    await db.run(`INSERT OR REPLACE INTO metadata(key, value) VALUES ('fixture_notice', 'Technical fixture only; not a corpus release')`);
  }
}

function first(values: DatabaseRow[] | undefined): DatabaseRow {
  return values?.[0] ?? {};
}

function numberValue(value: unknown): number {
  return typeof value === 'number' ? value : Number(value ?? 0);
}

function textUnitSummary(row: DatabaseRow): TextUnitSummary {
  return { id: String(row.id), sourceWorkId: String(row.sourceWorkId), title: String(row.title),
    contributorId: String(row.contributorId), contributorName: String(row.contributorName),
    firstAng: numberValue(row.firstAng), lastAng: numberValue(row.lastAng), lineCount: numberValue(row.lineCount),
    preview: String(row.preview), transliteration: String(row.transliteration), raag: String(row.raag ?? 'Unclassified') };
}

function latinFold(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toLowerCase()
    .replace(/\(([a-z])\)/gu, '$1').replace(/[^a-z\s]/gu, ' ')
    .replace(/([aeiou])\1+/gu, '$1').replace(/\s+/gu, ' ').trim();
}

function foldedWord(value: string): string {
  return phoneticRoman(value).replaceAll(' ', '');
}

function transliterationMatches(transliteration: string, query: string): boolean {
  const foldedQuery = latinFold(query);
  if (foldedQuery.includes(' ')) return latinFold(transliteration).includes(foldedQuery) || phoneticRoman(transliteration).includes(phoneticRoman(foldedQuery));
  const wanted = foldedWord(foldedQuery);
  return latinFold(transliteration).split(' ').some(token => foldedWord(token) === wanted);
}

function phoneticRoman(value: string): string {
  return latinFold(value).split(' ').map(word => word.replace(/aa/gu, 'a').replace(/ee|ii/gu, 'i')
    .replace(/oo|uu/gu, 'u').replace(/ai|ae/gu, 'e').replace(/au/gu, 'o').replace(/ng/gu, 'g')
    .replace(/(eai|ahi|ai|ee|[aeiou])$/u, '')).join(' ');
}

function ftsRomanQuery(normalized: string, phonetic: string): string {
  const clean = (value: string) => value.replaceAll('"', ' ').replace(/\s+/gu, ' ').trim();
  return `roman:"${clean(normalized)}"* OR roman_phonetic:"${clean(phonetic)}"*`;
}

function alignedCandidates(gurmukhi: string, transliteration: string, query: string): SearchCandidate[] {
  const gurmukhiTokens = Array.from(gurmukhi.matchAll(/[\p{L}\p{M}]+/gu), match => match[0]);
  const latinTokens = latinFold(transliteration).split(' ').filter(Boolean);
  if (gurmukhiTokens.length !== latinTokens.length) return [];
  const wanted = foldedWord(query);
  return latinTokens.flatMap((token, index) => foldedWord(token) === wanted ? [{
    gurmukhi: gurmukhiTokens[index], transliteration: token, note: 'Phonetic candidate; exact forms counted separately'
  }] : []);
}

function plainText(content: string): string {
  return content.replace(/<[^>]*>/gu, ' ').replace(/&nbsp;/gu, ' ').replace(/\s+/gu, ' ').trim();
}

function defaultSearchFilters(): SearchFilters {
  return { sourceWorkId: 'all', raag: '', contributorId: '', tggspOnly: false, tggspCoverage: '', providerContentTypes: [] };
}

function searchFacetSql(filters: SearchFilters, lineAlias: string, includeTggsp = true): { clause: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filters.sourceWorkId !== 'all') { clauses.push(`${lineAlias}.source_work_id = ?`); params.push(filters.sourceWorkId); }
  if (filters.raag) { clauses.push(`${lineAlias}.raag = ?`); params.push(filters.raag); }
  if (filters.contributorId === COMBINED_BHAI_GURDAS_ID) {
    clauses.push(`${lineAlias}.contributor_id IN (${BHAI_GURDAS_CONTRIBUTORS.map(() => '?').join(',')})`);
    params.push(...BHAI_GURDAS_CONTRIBUTORS);
  } else if (filters.contributorId) { clauses.push(`${lineAlias}.contributor_id = ?`); params.push(filters.contributorId); }
  if (includeTggsp && (filters.tggspOnly || filters.tggspCoverage || filters.providerContentTypes.length)) {
    const types = filters.providerContentTypes;
    const coverage = filters.tggspCoverage || 'any';
    if (coverage === 'translation') clauses.push(`EXISTS (SELECT 1 FROM tggsp_line_member facet_tm JOIN tggsp_line_alignment facet_ta ON facet_ta.id=facet_tm.alignment_id WHERE facet_tm.canonical_line_id=${lineAlias}.id AND (facet_ta.literal_translation_en<>'' OR facet_ta.literal_translation_pa<>''))`);
    else if (coverage === 'word-analysis') clauses.push(`EXISTS (SELECT 1 FROM tggsp_line_term facet_tt WHERE facet_tt.canonical_line_id=${lineAlias}.id)`);
    else if (coverage === 'extended' || types.length) {
      clauses.push(`EXISTS (SELECT 1 FROM provider_content facet_pc WHERE facet_pc.text_unit_id = ${lineAlias}.text_unit_id${types.length ? ` AND facet_pc.content_type IN (${types.map(() => '?').join(',')})` : ''})`);
      params.push(...types);
    } else clauses.push(`(EXISTS (SELECT 1 FROM tggsp_line_member facet_tm WHERE facet_tm.canonical_line_id=${lineAlias}.id) OR EXISTS (SELECT 1 FROM tggsp_line_term facet_tt WHERE facet_tt.canonical_line_id=${lineAlias}.id) OR EXISTS (SELECT 1 FROM provider_content facet_pc WHERE facet_pc.text_unit_id=${lineAlias}.text_unit_id))`);
  }
  return { clause: clauses.length ? `AND ${clauses.join(' AND ')}` : '', params };
}

function splitProviderTypes(value: unknown): string[] {
  return String(value ?? '').split(',').filter(Boolean);
}

function providerGroupTitle(id: string): string {
  const parts = id.split(':');
  return `${parts[1] ?? 'TGGSP'} · subsection ${parts[2] ?? 'unknown'} · record ${parts[3] ?? 'unknown'}`;
}

function preferredReadingTitle(value:string):string {
  return /asa\s+(ki|di)\s+v(a|aa)r/i.test(value) ? 'Asa Di Vaar' : value;
}
