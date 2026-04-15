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
const reportsLayout = document.querySelector('#reports-layout');
const reportPanel = document.querySelector('#report-panel');
const reportPanelContent = document.querySelector('#report-panel-content');
const toggleReportPanelButton = document.querySelector('#toggle-report-panel');

const REPORT_PANEL_STORAGE_KEY = 'top-task-dashboard.report-panel-collapsed';

let reports = [];
let reportLoadFailures = [];
let selectedReport = null;
let selectedClassification = 'all';

const reportsBase = document.body?.dataset?.reportsBase || './reports';
const forcedReportFile = document.body?.dataset?.reportFile || '';

const titleFromFile = (name) => name.replace('.json', '').replace(/[-_]/g, ' ');
const round = (value) => Number.isFinite(value) ? value.toFixed(2) : '0.00';
const reportStatus = (report) => report?.data?.meta?.report_status || 'Unreviewed';
const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');
const classificationDefinitions = {
  top: 'Top tasks are the critical few user goals that matter most and should be easiest to find and complete.',
  secondary: 'Secondary tasks are still important, but they support the top tasks and should not dominate the primary experience.',
  tiny: 'Tiny tasks are low-frequency, low-impact needs that can add clutter if treated like primary navigation priorities.'
};

function buildClassificationLabelTemplate(classification) {
  const normalized = (classification || '').toLowerCase();
  const label = normalized ? `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}` : 'Unknown';
  const description = classificationDefinitions[normalized];

  if (!description) return label;
  const tooltipId = `classification-tooltip-${normalized.replace(/[^a-z0-9_-]/g, '-') || 'unknown'}`;
  const safeLabel = escapeHtml(label);

  return `
    <span class="tooltip-label">
      ${safeLabel}
      <button
        class="info-tooltip"
        type="button"
        aria-label="What ${safeLabel} means in Top Task Analysis"
        aria-describedby="${tooltipId}"
      >
        i
      </button>
      <span id="${tooltipId}" class="tooltip-content" role="tooltip">
        In Top Task Analysis (developed by Gerry McGovern), ${description}
      </span>
    </span>
  `;
}

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

function setReportPanelCollapsed(collapsed) {
  if (!reportsLayout || !toggleReportPanelButton) return;

  reportsLayout.classList.toggle('sidebar-collapsed', collapsed);
  reportPanel?.setAttribute('aria-expanded', String(!collapsed));
  reportPanelContent?.setAttribute('aria-hidden', String(collapsed));
  toggleReportPanelButton.setAttribute('aria-expanded', String(!collapsed));
  toggleReportPanelButton.setAttribute('aria-label', collapsed ? 'Expand reports panel' : 'Collapse reports panel');
  toggleReportPanelButton.title = collapsed ? 'Expand reports panel' : 'Collapse reports panel';

  const icon = toggleReportPanelButton.querySelector('.panel-toggle-icon');
  const text = toggleReportPanelButton.querySelector('.panel-toggle-text');
  if (icon) icon.textContent = collapsed ? '→' : '←';
  if (text) text.textContent = collapsed ? 'Expand' : 'Collapse';

  localStorage.setItem(REPORT_PANEL_STORAGE_KEY, collapsed ? 'true' : 'false');
}

