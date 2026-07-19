#!/usr/bin/env node
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const directory = resolve('public/assets/databases');
const keep = 'gurbani_reader_v8SQLite.db';
if (!existsSync(resolve(directory, keep))) throw new Error(`Required native database is missing: ${keep}`);

const removable = readdirSync(directory).filter(name => {
  if (name === keep) return false;
  return /^gurbani_reader_v[5-8]SQLite\.db(?:-(?:wal|shm|journal))?$/u.test(name)
    || /^\.gurbani_reader_v[5-8]SQLite\.db(?:\..+)?$/u.test(name)
    || /^gurbani_reader_v8SQLite\.db\.building(?:-(?:wal|shm|journal))?$/u.test(name);
});
for (const name of removable) rmSync(resolve(directory, name), { force: true });
console.log(JSON.stringify({ status: 'pass', kept: keep, removedGeneratedAssets: removable.length }, null, 2));
