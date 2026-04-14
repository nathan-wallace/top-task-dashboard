const reportList = document.querySelector('#report-list');
const reportSearch = document.querySelector('#report-search');
const reportView = document.querySelector('#report-view');
const classificationFilter = document.querySelector('#classification-filter');
const downloadButton = document.querySelector('#download-md');
const downloadSpreadsheetButton = document.querySelector('#download-spreadsheet');
const promptForm = document.querySelector('#prompt-form');
const promptOutput = document.querySelector('#prompt-output');
const copyPromptButton = document.querySelector('#copy-prompt');
const copyStatus = document.querySelector('#copy-status');
const overviewStats = document.querySelector('#overview-stats');
const overviewCount = document.querySelector('#overview-count');
const overviewTableBody = document.querySelector('#overview-table-body');

let reports = [];
let selectedReport = null;

const reportsBase = document.body?.dataset?.reportsBase || './reports';

const titleFromFile = (name) => name.replace('.json', '').replace(/[-_]/g, ' ');
const round = (value) => Number.isFinite(value) ? value.toFixed(2) : '0.00';
const reportStatus = (report) => report?.data?.meta?.report_status || 'Unreviewed';

function buildPrompt(values) {
  const tokens = {
    page_url: values.page_url?.trim() || '{{page_url}}',
    page_title_and_stated_purpose: values.page_title_and_stated_purpose?.trim() || '{{page_title_and_stated_purpose}}',
    top_1_to_3_user_jobs: values.top_1_to_3_user_jobs?.trim() || '{{top_1_to_3_user_jobs}}',
    conversion_or_outcome: values.conversion_or_outcome?.trim() || '{{conversion_or_outcome}}',
    date: values.date?.trim() || '{{date}}',
    reviewer: values.reviewer?.trim() || '{{reviewer}}',
    audit_number: values.audit_number?.trim() || '##'
  };

  return `## Role and Objective

You are a senior UX content strategist conducting a defensible, data-backed audit of a single high-impact federal web page. Your goal is to evaluate content effectiveness against user intent and agency objectives, then produce prioritized, evidence-linked recommendations that a project team can act on without further clarification. This audit is one of 50 and must follow a repeatable structure so findings can be compared across the portfolio.

---

## Inputs (provided per page)

Fill in before running the analysis:

- **Page URL:** \`${tokens.page_url}\`
- **Page Title / Purpose:** \`${tokens.page_title_and_stated_purpose}\`
- **Primary User Task(s):** \`${tokens.top_1_to_3_user_jobs}\`
- **Primary Business/Agency Goal:** \`${tokens.conversion_or_outcome}\`
- **Audit Date / Reviewer:** \`${tokens.date} / ${tokens.reviewer}\`
- **Audit ID:** \`HIP-${tokens.audit_number}-of-50\`

### Quantitative data sources

Paste raw values or attach exports.

**Google Analytics (trailing 90 days)**
- Pageviews, unique pageviews
- Avg. time on page
- Entrances, bounce rate, exit rate
- Scroll depth
- Top referrers
- Device split (desktop / mobile / tablet)
- Top in-page events
- Internal search terms leading to and from the page

**Siteimprove**
- Section 508 / WCAG issues (count by severity)
- Readability score (Flesch-Kincaid or equivalent)
- Broken links
- Misspellings
- SEO score
- Policy violations
- Digital Certainty Index (DCI) sub-scores

**Heatmap data** (Hotjar / Crazy Egg / FullStory / equivalent)
- Click map summary
- Scroll reach (25 / 50 / 75 / 100%)
- Rage clicks
- Dead clicks
- Attention hotspots
- Mobile vs. desktop divergence

**Optional**
- USWDS / M-24-08 compliance notes
- Prior user feedback
- Search Console queries

---

## Analysis Framework

Evaluate the page across these six dimensions. For each, cite the specific data point(s) that support your finding using the format \`[Source: GA | Siteimprove | Heatmap — metric: value]\`.

1. **Findability & Intent Match** — Do entrances and search terms indicate users arrive with the intent this page is designed to serve? Is the page title/H1 aligned?
2. **Information Architecture & Scannability** — Does scroll reach and heatmap attention match the intended content hierarchy? Where do users drop off?
3. **Plain Language & Readability** — Siteimprove readability score vs. target (8th-grade or Plain Writing Act benchmark), jargon, sentence length, voice.
4. **Accessibility & USWDS / 508 Compliance** — Severity-weighted issues, heading structure, link text quality, alt text, color contrast, form labels.
5. **Task Completion & CTA Effectiveness** — Click map on primary CTAs, rage/dead clicks, exit rate relative to task completion, form abandonment if applicable.
6. **Trust, Tone & Brand Consistency** — Voice alignment with agency style guide, currency of content, authorship/date signals, cross-links to authoritative sources.

---

## Required Output Structure

Produce the audit using **exactly** the following template. Do not omit sections; mark "N/A — data not provided" where inputs are missing.

\`\`\`
# Page Audit: {{page_title}}
**URL:** {{page_url}}
**Reviewed:** {{date}} by {{reviewer}}
**Audit ID:** HIP-{{##}}-of-50

## 1. Executive Summary
- Overall Health Score: {{0–100}} (weighted: 25% task completion, 20% accessibility, 20% readability, 15% findability, 10% IA, 10% trust)
- Top 3 Findings (one sentence each, each with a data citation)
- Top 3 Recommendations (ranked by impact × effort)

## 2. Page Context
- Stated purpose, primary user task, primary agency goal
- Traffic tier and strategic importance

## 3. Quantitative Snapshot
| Metric | Value | Source | Benchmark | Status |
|---|---|---|---|---|
(Include all GA, Siteimprove, and heatmap metrics listed in Inputs. Status = ✅ / ⚠️ / ❌ vs. benchmark.)

## 4. Dimensional Findings
For each of the six dimensions:
### {{Dimension}}
- **Finding:** {{what the data shows}}
- **Evidence:** {{citations with values}}
- **User impact:** {{who is affected and how}}
- **Severity:** Critical / High / Medium / Low

## 5. Prioritized Recommendations
| # | Recommendation | Dimension | Evidence | Impact | Effort | Priority | Owner |
|---|---|---|---|---|---|---|---|
(Priority = Impact ÷ Effort, 1–5 scale each. Sort descending.)

## 6. Suggested Content Revisions
Show before/after for the top 3 text or structural changes. Keep revisions USWDS- and plain-language-compliant.

## 7. Open Questions & Data Gaps
List anything that blocked a confident finding, and what data would resolve it.

## 8. Appendix
- Raw data references / export filenames
- Screenshots or heatmap overlays (linked)
- Change log for this audit entry
\`\`\`

---

## Rules of Engagement

- **Every claim must cite data.** If you cannot cite a source, move it to Section 7 (Open Questions), not Findings.
- **No generic advice.** "Improve readability" is not acceptable; "Reduce avg. sentence length from 24 to ≤15 words in the eligibility section (Siteimprove FK: 13.2)" is.
- **Benchmarks are explicit.** State the target you are comparing against (e.g., bounce rate benchmark 40%, readability grade ≤8, WCAG 2.1 AA zero criticals).
- **Severity is consistent across all 50 audits.**
  - **Critical** — blocks task or violates 508
  - **High** — measurably degrades completion
  - **Medium** — friction
  - **Low** — polish
- **Tone of recommendations:** direct, specific, actionable in a single sprint where possible.

---

## Repeatable Workflow (per page)

1. **Intake** — Create a new audit entry from the template; populate Inputs section. Confirm URL is live and matches the HIP list row.
2. **Pull data** — Export GA (90d), Siteimprove page report, and heatmap snapshot on the same date. Save to \`/audits/HIP-##/raw/\` with ISO date in filename.
3. **Set benchmarks** — Copy the standing benchmark row from the master audit sheet so comparisons are consistent across all 50 pages.
4. **Run the analysis** — Feed this prompt plus the raw data into the model. Review output against the Rules of Engagement.
5. **QA pass** — Verify every finding has a citation; confirm severity labels match the rubric; sanity-check the health score calculation.
6. **Log to master tracker** — Append health score, top 3 findings, and top 3 recommendations to the portfolio spreadsheet with a link to the full audit file.
7. **Stakeholder handoff** — Share Sections 1, 5, and 6 with the page owner; retain full audit as the defensible record.
8. **Re-audit trigger** — Schedule a 90-day follow-up to measure movement on the same metrics.

---

## Version

- **v1.0** — Initial prompt for HIP 50-page review program.`;
}