function initReportPanelToggle() {
  if (!reportsLayout || !toggleReportPanelButton) return;

  const stored = localStorage.getItem(REPORT_PANEL_STORAGE_KEY);
  const startsCollapsed = stored === 'true' && window.matchMedia('(min-width: 901px)').matches;
  setReportPanelCollapsed(startsCollapsed);

  toggleReportPanelButton.addEventListener('click', () => {
    const isCollapsed = reportsLayout.classList.contains('sidebar-collapsed');
    setReportPanelCollapsed(!isCollapsed);
  });
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
      title: titleFromFile(entry.file),
      path: entry.path || './'
    };
  });

  if (forcedReportFile && !indexEntries.some((entry) => entry.file === forcedReportFile)) {
    throw new Error(`Report not found in index: ${forcedReportFile}`);
  }

  const settledReports = await Promise.allSettled(indexEntries.map(async (entry) => {
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

  reports = settledReports
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value)
    .sort((a, b) => a.file.localeCompare(b.file));

  reportLoadFailures = settledReports
    .map((result, index) => {
      if (result.status === 'fulfilled') return null;
      const reason = result.reason instanceof Error
        ? result.reason.message
        : String(result.reason || 'Unknown error');
      return { file: indexEntries[index].file, message: reason };
    })
    .filter(Boolean);

  renderReportLoadWarnings();

  if (!reports.length) {
    throw new Error('No valid reports could be loaded.');
  }

  if (reportList) {
    renderReportList();
    if (reports.length > 0) {
      selectReport(forcedReportFile || reports[0].file);
    }
  } else if (reportView && reports.length > 0) {
    selectReport(forcedReportFile || reports[0].file);
  }

  if (overviewStats && overviewTableBody) {
    renderOverviewPage();
  }
}

function renderReportLoadWarnings() {
  const warningHost = reportList?.closest('.panel') || overviewStats?.closest('.panel');
  if (!warningHost) return;

  let warningPanel = document.querySelector('#report-load-warning');
  if (!reportLoadFailures.length) {
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

  warningPanel.innerHTML = '';
  const heading = document.createElement('h3');
  heading.textContent = 'Some reports were skipped';
  const summary = document.createElement('p');
  summary.className = 'subtle';
  summary.textContent = `${reportLoadFailures.length} file(s) could not be loaded. Valid reports are still available below.`;
  const list = document.createElement('ul');
  for (const failure of reportLoadFailures) {
    const item = document.createElement('li');
    item.textContent = `${failure.file}: ${failure.message}`;
    list.append(item);
  }

  warningPanel.append(heading, summary, list);
}

function textMatchesQuery(value, query) {
  if (!query) return true;
  return String(value ?? '').toLowerCase().includes(query);
}

function renderReportList() {
  if (!reportList) return;

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
    btn.addEventListener('click', () => {
      if (forcedReportFile) {
        const reportPath = report.path?.startsWith('./') ? report.path.slice(2) : report.path || '';
        window.location.href = `${reportsBase}/${reportPath}`;
        return;
      }
      selectReport(report.file);
    });
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
  const sortedTasks = [...tasks].sort((a, b) => b.composite_score - a.composite_score);
  const meta = data.meta || {};

  reportView.replaceChildren();

  const heading = document.createElement('h2');
  heading.textContent = selectedReport.title;
  reportView.append(heading);

  const metaCard = document.createElement('div');
  metaCard.className = 'report-meta-card card';
  const metaList = document.createElement('dl');
  metaList.className = 'report-meta-list';
  const metaItems = [
    ['URL', meta.url || 'n/a'],
    ['Audience', meta.audience || 'n/a'],
    ['Scope', meta.scope || 'n/a'],
    ['Analyzed', meta.analyzed_at || 'n/a'],
    ['Status', reportStatus(selectedReport)]
  ];
  for (const [label, value] of metaItems) {
    const item = document.createElement('div');
    item.className = 'report-meta-item';
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    if (label === 'URL' && meta.url) {
      const link = document.createElement('a');
      link.href = meta.url;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.textContent = meta.url;
      dd.append(link);
    } else {
      dd.textContent = value;
    }
    item.append(dt, dd);
    metaList.append(item);
  }
  metaCard.append(metaList);
  reportView.append(metaCard);

  const summaryHeading = document.createElement('h3');
  summaryHeading.textContent = 'Research Summary';
  reportView.append(summaryHeading);

  const summary = document.createElement('p');
  summary.textContent = data.summary || 'No summary available for this report.';
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
    card.append(strong);

    const bar = document.createElement('div');
    bar.className = 'bar';
    const span = document.createElement('span');
    span.style.width = `${(entry.average / 5) * 100}%`;
    bar.append(span);
    card.append(bar);

    const small = document.createElement('small');
    small.textContent = `avg ${entry.average.toFixed(2)} across ${entry.count} tasks`;
    card.append(small);
    statGrid.append(card);
  }
  reportView.append(statGrid);

  const tasksHeader = document.createElement('div');
  tasksHeader.className = 'tasks-header';
  const tasksHeading = document.createElement('h3');
  tasksHeading.textContent = `Tasks (${sortedTasks.length}${filter === 'all' ? '' : ` filtered: ${filter}`})`;
  tasksHeader.append(tasksHeading);

  const label = document.createElement('label');
  label.className = 'tasks-filter-label';
  label.htmlFor = 'classification-filter';
  label.append(document.createTextNode('Classification'));
  const select = document.createElement('select');
  select.id = 'classification-filter';
  select.setAttribute('aria-label', 'Filter tasks by classification');
  const filterOptions = ['all', 'top', 'secondary', 'tiny'];
  for (const optionValue of filterOptions) {
    const option = document.createElement('option');
    option.value = optionValue;
    option.textContent = optionValue === 'all'
      ? 'All'
      : `${optionValue.charAt(0).toUpperCase()}${optionValue.slice(1)}`;
    option.selected = optionValue === filter;
    select.append(option);
  }
  label.append(select);
  tasksHeader.append(label);
  reportView.append(tasksHeader);

  const tableWrap = document.createElement('div');
  tableWrap.className = 'table-wrap';
  const table = document.createElement('table');
  table.className = 'task-table';
  table.innerHTML = `
    <thead>
      <tr><th>ID</th><th>Task</th><th>Class</th><th>Score</th><th>Rationale</th></tr>
    </thead>
  `;
  const tbody = document.createElement('tbody');
  for (const task of sortedTasks) {
    const tr = document.createElement('tr');
    const idCell = document.createElement('td');
    const idStrong = document.createElement('strong');
    idStrong.textContent = task.id || 'n/a';
    idCell.append(idStrong);

    const statementCell = document.createElement('td');
    statementCell.textContent = task.task_statement || '';

    const classCell = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = task.classification || 'unknown';
    classCell.append(badge);

    const scoreCell = document.createElement('td');
    scoreCell.textContent = round(task.composite_score);

    const rationaleCell = document.createElement('td');
    rationaleCell.textContent = task.rationale || '';

    tr.append(idCell, statementCell, classCell, scoreCell, rationaleCell);
    tbody.append(tr);
  }
  table.append(tbody);
  tableWrap.append(table);
  reportView.append(tableWrap);

  const nextStepsHeading = document.createElement('h3');
  nextStepsHeading.textContent = 'Next steps';
  reportView.append(nextStepsHeading);

  const nextStepsList = document.createElement('ul');
  for (const step of (data.next_steps || [])) {
    const item = document.createElement('li');
    item.textContent = step;
    nextStepsList.append(item);
  }
  reportView.append(nextStepsList);
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

  overviewStats.replaceChildren();
  const overviewCards = [
    ['Average Report Score', round(avgScore)],
    ['Top Classified Tasks', topTasks],
    ['Secondary Tasks', secondaryTasks],
    ['Tiny Tasks', tinyTasks]
  ];
  for (const [label, value] of overviewCards) {
    const card = document.createElement('article');
    card.className = 'card stat-card';
    const subtle = document.createElement('p');
    subtle.className = 'subtle';
    subtle.textContent = label;
    const bigNumber = document.createElement('p');
    bigNumber.className = 'big-number';
    bigNumber.textContent = String(value);
    card.append(subtle, bigNumber);
    overviewStats.append(card);
  }

  overviewTableBody.replaceChildren();
  for (const report of summaries.sort((a, b) => b.avgScore - a.avgScore)) {
    const tr = document.createElement('tr');

    const titleCell = document.createElement('td');
    const reportLink = document.createElement('a');
    reportLink.href = report.path.startsWith('./')
      ? `./reports/${report.path.slice(2)}`
      : `./reports/${report.path}`;
    reportLink.textContent = report.title;
    titleCell.append(reportLink);

    const statusCell = document.createElement('td');
    statusCell.textContent = reportStatus(report);

    const audienceCell = document.createElement('td');
    audienceCell.textContent = report.data.meta?.audience || 'n/a';

    const totalTasksCell = document.createElement('td');
    totalTasksCell.textContent = String(report.totalTasks);

    const avgScoreCell = document.createElement('td');
    avgScoreCell.textContent = round(report.avgScore);

    const topTasksCell = document.createElement('td');
    topTasksCell.textContent = String(report.topTasks);

    const secondaryTasksCell = document.createElement('td');
    secondaryTasksCell.textContent = String(report.secondaryTasks);

    const tinyTasksCell = document.createElement('td');
    tinyTasksCell.textContent = String(report.tinyTasks);

    tr.append(
      titleCell,
      statusCell,
      audienceCell,
      totalTasksCell,
      avgScoreCell,
      topTasksCell,
      secondaryTasksCell,
      tinyTasksCell
    );
    overviewTableBody.append(tr);
  }
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
    ['Sheet 3: Overview', 'Report metadata, recommendations, confidence, evidence gaps, and aggregate counts.'],
    ['Sheet 4: Top Tasks', 'All ranked tasks with scores, evidence, and rationale.'],
    ['Sheet 5: Raw JSON', 'Full report payload to ensure complete data transparency.']
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
  const overviewRows = [
    ['Overview'],
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
    ['Recommended Survey Task List For Voting', toJoinedList(data.recommended_survey?.task_list_for_voting) || ''],
    ['Recommended Survey Sample Size', data.recommended_survey?.recommended_sample_size ?? ''],
    ['Recommended Survey Target Segments', toJoinedList(data.recommended_survey?.target_segments) || ''],
    ['Top Task IDs', toJoinedList(data.top_tasks) || ''],
    ['Tiny Task IDs', toJoinedList(data.tiny_tasks) || ''],
    ['Next Steps / Recommendations', toJoinedList(data.next_steps) || '']
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
  const topTaskRows = allTasks.length
    ? allTasks.map((task, index) => [
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
    : [['', '', 'No tasks are available in this report.', '', '', '', '', '', '', '', '', '', '']];

  const rawJsonRows = [
    ['Raw JSON'],
    [''],
    [JSON.stringify(data, null, 2)]
  ];

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
 <Worksheet ss:Name="Overview">
  <Table>
   ${overviewRows.map((row, index) => (index === 0
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
 <Worksheet ss:Name="Raw JSON">
  <Table>
   ${rawJsonRows.map((row, index) => (index === 0
    ? `<Row><Cell ss:StyleID="Header"><Data ss:Type="String">${toWorkbookCell(row[0])}</Data></Cell></Row>`
    : toWorkbookRow(row))).join('')}
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

function formatTimestamp(value) {
  if (!value) return 'n/a';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function escapePdfText(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapText(value, maxChars = 100) {
  const words = String(value ?? '').split(/\s+/).filter(Boolean);
  if (!words.length) return [''];

  const lines = [];
  let current = words[0];
  for (let index = 1; index < words.length; index += 1) {
    const next = `${current} ${words[index]}`;
    if (next.length > maxChars) {
      lines.push(current);
      current = words[index];
    } else {
      current = next;
    }
  }
  lines.push(current);
  return lines;
}

function collectReportPdfLines(report) {
  const { file, data } = report;
  const tasks = [...(data.task_longlist || [])].sort((a, b) => b.composite_score - a.composite_score);
  const byClass = classifyCounts(tasks);
  const averageScore = tasks.length
    ? tasks.reduce((sum, task) => sum + (task.composite_score || 0), 0) / tasks.length
    : 0;
  const lines = [
    { type: 'title', text: `Top Task Research Report — ${titleFromFile(file)}` },
    { type: 'body', text: `Report file: ${file}` },
    { type: 'body', text: `Generated at: ${formatTimestamp(new Date().toISOString())}` },
    { type: 'spacer', text: '' },
    { type: 'heading', text: 'Report Metadata' },
    { type: 'body', text: `Status: ${data.meta?.report_status || 'Unreviewed'}` },
    { type: 'body', text: `URL: ${data.meta?.url || 'n/a'}` },
    { type: 'body', text: `Audience: ${data.meta?.audience || 'n/a'}` },
    { type: 'body', text: `Scope: ${data.meta?.scope || 'n/a'}` },
    { type: 'body', text: `Analyzed At: ${formatTimestamp(data.meta?.analyzed_at)}` },
    { type: 'body', text: `Analyst Confidence: ${data.meta?.analyst_confidence || 'n/a'}` },
    { type: 'body', text: `Evidence Gaps: ${(data.meta?.evidence_gaps || []).join('; ') || 'None listed'}` },
    { type: 'spacer', text: '' },
    { type: 'heading', text: 'Executive Summary' },
    ...wrapText(data.summary || 'No summary available.', 120).map((text) => ({ type: 'body', text })),
    { type: 'spacer', text: '' },
    { type: 'heading', text: 'Portfolio Metrics' },
    { type: 'body', text: `Total Tasks: ${tasks.length}` },
    { type: 'body', text: `Average Composite Score: ${round(averageScore)}` },
    { type: 'body', text: `Top: ${byClass.top || 0} | Secondary: ${byClass.secondary || 0} | Tiny: ${byClass.tiny || 0} | Unknown: ${byClass.unknown || 0}` },
    { type: 'body', text: `Top Task IDs: ${(data.top_tasks || []).join(', ') || 'n/a'}` },
    { type: 'body', text: `Tiny Task IDs: ${(data.tiny_tasks || []).join(', ') || 'n/a'}` },
    { type: 'spacer', text: '' },
    { type: 'heading', text: 'Recommended Validation Survey' },
    ...wrapText(`Instructions: ${data.recommended_survey?.instructions || 'n/a'}`, 120).map((text) => ({ type: 'body', text })),
    ...wrapText(`Task List for Voting: ${(data.recommended_survey?.task_list_for_voting || []).join(', ') || 'n/a'}`, 120).map((text) => ({ type: 'body', text })),
    { type: 'body', text: `Recommended Sample Size: ${data.recommended_survey?.recommended_sample_size ?? 'n/a'}` },
    ...wrapText(`Target Segments: ${(data.recommended_survey?.target_segments || []).join(', ') || 'n/a'}`, 120).map((text) => ({ type: 'body', text })),
    { type: 'spacer', text: '' },
    { type: 'heading', text: 'Next Steps' },
    ...((data.next_steps || []).length
      ? data.next_steps.flatMap((step, index) =>
        wrapText(`${index + 1}. ${step}`, 120).map((text) => ({ type: 'body', text })))
      : [{ type: 'body', text: 'No next steps provided.' }]),
    { type: 'spacer', text: '' },
    { type: 'heading', text: 'Detailed Task Register' }
  ];

  if (!tasks.length) {
    lines.push({ type: 'body', text: 'No tasks available for this report.' });
    return lines;
  }

  tasks.forEach((task, index) => {
    lines.push({ type: 'heading', text: `Task ${index + 1}: ${task.id || 'n/a'} — ${task.task_statement || 'Untitled task'}` });
    lines.push({ type: 'body', text: `Classification: ${task.classification || 'unknown'} | Intent: ${task.user_intent_category || 'n/a'}` });
    lines.push({
      type: 'body',
      text: `Scores — Frequency: ${task.scores?.frequency ?? 'n/a'}, Impact: ${task.scores?.impact ?? 'n/a'}, Findability: ${task.scores?.findability ?? 'n/a'}, Completability: ${task.scores?.completability ?? 'n/a'}, Composite: ${round(task.composite_score)}`
    });
    wrapText(`Rationale: ${task.rationale || 'n/a'}`, 120).forEach((text) => lines.push({ type: 'body', text }));

    if ((task.evidence || []).length) {
      lines.push({ type: 'body', text: 'Evidence:' });
      task.evidence.forEach((item, evidenceIndex) => {
        wrapText(
          `  ${evidenceIndex + 1}) URL: ${item.source_url || 'n/a'} | Element: ${item.element || 'n/a'} | Note: ${item.note || 'No note'}`,
          118
        ).forEach((text) => lines.push({ type: 'body', text }));
      });
    } else {
      lines.push({ type: 'body', text: 'Evidence: none provided.' });
    }
    lines.push({ type: 'spacer', text: '' });
  });

  return lines;
}

function createPdfBlob(lines) {
  const pageWidth = 612;
  const pageHeight = 792;
  const marginLeft = 42;
  const marginTop = 40;
  const marginBottom = 40;

  const pages = [];
  let pageCommands = [];
  let y = pageHeight - marginTop;

  function pushPage() {
    if (pageCommands.length) {
      pages.push(pageCommands.join('\n'));
    }
    pageCommands = [];
    y = pageHeight - marginTop;
  }

  const style = (lineType) => {
    if (lineType === 'title') return { fontSize: 18, leading: 24 };
    if (lineType === 'heading') return { fontSize: 12, leading: 17 };
    if (lineType === 'spacer') return { fontSize: 10, leading: 8 };
    return { fontSize: 10, leading: 14 };
  };

  lines.forEach((line) => {
    const { fontSize, leading } = style(line.type);
    if (y - leading < marginBottom) {
      pushPage();
    }

    if (line.type !== 'spacer') {
      pageCommands.push(`BT /F1 ${fontSize} Tf ${marginLeft} ${y} Td (${escapePdfText(line.text)}) Tj ET`);
    }
    y -= leading;
  });

  pushPage();
  if (!pages.length) pages.push('');

  const objectContents = [];
  objectContents.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  const pageObjectIds = pages.map((_, index) => 4 + index * 2);
  const contentObjectIds = pages.map((_, index) => 5 + index * 2);

  objectContents.push(`2 0 obj\n<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>\nendobj\n`);
  objectContents.push('3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');

  pages.forEach((pageStream, index) => {
    const pageId = pageObjectIds[index];
    const contentId = contentObjectIds[index];
    objectContents.push(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`
    );
    objectContents.push(`${contentId} 0 obj\n<< /Length ${pageStream.length} >>\nstream\n${pageStream}\nendstream\nendobj\n`);
  });

  let pdf = '%PDF-1.4\n';
  const xrefOffsets = [0];
  objectContents.forEach((content) => {
    xrefOffsets.push(pdf.length);
    pdf += content;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${xrefOffsets.length}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < xrefOffsets.length; i += 1) {
    pdf += `${String(xrefOffsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${xrefOffsets.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return new Blob([pdf], { type: 'application/pdf' });
}

function triggerBlobDownload(blob, fileName) {
  const link = document.createElement('a');
  const objectUrl = URL.createObjectURL(blob);
  link.href = objectUrl;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function downloadPdfReport(report) {
  const blob = createPdfBlob(collectReportPdfLines(report));
  triggerBlobDownload(blob, `${report.file.replace('.json', '')}-report.pdf`);
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
    triggerBlobDownload(blob, `${selectedReport.file.replace('.json', '')}-report-workbook.xls`);
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

initReportPanelToggle();

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
    triggerBlobDownload(blob, `top-task-portfolio-${today}.csv`);
  });
}
