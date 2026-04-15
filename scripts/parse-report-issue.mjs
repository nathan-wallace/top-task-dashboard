import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ISSUE_TITLE = process.env.ISSUE_TITLE ?? '';
const ISSUE_BODY = process.env.ISSUE_BODY ?? '';
const ISSUE_NUMBER = process.env.ISSUE_NUMBER ?? '';
const OUTPUT_FILE = process.env.GITHUB_OUTPUT;

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const reportsDir = resolve(repoRoot, 'reports');

function appendOutput(key, value) {
  if (!OUTPUT_FILE) return;
  const payload = `${key}<<__CODEx__\n${value}\n__CODEx__\n`;
  return writeFile(OUTPUT_FILE, payload, { flag: 'a' });
}

async function fail(message) {
  console.error(`Submission parse error: ${message}`);
  await appendOutput('error_message', message);
  throw new Error(message);
}

function extractSection(label, body) {
  const lines = body.split(/\r?\n/);
  const heading = `### ${label}`.toLowerCase();
  const startIndex = lines.findIndex((line) => line.trim().toLowerCase() === heading);
  if (startIndex === -1) return '';

  const sectionLines = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith('### ')) break;
    sectionLines.push(lines[index]);
  }
  return sectionLines.join('\n').trim();
}

function normalizeJsonPayload(raw) {
  const trimmed = raw.trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\n([\s\S]*?)\n```$/i);
  return fencedMatch ? fencedMatch[1].trim() : trimmed;
}

function deriveSlug() {
  const fromBody = extractSection('Report slug', ISSUE_BODY).replace(/`/g, '').trim();
  if (fromBody) return fromBody;

  const fromTitle = ISSUE_TITLE.match(/^\[report\]\s*([a-z0-9-]+)/i)?.[1] ?? '';
  return fromTitle.trim();
}

const slug = deriveSlug();
if (!slug) {
  await fail('Missing report slug. Include it in the "Report slug" field or title like "[report] my-slug".');
}

if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
  await fail(`Invalid slug "${slug}". Use only lowercase letters, numbers, and hyphens.`);
}

const jsonSection = extractSection('Report JSON payload', ISSUE_BODY);
if (!jsonSection) {
  await fail('Missing "Report JSON payload" section in the issue body.');
}

const jsonPayload = normalizeJsonPayload(jsonSection);
let report;
try {
  report = JSON.parse(jsonPayload);
} catch (error) {
  await fail(`Report JSON payload is not valid JSON: ${error.message}`);
}

if (!report || typeof report !== 'object' || Array.isArray(report)) {
  await fail('Report JSON payload must be a JSON object.');
}

const reportFileName = `${slug}.json`;
const reportPath = resolve(reportsDir, reportFileName);
if (!reportPath.startsWith(`${reportsDir}/`)) {
  await fail('Refusing to write outside the reports directory.');
}

await mkdir(reportsDir, { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

await appendOutput('slug', slug);
await appendOutput('report_file', reportFileName);
await appendOutput('issue_number', String(ISSUE_NUMBER));
console.log(`Wrote reports/${reportFileName}`);
