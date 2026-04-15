import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUTPUT_FILE = process.env.GITHUB_OUTPUT;
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const reportsDir = resolve(repoRoot, 'reports');

function parseArgs(argv) {
  const args = { body: undefined, bodyFile: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if ((token === '--body-file' || token === '-f') && argv[index + 1]) {
      args.bodyFile = argv[index + 1];
      index += 1;
    } else if ((token === '--body' || token === '-b') && argv[index + 1]) {
      args.body = argv[index + 1];
      index += 1;
    }
  }
  return args;
}

async function appendOutput(name, value) {
  if (!OUTPUT_FILE) return;
  const payload = `${name}<<__REPORT_SUBMISSION__\n${value}\n__REPORT_SUBMISSION__\n`;
  await writeFile(OUTPUT_FILE, payload, { flag: 'a' });
}

async function fail(message) {
  console.error(`Report submission parse error: ${message}`);
  await appendOutput('error_message', message);
}

function normalizeKey(raw) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[`*_]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function extractFieldsFromIssueBody(body) {
  const fields = new Map();
  const lines = body.split(/\r?\n/);
  let currentKey = null;
  let currentLines = [];

  const commitCurrent = () => {
    if (!currentKey) return;
    const value = currentLines.join('\n').trim();
    if (value) fields.set(currentKey, value);
  };

  for (const line of lines) {
    const headingMatch = line.match(/^###\s+(.+)\s*$/);
    if (headingMatch) {
      commitCurrent();
      currentKey = normalizeKey(headingMatch[1]);
      currentLines = [];
      continue;
    }

    if (currentKey) currentLines.push(line);
  }

  commitCurrent();
  return fields;
}

function stripCodeFence(raw) {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function resolveInputFilePath(rawPath) {
  const candidate = resolve(process.cwd(), rawPath);
  if (!existsSync(candidate)) {
    throw new Error(`Issue body file not found: ${rawPath}`);
  }
  return candidate;
}

async function readIssueBody() {
  const args = parseArgs(process.argv.slice(2));

  if (typeof args.body === 'string' && args.body.trim()) {
    return args.body;
  }

  const envBody =
    process.env.REPORT_SUBMISSION_BODY
    ?? process.env.ISSUE_BODY
    ?? process.env.INPUT_ISSUE_BODY;
  if (typeof envBody === 'string' && envBody.trim()) {
    return envBody;
  }

  const issueBodyFile =
    args.bodyFile
    ?? process.env.REPORT_SUBMISSION_BODY_FILE
    ?? process.env.ISSUE_BODY_FILE
    ?? process.env.INPUT_ISSUE_BODY_FILE;

  if (issueBodyFile) {
    const inputPath = resolveInputFilePath(issueBodyFile);
    return readFile(inputPath, 'utf8');
  }

  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath) {
    const payload = JSON.parse(await readFile(eventPath, 'utf8'));
    if (typeof payload?.issue?.body === 'string' && payload.issue.body.trim()) {
      return payload.issue.body;
    }
  }

  throw new Error(
    'No issue body input found. Provide --body, --body-file, ISSUE_BODY, INPUT_ISSUE_BODY, or GITHUB_EVENT_PATH.',
  );
}

function deriveSlug(fields) {
  return (fields.get('slug')
    ?? fields.get('report_slug')
    ?? fields.get('reportslug')
    ?? '')
    .replace(/`/g, '')
    .trim();
}

function validateSlug(slug) {
  if (!slug) {
    throw new Error('Missing slug field in issue form body.');
  }

  if (slug.endsWith('.json')) {
    throw new Error(`Invalid slug "${slug}": remove the .json suffix.`);
  }

  if (slug !== slug.toLowerCase()) {
    throw new Error(`Invalid slug "${slug}": use lowercase only.`);
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new Error(`Invalid slug "${slug}": allowed characters are [a-z0-9-].`);
  }
}

function parseReportJson(fields) {
  const raw = fields.get('report_json')
    ?? fields.get('report_json_payload')
    ?? fields.get('report_jsonpayload')
    ?? fields.get('report_payload')
    ?? '';

  if (!raw.trim()) {
    throw new Error('Missing report_json field in issue form body.');
  }

  const payload = stripCodeFence(raw);
  try {
    return JSON.parse(payload);
  } catch (error) {
    throw new Error(`report_json is not valid JSON: ${error.message}`);
  }
}

function deriveReportPath(slug) {
  const relativePath = `reports/${slug}.json`;
  const absolutePath = resolve(repoRoot, relativePath);
  const reportsPrefix = `${reportsDir}${sep}`;

  if (!absolutePath.startsWith(reportsPrefix)) {
    throw new Error('Refusing path that escapes reports/.');
  }

  return relativePath;
}

function sanitizeBranchSuffix(slug) {
  const cleaned = slug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return cleaned || 'submission';
}

async function main() {
  try {
    const issueBody = await readIssueBody();
    const fields = extractFieldsFromIssueBody(issueBody);

    const slug = deriveSlug(fields);
    validateSlug(slug);

    const parsedReport = parseReportJson(fields);
    if (!parsedReport || typeof parsedReport !== 'object' || Array.isArray(parsedReport)) {
      throw new Error('report_json must decode to a JSON object.');
    }

    const reportPath = deriveReportPath(slug);
    const branchSuffix = sanitizeBranchSuffix(slug);
    const branchName = `report-submissions/${branchSuffix}`;

    await appendOutput('slug', slug);
    await appendOutput('report_path', reportPath);
    await appendOutput('report_json', JSON.stringify(parsedReport));
    await appendOutput('branch_suffix', branchSuffix);
    await appendOutput('branch_name', branchName);

    console.log(JSON.stringify({ slug, report_path: reportPath, branch_suffix: branchSuffix, branch_name: branchName }));
  } catch (error) {
    await fail(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

await main();
