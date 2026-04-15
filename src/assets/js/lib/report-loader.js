import { titleFromFile } from './formatting.js';

export function getReportContext() {
  const reportsBase = document.body?.dataset?.reportsBase || './reports';
  const forcedReportFile = document.body?.dataset?.reportFile || '';
  return { reportsBase, forcedReportFile };
}

export async function loadReports() {
  const { reportsBase, forcedReportFile } = getReportContext();
  const response = await fetch(`${reportsBase}/index.json`);
  if (!response.ok) {
    throw new Error(`Failed to load report index (HTTP ${response.status})`);
  }
  const reportIndex = await response.json();
  const indexEntries = reportIndex.map((entry) => {
    if (typeof entry === 'string') {
      return { file: entry, title: titleFromFile(entry), path: './' };
    }
    return {
      file: entry.file,
      title: entry.title || titleFromFile(entry.file),
      path: entry.path || './'
    };
  });

  const filesToLoad = forcedReportFile
    ? indexEntries.filter((entry) => entry.file === forcedReportFile)
    : indexEntries;

  if (forcedReportFile && !filesToLoad.length) {
    throw new Error(`Report not found in index: ${forcedReportFile}`);
  }

  const settledReports = await Promise.allSettled(filesToLoad.map(async (entry) => {
    const normalizedPath = String(entry.path || './').replace(/\/+$/, '');
    const pathCandidate = normalizedPath === '.'
      ? `${reportsBase}/${entry.file}`
      : `${reportsBase}/${normalizedPath.replace(/^\.\//, '')}/${entry.file}`;
    const urlCandidates = [...new Set([`${reportsBase}/${entry.file}`, pathCandidate])];
    let lastStatus = 0;
    let reportResponse = null;

    for (const url of urlCandidates) {
      const attemptedResponse = await fetch(url);
      if (attemptedResponse.ok) {
        reportResponse = attemptedResponse;
        break;
      }
      lastStatus = attemptedResponse.status;
    }

    if (!reportResponse) {
      throw new Error(`HTTP ${lastStatus || 'fetch failed'}`);
    }

    const data = await reportResponse.json();
    if (!data || typeof data !== 'object' || !Array.isArray(data.task_longlist)) {
      throw new Error('Invalid report schema: expected an object with task_longlist array');
    }

    return { ...entry, data };
  }));

  const reports = settledReports
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value)
    .sort((a, b) => a.file.localeCompare(b.file));

  const failures = settledReports
    .map((result, index) => {
      if (result.status === 'fulfilled') return null;
      const reason = result.reason instanceof Error
        ? result.reason.message
        : String(result.reason || 'Unknown error');
      return { file: filesToLoad[index].file, message: reason };
    })
    .filter(Boolean);

  if (!reports.length) {
    throw new Error('No valid reports could be loaded.');
  }

  return { reports, failures, forcedReportFile };
}
