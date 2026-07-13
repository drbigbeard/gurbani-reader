#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';

const inputPath = resolve(process.argv[2] ?? 'corpus-pack/gurbani_reader_v4SQLite.db.gz');
const outputPath = resolve(process.argv[3] ?? 'public/assets/databases/gurbani_reader_v4SQLite.db');
const expected = '8da59be2288d7abb0065d1464d4509f69f31db56a661be0053a94bde18eebc92';
mkdirSync(dirname(outputPath), { recursive: true });
await pipeline(createReadStream(inputPath), createGunzip(), createWriteStream(outputPath));
const hash = createHash('sha256');
for await (const chunk of createReadStream(outputPath)) hash.update(chunk);
const actual = hash.digest('hex');
if (actual !== expected) throw new Error(`Restored reading-data checksum mismatch: ${actual}`);
console.log(JSON.stringify({ outputPath, sha256: actual }, null, 2));
