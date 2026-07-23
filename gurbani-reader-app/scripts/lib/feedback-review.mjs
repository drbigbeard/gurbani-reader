const forbiddenKeys = new Set([
  'rawAudio',
  'audio',
  'bookmarks',
  'notes',
  'reflections',
  'readingHistory',
  'history',
]);

export function compileFeedbackExport(input) {
  if (
    input?.format !== 'shabad-sojhi-feedback' ||
    input?.version !== 1 ||
    !Array.isArray(input.records)
  ) throw new Error('Invalid Shabad Sojhi feedback export');
  assertNoPersonalPayload(input);
  const seen = new Set();
  const records = [];
  for (const record of input.records) {
    if (
      record?.schemaVersion !== 1 ||
      typeof record.id !== 'string' ||
      typeof record.kind !== 'string' ||
      typeof record.verdict !== 'string'
    ) throw new Error('Invalid feedback record');
    const expected = record.selectedResult ?? null;
    const key = [
      record.kind,
      normalized(record.query),
      normalized(record.correctedQuery),
      expected?.textUnitId ?? '',
      expected?.lineId ?? '',
      record.verdict,
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    records.push({
      feedbackId: record.id,
      reviewStatus: 'pending',
      kind: record.kind,
      verdict: record.verdict,
      query: record.query ?? '',
      correctedQuery: record.correctedQuery ?? '',
      voiceAlternatives: uniqueStrings(record.voiceAlternatives),
      audioSource: record.audioSource ?? null,
      expectedTextUnitId: expected?.textUnitId ?? null,
      expectedLineId: expected?.lineId ?? null,
      expectedTitle: expected?.title ?? null,
      comment: record.comment ?? '',
      suggestedBenchmark: expected?.textUnitId
        ? {
            query: record.correctedQuery || record.query,
            inputKind: record.kind,
            expectedTextUnitId: expected.textUnitId,
            expectedLineId: expected.lineId ?? null,
            recognitionAlternatives: uniqueStrings(record.voiceAlternatives),
          }
        : null,
    });
  }
  return {
    format: 'shabad-sojhi-feedback-review',
    version: 1,
    generatedAt: new Date().toISOString(),
    sourceAppVersions: uniqueStrings(input.records.map(record => record.appVersion)),
    recordCount: records.length,
    records,
  };
}

function assertNoPersonalPayload(value, path = '') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoPersonalPayload(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenKeys.has(key)) throw new Error(`Feedback export contains forbidden personal field: ${path}${key}`);
    assertNoPersonalPayload(child, `${path}${key}.`);
  }
}

function normalized(value) {
  return String(value ?? '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(value => String(value).trim()).filter(Boolean))];
}
