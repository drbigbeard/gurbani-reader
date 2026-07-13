#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { canonicalFromBaniDbPages, snapshotManifest } from './banidb-import.mjs';
import { assertValidCanonical } from './validate.mjs';

const options = parseArgs(process.argv.slice(2));
const fetchedAt = new Date().toISOString();
const pages = [];
await mkdir(options.rawDir, { recursive: true });

for (let pageNo = options.from; options.to == null || pageNo <= options.to;) {
  const rawPath = resolve(options.rawDir, `${options.source}-${String(pageNo).padStart(5, '0')}.json`);
  let response;
  try {
    response = JSON.parse(await readFile(rawPath, 'utf8'));
    process.stdout.write(`resume ${options.source}:${pageNo}\n`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    response = await fetchPage(options, pageNo);
    await writeJson(rawPath, response);
    process.stdout.write(`fetched ${options.source}:${pageNo} (${response.page?.length ?? 0} verses)\n`);
    if (options.delayMs) await delay(options.delayMs);
  }
  pages.push({ pageNo, response });
  if (options.to == null) {
    const next = Number(response.navigation?.next);
    if (!Number.isFinite(next) || next <= pageNo) break;
    pageNo = next;
  } else {
    pageNo += 1;
  }
}

const manifest = snapshotManifest({ sourceId: options.source, pages, fetchedAt });
const releaseId = `banidb-${options.source.toLowerCase()}-${fetchedAt.slice(0, 10)}-${manifest.checksum.slice(0, 12)}`;
const canonical = canonicalFromBaniDbPages({ sourceId: options.source, pages, fetchedAt,
  releaseId, manifestChecksum: manifest.checksum });
assertValidCanonical(canonical);
await writeJson(options.output, canonical);
await writeJson(options.manifest, { ...manifest, releaseId, canonicalOutput: options.output });
process.stdout.write(`${JSON.stringify({ releaseId, output: options.output, manifest: options.manifest,
  pages: manifest.pageCount, verses: manifest.verseCount, checksum: manifest.checksum }, null, 2)}\n`);

async function fetchPage(config, pageNo) {
  const url = new URL(`angs/${pageNo}/${config.source}`, config.baseUrl);
  let lastError;
  for (let attempt = 1; attempt <= config.retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { accept: 'application/json', 'user-agent': 'GurbaniReaderPersonalCorpus/0.5' },
        signal: AbortSignal.timeout(config.timeoutMs)
      });
      if (!response.ok) throw new Error(`BaniDB ${response.status} ${response.statusText} for ${url}`);
      const body = await response.json();
      if (!Array.isArray(body.page)) throw new Error(`Unexpected BaniDB Ang response for ${url}`);
      return body;
    } catch (error) {
      lastError = error;
      if (attempt < config.retries) await delay(attempt * 1000);
    }
  }
  throw lastError;
}

function parseArgs(args) {
  const values = {
    source: 'G', from: 1, to: 1430, delayMs: 300, retries: 3, timeoutMs: 30_000,
    baseUrl: 'https://api.banidb.com/v2/', output: resolve('imports/banidb-G-canonical.json'),
    manifest: resolve('imports/banidb-G-manifest.json'), rawDir: resolve('imports/banidb-raw')
  };
  const numberFlags = new Set(['from', 'to', 'delay-ms', 'retries', 'timeout-ms']);
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const raw = args[i + 1];
    if (!flag?.startsWith('--') || raw == null) throw new Error(`Invalid option near ${flag ?? '(end)'}`);
    const key = flag.slice(2);
    if (key === 'to' && raw === 'auto') values.to = null;
    else if (numberFlags.has(key)) values[toCamel(key)] = Number(raw);
    else if (key === 'source') values.source = raw.toUpperCase();
    else if (key === 'base-url') values.baseUrl = raw.endsWith('/') ? raw : `${raw}/`;
    else if (['output', 'manifest', 'raw-dir'].includes(key)) values[toCamel(key)] = resolve(raw);
    else throw new Error(`Unknown option ${flag}`);
  }
  if (!Number.isInteger(values.from) || (values.to != null && !Number.isInteger(values.to)) ||
      values.from < 1 || (values.to != null && values.to < values.from)) {
    throw new Error('Invalid --from/--to Ang range');
  }
  return values;
}

function toCamel(value) { return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()); }
async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function delay(milliseconds) { return new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds)); }
