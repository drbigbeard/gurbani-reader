#!/usr/bin/env node
import { parseBackup } from '../src/lib/backup.ts';

const oldBackup = JSON.stringify({ format:'gurbani-reader-backup', version:1, exportedAt:'2026-01-01T00:00:00.000Z', personal:{ myBaniIds:['bani:test'], bookmarks:['line:test'] }, preferences:{ theme:'paper' } });
const restored = parseBackup(oldBackup);
if (restored.personal.myBaniIds[0] !== 'bani:test' || restored.personal.bookmarks[0] !== 'line:test') throw new Error('v1 backup did not preserve Saved Banis and bookmarks');
console.log('PASS  v1 My Banis data migrates intact to the Saved Banis interface');
let rejected = false;
try { parseBackup('{"format":"something-else"}'); } catch { rejected = true; }
if (!rejected) throw new Error('invalid backup was accepted');
console.log('PASS  invalid backups are rejected before local data changes');
console.log('\nv0.16 backup compatibility audit passed.');
