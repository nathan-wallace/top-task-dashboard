import { triggerBlobDownload } from './lib/dom.js';
import { buildReportPdfBlob, buildSingleReportWorkbook } from './lib/exports.js';
import {
  averageByClassification,
  buildClassificationLabelTemplate,
  reportStatus,
  round,
  textMatchesQuery
} from './lib/formatting.js';
import { loadReports } from './lib/report-loader.js';

const REPORT_PANEL_STORAGE_KEY = 'top-task-dashboard.report-panel-collapsed';

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
  warningPanel.innerHTML = `<h3>Some reports were skipped</h3><p class="subtle">${failures.length} file(s) could not be loaded. Valid reports are still available below.</p><ul>${failures.map((f) => `<li>${f.file}: ${f.message}</li>`).join('')}</ul>`;
}

function initReportPanelToggle(layout, panel, panelContent, toggleButton) {
  if (!layout || !toggleButton) return;

  const setCollapsed = (collapsed) => {
    layout.classList.toggle('sidebar-collapsed', collapsed);
    panel?.setAttribute('aria-expanded', String(!collapsed));
    panelContent?.setAttribute('aria-hidden', String(collapsed));
    toggleButton.setAttribute('aria-expanded', String(!collapsed));
    toggleButton.setAttribute('aria-label', collapsed ? 'Expand reports panel' : 'Collapse reports panel');
    toggleButton.title = collapsed ? 'Expand reports panel' : 'Collapse reports panel';
    const icon = toggleButton.querySelector('.panel-toggle-icon');
    const text = toggleButton.querySelector('.panel-toggle-text');
    if (icon) icon.textContent = collapsed ? '→' : '←';
    if (text) text.textContent = collapsed ? 'Expand' : 'Collapse';
    localStorage.setItem(REPORT_PANEL_STORAGE_KEY, collapsed ? 'true' : 'false');
  };

  const stored = localStorage.getItem(REPORT_PANEL_STORAGE_KEY);
  setCollapsed(stored === 'true' && window.matchMedia('(min-width: 901px)').matches);
  toggleButton.addEventListener('click', () => setCollapsed(!layout.classList.contains('sidebar-collapsed')));
}

function renderReport(reportView, report) {
  if (!report) {
    reportView.innerHTML = '<p>No report selected.</p>';
    return;
  }

  const allTasks = report.data.task_longlist || [];
  const sortedTasks = [...allTasks].sort((a, b) => b.composite_score - a.composite_score);
  reportView.replaceChildren();

  const heading = document.createElement('h2');
  heading.textContent = report.title;
  reportView.append(heading);

  const summary = document.createElement('p');
  summary.textContent = report.data.summary || 'No summary available for this report.';
  reportView.append(summary);

  const scoreHeading = document.createElement('h3');
  scoreHeading.textContent = 'Score overview';
  reportView.append(scoreHeading);

  const statGrid = document.createElement('div');
  statGrid.className = 'stat-grid';
  for (const entry of averageByClassification(allTasks)) {
    const card = document.createElement('div');
    card.className = 'card';
    const strong = document.createElement('strong');
    strong.innerHTML = buildClassificationLabelTemplate(entry.classification);
    const small = document.createElement('small');
    small.textContent = `avg ${entry.average.toFixed(2)} across ${entry.count} tasks`;
    card.append(strong, small);
    statGrid.append(card);
  }
  reportView.append(statGrid);

  const tableWrap = document.createElement('div');
  tableWrap.className = 'table-wrap';
  const table = document.createElement('table');
  table.className = 'task-table';
  table.innerHTML = '<thead><tr><th>ID</th><th>Task</th><th>Class</th><th>Score</th><th>Rationale</th></tr></thead>';
  const tbody = document.createElement('tbody');
  for (const task of sortedTasks) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><strong>${task.id || 'n/a'}</strong></td><td>${task.task_statement || ''}</td><td><span class="badge">${task.classification || 'unknown'}</span></td><td>${round(task.composite_score)}</td><td>${task.rationale || ''}</td>`;
    tbody.append(tr);
  }
  table.append(tbody);
  tableWrap.append(table);
  reportView.append(tableWrap);
}

function renderReportList(reportList, reportSearch, reports, selectedReportFile, onSelect) {
  const query = reportSearch?.value?.trim().toLowerCase() || '';
  const filtered = reports.filter((report) =>
    textMatchesQuery(report.title, query)
    || textMatchesQuery(report.data.meta?.url, query)
    || textMatchesQuery(report.data.meta?.audience, query)
  );

  reportList.innerHTML = '';
  for (const report of filtered) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.textContent = report.title;
    btn.className = report.file === selectedReportFile ? 'active' : '';
    btn.addEventListener('click', () => {
      const forcedReportFile = document.body?.dataset?.reportFile || '';
      if (forcedReportFile) {
        const reportsBase = document.body?.dataset?.reportsBase || './reports';
        const reportPath = report.path?.startsWith('./') ? report.path.slice(2) : report.path || '';
        window.location.href = `${reportsBase}/${reportPath}`;
        return;
      }
      onSelect(report.file);
    });
    li.append(btn);
    reportList.append(li);
  }
}

async function initReportExplorerPage() {
  const reportList = document.querySelector('#report-list');
  const reportSearch = document.querySelector('#report-search');
  const reportView = document.querySelector('#report-view');
  if (!reportList || !reportView) return;

  const reportsLayout = document.querySelector('#reports-layout');
  const reportPanel = document.querySelector('#report-panel');
  const reportPanelContent = document.querySelector('#report-panel-content');
  const toggleReportPanelButton = document.querySelector('#toggle-report-panel');
  const downloadButton = document.querySelector('#download-pdf');
  const downloadReportWorkbookButton = document.querySelector('#download-report-workbook');

  initReportPanelToggle(reportsLayout, reportPanel, reportPanelContent, toggleReportPanelButton);

  try {
    const { reports, failures, forcedReportFile } = await loadReports();
    renderReportLoadWarnings(failures, reportList.closest('.panel'));

    let selectedReport = reports.find((report) => report.file === forcedReportFile) || reports[0] || null;

    const rerender = () => {
      renderReportList(reportList, reportSearch, reports, selectedReport?.file, (file) => {
        selectedReport = reports.find((report) => report.file === file) || null;
        rerender();
      });
      renderReport(reportView, selectedReport);
    };

    reportSearch?.addEventListener('input', rerender);

    downloadButton?.addEventListener('click', async () => {
      if (!selectedReport) return;
      const blob = await buildReportPdfBlob(selectedReport);
      triggerBlobDownload(blob, `${selectedReport.file.replace('.json', '')}-report.pdf`);
    });

    downloadReportWorkbookButton?.addEventListener('click', () => {
      if (!selectedReport) return;
      const workbook = buildSingleReportWorkbook(selectedReport);
      const blob = new Blob([workbook], { type: 'application/vnd.ms-excel;charset=utf-8' });
      triggerBlobDownload(blob, `${selectedReport.file.replace('.json', '')}-report-workbook.xls`);
    });

    rerender();
  } catch (error) {
    reportView.innerHTML = `<p>Failed to load reports: ${error.message}</p>`;
  }
}

initReportExplorerPage();
