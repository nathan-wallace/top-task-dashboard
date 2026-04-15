import { readdir, readFile } from 'node:fs/promises';

const validReportStatuses = new Set(['Unreviewed', 'Reviewed', 'Approved']);
const validConfidenceLevels = new Set(['low', 'medium', 'high']);
const validClassifications = new Set(['top', 'secondary', 'tiny']);

function fail(reportFile, message) {
  throw new Error(`${reportFile}: ${message}`);
}

function ensureString(reportFile, value, fieldPath) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(reportFile, `${fieldPath} must be a non-empty string.`);
  }
}

function ensureNumber(reportFile, value, fieldPath) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    fail(reportFile, `${fieldPath} must be a number.`);
  }
}

function ensureNumberInRange(reportFile, value, fieldPath, min, max) {
  ensureNumber(reportFile, value, fieldPath);
  if (value < min || value > max) {
    fail(reportFile, `${fieldPath} must be between ${min} and ${max}.`);
  }
}

const reportsDirUrl = new URL('../reports/', import.meta.url);
const listRaw = await readFile(new URL('index.json', reportsDirUrl), 'utf8');
const reportEntriesRaw = JSON.parse(listRaw);

if (!Array.isArray(reportEntriesRaw)) {
  throw new Error('reports/index.json must be an array of report entries.');
}

const reportFiles = [];
const indexedSlugs = new Set();
const indexedFiles = new Set();

for (const [entryIndex, entry] of reportEntriesRaw.entries()) {
  if (typeof entry === 'string') {
    ensureString('reports/index.json', entry, `entries[${entryIndex}]`);
    if (indexedFiles.has(entry)) {
      fail('reports/index.json', `entries[${entryIndex}] (${entry}) is duplicated.`);
    }
    indexedFiles.add(entry);
    reportFiles.push(entry);
    continue;
  }

  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    fail('reports/index.json', `entries[${entryIndex}] must be a string or object.`);
  }

  ensureString('reports/index.json', entry.file, `entries[${entryIndex}].file`);
  ensureString('reports/index.json', entry.slug, `entries[${entryIndex}].slug`);
  ensureString('reports/index.json', entry.title, `entries[${entryIndex}].title`);
  ensureString('reports/index.json', entry.path, `entries[${entryIndex}].path`);

  const expectedFile = `${entry.slug}.json`;
  if (entry.file !== expectedFile) {
    fail('reports/index.json', `entries[${entryIndex}].file (${entry.file}) must match slug (${entry.slug}) as ${expectedFile}.`);
  }

  const expectedPath = `./${entry.slug}/`;
  if (entry.path !== expectedPath) {
    fail('reports/index.json', `entries[${entryIndex}].path (${entry.path}) must be ${expectedPath}.`);
  }

  if (indexedFiles.has(entry.file)) {
    fail('reports/index.json', `entries[${entryIndex}].file (${entry.file}) is duplicated.`);
  }
  if (indexedSlugs.has(entry.slug)) {
    fail('reports/index.json', `entries[${entryIndex}].slug (${entry.slug}) is duplicated.`);
  }

  indexedFiles.add(entry.file);
  indexedSlugs.add(entry.slug);
  reportFiles.push(entry.file);
}

const reportDirEntries = await readdir(reportsDirUrl, { withFileTypes: true });
const reportJsonFiles = reportDirEntries
  .filter((entry) => entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'index.json')
  .map((entry) => entry.name)
  .sort((a, b) => a.localeCompare(b));

for (const reportJsonFile of reportJsonFiles) {
  if (!indexedFiles.has(reportJsonFile)) {
    fail('reports/index.json', `Missing report entry for ${reportJsonFile}.`);
  }
}

