export const classificationDefinitions = {
  top: 'Top tasks are the critical few user goals that matter most and should be easiest to find and complete.',
  secondary: 'Secondary tasks are still important, but they support the top tasks and should not dominate the primary experience.',
  tiny: 'Tiny tasks are low-frequency, low-impact needs that can add clutter if treated like primary navigation priorities.'
};

export const titleFromFile = (name) => name.replace('.json', '').replace(/[-_]/g, ' ');
export const round = (value) => Number.isFinite(value) ? value.toFixed(2) : '0.00';
export const reportStatus = (report) => report?.data?.meta?.report_status || 'Unreviewed';

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildClassificationLabelTemplate(classification) {
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

export function formatTimestamp(value) {
  if (!value) return 'n/a';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

export function textMatchesQuery(value, query) {
  if (!query) return true;
  return String(value ?? '').toLowerCase().includes(query);
}

export function classifyCounts(tasks) {
  return tasks.reduce((acc, task) => {
    const key = task.classification || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

export function averageByClassification(tasks) {
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

export function summarizeReport(report) {
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
