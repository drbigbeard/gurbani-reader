#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

for (const script of ['scripts/audit-v015.mjs','scripts/audit-contrast-v016.mjs','scripts/audit-themes-v016.mjs','scripts/audit-backup-v016.mjs']) {
  const result=spawnSync(process.execPath,[script],{cwd:new URL('../',import.meta.url),encoding:'utf8'});
  process.stdout.write(result.stdout);process.stderr.write(result.stderr);
  if(result.status!==0)throw new Error(`${script} failed`);
}
console.log('\nv0.16 release audit passed.');
