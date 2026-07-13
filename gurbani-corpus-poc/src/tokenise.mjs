const TOKEN_PATTERN = /[\p{L}\p{M}]+|[\p{N}]+|[^\s]/gu;
const GURMUKHI_PATTERN = /^[\u0A00-\u0A7F]+$/u;
const PUNCTUATION_PATTERN = /^\p{P}+$/u;
const NUMBER_PATTERN = /^\p{N}+$/u;

export function compareForm(value) {
  return value.normalize('NFC');
}

export function classifyToken(value) {
  if (GURMUKHI_PATTERN.test(value) && /[\p{L}\p{M}]/u.test(value)) return 'lexical_gurmukhi';
  if (NUMBER_PATTERN.test(value)) return 'numeric_marker';
  if (PUNCTUATION_PATTERN.test(value) || value === '॥' || value === '।') return 'punctuation';
  if (/[\p{L}\p{M}]/u.test(value)) return 'lexical_other_script';
  return 'unclassified';
}

export function tokeniseLine(line, analysisReleaseId) {
  const occurrences = [];
  for (const match of line.gurmukhi.matchAll(TOKEN_PATTERN)) {
    const exact = match[0];
    const startUtf16 = match.index;
    const endUtf16 = match.index + exact.length;
    const startCodePoint = Array.from(line.gurmukhi.slice(0, startUtf16)).length;
    const endCodePoint = startCodePoint + Array.from(exact).length;
    const startByte = Buffer.byteLength(line.gurmukhi.slice(0, startUtf16), 'utf8');
    const endByte = startByte + Buffer.byteLength(exact, 'utf8');
    occurrences.push({
      id: `occurrence:${line.id}:${occurrences.length}`,
      lineId: line.id,
      textUnitId: line.textUnitId,
      sourceWorkId: line.sourceWorkId,
      position: occurrences.length,
      startUtf16,
      endUtf16,
      startCodePoint,
      endCodePoint,
      startByte,
      endByte,
      exact,
      compare: compareForm(exact),
      tokenClass: classifyToken(exact),
      analysisReleaseId
    });
  }
  return occurrences;
}

export function tokeniseCorpus(corpus, analysisReleaseId) {
  return corpus.lines.flatMap(line => tokeniseLine(line, analysisReleaseId));
}
