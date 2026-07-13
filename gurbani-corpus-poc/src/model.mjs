import { createHash } from 'node:crypto';

export const ONTOLOGY_VERSION = '0.1.0';
export const TOKENISER_VERSION = '0.1.0';
export const NORMALISATION_VERSION = 'nfc-0.1.0';
export const UNICODE_POLICY = 'Runtime Unicode data; NFC canonical comparison only';

export function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function createAnalysisRelease(corpus, provider) {
  const inputChecksum = sha256(canonicalJson({ corpus, provider }));
  return {
    id: `analysis:${inputChecksum.slice(0, 16)}`,
    corpusReleaseId: corpus.corpusRelease.id,
    providerReleaseId: provider?.providerRelease?.id ?? null,
    ontologyVersion: ONTOLOGY_VERSION,
    tokeniserVersion: TOKENISER_VERSION,
    normalisationVersion: NORMALISATION_VERSION,
    unicodePolicy: UNICODE_POLICY,
    inputChecksum
  };
}
