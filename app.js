const reportList = document.querySelector('#report-list');
const reportSearch = document.querySelector('#report-search');
const reportView = document.querySelector('#report-view');
const classificationFilter = document.querySelector('#classification-filter');
const downloadButton = document.querySelector('#download-md');
const overviewStats = document.querySelector('#overview-stats');
const overviewCount = document.querySelector('#overview-count');
const overviewTableBody = document.querySelector('#overview-table-body');

let reports = [];
let selectedReport = null;

const titleFromFile = (name) => name.replace('.json', '').replace(/[-_]/g, ' ');
const round = (value) => Number.isFinite(value) ? value.toFixed(2) : '0.00';

async function loadReports() {
  const response = await fetch('./reports/index.json');
  const files = await response.json();
  reports = await Promise.all(files.map(async (file) => {
    const data = await fetch(`./reports/${file}`).then((r) => r.json());
    return { file, title: titleFromFile(file), data };
  }));

  if (reportList) {
    renderReportList();
    if (reports.length > 0) {
      selectReport(reports[0].file);
    }
  }

  if (overviewStats && overviewTableBody) {
    renderOverviewPage();
  }
}

function renderReportList() {
  const query = reportSearch.value.trim().toLowerCase();
  const filtered = reports.filter((report) =>
    report.title.toLowerCase().includes(query)
    || report.data.meta?.url?.toLowerCase().includes(query)
    || report.data.meta?.audience?.toLowerCase().includes(query)
  );

  reportList.innerHTML = '';
  for (const report of filtered) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.textContent = report.title;
    btn.className = report.file === selectedReport?.file ? 'active' : '';
    btn.addEventListener('click', () => selectReport(report.file));
    li.append(btn);
    reportList.append(li);
  }
}

function selectReport(file) {
  selectedReport = reports.find((r) => r.file === file) ?? null;
  renderReportList();
  renderReport();
}

function averageByClassification(tasks) {
  const grouped = new Map();
  for (const task of tasks) {
    const key = task.classification || 'unknown';
    const group = grouped.get(key) || { total: 0, count: 0 };
    group.total += task.composite_score;
    group.count += 1;
    grouped.set(key, group);
  }

  return [...grouped.entries()]
    .map(([classification, { total, count }]) => ({
      classification,
      average: total / count,
      count
    }))
    .sort((a, b) => b.average - a.average);
}

function renderReport() {
  if (!reportView) return;
  if (!selectedReport) {
    reportView.innerHTML = '<p>No report selected.</p>';
    return;
  }

  const { data } = selectedReport;
  const allTasks = data.task_longlist || [];
  const filter = classificationFilter.value;
  const tasks = filter === 'all' ? allTasks : allTasks.filter((task) => task.classification === filter);
  const bars = averageByClassification(allTasks)
    .map((entry) => `
      <div class="card">
        <strong>${entry.classification}</strong>
        <div class="bar"><span style="width:${(entry.average / 5) * 100}%"></span></div>
        <small>avg ${entry.average.toFixed(2)} across ${entry.count} tasks</small>
      </div>
    `)
    .join('');

  const rows = tasks
    .sort((a, b) => b.composite_score - a.composite_score)
    .map((task) => `
      <tr>
        <td><strong>${task.id}</strong></td>
        <td>${task.task_statement}</td>
        <td><span class="badge">${task.classification}</span></td>
        <td>${task.composite_score.toFixed(2)}</td>
        <td>${task.rationale || ''}</td>
      </tr>
    `).join('');

  reportView.innerHTML = `
    <h2>${selectedReport.title}</h2>
    <div class="meta-grid">
      <div class="card"><strong>URL</strong><br><a href="${data.meta.url}" target="_blank" rel="noreferrer">${data.meta.url}</a></div>
      <div class="card"><strong>Audience</strong><br>${data.meta.audience || 'n/a'}</div>
      <div class="card"><strong>Scope</strong><br>${data.meta.scope || 'n/a'}</div>
      <div class="card"><strong>Analyzed</strong><br>${data.meta.analyzed_at || 'n/a'}</div>
    </div>

    <h3>Score overview</h3>
    <div class="meta-grid">${bars}</div>

    <h3>Tasks (${tasks.length}${filter === 'all' ? '' : ` filtered: ${filter}`})</h3>
    <div class="table-wrap">
      <table class="task-table">
        <thead>
          <tr><th>ID</th><th>Task</th><th>Class</th><th>Score</th><th>Rationale</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <h3>Next steps</h3>
    <ul>${(data.next_steps || []).map((step) => `<li>${step}</li>`).join('')}</ul>
  `;
}

