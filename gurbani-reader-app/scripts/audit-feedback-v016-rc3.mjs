#!/usr/bin/env node
import { compileFeedbackExport } from './lib/feedback-review.mjs';
import { makeFeedbackExport, parseFeedbackExport } from '../src/lib/feedback.ts';

const candidate = {
  textUnitId: 'unit:G:123',
  lineId: 'line:G:456',
  title: 'Expected Shabad',
  gurmukhi: 'ਸਤਿਗੁਰੁ ਮੇਰਾ ਪੂਰਾ',
  transliteration: 'satigur mera poora',
  score: 812,
};
const record = {
  schemaVersion: 1,
  id: 'feedback-1',
  createdAt: '2026-07-23T00:00:00.000Z',
  appVersion: '0.16.0-rc.3',
  platform: 'android',
  kind: 'voice-search',
  verdict: 'wrong',
  query: 'satgur mera pura',
  correctedQuery: 'satigur mera poora',
  voiceAlternatives: ['satgur mera pura', 'sat guru mera poora'],
  candidateResults: [],
  selectedResult: candidate,
  comment: '',
};
const output = compileFeedbackExport({
  ...makeFeedbackExport([record, { ...record, id: 'duplicate' }]),
});

assert(output.recordCount === 1, 'duplicate corrections are collapsed for review');
assert(output.records[0].expectedTextUnitId === candidate.textUnitId, 'canonical intended Shabad ID survives export');
assert(output.records[0].suggestedBenchmark?.query === 'satigur mera poora', 'review tooling prefers the corrected transcript');
assert(output.records[0].voiceAlternatives.length === 2, 'every recognition alternative survives review compilation');
const roundTrip = parseFeedbackExport(JSON.stringify(makeFeedbackExport([record])));
assert(roundTrip.records[0].id === record.id, 'the app feedback export survives a JSON round trip');
assert(!('personal' in roundTrip), 'feedback export remains separate from the personal backup');

let rejected = false;
try {
  compileFeedbackExport({
    format: 'shabad-sojhi-feedback',
    version: 1,
    records: [{ ...record, notes: { private: 'reflection' } }],
  });
} catch {
  rejected = true;
}
assert(rejected, 'feedback review rejects personal notes and reflections');
console.log('\nv0.16 RC3 feedback audit passed.');

function assert(condition, label) {
  if (!condition) throw new Error(label);
  console.log(`PASS  ${label}`);
}
