const reportList = document.querySelector('#report-list');
const reportSearch = document.querySelector('#report-search');
const reportView = document.querySelector('#report-view');
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
let selectedClassification = 'all';

const reportsBase = document.body?.dataset?.reportsBase || './reports';

const titleFromFile = (name) => name.replace('.json', '').replace(/[-_]/g, ' ');
const round = (value) => Number.isFinite(value) ? value.toFixed(2) : '0.00';
const reportStatus = (report) => report?.data?.meta?.report_status || 'Unreviewed';

function buildPrompt(values) {
  const tokens = {
    url: values.url?.trim() || '<string>',
    audience: values.audience?.trim() || '<string>',
    scope: values.scope?.trim() || '<string>',
    business_context: values.business_context?.trim() || '<string>',
    existing_data: values.existing_data?.trim() || '<string>',
    constraints: values.constraints?.trim() || '<string>',
    max_tasks: values.max_tasks?.trim() || '25'
  };

  return `# Top Task Research Prompt

A repeatable prompt for conducting Top Task Identification analysis (Gerry McGovern methodology) on any URL. Paste into LLM and fill in the structured input block.

---

## Role
You are a UX researcher conducting Top Task Identification analysis for a website. Your job is to identify the small number of tasks that matter most to users, separate them from the "tiny tasks" that clutter most sites, and produce a prioritized, evidence-backed list.

## Structured Input
\`\`\`yaml
url: ${tokens.url}                          # Required. Full URL of site/section to analyze
audience: ${tokens.audience}                # Required. Primary user group (e.g., "small business owners applying for SBA loans")
scope: ${tokens.scope}                      # Required. "entire site" | "section: /path" | "specific journey: X"
business_context: ${tokens.business_context} # Optional. Org mission, known pain points, stakeholder goals
existing_data: ${tokens.existing_data}      # Optional. Analytics, search logs, support tickets, prior research
constraints: ${tokens.constraints}          # Optional. Compliance (e.g., Section 508, USWDS), tech stack, timeline
max_tasks: ${tokens.max_tasks}              # Optional. Default 25. Target longlist size before voting
\`\`\`

## Process
1. **Fetch and inventory** the URL. Catalog navigation, page types, CTAs, forms, and content themes.
2. **Infer user intents** from visible content, metadata, and the stated audience. Do not invent tasks the site does not support or imply.
3. **Generate a task longlist** of short, customer-voice statements (5–9 words each, verb-led, jargon-free, non-overlapping). Example: "Find out if I qualify for a loan."
4. **Deduplicate and normalize** — merge near-duplicates, split compound tasks, flag ambiguous ones.
5. **Score each task** on the dimensions below using evidence from the page (cite specific URLs/elements).
6. **Rank** into Top Tasks (critical few) and Tiny Tasks (trivial many).
7. **Recommend** a voting survey design for validation with real users.

## Scoring Dimensions (1–5 scale)
- **Frequency** — how often the audience likely needs this
- **Impact** — consequence of failure to the user
- **Findability** — how easy it is to locate on the current site
- **Completability** — whether the user can actually finish it end-to-end

## Structured Output
Return valid JSON matching this schema.

\`\`\`json
{
  "meta": {
    "url": "",
    "audience": "",
    "scope": "",
    "analyzed_at": "",
    "analyst_confidence": "low|medium|high",
    "evidence_gaps": [],
    "report_status": "Unreviewed|Reviewed|Approved"
  },
  "task_longlist": [
    {
      "id": "T01",
      "task_statement": "",
      "user_intent_category": "",
      "evidence": [{"source_url": "", "element": "", "note": ""}],
      "scores": {"frequency": 0, "impact": 0, "findability": 0, "completability": 0},
      "composite_score": 0.0,
      "classification": "top|secondary|tiny",
      "rationale": ""
    }
  ],
  "top_tasks": ["T01", "T05"],
  "tiny_tasks": ["T12", "T18"],
  "recommended_survey": {
    "instructions": "",
    "task_list_for_voting": [],
    "recommended_sample_size": 0,
    "target_segments": []
  },
  "next_steps": [],
  "summary": ""
}
\`\`\`

Set \`summary\` to ≤150 words covering top 3–5 tasks, key risks, and what to validate with users next.

## Rules
- Write tasks in the user's voice, not the org's. "Apply for benefits," not "Benefits application portal."
- No task longer than 9 words.
- Every score must cite evidence; if evidence is missing, mark it in \`evidence_gaps\` and lower \`analyst_confidence\`.
- If the URL cannot be fetched or scope is unclear, return an \`error\` object with \`missing_inputs\` instead of guessing.
- Deterministic: same inputs should yield substantively the same longlist and rankings.`;
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

function textMatchesQuery(value, query) {
  if (!query) return true;
  return String(value ?? '').toLowerCase().includes(query);
}

function renderReportList() {
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
  const filter = selectedClassification;
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
        <td>${round(task.composite_score)}</td>
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

    <div class="tasks-header">
      <h3>Tasks (${tasks.length}${filter === 'all' ? '' : ` filtered: ${filter}`})</h3>
      <label class="tasks-filter-label" for="classification-filter">
        Classification
        <select id="classification-filter" aria-label="Filter tasks by classification">
          <option value="all" ${filter === 'all' ? 'selected' : ''}>All</option>
          <option value="top" ${filter === 'top' ? 'selected' : ''}>Top</option>
          <option value="secondary" ${filter === 'secondary' ? 'selected' : ''}>Secondary</option>
          <option value="tiny" ${filter === 'tiny' ? 'selected' : ''}>Tiny</option>
        </select>
      </label>
    </div>
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


function classifyCounts(tasks) {
  return tasks.reduce((acc, task) => {
    const key = task.classification || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function toCsvCell(value) {
  const safe = String(value ?? '');
  return `"${safe.replace(/"/g, '""')}"`;
}

function toJoinedList(items) {
  if (!Array.isArray(items) || !items.length) return '';
  return items.join(' | ');
}

function buildPortfolioCsv() {
  const summaries = reports.map(summarizeReport)
    .sort((a, b) => b.avgScore - a.avgScore);
  const summaryByFile = new Map(summaries.map((summary) => [summary.file, summary]));

  const csvHeader = [
    'Report',
    'Report File',
    'Status',
    'Report URL',
    'Audience',
    'Scope',
    'Analyzed At',
    'Analyst Confidence',
    'Evidence Gaps',
    'Report Summary',
    'Top Task IDs',
    'Tiny Task IDs',
    'Next Steps',
    'Survey Instructions',
    'Survey Task List For Voting',
    'Survey Recommended Sample Size',
    'Survey Target Segments',
    'Total Tasks (Report)',
    'Average Score (Report)',
    'Top Tasks (Report)',
    'Secondary Tasks (Report)',
    'Tiny Tasks (Report)',
    'Unknown Tasks (Report)',
    'Task Rank in Report',
    'Task ID',
    'Task Statement',
    'Task User Intent Category',
    'Classification',
    'Score Frequency',
    'Score Impact',
    'Score Findability',
    'Score Completability',
    'Composite Score',
    'Evidence Source URLs',
    'Evidence Details (JSON)',
    'Rationale'
  ];

  const taskRows = summaries.flatMap((summary) => {
    const sortedTasks = [...(summary.data.task_longlist || [])].sort((a, b) => b.composite_score - a.composite_score);
    const reportMeta = summary.data.meta || {};
    const reportLevelFields = {
      url: reportMeta.url || 'n/a',
      audience: reportMeta.audience || 'n/a',
      scope: reportMeta.scope || 'n/a',
      analyzedAt: reportMeta.analyzed_at || 'n/a',
      analystConfidence: reportMeta.analyst_confidence || 'n/a',
      evidenceGaps: toJoinedList(reportMeta.evidence_gaps),
      reportSummary: summary.data.summary || '',
      topTaskIds: toJoinedList(summary.data.top_tasks),
      tinyTaskIds: toJoinedList(summary.data.tiny_tasks),
      nextSteps: toJoinedList(summary.data.next_steps),
      surveyInstructions: summary.data.recommended_survey?.instructions || '',
      surveyTaskList: toJoinedList(summary.data.recommended_survey?.task_list_for_voting),
      surveySampleSize: summary.data.recommended_survey?.recommended_sample_size ?? '',
      surveyTargetSegments: toJoinedList(summary.data.recommended_survey?.target_segments)
    };

    if (!sortedTasks.length) {
      return [{
        reportTitle: summary.title,
        reportFile: summary.file,
        reportStatus: reportStatus(summary),
        rank: '',
        id: '',
        taskStatement: '',
        userIntentCategory: '',
        classification: '',
        scoreFrequency: '',
        scoreImpact: '',
        scoreFindability: '',
        scoreCompletability: '',
        compositeScore: '',
        evidenceSourceUrls: '',
        evidenceDetails: '',
        rationale: '',
        ...reportLevelFields
      }];
    }

    return sortedTasks.map((task, index) => ({
      reportTitle: summary.title,
      reportFile: summary.file,
      reportStatus: reportStatus(summary),
      rank: index + 1,
      id: task.id || 'n/a',
      taskStatement: task.task_statement || 'n/a',
      userIntentCategory: task.user_intent_category || '',
      classification: task.classification || 'unknown',
      scoreFrequency: task.scores?.frequency ?? '',
      scoreImpact: task.scores?.impact ?? '',
      scoreFindability: task.scores?.findability ?? '',
      scoreCompletability: task.scores?.completability ?? '',
      compositeScore: Number.isFinite(task.composite_score) ? task.composite_score : '',
      evidenceSourceUrls: toJoinedList((task.evidence || []).map((item) => item.source_url).filter(Boolean)),
      evidenceDetails: task.evidence?.length ? JSON.stringify(task.evidence) : '',
      rationale: task.rationale || '',
      ...reportLevelFields
    }));
  });

  const csvRows = [
    csvHeader.map(toCsvCell).join(','),
    ...taskRows.map((task) => [
      task.reportTitle,
      task.reportFile,
      task.reportStatus,
      task.url,
      task.audience,
      task.scope,
      task.analyzedAt,
      task.analystConfidence,
      task.evidenceGaps,
      task.reportSummary,
      task.topTaskIds,
      task.tinyTaskIds,
      task.nextSteps,
      task.surveyInstructions,
      task.surveyTaskList,
      task.surveySampleSize,
      task.surveyTargetSegments,
      summaryByFile.get(task.reportFile)?.totalTasks ?? 0,
      round(summaryByFile.get(task.reportFile)?.avgScore ?? 0),
      summaryByFile.get(task.reportFile)?.topTasks ?? 0,
      summaryByFile.get(task.reportFile)?.secondaryTasks ?? 0,
      summaryByFile.get(task.reportFile)?.tinyTasks ?? 0,
      summaryByFile.get(task.reportFile)?.unknownTasks ?? 0,
      task.rank,
      task.id,
      task.taskStatement,
      task.userIntentCategory,
      task.classification,
      task.scoreFrequency,
      task.scoreImpact,
      task.scoreFindability,
      task.scoreCompletability,
      Number.isFinite(task.compositeScore) ? task.compositeScore.toFixed(2) : '',
      task.evidenceSourceUrls,
      task.evidenceDetails,
      task.rationale
    ].map(toCsvCell).join(','))
  ];

  return `\uFEFF${csvRows.join('\n')}`;
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
      `| ${task.id} | ${task.task_statement} | ${task.classification} | ${round(task.composite_score)} |`),
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

if (reportView) {
  reportView.addEventListener('change', (event) => {
    if (event.target?.id !== 'classification-filter') return;
    selectedClassification = event.target.value || 'all';
    renderReport();
  });
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
    const blob = new Blob([buildPortfolioCsv()], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `top-task-portfolio-${today}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  });
}
