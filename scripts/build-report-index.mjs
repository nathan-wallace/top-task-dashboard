import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const reportsDir = new URL('../reports/', import.meta.url);
const reportsDirPath = fileURLToPath(reportsDir);

function titleFromFile(name) {
  return name.replace('.json', '').replace(/[-_]/g, ' ');
}

const entries = await readdir(reportsDirPath, { withFileTypes: true });

const files = entries
  .filter((entry) => entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'index.json')
  .map((entry) => entry.name)
  .sort((a, b) => a.localeCompare(b));

const manifest = [];
for (const file of files) {
  const slug = basename(file, '.json');
  const title = titleFromFile(file);
  manifest.push({
    file,
    slug,
    title,
    path: `./${slug}/`
  });
}

await writeFile(join(reportsDirPath, 'index.json'), `${JSON.stringify(manifest, null, 2)}\n`);

const generatedDirs = entries
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => manifest.every((item) => item.slug !== name));

for (const staleDir of generatedDirs) {
  const staleIndex = join(reportsDirPath, staleDir, 'index.html');
  try {
    const current = await readFile(staleIndex, 'utf8');
    if (current.includes('<!-- generated-report-page -->')) {
      await rm(join(reportsDirPath, staleDir), { recursive: true, force: true });
    }
  } catch {
    // ignore directories not managed by this script
  }
}

for (const report of manifest) {
  const pageDir = join(reportsDirPath, report.slug);
  await mkdir(pageDir, { recursive: true });

  const pageHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${report.title} | Top Task Dashboard</title>
    <link rel="stylesheet" href="../../styles.css" />
  </head>
  <body data-reports-base=".." data-report-file="${report.file}">
    <!-- generated-report-page -->
    <header class="site-header">
      <div class="brand">
        <h1><a href="../../index.html">Top Task Dashboard</a></h1>
        <p>Top task analysis report view.</p>
      </div>
      <nav class="site-nav" aria-label="Main">
        <a href="../../overview.html">Overview</a>
        <a class="active" href="../../index.html">Reports</a>
        <a href="../../prompt.html">Build a Prompt</a>
      </nav>
    </header>

    <main class="layout reports-layout report-single-layout" id="reports-layout">
      <section class="panel content">
        <div class="toolbar">
          <a class="button-link" href="../../index.html">Browse All Reports</a>
          <button id="download-pdf" type="button">Download PDF</button>
          <button id="download-report-workbook" type="button">Download Report Workbook</button>
        </div>

        <article id="report-view" aria-live="polite">
          <p>Loading report…</p>
        </article>
      </section>
    </main>

    <footer>
      <small>
        Top Tasks Dashboard — HHS website top task repository. A WebFirst project.<br />
        <a href="https://github.com/nathan-wallace-hhs/top-task-dashboard">View source on GitHub</a>
        ·
        <a href="https://github.com/nathan-wallace-hhs/top-task-dashboard/issues/new">Report an issue</a>
      </small>
    </footer>

    <script type="module" src="../../app.js"></script>
  </body>
</html>
`;

  await writeFile(join(pageDir, 'index.html'), pageHtml);
}

console.log(`Generated reports/index.json with ${manifest.length} reports and static pages.`);
