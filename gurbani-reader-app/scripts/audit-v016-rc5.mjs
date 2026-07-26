#!/usr/bin/env node
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const db = new DatabaseSync(
  new URL('public/assets/databases/gurbani_reader_v10SQLite.db', root).pathname,
  { readOnly: true },
);
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
  console.log(`PASS  ${message}`);
};
const scalar = sql => db.prepare(sql).get()?.count ?? 0;

assert(
  db.prepare("SELECT value FROM metadata WHERE key='schema_release'").get()?.value === 'v10',
  'RC5 v10 reading database is installed',
);
assert(
  db.prepare("SELECT value FROM metadata WHERE key='tggsp_alignment_release'").get()?.value
    === 'rc5-strict-line-or-passage-v1',
  'strict TGGSP line-or-passage policy is installed',
);
assert(
  Number(scalar(`
    SELECT COUNT(*) count FROM tggsp_line_alignment
    WHERE translation_scope='line'
      AND mapping_status NOT IN ('verified_manual_line','verified_exact_within_unit')
      AND (literal_translation_en<>'' OR literal_translation_pa<>'')
  `)) === 0,
  'no inferred TGGSP translation is presented inline',
);
assert(
  Number(scalar(`
    SELECT COUNT(*) count FROM tggsp_line_alignment
    WHERE collection_code='AKV'
      AND translation_scope='line'
      AND (literal_translation_en<>'' OR literal_translation_pa<>'')
  `)) === 0,
  'Asa Di Vaar TGGSP translation is passage-level rather than interleaved',
);
assert(
  Number(scalar(`
    SELECT COUNT(*) count FROM tggsp_line_alignment
    WHERE collection_code='AKV' AND translation_scope='passage'
      AND (literal_translation_en<>'' OR literal_translation_pa<>'')
  `)) > 20,
  'Asa Di Vaar TGGSP passage translations remain available',
);

const voice = read('src/lib/voice-search.ts');
const app = read('src/App.tsx');
const searchBar = read('src/components/SearchBar.tsx');
const proxy = read('../services/punjabi-speech-proxy/server.mjs');
assert(voice.includes('SpeechRecognition.forceStop()'), 'iOS recognition has deterministic stale-session cleanup');
assert(voice.includes('useOnDeviceRecognition'), 'Apple SpeechAnalyzer capability routing is present');
assert(voice.includes("'pa-Guru-IN'"), 'Punjabi Gurmukhi locale is probed');
assert(voice.includes('isOnDeviceRecognitionAvailable'), 'Apple modern locale availability is checked at runtime');
assert(voice.includes('VITE_ENHANCED_SPEECH_URL'), 'cross-platform enhanced Punjabi fallback is configurable');
assert(voice.includes('enhanced-punjabi-speech-consent'), 'cloud Punjabi fallback requires one-time user consent');
assert(searchBar.includes('Stop voice search'), 'ordinary voice search exposes an explicit Stop action');
assert(app.includes('Stop listening'), 'Identify Keertan exposes an explicit Stop action');
assert(proxy.includes("languageCodes: ['pa-Guru-IN']"), 'secure proxy requests Punjabi Gurmukhi recognition');
assert(proxy.includes("model: 'chirp_2'"), 'secure proxy uses the selected multilingual recognition model');
assert(proxy.includes("request.headers['x-shabad-beta-key']"), 'beta proxy rejects unauthorised clients');

db.close();
console.log('\nv0.16 RC5 voice and TGGSP audit passed.');
