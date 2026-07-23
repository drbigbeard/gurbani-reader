#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileFeedbackExport } from './lib/feedback-review.mjs';

const inputPath = resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw new Error('Usage: node scripts/feedback-to-review.mjs feedback.json [review.json]');
const outputPath = resolve(process.argv[3] ?? inputPath.replace(/\.json$/i, '-review.json'));
const review = compileFeedbackExport(JSON.parse(readFileSync(inputPath, 'utf8')));
writeFileSync(outputPath, `${JSON.stringify(review, null, 2)}\n`);
console.log(JSON.stringify({ outputPath, records: review.recordCount }, null, 2));