for (const reportFile of reportFiles) {
  if (!reportJsonFiles.includes(reportFile)) {
    fail('reports/index.json', `Entry references report file that does not exist: ${reportFile}.`);
  }

  const reportRaw = await readFile(new URL(reportFile, reportsDirUrl), 'utf8');
  const report = JSON.parse(reportRaw);

  if (!report.meta || typeof report.meta !== 'object') {
    fail(reportFile, 'meta must be an object.');
  }

  ensureString(reportFile, report.meta.url, 'meta.url');
  ensureString(reportFile, report.meta.audience, 'meta.audience');
  ensureString(reportFile, report.meta.scope, 'meta.scope');
  ensureString(reportFile, report.meta.analyzed_at, 'meta.analyzed_at');
  if (Number.isNaN(Date.parse(report.meta.analyzed_at))) {
    fail(reportFile, 'meta.analyzed_at must be a valid ISO-8601 date or date-time string.');
  }

  if (!validConfidenceLevels.has(report.meta.analyst_confidence)) {
    fail(reportFile, `meta.analyst_confidence must be one of: ${[...validConfidenceLevels].join(', ')}.`);
  }

  if (!Array.isArray(report.meta.evidence_gaps)) {
    fail(reportFile, 'meta.evidence_gaps must be an array.');
  }

  for (const [index, gap] of report.meta.evidence_gaps.entries()) {
    ensureString(reportFile, gap, `meta.evidence_gaps[${index}]`);
  }

  if (!validReportStatuses.has(report.meta.report_status)) {
    fail(reportFile, `meta.report_status must be one of: ${[...validReportStatuses].join(', ')}.`);
  }

  ensureString(reportFile, report.summary, 'summary');

  if (!Array.isArray(report.task_longlist) || report.task_longlist.length === 0) {
    fail(reportFile, 'task_longlist must be a non-empty array.');
  }

  const taskIds = new Set();
  const taskClassifications = new Map();
  const taskIdsByClassification = {
    top: new Set(),
    tiny: new Set(),
  };

  for (const [taskIndex, task] of report.task_longlist.entries()) {
    ensureString(reportFile, task.id, `task_longlist[${taskIndex}].id`);
    if (taskIds.has(task.id)) {
      fail(reportFile, `task_longlist[${taskIndex}].id (${task.id}) is duplicated.`);
    }
    taskIds.add(task.id);

    ensureString(reportFile, task.task_statement, `task_longlist[${taskIndex}].task_statement`);
    ensureString(reportFile, task.user_intent_category, `task_longlist[${taskIndex}].user_intent_category`);
    ensureNumber(reportFile, task.composite_score, `task_longlist[${taskIndex}].composite_score`);
    ensureString(reportFile, task.rationale, `task_longlist[${taskIndex}].rationale`);

    if (!validClassifications.has(task.classification)) {
      fail(reportFile, `task_longlist[${taskIndex}].classification must be one of: ${[...validClassifications].join(', ')}.`);
    }
    taskClassifications.set(task.id, task.classification);

    if (!task.scores || typeof task.scores !== 'object') {
      fail(reportFile, `task_longlist[${taskIndex}].scores must be an object.`);
    }

    for (const key of ['frequency', 'impact', 'findability', 'completability']) {
      ensureNumberInRange(reportFile, task.scores[key], `task_longlist[${taskIndex}].scores.${key}`, 1, 5);
    }
    ensureNumberInRange(reportFile, task.composite_score, `task_longlist[${taskIndex}].composite_score`, 1, 5);

    const averageScore = (
      task.scores.frequency
      + task.scores.impact
      + task.scores.findability
      + task.scores.completability
    ) / 4;
    if (Math.abs(task.composite_score - averageScore) > 0.051) {
      fail(
        reportFile,
        `task_longlist[${taskIndex}].composite_score (${task.composite_score}) must match the average of score dimensions (${averageScore.toFixed(2)}), allowing for rounding.`,
      );
    }

    if (!Array.isArray(task.evidence) || task.evidence.length === 0) {
      fail(reportFile, `task_longlist[${taskIndex}].evidence must be a non-empty array.`);
    }

    for (const [evidenceIndex, evidence] of task.evidence.entries()) {
      ensureString(reportFile, evidence?.source_url, `task_longlist[${taskIndex}].evidence[${evidenceIndex}].source_url`);
      ensureString(reportFile, evidence?.element, `task_longlist[${taskIndex}].evidence[${evidenceIndex}].element`);
      ensureString(reportFile, evidence?.note, `task_longlist[${taskIndex}].evidence[${evidenceIndex}].note`);
    }

    if (task.classification === 'top' || task.classification === 'tiny') {
      taskIdsByClassification[task.classification].add(task.id);
    }
  }

  const expectedClassificationByField = {
    top_tasks: 'top',
    tiny_tasks: 'tiny',
  };

  for (const fieldName of ['top_tasks', 'tiny_tasks']) {
    if (!Array.isArray(report[fieldName])) {
      fail(reportFile, `${fieldName} must be an array.`);
    }

    const seenTaskIds = new Set();
    for (const [index, taskId] of report[fieldName].entries()) {
      ensureString(reportFile, taskId, `${fieldName}[${index}]`);
      if (seenTaskIds.has(taskId)) {
        fail(reportFile, `${fieldName}[${index}] (${taskId}) is duplicated in ${fieldName}.`);
      }
      seenTaskIds.add(taskId);
      if (!taskIds.has(taskId)) {
        fail(reportFile, `${fieldName}[${index}] (${taskId}) does not exist in task_longlist.`);
      }

      const actualClassification = taskClassifications.get(taskId);
      const expectedClassification = expectedClassificationByField[fieldName];
      if (actualClassification !== expectedClassification) {
        fail(
          reportFile,
          `${fieldName}[${index}] (${taskId}) must reference a "${expectedClassification}" task, but task_longlist classification is "${actualClassification}".`,
        );
      }
    }
  }

  for (const topTaskId of taskIdsByClassification.top) {
    if (!report.top_tasks.includes(topTaskId)) {
      fail(reportFile, `task_longlist top task (${topTaskId}) is missing from top_tasks.`);
    }
  }

  for (const tinyTaskId of taskIdsByClassification.tiny) {
    if (!report.tiny_tasks.includes(tinyTaskId)) {
      fail(reportFile, `task_longlist tiny task (${tinyTaskId}) is missing from tiny_tasks.`);
    }
  }

  const tinyTaskIds = new Set(report.tiny_tasks);
  for (const [index, taskId] of report.top_tasks.entries()) {
    if (tinyTaskIds.has(taskId)) {
      fail(reportFile, `top_tasks[${index}] (${taskId}) also appears in tiny_tasks; top_tasks and tiny_tasks must be disjoint.`);
    }
  }

  if (!report.recommended_survey || typeof report.recommended_survey !== 'object') {
    fail(reportFile, 'recommended_survey must be an object.');
  }

  ensureString(reportFile, report.recommended_survey.instructions, 'recommended_survey.instructions');

  if (!Array.isArray(report.recommended_survey.task_list_for_voting) || report.recommended_survey.task_list_for_voting.length === 0) {
    fail(reportFile, 'recommended_survey.task_list_for_voting must be a non-empty array.');
  }

  for (const [index, taskLabel] of report.recommended_survey.task_list_for_voting.entries()) {
    ensureString(reportFile, taskLabel, `recommended_survey.task_list_for_voting[${index}]`);
  }

  ensureNumber(reportFile, report.recommended_survey.recommended_sample_size, 'recommended_survey.recommended_sample_size');
  if (
    !Number.isInteger(report.recommended_survey.recommended_sample_size)
    || report.recommended_survey.recommended_sample_size <= 0
  ) {
    fail(reportFile, 'recommended_survey.recommended_sample_size must be a positive integer.');
  }

  if (!Array.isArray(report.recommended_survey.target_segments) || report.recommended_survey.target_segments.length === 0) {
    fail(reportFile, 'recommended_survey.target_segments must be a non-empty array.');
  }

  for (const [index, segment] of report.recommended_survey.target_segments.entries()) {
    ensureString(reportFile, segment, `recommended_survey.target_segments[${index}]`);
  }

  if (!Array.isArray(report.next_steps)) {
    fail(reportFile, 'next_steps must be an array.');
  }

  for (const [index, step] of report.next_steps.entries()) {
    ensureString(reportFile, step, `next_steps[${index}]`);
  }
}

console.log(`Validated ${reportFiles.length} report(s) against the prompt + dashboard data model.`);
