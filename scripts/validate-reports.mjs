import { readFile } from 'node:fs/promises';

const validReportStatuses = new Set(['Unreviewed', 'Reviewed', 'Approved']);
const validConfidenceLevels = new Set(['low', 'medium', 'high']);
const validClassifications = new Set(['top', 'secondary', 'tiny']);

const listRaw = await readFile(new URL('../reports/index.json', import.meta.url), 'utf8');
const reportFilesRaw = JSON.parse(listRaw);
const reportFiles = reportFilesRaw.map((entry) => typeof entry === 'string' ? entry : entry.file);

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

if (!Array.isArray(reportFilesRaw)) {
  throw new Error('reports/index.json must be an array of report entries.');
}

for (const reportFile of reportFiles) {
  const reportRaw = await readFile(new URL(`../reports/${reportFile}`, import.meta.url), 'utf8');
  const report = JSON.parse(reportRaw);

  if (!report.meta || typeof report.meta !== 'object') {
    fail(reportFile, 'meta must be an object.');
  }

  ensureString(reportFile, report.meta.url, 'meta.url');
  ensureString(reportFile, report.meta.audience, 'meta.audience');
  ensureString(reportFile, report.meta.scope, 'meta.scope');
  ensureString(reportFile, report.meta.analyzed_at, 'meta.analyzed_at');

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

  if (!Array.isArray(report.task_longlist) || report.task_longlist.length === 0) {
    fail(reportFile, 'task_longlist must be a non-empty array.');
  }

  const taskIds = new Set();
  const taskClassifications = new Map();

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
      ensureNumber(reportFile, task.scores[key], `task_longlist[${taskIndex}].scores.${key}`);
    }

    if (!Array.isArray(task.evidence) || task.evidence.length === 0) {
      fail(reportFile, `task_longlist[${taskIndex}].evidence must be a non-empty array.`);
    }

    for (const [evidenceIndex, evidence] of task.evidence.entries()) {
      ensureString(reportFile, evidence?.source_url, `task_longlist[${taskIndex}].evidence[${evidenceIndex}].source_url`);
      ensureString(reportFile, evidence?.element, `task_longlist[${taskIndex}].evidence[${evidenceIndex}].element`);
      ensureString(reportFile, evidence?.note, `task_longlist[${taskIndex}].evidence[${evidenceIndex}].note`);
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

    for (const [index, taskId] of report[fieldName].entries()) {
      ensureString(reportFile, taskId, `${fieldName}[${index}]`);
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
