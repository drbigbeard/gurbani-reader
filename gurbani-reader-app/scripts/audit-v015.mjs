#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';

const root = new URL('../', import.meta.url);
const db = new DatabaseSync(new URL('public/assets/databases/gurbani_reader_v8SQLite.db', root).pathname, { readOnly: true });
const assert = (condition, message) => { if (!condition) throw new Error(message); console.log(`PASS  ${message}`); };
const scalar = (sql, ...params) => { const row = db.prepare(sql).get(...params); return row?.value ?? row?.count ?? 0; };

assert(db.prepare('PRAGMA integrity_check').get()?.integrity_check === 'ok', 'v8 reading database passes SQLite integrity check');
assert(String(scalar("SELECT value FROM metadata WHERE key='schema_release'")) === 'v8', 'v0.15 search schema is installed');
assert(String(scalar("SELECT value FROM metadata WHERE key='reading_profile'")) === 'SGPC', 'the single installed reading profile is SGPC');
assert(Number(scalar('SELECT COUNT(*) AS count FROM line_search_fts')) === Number(scalar('SELECT COUNT(*) AS count FROM canonical_line')), 'every installed line is indexed for tolerant search');
assert(Number(scalar('SELECT COUNT(*) AS count FROM stable_line_reference')) === Number(scalar('SELECT COUNT(*) AS count FROM canonical_line')), 'every line has a portable personal-data reference');
assert(Number(scalar('SELECT COUNT(*) AS count FROM provider_line_coverage')) === Number(scalar('SELECT COUNT(*) AS count FROM canonical_line')), 'translation coverage is computed per line');
assert(Number(scalar("SELECT COUNT(*) AS count FROM bani_collection WHERE token IN ('japji','jaap','tav-prasad-savaiye','benti-chaupai','anand','rehras','kirtan-sohila')")) === 7, 'Nitnem includes all seven agreed readings');
assert(Number(scalar("SELECT COUNT(*) AS count FROM bani_collection WHERE token IN ('shabad-hazare-patshahi-10','ardas','rehras')")) === 3, 'Shabad Hazare Patshahi 10, Ardas and Rehras are installed');
assert(Number(scalar('SELECT COUNT(*) AS count FROM tggsp_collection WHERE collection_type=\'ceremonial\'')) > 0, 'SikhRI ceremonial and life-event readings are installed');
db.close();

const benchmark = spawnSync(process.execPath, ['scripts/search-benchmark-v015.mjs'], { cwd: new URL('.', root), encoding: 'utf8' });
process.stdout.write(benchmark.stdout);
process.stderr.write(benchmark.stderr);
if (benchmark.status !== 0) throw new Error('the machine-readable search benchmark failed');
console.log('\nv0.15 release audit passed.');
