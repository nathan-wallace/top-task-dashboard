import { readFile } from 'node:fs/promises';

const validReportStatuses = new Set(['Unreviewed', 'Reviewed', 'Approved']);

const listRaw = await readFile(new URL('../reports/index.json', import.meta.url), 'utf8');
const reportFiles = JSON.parse(listRaw);

if (!Array.isArray(reportFiles)) {
  throw new Error('reports/index.json must be an array of report filenames.');
}

for (const reportFile of reportFiles) {
  const reportRaw = await readFile(new URL(`../reports/${reportFile}`, import.meta.url), 'utf8');
  const report = JSON.parse(reportRaw);

  if (!report.meta?.url || !Array.isArray(report.task_longlist)) {
    throw new Error(`${reportFile} is missing required keys: meta.url and task_longlist.`);
  }

  if (!validReportStatuses.has(report.meta.report_status)) {
    throw new Error(
      `${reportFile} has invalid meta.report_status. Expected one of: ${[...validReportStatuses].join(', ')}.`
    );
  }

  for (const task of report.task_longlist) {
    if (!task.id || !task.task_statement || typeof task.composite_score !== 'number') {
      throw new Error(`${reportFile} has an invalid task record.`);
    }
  }
}

console.log(`Validated ${reportFiles.length} report(s).`);
