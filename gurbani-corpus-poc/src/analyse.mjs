export function exactFrequency(index, query, scope = {}) {
  const compare = query.normalize('NFC');
  const matches = index.occurrences.filter(occurrence => {
    if (occurrence.tokenClass !== 'lexical_gurmukhi') return false;
    if (occurrence.compare !== compare) return false;
    if (scope.sourceWorkId && occurrence.sourceWorkId !== scope.sourceWorkId) return false;
    if (scope.textUnitId && occurrence.textUnitId !== scope.textUnitId) return false;
    return true;
  });

  const eligibleTokens = index.occurrences.filter(occurrence => {
    if (occurrence.tokenClass !== 'lexical_gurmukhi') return false;
    if (scope.sourceWorkId && occurrence.sourceWorkId !== scope.sourceWorkId) return false;
    if (scope.textUnitId && occurrence.textUnitId !== scope.textUnitId) return false;
    return true;
  });

  const lineIds = new Set(matches.map(row => row.lineId));
  const unitIds = new Set(matches.map(row => row.textUnitId));
  return {
    query,
    mode: 'exact_written_form',
    rawFrequency: matches.length,
    distinctLines: lineIds.size,
    distinctNearestTextUnits: unitIds.size,
    eligibleLexicalTokens: eligibleTokens.length,
    perTenThousand: eligibleTokens.length ? matches.length / eligibleTokens.length * 10_000 : 0,
    occurrenceIds: matches.map(row => row.id),
    scope
  };
}

export function relatedFormFrequency(index, forms, scope = {}) {
  const results = forms.map(form => exactFrequency(index, form, scope));
  return {
    mode: 'curated_related_forms',
    includedForms: results,
    combinedRawFrequency: results.reduce((sum, result) => sum + result.rawFrequency, 0),
    notice: 'This combined value is not an exact-form frequency. Every included form remains visible.'
  };
}

export function rankExactForms(index, limit = null) {
  const counts = new Map();
  for (const occurrence of index.occurrences) {
    if (occurrence.tokenClass !== 'lexical_gurmukhi') continue;
    const current = counts.get(occurrence.compare) ?? { form: occurrence.compare, rawFrequency: 0,
      lineIds: new Set(), unitIds: new Set() };
    current.rawFrequency += 1;
    current.lineIds.add(occurrence.lineId);
    current.unitIds.add(occurrence.textUnitId);
    counts.set(occurrence.compare, current);
  }
  const ranked = [...counts.values()].map(row => ({ form: row.form, rawFrequency: row.rawFrequency,
    distinctLines: row.lineIds.size, distinctUnits: row.unitIds.size }))
    .sort((a, b) => b.rawFrequency - a.rawFrequency || a.form.localeCompare(b.form, 'pa'));
  return limit == null ? ranked : ranked.slice(0, limit);
}

export function contributorStructuralCounts(index) {
  const units = new Map(index.textUnits.map(row => [row.id, row]));
  const byContributor = new Map(index.contributors.map(row => [row.id, {
    contributorId: row.id, name: row.name, contributorType: row.type,
    shabads: new Set(), unitIds: new Set(), lineIds: new Set()
  }]));
  for (const attribution of index.attributions) {
    const summary = byContributor.get(attribution.contributorId);
    const unit = units.get(attribution.targetId);
    if (!summary || attribution.targetType !== 'textUnit' || !unit) continue;
    summary.unitIds.add(unit.id);
    if (unit.unitType === 'shabad') summary.shabads.add(unit.id);
  }
  for (const line of index.lines) {
    const summary = byContributor.get(line.contributorId);
    if (summary) summary.lineIds.add(line.id);
  }
  return [...byContributor.values()].map(row => ({
    contributorId: row.contributorId, name: row.name, contributorType: row.contributorType,
    shabadCount: row.shabads.size, attributedUnitCount: row.unitIds.size, lineCount: row.lineIds.size
  })).sort((a, b) => b.shabadCount - a.shabadCount || b.lineCount - a.lineCount || a.name.localeCompare(b.name));
}
