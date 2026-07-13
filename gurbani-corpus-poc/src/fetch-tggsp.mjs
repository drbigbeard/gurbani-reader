#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { buildTggspExports, checksumJson, TGGSP_ATTRIBUTION } from './tggsp-transform.mjs';

const INDEXES = [
  'sikhri-bani-sql-index', 'sggs2-0-banidetail-index', 'sikhri-significantwords-sql-index',
  'sikhri-baniwordrefdict-sql-index', 'sikhri-banisubsection-sql-index', 'sikhri-banifootnote-sql-index'
];
const options = parseArgs(process.argv.slice(2));
const config = await discoverPublicReaderConfig(options.siteUrl);
const fetchedAt = new Date().toISOString();
const recordsByIndex = {};
const indexManifests = [];

for (const index of INDEXES) {
  const result = await fetchIndex(index, config, options);
  recordsByIndex[index] = result.records;
  indexManifests.push(result.manifest);
}

const snapshotChecksum = checksumJson(indexManifests.map(row => ({ index: row.index, checksum: row.checksum })));
const manifest = {
  format: 'tggsp-public-reader-azure-search-snapshot', fetchedAt, sourceUrl: options.siteUrl,
  attribution: TGGSP_ATTRIBUTION, indexes: indexManifests, checksum: snapshotChecksum
};
const exports = buildTggspExports({ recordsByIndex, fetchedAt, snapshotChecksum });
await writeJson(options.manifest, manifest);
await writeJson(options.providerOutput, exports.provider);
await writeJson(options.enrichmentOutput, exports.enrichment);
process.stdout.write(`${JSON.stringify({ fetchedAt, checksum: snapshotChecksum,
  providerRecords: exports.provider.records.length,
  providerContent: exports.enrichment.providerContent.length,
  glossaryEntries: exports.enrichment.glossaryEntries.length,
  termForms: exports.enrichment.termForms.length,
  manifest: options.manifest, providerOutput: options.providerOutput,
  enrichmentOutput: options.enrichmentOutput }, null, 2)}\n`);

async function discoverPublicReaderConfig(siteUrl) {
  const html = await fetchText(siteUrl);
  const script = html.match(/<script[^>]+src="(main\.[^"]+\.js)"/i)?.[1];
  if (!script) throw new Error('Could not locate TGGSP public reader main bundle');
  const bundleUrl = new URL(script, siteUrl).href;
  const bundle = await fetchText(bundleUrl);
  const apiKey = bundle.match(/apiKey:"([^"]+)"/)?.[1];
  const apiVersion = bundle.match(/apiVersionPreview:"([^"]+)"/)?.[1];
  const searchBase = bundle.match(/const [A-Za-z_$][\w$]*="(https:\/\/[^"/]+\/indexes\/)"/)?.[1];
  if (!apiKey || !apiVersion || !searchBase) throw new Error('TGGSP public reader data configuration was not found');
  return { apiKey, apiVersion, searchBase, bundleUrl };
}

async function fetchIndex(index, config, options) {
  const records = [];
  const pages = [];
  let expectedCount = null;
  for (let skip = 0; expectedCount == null || skip < expectedCount; skip += options.pageSize) {
    const rawPath = resolve(options.rawDir, index, `${String(skip).padStart(6, '0')}.json`);
    let body;
    try {
      body = JSON.parse(await readFile(rawPath, 'utf8'));
      process.stdout.write(`resume ${index}:${skip}\n`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const url = new URL(`${index}/docs`, config.searchBase);
      url.search = new URLSearchParams({ 'api-version': config.apiVersion, search: '*',
        '$count': 'true', '$top': String(options.pageSize), '$skip': String(skip) });
      body = await fetchJson(url, config.apiKey, options);
      await writeJson(rawPath, body);
      process.stdout.write(`fetched ${index}:${skip} (${body.value?.length ?? 0} records)\n`);
      if (options.delayMs) await delay(options.delayMs);
    }
    if (!Array.isArray(body.value)) throw new Error(`Unexpected TGGSP response for ${index}:${skip}`);
    expectedCount = Number(body['@odata.count']);
    records.push(...body.value);
    pages.push({ skip, count: body.value.length, checksum: checksumJson(body) });
    if (body.value.length === 0) break;
  }
  if (Number.isFinite(expectedCount) && records.length !== expectedCount) {
    throw new Error(`${index} reconciliation failed: expected ${expectedCount}, received ${records.length}`);
  }
  return { records, manifest: { index, expectedCount, recordCount: records.length, pages,
    checksum: checksumJson(pages) } };
}

async function fetchJson(url, apiKey, options) {
  let lastError;
  for (let attempt = 1; attempt <= options.retries; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { accept: 'application/json', 'api-key': apiKey },
        signal: AbortSignal.timeout(options.timeoutMs) });
      if (!response.ok) throw new Error(`TGGSP ${response.status} ${response.statusText}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < options.retries) await delay(attempt * 1000);
    }
  }
  throw lastError;
}

async function fetchText(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`TGGSP reader ${response.status} ${response.statusText}`);
  return response.text();
}

function parseArgs(args) {
  const values = {
    siteUrl: 'https://gurugranthsahib.io/', pageSize: 1000, delayMs: 300, retries: 3, timeoutMs: 30_000,
    rawDir: resolve('imports/tggsp-raw'), manifest: resolve('imports/tggsp-manifest.json'),
    providerOutput: resolve('imports/tggsp-provider.json'),
    enrichmentOutput: resolve('imports/tggsp-mobile-enrichment.json')
  };
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i]; const raw = args[i + 1];
    if (!flag?.startsWith('--') || raw == null) throw new Error(`Invalid option near ${flag ?? '(end)'}`);
    const key = flag.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (['pageSize', 'delayMs', 'retries', 'timeoutMs'].includes(key)) values[key] = Number(raw);
    else if (key === 'siteUrl') values[key] = raw;
    else if (['rawDir', 'manifest', 'providerOutput', 'enrichmentOutput'].includes(key)) values[key] = resolve(raw);
    else throw new Error(`Unknown option ${flag}`);
  }
  return values;
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function delay(milliseconds) { return new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds)); }
