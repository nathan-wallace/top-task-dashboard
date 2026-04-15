const reportList = document.querySelector('#report-list');
const reportSearch = document.querySelector('#report-search');
const reportView = document.querySelector('#report-view');
const downloadButton = document.querySelector('#download-pdf');
const downloadReportWorkbookButton = document.querySelector('#download-report-workbook');
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
    <p>${data.summary || 'No summary available for this report.'}</p>
    <div class="report-meta-card card">
      <dl class="report-meta-list">
        <div class="report-meta-item">
          <dt>URL</dt>
          <dd><a href="${data.meta.url}" target="_blank" rel="noreferrer">${data.meta.url}</a></dd>
        </div>
        <div class="report-meta-item">
          <dt>Audience</dt>
          <dd>${data.meta.audience || 'n/a'}</dd>
        </div>
        <div class="report-meta-item">
          <dt>Scope</dt>
          <dd>${data.meta.scope || 'n/a'}</dd>
        </div>
        <div class="report-meta-item">
          <dt>Analyzed</dt>
          <dd>${data.meta.analyzed_at || 'n/a'}</dd>
        </div>
        <div class="report-meta-item">
          <dt>Status</dt>
          <dd>${reportStatus(selectedReport)}</dd>
        </div>
      </dl>
    </div>

    <h3>Score overview</h3>
    <div class="stat-grid">${bars}</div>

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

