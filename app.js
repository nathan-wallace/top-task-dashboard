const reportList = document.querySelector('#report-list');
const reportSearch = document.querySelector('#report-search');
const reportView = document.querySelector('#report-view');
const classificationFilter = document.querySelector('#classification-filter');
const downloadButton = document.querySelector('#download-md');

let reports = [];
let selectedReport = null;

const titleFromFile = (name) => name.replace('.json', '').replace(/[-_]/g, ' ');

async function loadReports() {
  const response = await fetch('./reports/index.json');
  const files = await response.json();
  reports = await Promise.all(files.map(async (file) => {
    const data = await fetch(`./reports/${file}`).then((r) => r.json());
    return { file, title: titleFromFile(file), data };
  }));

  renderReportList();
  if (reports.length > 0) selectReport(reports[0].file);
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
    <table class="task-table">
      <thead>
        <tr><th>ID</th><th>Task</th><th>Class</th><th>Score</th><th>Rationale</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <h3>Next steps</h3>
    <ul>${(data.next_steps || []).map((step) => `<li>${step}</li>`).join('')}</ul>
  `;
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

downloadButton.addEventListener('click', () => {
  if (!selectedReport) return;
  const blob = new Blob([toMarkdown(selectedReport)], { type: 'text/markdown;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${selectedReport.file.replace('.json', '')}.md`;
  link.click();
  URL.revokeObjectURL(link.href);
});

classificationFilter.addEventListener('change', renderReport);
reportSearch.addEventListener('input', renderReportList);

loadReports().catch((error) => {
  reportView.innerHTML = `<p>Failed to load reports: ${error.message}</p>`;
});
