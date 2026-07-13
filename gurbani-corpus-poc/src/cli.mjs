import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPipeline } from './pipeline.mjs';
import { exactFrequency } from './analyse.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '..');
const defaults = {
  canonicalPath: path.join(root, 'fixtures', 'canonical.sample.json'),
  providerPath: path.join(root, 'fixtures', 'provider.sample.json'),
  outputDirectory: path.join(root, 'build')
};

const command = process.argv[2] ?? 'build';
const options = parseOptions(process.argv.slice(command === 'query' ? 4 : 3), defaults);
const result = await buildPipeline(options);

if (command === 'build') {
  console.log(JSON.stringify(result.report, null, 2));
} else if (command === 'query') {
  const query = process.argv[3];
  if (!query) throw new Error('Usage: npm run query -- <exact-gurmukhi-form>');
  console.log(JSON.stringify(exactFrequency(result.index, query), null, 2));
} else {
  throw new Error(`Unknown command: ${command}`);
}

function parseOptions(args, fallback) {
  const parsed = { ...fallback };
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    if (!flag?.startsWith('--') || value == null) throw new Error(`Invalid option near ${flag ?? '(end)'}`);
    if (flag === '--canonical') parsed.canonicalPath = path.resolve(value);
    else if (flag === '--provider') parsed.providerPath = value === 'none' ? null : path.resolve(value);
    else if (flag === '--output') parsed.outputDirectory = path.resolve(value);
    else throw new Error(`Unknown option: ${flag}`);
  }
  return parsed;
}
