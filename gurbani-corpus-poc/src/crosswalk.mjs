import { compareForm } from './tokenise.mjs';

function whitespaceFold(value) {
  return compareForm(value).replace(/\s+/gu, ' ').trim();
}

export function buildCrosswalk(corpus, provider) {
  const exact = new Map();
  const folded = new Map();
  for (const line of corpus.lines) {
    const exactKey = compareForm(line.gurmukhi);
    const foldedKey = whitespaceFold(line.gurmukhi);
    if (!exact.has(exactKey)) exact.set(exactKey, []);
    if (!folded.has(foldedKey)) folded.set(foldedKey, []);
    exact.get(exactKey).push(line);
    folded.get(foldedKey).push(line);
  }

  return provider.records.map(record => {
    const exactCandidates = exact.get(compareForm(record.referenceGurmukhi)) ?? [];
    if (exactCandidates.length === 1) {
      return mapping(record, exactCandidates[0], 'proposed_exact_text', 'review_required');
    }
    if (exactCandidates.length > 1) {
      return mapping(record, null, 'ambiguous_exact_text', 'review_required', exactCandidates.map(row => row.id));
    }

    const foldedCandidates = folded.get(whitespaceFold(record.referenceGurmukhi)) ?? [];
    if (foldedCandidates.length === 1) {
      return mapping(record, foldedCandidates[0], 'proposed_whitespace_normalised', 'review_required');
    }
    if (foldedCandidates.length > 1) {
      return mapping(record, null, 'ambiguous_whitespace_normalised', 'review_required', foldedCandidates.map(row => row.id));
    }
    return mapping(record, null, 'unmatched', 'unavailable');
  });
}

function mapping(record, line, method, status, candidates = []) {
  return {
    id: `crosswalk:${record.id}`,
    providerRecordId: record.id,
    canonicalLineId: line?.id ?? null,
    method,
    status,
    candidates
  };
}
