import {
  classifyCounts,
  formatTimestamp,
  reportStatus,
  round,
  summarizeReport,
  titleFromFile
} from './formatting.js';

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

export function buildSingleReportWorkbook(report) {
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
    ['Generated At (UTC)', nowIso]
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
    ['Total Tasks', String(allTasks.length)],
    ['Top Tasks', String(byClass.top || 0)],
    ['Secondary Tasks', String(byClass.secondary || 0)],
    ['Tiny Tasks', String(byClass.tiny || 0)],
    ['Unknown Tasks', String(byClass.unknown || 0)]
  ];

  const topTaskHeader = ['Rank', 'Task ID', 'Task Statement', 'Classification', 'Composite Score', 'Rationale'];
  const topTaskRows = allTasks.length
    ? allTasks.map((task, index) => [
      String(index + 1),
      task.id || 'n/a',
      task.task_statement || 'n/a',
      task.classification || 'top',
      Number.isFinite(task.composite_score) ? task.composite_score.toFixed(2) : '',
      task.rationale || ''
    ])
    : [['', '', 'No tasks are available in this report.', '', '', '']];

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles><Style ss:ID="Header"><Font ss:Bold="1"/></Style></Styles>
 <Worksheet ss:Name="Tool Explanation"><Table>${toolExplanationRows.map((row, index) => (index === 0
    ? `<Row><Cell ss:StyleID="Header"><Data ss:Type="String">${toWorkbookCell(row[0])}</Data></Cell></Row>`
    : toWorkbookRow(row))).join('')}</Table></Worksheet>
 <Worksheet ss:Name="Overview"><Table>${overviewRows.map((row, index) => (index === 0
    ? `<Row><Cell ss:StyleID="Header"><Data ss:Type="String">${toWorkbookCell(row[0])}</Data></Cell></Row>`
    : toWorkbookRow(row))).join('')}</Table></Worksheet>
 <Worksheet ss:Name="Top Tasks"><Table>
   <Row>${topTaskHeader.map((header) => `<Cell ss:StyleID="Header"><Data ss:Type="String">${toWorkbookCell(header)}</Data></Cell>`).join('')}</Row>
   ${topTaskRows.map((row) => toWorkbookRow(row)).join('')}
 </Table></Worksheet>
</Workbook>`;
}

export function buildPortfolioCsv(reports) {
  const summaries = reports.map(summarizeReport).sort((a, b) => b.avgScore - a.avgScore);
  const csvHeader = ['Report', 'Report File', 'Status', 'Audience', 'Total Tasks (Report)', 'Average Score (Report)'];
  const csvRows = [
    csvHeader.map(toCsvCell).join(','),
    ...summaries.map((summary) => [
      summary.title,
      summary.file,
      reportStatus(summary),
      summary.data.meta?.audience || 'n/a',
      summary.totalTasks,
      round(summary.avgScore)
    ].map(toCsvCell).join(','))
  ];

  return `\uFEFF${csvRows.join('\n')}`;
}

function escapePdfText(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
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
  const lines = [
    { type: 'title', text: `Top Task Research Report — ${titleFromFile(file)}` },
    { type: 'body', text: `Report file: ${file}` },
    { type: 'body', text: `Generated at: ${formatTimestamp(new Date().toISOString())}` },
    { type: 'heading', text: 'Executive Summary' },
    ...wrapText(data.summary || 'No summary available.', 120).map((text) => ({ type: 'body', text })),
    { type: 'heading', text: 'Detailed Task Register' }
  ];

  tasks.forEach((task, index) => {
    lines.push({ type: 'heading', text: `Task ${index + 1}: ${task.id || 'n/a'} — ${task.task_statement || 'Untitled task'}` });
    lines.push({ type: 'body', text: `Classification: ${task.classification || 'unknown'} | Composite: ${round(task.composite_score)}` });
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
    if (pageCommands.length) pages.push(pageCommands.join('\n'));
    pageCommands = [];
    y = pageHeight - marginTop;
  }

  lines.forEach((line) => {
    const fontSize = line.type === 'title' ? 18 : line.type === 'heading' ? 12 : 10;
    const leading = line.type === 'title' ? 24 : line.type === 'heading' ? 17 : 14;
    if (y - leading < marginBottom) pushPage();
    pageCommands.push(`BT /F1 ${fontSize} Tf ${marginLeft} ${y} Td (${escapePdfText(line.text)}) Tj ET`);
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
    objectContents.push(`${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`);
    objectContents.push(`${contentId} 0 obj\n<< /Length ${pageStream.length} >>\nstream\n${pageStream}\nendstream\nendobj\n`);
  });

  let pdf = '%PDF-1.4\n';
  const xrefOffsets = [0];
  objectContents.forEach((content) => {
    xrefOffsets.push(pdf.length);
    pdf += content;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${xrefOffsets.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < xrefOffsets.length; i += 1) {
    pdf += `${String(xrefOffsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${xrefOffsets.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return new Blob([pdf], { type: 'application/pdf' });
}

export function buildReportPdfBlob(report) {
  return createPdfBlob(collectReportPdfLines(report));
}
