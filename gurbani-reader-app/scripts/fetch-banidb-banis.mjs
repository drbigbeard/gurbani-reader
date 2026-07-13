#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const baseUrl = process.env.BANIDB_API_URL ?? 'https://api.banidb.com/v2';
const outputPath = resolve(process.argv[2] ?? '../gurbani-corpus-poc/imports/banidb-banis.json');
const response = await fetch(`${baseUrl}/banis`, { headers: { Accept: 'application/json' } });
if (!response.ok) throw new Error(`BaniDB /banis returned ${response.status}`);
const index = await response.json();
const records = index.records ?? index;

const collections = new Array(records.length);
let cursor = 0;
async function worker() {
  while (cursor < records.length) {
    const position = cursor++;
    const record = records[position];
    const detailResponse = await fetch(`${baseUrl}/banis/${record.ID}`, { headers: { Accept: 'application/json' } });
    if (!detailResponse.ok) throw new Error(`BaniDB /banis/${record.ID} returned ${detailResponse.status}`);
    const detail = await detailResponse.json();
    collections[position] = {
      id: record.ID,
      token: record.token,
      gurmukhi: record.gurmukhiUni,
      transliteration: record.transliterations?.en ?? record.transliteration ?? '',
      sourceId: detail.baniInfo?.source?.sourceId ?? null,
      sourceName: detail.baniInfo?.source?.unicode ?? detail.baniInfo?.source?.english ?? null,
      verses: (detail.verses ?? []).map((entry, order) => ({
        order,
        verseId: entry.verse?.verseId ?? null,
        header: entry.header ?? 0,
        paragraph: entry.paragraph ?? null,
        gurmukhi: entry.verse?.verse?.unicode ?? '',
        transliteration: entry.verse?.transliteration?.en ?? entry.verse?.transliteration?.english ?? ''
      }))
    };
    process.stdout.write(`\rFetched ${position + 1}/${records.length}`);
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
process.stdout.write('\n');

const payload = {
  format: 'banidb-bani-collections-v1',
  generatedAt: new Date().toISOString(),
  source: `${baseUrl}/banis`,
  attribution: 'BaniDB (banidb.com)',
  collections
};
const serialized = `${JSON.stringify(payload, null, 2)}\n`;
payload.sha256 = createHash('sha256').update(serialized).digest('hex');
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify({ outputPath, collections: collections.length,
  verses: collections.reduce((sum, row) => sum + row.verses.length, 0), sha256: payload.sha256 }, null, 2));