function summarizeReport(report) {
  const tasks = report.data.task_longlist || [];
  const byClass = tasks.reduce((acc, task) => {
    const key = task.classification || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const totalScore = tasks.reduce((sum, task) => sum + task.composite_score, 0);
  return {
    ...report,
    totalTasks: tasks.length,
    avgScore: tasks.length ? totalScore / tasks.length : 0,
    topTasks: byClass.top || 0,
    secondaryTasks: byClass.secondary || 0,
    tinyTasks: byClass.tiny || 0
  };
}

function renderOverviewPage() {
  const summaries = reports.map(summarizeReport);
  const totalTasks = summaries.reduce((sum, report) => sum + report.totalTasks, 0);
  const avgScore = summaries.length
    ? summaries.reduce((sum, report) => sum + report.avgScore, 0) / summaries.length
    : 0;
  const topTasks = summaries.reduce((sum, report) => sum + report.topTasks, 0);
  const secondaryTasks = summaries.reduce((sum, report) => sum + report.secondaryTasks, 0);
  const tinyTasks = summaries.reduce((sum, report) => sum + report.tinyTasks, 0);

  overviewCount.textContent = `${summaries.length} reports • ${totalTasks} tasks analyzed`;

  overviewStats.innerHTML = [
    ['Average Report Score', round(avgScore)],
    ['Top Classified Tasks', topTasks],
    ['Secondary Tasks', secondaryTasks],
    ['Tiny Tasks', tinyTasks]
  ].map(([label, value]) => `
    <article class="card stat-card">
      <p class="subtle">${label}</p>
      <p class="big-number">${value}</p>
    </article>
  `).join('');

  overviewTableBody.innerHTML = summaries
    .sort((a, b) => b.avgScore - a.avgScore)
    .map((report) => `
      <tr>
        <td><a href="./index.html">${report.title}</a></td>
        <td>${report.data.meta?.audience || 'n/a'}</td>
        <td>${report.totalTasks}</td>
        <td>${round(report.avgScore)}</td>
        <td>${report.topTasks}</td>
        <td>${report.secondaryTasks}</td>
        <td>${report.tinyTasks}</td>
      </tr>
    `)
    .join('');
}

function toMarkdown(report) {
  const { file, data } = report;
  const lines = [
    `# Top Task Report: ${titleFromFile(file)}`,
    '',
    `- URL: ${data.meta?.url || 'n/a'}`,
    `- Audience: ${data.meta?.audience || 'n/a'}`,
    `- Scope: ${data.meta?.scope || 'n/a'}`,
    `- Analyzed at: ${data.meta?.analyzed_at || 'n/a'}`,
    '',
    '## Tasks',
    '',
    '| ID | Task | Classification | Composite Score |',
    '|---|---|---|---|',
    ...(data.task_longlist || []).map((task) =>
      `| ${task.id} | ${task.task_statement} | ${task.classification} | ${task.composite_score.toFixed(2)} |`),
    '',
    '## Next steps',
    '',
    ...(data.next_steps || []).map((step) => `- ${step}`)
  ];

  return lines.join('\n');
}

if (downloadButton) {
  downloadButton.addEventListener('click', () => {
    if (!selectedReport) return;
    const blob = new Blob([toMarkdown(selectedReport)], { type: 'text/markdown;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${selectedReport.file.replace('.json', '')}.md`;
    link.click();
    URL.revokeObjectURL(link.href);
  });
}

if (classificationFilter) {
  classificationFilter.addEventListener('change', renderReport);
}

if (reportSearch) {
  reportSearch.addEventListener('input', renderReportList);
}

loadReports().catch((error) => {
  if (reportView) {
    reportView.innerHTML = `<p>Failed to load reports: ${error.message}</p>`;
  }
  if (overviewStats) {
    overviewStats.innerHTML = `<p>Failed to load reports: ${error.message}</p>`;
  }
});
