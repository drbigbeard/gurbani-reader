#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';

const inputPath = resolve(process.argv[2] ?? 'corpus-pack/gurbani_reader_v5SQLite.db.gz');
const outputPath = resolve(process.argv[3] ?? 'public/assets/databases/gurbani_reader_v5SQLite.db');
const expected = '4299c273c48b2329a443e17b5a7e68c5dcb1b5ccf759c5a61a4b115a938cdea8';
mkdirSync(dirname(outputPath), { recursive: true });
await pipeline(createReadStream(inputPath), createGunzip(), createWriteStream(outputPath));
const hash = createHash('sha256');
for await (const chunk of createReadStream(outputPath)) hash.update(chunk);
const actual = hash.digest('hex');
if (actual !== expected) throw new Error(`Restored reading-data checksum mismatch: ${actual}`);
console.log(JSON.stringify({ outputPath, sha256: actual }, null, 2));
