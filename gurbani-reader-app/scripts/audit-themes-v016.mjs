#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { resolveTggspTheme, TGGSP_THEME_INDEX_VERSION } from '../src/data/tggsp-themes-v1.ts';

const cases = JSON.parse(readFileSync(new URL('../benchmarks/themes-v016.json', import.meta.url), 'utf8'));
const assert = (condition, message) => { if (!condition) throw new Error(message); console.log(`PASS  ${message}`); };

assert(cases.version === TGGSP_THEME_INDEX_VERSION, 'the benchmark and reviewed TGGSP theme index use the same version');
for (const test of cases.positive) {
  const theme = resolveTggspTheme(test.query);
  assert(theme?.id === test.theme, `“${test.query}” triggers only the reviewed ${test.theme} theme`);
}
for (const query of cases.negative) assert(resolveTggspTheme(query) === null, `“${query}” does not trigger thematic search`);
const db = new DatabaseSync(new URL('../public/assets/databases/gurbani_reader_v8SQLite.db', import.meta.url).pathname, { readOnly:true });
for (const id of [...new Set(cases.positive.map(test => test.theme))]) {
  const theme=resolveTggspTheme(cases.positive.find(test => test.theme === id).query);
  const where=theme.searchTerms.map(() => 'lower(content) LIKE ?').join(' OR ');
  const rows=db.prepare(`SELECT text_unit_id AS id,content FROM provider_content WHERE content_type IN ('literal_translation_en','interpretive_transcreation_en','commentary_en','poetical_dimension_en') AND (${where})`).all(...theme.searchTerms.map(term => `%${term}%`));
  const evidence=new Set(rows.filter(row => theme.searchTerms.some(term => containsTerm(String(row.content),term))).map(row => row.id));
  assert(evidence.size>0, `${theme.label} has whole-word evidence in the installed TGGSP material`);
}
db.close();
console.log('\nv0.16 TGGSP thematic trigger audit passed.');

function containsTerm(content,term){const escaped=term.replace(/[.*+?^${}()|[\]\\]/gu,'\\$&').replace(/[-\s]+/gu,'[-\\s]+');return new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`,'iu').test(content);}
