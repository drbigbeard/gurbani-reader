#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { buildGurmukhiFtsQuery, buildRomanFtsQuery, containsGurmukhi, latinInitials, normalizeGurmukhi, normalizeRoman, scoreSearchCandidate } from '../src/lib/search-core.ts';

const root = new URL('../', import.meta.url);
const benchmark = JSON.parse(readFileSync(new URL('benchmarks/search-v015.json', root), 'utf8'));
const db = new DatabaseSync(new URL('public/assets/databases/gurbani_reader_v8SQLite.db', root).pathname, { readOnly: true });
const measurements = [];
let passed = 0;

for (const test of benchmark.positive) {
  const started = performance.now();
  const results = search(test.query, 10);
  const elapsed = performance.now() - started;
  measurements.push(elapsed);
  const rank = results.findIndex(row => row.gurmukhi.includes(test.expectedGurmukhi));
  if (rank < 0) throw new Error(`${test.id}: expected line was not in the top 10 for “${test.query}”`);
  passed += 1;
  console.log(`PASS  ${test.id.padEnd(27)} rank ${String(rank + 1).padStart(2)}  ${elapsed.toFixed(1)} ms`);
}

for (const test of benchmark.negative) {
  const started = performance.now();
  const results = search(test.query, 10);
  const elapsed = performance.now() - started;
  measurements.push(elapsed);
  if (results.length) throw new Error(`${test.id}: nonsense query returned a confident result`);
  passed += 1;
  console.log(`PASS  ${test.id.padEnd(27)} empty    ${elapsed.toFixed(1)} ms`);
}

const p95 = percentile(measurements, 0.95);
if (p95 > 500) throw new Error(`Search p95 ${p95.toFixed(1)} ms exceeds the 500 ms full-result gate`);
console.log(`\n${passed}/${benchmark.positive.length + benchmark.negative.length} cases passed · p95 ${p95.toFixed(1)} ms`);
db.close();

function search(query, limit) {
  const gurmukhi = containsGurmukhi(query);
  const select = db.prepare(`SELECT l.id,l.text_unit_id,l.gurmukhi,COALESCE(l.transliteration,'') AS transliteration,
      l.source_work_id,l.ang,l.line_order
    FROM line_search_fts f JOIN canonical_line l ON l.id=f.line_id
    WHERE line_search_fts MATCH ? ORDER BY rank LIMIT 1800`);
  let rows = select.all(gurmukhi ? buildGurmukhiFtsQuery(query) : buildRomanFtsQuery(query));
  if (!rows.length) rows = select.all(gurmukhi ? buildGurmukhiFtsQuery(query, true) : buildRomanFtsQuery(query, true));
  const compact = gurmukhi ? normalizeGurmukhi(query).replaceAll(' ', '') : normalizeRoman(query).replaceAll(' ', '');
  if (compact) {
    const field = gurmukhi ? 'initials_gurmukhi' : 'initials_latin';
    rows.push(...db.prepare(`SELECT l.id,l.text_unit_id,l.gurmukhi,COALESCE(l.transliteration,'') AS transliteration,
        l.source_work_id,l.ang,l.line_order
      FROM line_search_index i JOIN canonical_line l ON l.id=i.line_id
      WHERE i.${field} LIKE ? OR i.${field} LIKE ? LIMIT 600`).all(`${compact}%`, `%${compact}%`));
  }
  const byLine = new Map();
  for (const row of rows) {
    const scored = scoreSearchCandidate(query, row.gurmukhi, row.transliteration);
    let score = scored.score;
    let kind = scored.kind;
    const initials = gurmukhi
      ? normalizeGurmukhi(row.gurmukhi).split(' ').map(word => word.normalize('NFD').replace(/[\u0A01-\u0A03\u0A3C\u0A3E-\u0A4D\u0A51\u0A70-\u0A71\u0A75]/gu, '')[0] ?? '').join('')
      : latinInitials(row.transliteration);
    if (initials.startsWith(compact) && compact.length >= 2) { score = Math.max(score, 790); kind = 'first-letters'; }
    else if (initials.includes(compact) && compact.length >= 2) { score = Math.max(score, 690); kind = 'first-letters'; }
    if (score < 575) continue;
    const previous = byLine.get(row.id);
    if (!previous || previous.score < score) byLine.set(row.id, { ...row, score, kind });
  }
  const units = new Set();
  return [...byLine.values()]
    .sort((a, b) => b.score - a.score || sourcePriority(a) - sourcePriority(b) || a.ang - b.ang || a.line_order - b.line_order)
    .filter(row => units.has(row.text_unit_id) ? false : (units.add(row.text_unit_id), true))
    .slice(0, limit);
}

function sourcePriority(row) {
  return row.source_work_id === 'source:G' ? 0 : 1;
}

function percentile(values, value) {
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.ceil(value * ordered.length) - 1)] ?? 0;
}
