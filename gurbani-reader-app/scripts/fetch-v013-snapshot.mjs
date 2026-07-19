#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const baseUrl = process.env.BANIDB_API_URL ?? 'https://api.banidb.com/v2';
const outputRoot = resolve(process.argv[2] ?? '../../v013-banidb-snapshot');
const requests = [
  ...range(1, 1430).map(page => ({ kind: 'ang', source: 'G', page })),
  ...range(1, 40).map(page => ({ kind: 'ang', source: 'B', page })),
  ...range(1, 28).map(page => ({ kind: 'ang', source: 'S', page })),
  ...[...range(1, 13), 119, ...range(709, 712), ...range(1386, 1388)].map(page => ({ kind: 'ang', source: 'D', page })),
  ...[4, 5, 6, 9, 21, 23, 24].map(id => ({ kind: 'bani', id }))
];

mkdirSync(outputRoot, { recursive: true });
const manifestRows = new Array(requests.length);
let cursor = 0;
let completed = 0;

async function worker() {
  while (cursor < requests.length) {
    const position = cursor++;
    const request = requests[position];
    const relativePath = request.kind === 'ang'
      ? `angs/${request.source}/${String(request.page).padStart(4, '0')}.json`
      : `banis/${request.id}.json`;
    const url = request.kind === 'ang'
      ? `${baseUrl}/angs/${request.page}/${request.source}`
      : `${baseUrl}/banis/${request.id}?length=s`;
    const outputPath = resolve(outputRoot, relativePath);
    let response; let serialized;
    if (existsSync(outputPath)) {
      serialized = readFileSync(outputPath, 'utf8');
      response = JSON.parse(serialized);
    } else {
      response = await fetchWithRetry(url);
      serialized = `${JSON.stringify(response)}\n`;
    }
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, serialized);
    manifestRows[position] = { ...request, url, path: relativePath, sha256: sha256(serialized),
      verseCount: request.kind === 'ang' ? response.page?.length ?? 0 : response.verses?.length ?? 0 };
    completed += 1;
    if (completed % 50 === 0 || completed === requests.length) process.stdout.write(`Fetched ${completed}/${requests.length}\n`);
  }
}

await Promise.all(Array.from({ length: Number(process.env.SNAPSHOT_CONCURRENCY ?? 8) }, worker));
const generatedAt = process.env.SNAPSHOT_GENERATED_AT ?? new Date().toISOString();
const manifestCore = {
  format: 'gurbani-reader-v013-banidb-snapshot', generatedAt,
  source: baseUrl, attribution: 'BaniDB (banidb.com)',
  scope: {
    canonicalTranslations: ['Guru Granth Sahib', 'Vaaran Bhai Gurdas'],
    selectedDasamAngs: [...range(1, 13), 119, ...range(709, 712), ...range(1386, 1388)],
    sgpcBaniIds: [4, 5, 6, 9, 21, 23, 24]
  },
  files: manifestRows
};
const manifest = { ...manifestCore, sha256: sha256(JSON.stringify(manifestCore)) };
const expectedSnapshot = process.env.EXPECTED_SNAPSHOT_SHA256;
if (expectedSnapshot && manifest.sha256 !== expectedSnapshot) {
  throw new Error(`BaniDB snapshot checksum mismatch: expected ${expectedSnapshot}, received ${manifest.sha256}`);
}
writeFileSync(resolve(outputRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ outputRoot, files: manifestRows.length,
  verses: manifestRows.reduce((sum, row) => sum + row.verseCount, 0), sha256: manifest.sha256 }, null, 2));

async function fetchWithRetry(url) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json', 'user-agent': 'GurbaniReaderPersonal/0.14' },
        signal: AbortSignal.timeout(45_000) });
      if (!response.ok) throw new Error(`BaniDB ${response.status} for ${url}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < 4) await new Promise(resolveDelay => setTimeout(resolveDelay, attempt * 750));
    }
  }
  throw lastError;
}

function range(from, to) { return Array.from({ length: to - from + 1 }, (_, index) => from + index); }
function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