function toWorkbookCell(value) {
  const safe = String(value ?? '');
  return safe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toWorkbookRow(cells) {
  return `<Row>${cells.map((cell) => `<Cell><Data ss:Type="String">${toWorkbookCell(cell)}</Data></Cell>`).join('')}</Row>`;
}

function buildSingleReportWorkbook(report) {
  const { data, title } = report;
  const meta = data.meta || {};
  const allTasks = [...(data.task_longlist || [])].sort((a, b) => b.composite_score - a.composite_score);
  const topTasks = allTasks.filter((task) => task.classification === 'top');
  const nowIso = new Date().toISOString();

  const toolExplanationRows = [
    ['Top Task Dashboard Report Workbook'],
    [''],
    ['Purpose', 'Provide a professional export of one report for stakeholders and archival.'],
    ['Report', title],
    ['Source JSON', report.file],
    ['Generated At (UTC)', nowIso],
    [''],
    ['What this workbook contains'],
    ['Sheet 1: Tool Explanation', 'Overview of the export and intended use.'],
    ['Sheet 2: Prompt & Methodology', 'Prompt framing, research method, and scoring model used.'],
    ['Sheet 3: Test Metadata', 'Report metadata, confidence, evidence gaps, and aggregate counts.'],
    ['Sheet 4: Top Tasks', 'Ranked top-classified tasks with scores, evidence, and rationale.']
  ];

  const promptMethodologyRows = [
    ['Prompt & Methodology'],
    [''],
    ['Analysis Prompt'],
    ['Use the Top Task Research Prompt to analyze the selected URL, audience, and scope.'],
    ['The model inventories the site, infers user intent, creates a deduplicated longlist, scores tasks, and prioritizes Top vs Tiny tasks.'],
    [''],
    ['Methodology Steps'],
    ['1. Fetch and inventory navigation, CTAs, and page types.'],
    ['2. Infer user intents from observed on-site evidence.'],
    ['3. Generate a task longlist in user voice.'],
    ['4. Deduplicate overlapping tasks and normalize wording.'],
    ['5. Score each task: Frequency, Impact, Findability, Completability (1-5).'],
    ['6. Rank and classify tasks as top, secondary, or tiny.'],
    ['7. Recommend a user voting survey for validation.'],
    [''],
    ['Scoring Notes'],
    ['Composite score reflects the combined scoring dimensions and supports rank ordering.'],
    ['Evidence gaps should reduce confidence and be validated through additional research.']
  ];

  const byClass = classifyCounts(allTasks);
  const testMetadataRows = [
    ['Test Metadata'],
    [''],
    ['Report Status', reportStatus(report)],
    ['URL', meta.url || 'n/a'],
    ['Audience', meta.audience || 'n/a'],
    ['Scope', meta.scope || 'n/a'],
    ['Analyzed At', meta.analyzed_at || 'n/a'],
    ['Analyst Confidence', meta.analyst_confidence || 'n/a'],
    ['Evidence Gaps', toJoinedList(meta.evidence_gaps) || 'None noted'],
    ['Summary', data.summary || ''],
    [''],
    ['Total Tasks', String(allTasks.length)],
    ['Top Tasks', String(byClass.top || 0)],
    ['Secondary Tasks', String(byClass.secondary || 0)],
    ['Tiny Tasks', String(byClass.tiny || 0)],
    ['Unknown Tasks', String(byClass.unknown || 0)],
    ['Recommended Survey Instructions', data.recommended_survey?.instructions || ''],
    ['Recommended Survey Sample Size', data.recommended_survey?.recommended_sample_size ?? ''],
    ['Recommended Survey Target Segments', toJoinedList(data.recommended_survey?.target_segments) || '']
  ];

  const topTaskHeader = [
    'Rank',
    'Task ID',
    'Task Statement',
    'User Intent Category',
    'Classification',
    'Composite Score',
    'Frequency',
    'Impact',
    'Findability',
    'Completability',
    'Evidence Source URLs',
    'Evidence Details (JSON)',
    'Rationale'
  ];
  const topTaskRows = topTasks.length
    ? topTasks.map((task, index) => [
      String(index + 1),
      task.id || 'n/a',
      task.task_statement || 'n/a',
      task.user_intent_category || '',
      task.classification || 'top',
      Number.isFinite(task.composite_score) ? task.composite_score.toFixed(2) : '',
      task.scores?.frequency ?? '',
      task.scores?.impact ?? '',
      task.scores?.findability ?? '',
      task.scores?.completability ?? '',
      toJoinedList((task.evidence || []).map((item) => item.source_url).filter(Boolean)),
      task.evidence?.length ? JSON.stringify(task.evidence) : '',
      task.rationale || ''
    ])
    : [['', '', 'No tasks are currently classified as top.', '', '', '', '', '', '', '', '', '', '']];

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Tool Explanation">
  <Table>
   ${toolExplanationRows.map((row, index) => (index === 0
    ? `<Row><Cell ss:StyleID="Header"><Data ss:Type="String">${toWorkbookCell(row[0])}</Data></Cell></Row>`
    : toWorkbookRow(row))).join('')}
  </Table>
 </Worksheet>
 <Worksheet ss:Name="Prompt &amp; Methodology">
  <Table>
   ${promptMethodologyRows.map((row, index) => (index === 0
    ? `<Row><Cell ss:StyleID="Header"><Data ss:Type="String">${toWorkbookCell(row[0])}</Data></Cell></Row>`
    : toWorkbookRow(row))).join('')}
  </Table>
 </Worksheet>
 <Worksheet ss:Name="Test Metadata">
  <Table>
   ${testMetadataRows.map((row, index) => (index === 0
    ? `<Row><Cell ss:StyleID="Header"><Data ss:Type="String">${toWorkbookCell(row[0])}</Data></Cell></Row>`
    : toWorkbookRow(row))).join('')}
  </Table>
 </Worksheet>
 <Worksheet ss:Name="Top Tasks">
  <Table>
   <Row>${topTaskHeader.map((header) => `<Cell ss:StyleID="Header"><Data ss:Type="String">${toWorkbookCell(header)}</Data></Cell>`).join('')}</Row>
   ${topTaskRows.map((row) => toWorkbookRow(row)).join('')}
  </Table>
 </Worksheet>
</Workbook>`;
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

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTimestamp(value) {
  if (!value) return 'n/a';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function buildReportPdfHtml(report) {
  const { file, data } = report;
  const tasks = [...(data.task_longlist || [])].sort((a, b) => b.composite_score - a.composite_score);
  const topTaskSet = new Set(data.top_tasks || []);
  const tinyTaskSet = new Set(data.tiny_tasks || []);
  const byClass = classifyCounts(tasks);
  const averageScore = tasks.length
    ? tasks.reduce((sum, task) => sum + (task.composite_score || 0), 0) / tasks.length
    : 0;

  const taskRows = tasks.map((task, index) => {
    const evidenceText = (task.evidence || [])
      .map((item) => `${item.source_url || 'n/a'} — ${item.element || 'n/a'} (${item.note || 'No note'})`)
      .join('\n');

    return `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(task.id || '')}</td>
        <td>${escapeHtml(task.task_statement || '')}</td>
        <td>${escapeHtml(task.user_intent_category || '')}</td>
        <td>${escapeHtml(task.classification || 'unknown')}</td>
        <td>${task.scores?.frequency ?? ''}</td>
        <td>${task.scores?.impact ?? ''}</td>
        <td>${task.scores?.findability ?? ''}</td>
        <td>${task.scores?.completability ?? ''}</td>
        <td>${round(task.composite_score)}</td>
        <td>${escapeHtml(task.rationale || '')}</td>
        <td class="evidence-cell">${escapeHtml(evidenceText)}</td>
      </tr>
    `;
  }).join('');

  const noTasksRow = `
    <tr>
      <td colspan="12">No tasks available for this report.</td>
    </tr>
  `;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Top Task Report: ${escapeHtml(titleFromFile(file))}</title>
    <style>
      :root {
        --text: #14213d;
        --muted: #4b5563;
        --border: #d1d5db;
        --background: #f8fafc;
        --accent: #1d4ed8;
      }
      * { box-sizing: border-box; }
      body {
        font-family: "Inter", "Segoe UI", Arial, sans-serif;
        color: var(--text);
        line-height: 1.35;
        margin: 0;
        padding: 28px;
        background: #fff;
      }
      h1, h2, h3 { margin: 0 0 8px; }
      h1 { font-size: 24px; }
      h2 {
        margin-top: 22px;
        font-size: 17px;
        border-bottom: 2px solid var(--border);
        padding-bottom: 4px;
      }
      p, li { font-size: 12px; }
      .subtle { color: var(--muted); font-size: 11px; }
      .meta-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        margin-top: 14px;
      }
      .card {
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--background);
        padding: 10px 12px;
      }
      .card strong {
        display: block;
        margin-bottom: 2px;
        font-size: 11px;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
        margin-top: 10px;
      }
      .kpi-value {
        font-size: 20px;
        font-weight: 700;
        color: var(--accent);
      }
      .list {
        margin: 6px 0 0;
        padding-left: 18px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }
      th, td {
        border: 1px solid var(--border);
        padding: 6px;
        font-size: 10px;
        vertical-align: top;
        word-break: break-word;
      }
      th {
        background: #eff6ff;
        text-align: left;
      }
      .evidence-cell {
        white-space: pre-wrap;
      }
      @media print {
        @page {
          size: A4 landscape;
          margin: 10mm;
        }
        body {
          padding: 0;
        }
      }
    </style>
  </head>
  <body>
    <header>
      <h1>Top Task Research Report</h1>
      <p class="subtle">Generated from dashboard export • ${escapeHtml(file)}</p>
    </header>

    <section>
      <div class="meta-grid">
        <div class="card"><strong>Report Title</strong>${escapeHtml(titleFromFile(file))}</div>
        <div class="card"><strong>Report Status</strong>${escapeHtml(data.meta?.report_status || 'Unreviewed')}</div>
        <div class="card"><strong>URL</strong>${escapeHtml(data.meta?.url || 'n/a')}</div>
        <div class="card"><strong>Audience</strong>${escapeHtml(data.meta?.audience || 'n/a')}</div>
        <div class="card"><strong>Scope</strong>${escapeHtml(data.meta?.scope || 'n/a')}</div>
        <div class="card"><strong>Analyzed At</strong>${escapeHtml(formatTimestamp(data.meta?.analyzed_at))}</div>
        <div class="card"><strong>Analyst Confidence</strong>${escapeHtml(data.meta?.analyst_confidence || 'n/a')}</div>
        <div class="card"><strong>Generated At</strong>${escapeHtml(formatTimestamp(new Date().toISOString()))}</div>
      </div>
    </section>

    <section>
      <h2>Executive Summary</h2>
      <p>${escapeHtml(data.summary || 'No summary available.')}</p>
    </section>

    <section>
      <h2>Task Portfolio Metrics</h2>
      <div class="kpi-grid">
        <div class="card"><strong>Total Tasks</strong><div class="kpi-value">${tasks.length}</div></div>
        <div class="card"><strong>Avg Composite</strong><div class="kpi-value">${round(averageScore)}</div></div>
        <div class="card"><strong>Top Tasks</strong><div class="kpi-value">${byClass.top || 0}</div></div>
        <div class="card"><strong>Tiny Tasks</strong><div class="kpi-value">${byClass.tiny || 0}</div></div>
      </div>
      <div class="meta-grid">
        <div class="card"><strong>Top Task IDs</strong>${escapeHtml((data.top_tasks || []).join(', ') || 'n/a')}</div>
        <div class="card"><strong>Tiny Task IDs</strong>${escapeHtml((data.tiny_tasks || []).join(', ') || 'n/a')}</div>
      </div>
    </section>

    <section>
      <h2>Recommended Validation Survey</h2>
      <div class="meta-grid">
        <div class="card"><strong>Instructions</strong>${escapeHtml(data.recommended_survey?.instructions || 'n/a')}</div>
        <div class="card"><strong>Recommended Sample Size</strong>${escapeHtml(data.recommended_survey?.recommended_sample_size ?? 'n/a')}</div>
        <div class="card"><strong>Task List for Voting</strong>${escapeHtml((data.recommended_survey?.task_list_for_voting || []).join(', ') || 'n/a')}</div>
        <div class="card"><strong>Target Segments</strong>${escapeHtml((data.recommended_survey?.target_segments || []).join(', ') || 'n/a')}</div>
      </div>
    </section>

    <section>
      <h2>Next Steps</h2>
      <ul class="list">
        ${(data.next_steps || []).map((step) => `<li>${escapeHtml(step)}</li>`).join('') || '<li>No next steps provided.</li>'}
      </ul>
    </section>

    <section>
      <h2>Detailed Task Register</h2>
      <p class="subtle">
        Tasks flagged as top in report metadata: ${topTaskSet.size}. Tasks flagged as tiny in report metadata: ${tinyTaskSet.size}.
      </p>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>ID</th>
            <th>Task Statement</th>
            <th>Intent</th>
            <th>Class</th>
            <th>Freq</th>
            <th>Impact</th>
            <th>Findability</th>
            <th>Completability</th>
            <th>Composite</th>
            <th>Rationale</th>
            <th>Evidence</th>
          </tr>
        </thead>
        <tbody>
          ${taskRows || noTasksRow}
        </tbody>
      </table>
    </section>
  </body>
</html>`;
}

function downloadPdfReport(report) {
  const pdfWindow = window.open('', '_blank', 'noopener,noreferrer');
  if (!pdfWindow) {
    window.alert('Unable to open PDF preview. Please allow pop-ups for this site.');
    return;
  }

  pdfWindow.document.open();
  pdfWindow.document.write(buildReportPdfHtml(report));
  pdfWindow.document.close();
  pdfWindow.focus();
  pdfWindow.print();
}

if (downloadButton) {
  downloadButton.addEventListener('click', () => {
    if (!selectedReport) return;
    downloadPdfReport(selectedReport);
  });
}

if (downloadReportWorkbookButton) {
  downloadReportWorkbookButton.addEventListener('click', () => {
    if (!selectedReport) return;
    const workbook = buildSingleReportWorkbook(selectedReport);
    const blob = new Blob([workbook], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${selectedReport.file.replace('.json', '')}-report-workbook.xls`;
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