function updatePromptOutput() {
  if (!promptForm || !promptOutput) return;
  const formData = new FormData(promptForm);
  const values = Object.fromEntries(formData.entries());
  promptOutput.value = buildPrompt(values);
}

async function copyPromptToClipboard() {
  if (!promptOutput || !copyStatus) return;
  const text = promptOutput.value.trim();
  if (!text) {
    copyStatus.textContent = 'Please complete the form first.';
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    copyStatus.textContent = 'Prompt copied.';
  } catch (error) {
    copyStatus.textContent = 'Copy failed. Select and copy manually.';
  }
}

async function loadReports() {
  const response = await fetch(`${reportsBase}/index.json`);
  const files = await response.json();
  reports = await Promise.all(files.map(async (file) => {
    const data = await fetch(`${reportsBase}/${file}`).then((r) => r.json());
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
      <div class="card"><strong>Status</strong><br>${reportStatus(selectedReport)}</div>
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
  const byClass = classifyCounts(tasks);
  const totalScore = tasks.reduce((sum, task) => sum + task.composite_score, 0);
  return {
    ...report,
    totalTasks: tasks.length,
    avgScore: tasks.length ? totalScore / tasks.length : 0,
    topTasks: byClass.top || 0,
    secondaryTasks: byClass.secondary || 0,
    tinyTasks: byClass.tiny || 0,
    unknownTasks: byClass.unknown || 0
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
        <td><a href="./reports/">${report.title}</a></td>
        <td>${reportStatus(report)}</td>
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


function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function classifyCounts(tasks) {
  return tasks.reduce((acc, task) => {
    const key = task.classification || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function buildSpreadsheetXml(reportSummaries, taskRows) {
  const summaryHeader = [
    'Report',
    'Report File',
    'Status',
    'URL',
    'Audience',
    'Scope',
    'Analyzed At',
    'Total Tasks',
    'Average Score',
    'Top Tasks',
    'Secondary Tasks',
    'Tiny Tasks',
    'Unknown Tasks'
  ];

  const taskHeader = [
    'Report',
    'Report File',
    'Status',
    'Task Rank in Report',
    'Task ID',
    'Task Statement',
    'Classification',
    'Composite Score',
    'Rationale',
    'Report URL',
    'Audience',
    'Scope',
    'Analyzed At'
  ];

  const makeCell = (value, type = 'String') => `<Cell><Data ss:Type="${type}">${escapeXml(value)}</Data></Cell>`;
  const makeRow = (cells) => `<Row>${cells.join('')}</Row>`;

  const summaryRows = reportSummaries.map((summary) => makeRow([
    makeCell(summary.title),
    makeCell(summary.file),
    makeCell(reportStatus(summary)),
    makeCell(summary.data.meta?.url || 'n/a'),
    makeCell(summary.data.meta?.audience || 'n/a'),
    makeCell(summary.data.meta?.scope || 'n/a'),
    makeCell(summary.data.meta?.analyzed_at || 'n/a'),
    makeCell(summary.totalTasks, 'Number'),
    makeCell(Number(summary.avgScore.toFixed(4)), 'Number'),
    makeCell(summary.topTasks, 'Number'),
    makeCell(summary.secondaryTasks, 'Number'),
    makeCell(summary.tinyTasks, 'Number'),
    makeCell(summary.unknownTasks, 'Number')
  ])).join('');

  const detailRows = taskRows.map((task) => makeRow([
    makeCell(task.reportTitle),
    makeCell(task.reportFile),
    makeCell(task.reportStatus),
    makeCell(task.rank, 'Number'),
    makeCell(task.id),
    makeCell(task.taskStatement),
    makeCell(task.classification),
    makeCell(Number(task.compositeScore.toFixed(4)), 'Number'),
    makeCell(task.rationale),
    makeCell(task.url),
    makeCell(task.audience),
    makeCell(task.scope),
    makeCell(task.analyzedAt)
  ])).join('');

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Report Summary">
    <Table>
      ${makeRow(summaryHeader.map((header) => makeCell(header)))}
      ${summaryRows}
    </Table>
  </Worksheet>
  <Worksheet ss:Name="Task Inventory">
    <Table>
      ${makeRow(taskHeader.map((header) => makeCell(header)))}
      ${detailRows}
    </Table>
  </Worksheet>
</Workbook>`;
}

function buildPortfolioSpreadsheet() {
  const summaries = reports.map(summarizeReport)
    .sort((a, b) => b.avgScore - a.avgScore);

  const taskRows = summaries.flatMap((summary) => {
    const sortedTasks = [...(summary.data.task_longlist || [])].sort((a, b) => b.composite_score - a.composite_score);
    return sortedTasks.map((task, index) => ({
      reportTitle: summary.title,
      reportFile: summary.file,
      reportStatus: reportStatus(summary),
      rank: index + 1,
      id: task.id || 'n/a',
      taskStatement: task.task_statement || 'n/a',
      classification: task.classification || 'unknown',
      compositeScore: Number.isFinite(task.composite_score) ? task.composite_score : 0,
      rationale: task.rationale || '',
      url: summary.data.meta?.url || 'n/a',
      audience: summary.data.meta?.audience || 'n/a',
      scope: summary.data.meta?.scope || 'n/a',
      analyzedAt: summary.data.meta?.analyzed_at || 'n/a'
    }));
  });

  return buildSpreadsheetXml(summaries, taskRows);
}

function toMarkdown(report) {
  const { file, data } = report;
  const lines = [
    `# Top Task Report: ${titleFromFile(file)}`,
    '',
    `- URL: ${data.meta?.url || 'n/a'}`,
    `- Audience: ${data.meta?.audience || 'n/a'}`,
    `- Report status: ${data.meta?.report_status || 'Unreviewed'}`,
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

if (promptForm) {
  promptForm.addEventListener('input', updatePromptOutput);
  updatePromptOutput();
}

if (copyPromptButton) {
  copyPromptButton.addEventListener('click', copyPromptToClipboard);
}

loadReports().catch((error) => {
  if (reportView) {
    reportView.innerHTML = `<p>Failed to load reports: ${error.message}</p>`;
  }
  if (overviewStats) {
    overviewStats.innerHTML = `<p>Failed to load reports: ${error.message}</p>`;
  }
});

if (downloadSpreadsheetButton) {
  downloadSpreadsheetButton.addEventListener('click', () => {
    if (!reports.length) return;
    const today = new Date().toISOString().slice(0, 10);
    const blob = new Blob([buildPortfolioSpreadsheet()], { type: 'application/xml;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `top-task-portfolio-${today}.xml`;
    link.click();
    URL.revokeObjectURL(link.href);
  });
}
