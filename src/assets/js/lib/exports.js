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
  return buildStructuredReportPdfBlob(report);
}

function buildStructuredReportPdfBlob(report) {
  const sortedTasks = [...(report.data.task_longlist || [])].sort((a, b) => b.composite_score - a.composite_score);
  const meta = report.data.meta || {};
  const classificationSummaries = averageByClassification(report.data.task_longlist || []);
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;
  const tableColumns = [
    { key: 'id', label: 'ID', width: 56 },
    { key: 'task_statement', label: 'Task Statement', width: 180 },
    { key: 'classification', label: 'Class', width: 66 },
    { key: 'score', label: 'Score', width: 52, align: 'right' },
    { key: 'rationale', label: 'Rationale', width: 186 }
  ];
  const bodyFontSize = 9;
  const headerFontSize = 10;
  const lineHeight = 12;
  const cellPaddingX = 6;
  const cellPaddingY = 6;
  const tableHeaderHeight = lineHeight + cellPaddingY * 2;
  const sectionGap = 12;
  const measureText = createPdfTextMeasurer();
  const titleSize = 16;
  const sectionHeadingSize = 12;
  const subheadingSize = 10;

  const pages = [];
  const makePage = () => ({ contentParts: [] });
  const ensurePage = () => {
    const page = makePage();
    pages.push(page);
    return page;
  };

  const drawCellBorder = (page, x, topY, width, height) => {
    const pdfY = pageHeight - topY - height;
    page.contentParts.push(`${x.toFixed(2)} ${pdfY.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re S`);
  };

  const drawText = (page, text, x, topY, fontName = 'F1', size = bodyFontSize) => {
    const safeText = escapePdfText(text);
    const baseline = pageHeight - topY - size;
    page.contentParts.push(`BT /${fontName} ${size} Tf ${x.toFixed(2)} ${baseline.toFixed(2)} Td (${safeText}) Tj ET`);
  };

  const drawAlignedText = (page, text, x, topY, width, align = 'left', fontName = 'F1', size = bodyFontSize) => {
    const safe = String(text ?? '');
    if (align === 'right') {
      const textWidth = measureText(safe, size);
      const offset = Math.max(cellPaddingX, width - cellPaddingX - textWidth);
      drawText(page, safe, x + offset, topY, fontName, size);
      return;
    }
    drawText(page, safe, x + cellPaddingX, topY, fontName, size);
  };

  const drawWrappedText = (page, text, x, topY, width, fontName = 'F1', size = bodyFontSize) => {
    const lines = wrapTextByColumnWidth(text, width, size);
    let textY = topY;
    for (const line of lines) {
      drawText(page, line, x, textY, fontName, size);
      textY += lineHeight;
    }
    return textY;
  };

  const toPlainClassificationLabel = (classification) => buildClassificationLabelTemplate(classification)
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const drawTableHeader = (page, topY) => {
    let cursorX = margin;
    for (const column of tableColumns) {
      drawCellBorder(page, cursorX, topY, column.width, tableHeaderHeight);
      drawText(page, column.label, cursorX + cellPaddingX, topY + cellPaddingY, 'F2', headerFontSize);
      cursorX += column.width;
    }
    return topY + tableHeaderHeight;
  };

  const wrapTextByColumnWidth = (value, width, fontSize) => {
    const text = String(value ?? '').trim();
    if (!text) return [''];
    const maxWidth = Math.max(1, width - cellPaddingX * 2);
    const lines = [];
    for (const paragraph of text.split(/\r?\n/)) {
      const words = paragraph.split(/\s+/).filter(Boolean);
      if (!words.length) {
        lines.push('');
        continue;
      }
      let current = '';
      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (measureText(candidate, fontSize) <= maxWidth) {
          current = candidate;
          continue;
        }
        if (current) lines.push(current);
        current = '';
        if (measureText(word, fontSize) <= maxWidth) {
          current = word;
          continue;
        }
        let part = '';
        for (const glyph of word) {
          const extended = `${part}${glyph}`;
          if (measureText(extended, fontSize) <= maxWidth) {
            part = extended;
            continue;
          }
          if (part) lines.push(part);
          part = glyph;
        }
        current = part;
      }
      lines.push(current);
    }
    return lines.length ? lines : [''];
  };

  const ensureSectionSpace = (spaceNeeded) => {
    if (cursorY + spaceNeeded <= pageHeight - margin) return;
    page = ensurePage();
    cursorY = margin;
  };

  const drawSectionHeading = (label) => {
    ensureSectionSpace(lineHeight + sectionGap);
    drawText(page, label, margin, cursorY, 'F2', sectionHeadingSize);
    cursorY += lineHeight + 2;
  };

  const drawMetadataRow = (label, value) => {
    const safeValue = value || 'n/a';
    const labelWidth = 120;
    const valueWidth = contentWidth - labelWidth;
    const valueLines = wrapTextByColumnWidth(safeValue, valueWidth, bodyFontSize);
    const rowHeight = Math.max(lineHeight, valueLines.length * lineHeight);
    ensureSectionSpace(rowHeight);
    drawText(page, `${label}:`, margin, cursorY, 'F2', bodyFontSize);
    valueLines.forEach((line, index) => {
      drawText(page, line, margin + labelWidth, cursorY + index * lineHeight, 'F1', bodyFontSize);
    });
    cursorY += rowHeight;
  };

  const drawClassificationSummaryCard = (entry) => {
    const heading = toPlainClassificationLabel(entry.classification);
    const countText = `${entry.count} tasks`;
    const averageText = `avg score ${entry.average.toFixed(2)}`;
    const lines = [
      heading || 'Unknown',
      countText,
      averageText
    ];
    const wrapped = lines.map((line, index) => wrapTextByColumnWidth(line, contentWidth, index === 0 ? subheadingSize : bodyFontSize));
    const cardLineCount = wrapped.reduce((max, group) => Math.max(max, group.length), 0);
    const cardHeight = 8 + (cardLineCount * lineHeight * 3);
    ensureSectionSpace(cardHeight);
    wrapped[0].forEach((line, index) => drawText(page, line, margin, cursorY + (index * lineHeight), 'F2', subheadingSize));
    const firstBlockHeight = wrapped[0].length * lineHeight;
    wrapped[1].forEach((line, index) => drawText(page, line, margin + 10, cursorY + firstBlockHeight + (index * lineHeight), 'F1', bodyFontSize));
    const secondBlockHeight = wrapped[1].length * lineHeight;
    wrapped[2].forEach((line, index) => drawText(page, line, margin + 10, cursorY + firstBlockHeight + secondBlockHeight + (index * lineHeight), 'F2', bodyFontSize));
    cursorY += firstBlockHeight + secondBlockHeight + (wrapped[2].length * lineHeight) + 6;
  };

  let page = ensurePage();
  let cursorY = margin;

  drawText(page, titleFromFile(report.file), margin, cursorY, 'F2', titleSize);
  cursorY += 24;

  drawSectionHeading('Metadata');
  drawMetadataRow('Status', reportStatus(report));
  drawMetadataRow('URL', meta.url || 'n/a');
  drawMetadataRow('Audience', meta.audience || 'n/a');
  drawMetadataRow('Scope', meta.scope || 'n/a');
  drawMetadataRow('Analyzed date', meta.analyzed_at || 'n/a');
  drawMetadataRow('Analyst confidence', meta.analyst_confidence || 'n/a');
  drawMetadataRow('Evidence gaps', toJoinedList(meta.evidence_gaps) || 'None noted');
  cursorY += sectionGap;

  drawSectionHeading('Score overview');
  if (!classificationSummaries.length) {
    ensureSectionSpace(lineHeight);
    drawText(page, 'No tasks available.', margin, cursorY, 'F1', bodyFontSize);
    cursorY += lineHeight;
  } else {
    classificationSummaries.forEach(drawClassificationSummaryCard);
  }
  cursorY += sectionGap;

  drawSectionHeading('Executive summary');
  cursorY = drawWrappedText(
    page,
    report.data.summary || 'No summary available.',
    margin,
    cursorY,
    contentWidth,
    'F1',
    bodyFontSize
  );
  cursorY += sectionGap;

  drawSectionHeading('Ranked task register');
  ensureSectionSpace(tableHeaderHeight);
  cursorY = drawTableHeader(page, cursorY);

  if (!sortedTasks.length) {
    const emptyRowHeight = lineHeight + cellPaddingY * 2;
    if (cursorY + emptyRowHeight > pageHeight - margin) {
      page = ensurePage();
      cursorY = margin;
      cursorY = drawTableHeader(page, cursorY);
    }
    drawCellBorder(page, margin, cursorY, contentWidth, emptyRowHeight);
    drawText(page, 'No tasks available.', margin + cellPaddingX, cursorY + cellPaddingY, 'F1', bodyFontSize);
    cursorY += emptyRowHeight;
  }

  for (const task of sortedTasks) {
    const cellLines = tableColumns.map((column) => {
      const value = column.key === 'score'
        ? round(task.composite_score)
        : (task[column.key] || (column.key === 'id' ? 'n/a' : ''));
      return wrapTextByColumnWidth(value, column.width, bodyFontSize);
    });
    const tallestCellLineCount = Math.max(...cellLines.map((lines) => lines.length));
    const rowHeight = tallestCellLineCount * lineHeight + cellPaddingY * 2;

    if (cursorY + rowHeight > pageHeight - margin) {
      page = ensurePage();
      cursorY = margin;
      cursorY = drawTableHeader(page, cursorY);
    }

    let cursorX = margin;
    tableColumns.forEach((column, index) => {
      drawCellBorder(page, cursorX, cursorY, column.width, rowHeight);
      cellLines[index].forEach((line, lineIndex) => {
        const textY = cursorY + cellPaddingY + lineIndex * lineHeight;
        drawAlignedText(page, line, cursorX, textY, column.width, column.align || 'left', 'F1', bodyFontSize);
      });
      cursorX += column.width;
    });

    cursorY += rowHeight;
  }

  return assembleTextPdfBlob({ pageWidth, pageHeight, pages });
}

function assembleTextPdfBlob({ pageWidth, pageHeight, pages }) {
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
  const fontRegularId = 3;
  const fontBoldId = 4;
  const firstPageObjectId = 5;
  const pageRefs = [];

  pages.forEach((page, index) => {
    const pageId = firstPageObjectId + index * 2;
    const contentId = pageId + 1;
    pageRefs.push(`${pageId} 0 R`);
    const pageContent = textEncoder.encode(page.contentParts.join('\n'));
    pushObject(
      pageId,
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`
    );
    pushObject(contentId, `<< /Length ${pageContent.length} >>`, pageContent);
  });

  pushObject(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  pushObject(pagesId, `<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${pageRefs.length} >>`);
  pushObject(fontRegularId, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  pushObject(fontBoldId, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

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

function escapePdfText(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function createPdfTextMeasurer() {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (context) {
      return (text, fontSize) => {
        context.font = `${fontSize}px Helvetica`;
        return context.measureText(String(text ?? '')).width;
      };
    }
  }

  return (text, fontSize) => String(text ?? '').length * fontSize * 0.53;
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
