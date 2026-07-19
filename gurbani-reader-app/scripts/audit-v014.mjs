import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const root = new URL('../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(message); console.log(`PASS  ${message}`); };
const db = new DatabaseSync(new URL('public/assets/databases/gurbani_reader_v7SQLite.db', root).pathname, { readOnly: true });
const scalar = (sql, ...params) => db.prepare(sql).get(...params)?.value ?? db.prepare(sql).get(...params)?.count ?? 0;

assert(db.prepare('PRAGMA integrity_check').get()?.integrity_check === 'ok', 'v7 reading database passes SQLite integrity check');
assert(String(scalar("SELECT value FROM metadata WHERE key='schema_release'")) === 'v7', 'v0.14 search schema is installed');
assert(Number(scalar('SELECT COUNT(*) AS count FROM line_search_fts')) === Number(scalar('SELECT COUNT(*) AS count FROM canonical_line')), 'every installed line is in the normalised search index');
assert(Boolean(db.prepare(`SELECT 1 FROM line_search_fts f JOIN canonical_line l ON l.id=f.line_id WHERE line_search_fts MATCH ? AND l.gurmukhi LIKE 'ਜੋ ਮਾਗਹਿ%' LIMIT 1`).get('roman_phonetic:"j mag"*')), '“jo mange” phonetic key reaches the expected Gurbani line');
assert(Number(scalar("SELECT COUNT(*) AS count FROM bani_collection_line WHERE bani_id='bani:banidb:23'")) === 55, 'complete BaniDB Kirtan Sohila reading is installed');
assert(Number(scalar("SELECT COUNT(*) AS count FROM bani_collection WHERE token IN ('japji','jaap','tav-prasad-savaiye','benti-chaupai','anand','rehras','kirtan-sohila')")) === 7, 'daily-prayer collection contains all agreed named readings');

const app = read('src/App.tsx'); const chrome = read('src/components/Chrome.tsx'); const voice = read('src/lib/voice-search.ts'); const styles = read('src/v014.css');
assert(!chrome.includes("id: 'read', label: 'Read'") && chrome.includes("label: 'Library'"), 'primary navigation is reduced to four user-oriented destinations');
assert(app.includes('Search history') && app.includes('Clear all searches') && app.includes('delete-history'), 'search history supports individual and bulk deletion');
assert(app.includes('listenForSearch') && voice.includes("'pa-IN' | 'en-GB'"), 'Punjabi and Roman/English voice search share the search interface');
assert(app.includes('Find a recording on YouTube') && app.includes('youtube.com/results'), 'Shabad view offers an explicit external YouTube search');
assert(app.includes("SuhiM:4,ASWC2:5") && app.includes('Anand Sanskar · Laavan'), 'Laavan is positioned inside the Anand Sanskar sequence');
assert(app.includes("'kirtan-sohila'") && app.includes("'sukhmani'"), 'Daily and Common Bani discovery includes Sohila and Sukhmani');
assert(app.includes('mainRaagSequence') && app.includes('Other musical and structural headings'), 'principal Raags are separated from structural headings');
assert(styles.includes('.tggsp-translation') && styles.includes('dashed') && styles.includes('[data-accent=burgundy]'), 'providers use non-colour distinction and selectable accent palettes');
assert(app.includes('The Guru Granth Sahib Project') && app.includes('What “where available” means'), 'new-user source guide explains coverage and attribution');
db.close();
console.log('\nv0.14 audit passed.');
