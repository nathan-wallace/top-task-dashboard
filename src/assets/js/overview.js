import { triggerBlobDownload } from './lib/dom.js';
import { buildPortfolioCsv } from './lib/exports.js';
import { reportStatus, round, summarizeReport } from './lib/formatting.js';
import { loadReports } from './lib/report-loader.js';

function renderReportLoadWarnings(failures, warningHost) {
  if (!warningHost) return;
  let warningPanel = document.querySelector('#report-load-warning');
  if (!failures.length) {
    warningPanel?.remove();
    return;
  }
  if (!warningPanel) {
    warningPanel = document.createElement('section');
    warningPanel.id = 'report-load-warning';
    warningPanel.className = 'load-warning panel-warning';
    warningPanel.setAttribute('role', 'status');
    warningPanel.setAttribute('aria-live', 'polite');
    warningHost.prepend(warningPanel);
  }
  warningPanel.innerHTML = `<h3>Some reports were skipped</h3><ul>${failures.map((f) => `<li>${f.file}: ${f.message}</li>`).join('')}</ul>`;
}

function renderOverviewPage(reports, { overviewStats, overviewCount, overviewTableBody }) {
  const summaries = reports.map(summarizeReport);
  const totalTasks = summaries.reduce((sum, report) => sum + report.totalTasks, 0);
  const avgScore = summaries.length ? summaries.reduce((sum, report) => sum + report.avgScore, 0) / summaries.length : 0;

  overviewCount.textContent = `${summaries.length} reports • ${totalTasks} tasks analyzed`;

  overviewStats.replaceChildren();
  [['Average Report Score', round(avgScore)], ['Top Classified Tasks', summaries.reduce((sum, report) => sum + report.topTasks, 0)]].forEach(([label, value]) => {
    const card = document.createElement('article');
    card.className = 'card stat-card';
    card.innerHTML = `<p class="subtle">${label}</p><p class="big-number">${String(value)}</p>`;
    overviewStats.append(card);
  });

  overviewTableBody.replaceChildren();
  for (const report of summaries.sort((a, b) => b.avgScore - a.avgScore)) {
    const tr = document.createElement('tr');
    const reportPath = report.path.startsWith('./') ? `./reports/${report.path.slice(2)}` : `./reports/${report.path}`;
    tr.innerHTML = `<td><a href="${reportPath}">${report.title}</a></td><td>${reportStatus(report)}</td><td>${report.data.meta?.audience || 'n/a'}</td><td>${report.totalTasks}</td><td>${round(report.avgScore)}</td><td>${report.topTasks}</td><td>${report.secondaryTasks}</td><td>${report.tinyTasks}</td>`;
    overviewTableBody.append(tr);
  }
}

async function initOverviewPage() {
  const overviewStats = document.querySelector('#overview-stats');
  const overviewCount = document.querySelector('#overview-count');
  const overviewTableBody = document.querySelector('#overview-table-body');
  if (!overviewStats || !overviewCount || !overviewTableBody) return;

  const downloadSpreadsheetButton = document.querySelector('#download-spreadsheet');

  try {
    const { reports, failures } = await loadReports();
    renderReportLoadWarnings(failures, overviewStats.closest('.panel'));
    renderOverviewPage(reports, { overviewStats, overviewCount, overviewTableBody });

    downloadSpreadsheetButton?.addEventListener('click', () => {
      if (!reports.length) return;
      const today = new Date().toISOString().slice(0, 10);
      const blob = new Blob([buildPortfolioCsv(reports)], { type: 'text/csv;charset=utf-8' });
      triggerBlobDownload(blob, `top-task-portfolio-${today}.csv`);
    });
  } catch (error) {
    overviewStats.innerHTML = `<p>Failed to load reports: ${error.message}</p>`;
  }
}

initOverviewPage();
