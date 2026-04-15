import {
  averageByClassification,
  buildClassificationLabelTemplate,
  classifyCounts,
  round,
  reportStatus,
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

function buildReportPrintDom(report) {
  const allTasks = report.data.task_longlist || [];
  const sortedTasks = [...allTasks].sort((a, b) => b.composite_score - a.composite_score);

  const root = document.createElement('article');
  root.className = 'pdf-render-root';

  const heading = document.createElement('h2');
  heading.textContent = titleFromFile(report.file);
  root.append(heading);

  const summary = document.createElement('p');
  summary.textContent = report.data.summary || 'No summary available for this report.';
  root.append(summary);

  const scoreHeading = document.createElement('h3');
  scoreHeading.textContent = 'Score overview';
  root.append(scoreHeading);

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
  root.append(statGrid);

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
  root.append(tableWrap);

  return root;
}

export async function buildReportPdfBlob(report) {
  const container = document.createElement('div');
  container.className = 'pdf-render-host';
  container.append(buildReportPrintDom(report));
  document.body.append(container);

  try {
    const root = container.querySelector('.pdf-render-root');
    const canvas = await renderElementToCanvas(root);
    return buildPdfBlobFromCanvas(canvas);
  } finally {
    container.remove();
  }
}

async function renderElementToCanvas(element) {
  await document.fonts?.ready;
  const width = Math.ceil(element.scrollWidth || element.clientWidth || 880);
  const height = Math.ceil(element.scrollHeight || element.clientHeight || 1000);

  const cssRules = [];
  for (const sheet of [...document.styleSheets]) {
    try {
      cssRules.push(...[...sheet.cssRules].map((rule) => rule.cssText));
    } catch {
      // Ignore non-readable cross-origin stylesheets.
    }
  }

  const html = new XMLSerializer().serializeToString(element);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml">
          <style>${cssRules.join('\n')}</style>
          ${html}
        </div>
      </foreignObject>
    </svg>
  `;
  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function buildPdfBlobFromCanvas(canvas) {
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 36;
  const drawableWidth = pageWidth - margin * 2;
  const drawableHeight = pageHeight - margin * 2;
  const pixelToPoint = drawableWidth / canvas.width;
  const pageSliceHeight = Math.max(1, Math.floor(drawableHeight / pixelToPoint));

  const jpegSlices = [];
  for (let sourceY = 0; sourceY < canvas.height; sourceY += pageSliceHeight) {
    const sliceHeight = Math.min(pageSliceHeight, canvas.height - sourceY);
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeight;
    pageCanvas.getContext('2d').drawImage(
      canvas,
      0,
      sourceY,
      canvas.width,
      sliceHeight,
      0,
      0,
      canvas.width,
      sliceHeight
    );

    const dataUrl = pageCanvas.toDataURL('image/jpeg', 0.92);
    const base64 = dataUrl.split(',')[1] || '';
    jpegSlices.push({
      widthPx: pageCanvas.width,
      heightPx: pageCanvas.height,
      bytes: Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
    });
  }

  const objectBytes = [];
  const textEncoder = new TextEncoder();
  const pushObject = (id, dict, stream) => {
    const header = `${id} 0 obj\n${dict}\n`;
    if (!stream) {
      objectBytes[id] = textEncoder.encode(`${header}endobj\n`);
      return;
    }
    const open = textEncoder.encode(`${header}stream\n`);
    const close = textEncoder.encode(`\nendstream\nendobj\n`);
    const merged = new Uint8Array(open.length + stream.length + close.length);
    merged.set(open, 0);
    merged.set(stream, open.length);
    merged.set(close, open.length + stream.length);
    objectBytes[id] = merged;
  };

  const catalogId = 1;
  const pagesId = 2;
  const firstObjectId = 3;
  const pageRefs = [];

  jpegSlices.forEach((slice, index) => {
    const pageId = firstObjectId + index * 3;
    const imageId = pageId + 1;
    const contentId = pageId + 2;
    pageRefs.push(`${pageId} 0 R`);

    const imageWidthPt = drawableWidth;
    const imageHeightPt = slice.heightPx * (drawableWidth / slice.widthPx);
    const yOffset = pageHeight - margin - imageHeightPt;
    const commandBytes = textEncoder.encode(`q ${imageWidthPt} 0 0 ${imageHeightPt} ${margin} ${yOffset} cm /Im${index + 1} Do Q`);

    pushObject(pageId, `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im${index + 1} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pushObject(imageId, `<< /Type /XObject /Subtype /Image /Width ${slice.widthPx} /Height ${slice.heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${slice.bytes.length} >>`, slice.bytes);
    pushObject(contentId, `<< /Length ${commandBytes.length} >>`, commandBytes);
  });

  pushObject(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  pushObject(pagesId, `<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${pageRefs.length} >>`);

  const chunks = [textEncoder.encode('%PDF-1.4\n')];
  const offsets = [0];
  let offset = chunks[0].length;
  for (let i = 1; i < objectBytes.length; i += 1) {
    if (!objectBytes[i]) continue;
    offsets[i] = offset;
    chunks.push(objectBytes[i]);
    offset += objectBytes[i].length;
  }

  const xrefStart = offset;
  const xrefLines = [`xref\n0 ${objectBytes.length}\n0000000000 65535 f \n`];
  for (let i = 1; i < objectBytes.length; i += 1) {
    const entry = offsets[i] ?? 0;
    const marker = offsets[i] ? 'n' : 'f';
    xrefLines.push(`${String(entry).padStart(10, '0')} 00000 ${marker} \n`);
  }
  xrefLines.push(`trailer\n<< /Size ${objectBytes.length} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);
  chunks.push(textEncoder.encode(xrefLines.join('')));

  return new Blob(chunks, { type: 'application/pdf' });
}
