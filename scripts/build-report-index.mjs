import { readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const reportsDir = new URL('../reports/', import.meta.url);
const entries = await readdir(reportsDir);

const files = entries
  .filter((name) => name.endsWith('.json') && name !== 'index.json')
  .sort((a, b) => a.localeCompare(b));

await writeFile(join(fileURLToPath(reportsDir), 'index.json'), `${JSON.stringify(files, null, 2)}\n`);
console.log(`Generated reports/index.json with ${files.length} reports.`);
