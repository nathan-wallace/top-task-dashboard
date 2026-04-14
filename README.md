# Top Task Dashboard

A static dashboard that reads report JSON files from `reports/`, visualizes task scoring, and exports any loaded report as Markdown.

## Pages

- `index.html`: report explorer with report-level drill-down.
- `overview.html`: portfolio view showing summary stats across all reports.

## Styling

The UI is authored in `styles.scss` (Sass syntax) and committed as `styles.css` for static hosting.

## Add reports

1. Drop one or more report files into `reports/` (e.g. `my-site.json`).
2. Run `npm run build:index` to regenerate `reports/index.json`.
3. Run `npm run validate:reports` to validate required fields.

## Local usage

Because the dashboard loads JSON via `fetch`, serve it with a local static server.

```bash
python3 -m http.server 4173
# open http://localhost:4173
```

## CI/CD (GitHub Pages + nojekyll)

- CI workflow (`.github/workflows/ci.yml`) validates the reports.
- Deploy workflow (`.github/workflows/deploy-pages.yml`) publishes to GitHub Pages and creates `.nojekyll` in the artifact.

## Expected report shape

The app expects a JSON structure similar to:

- `meta` object (`url`, `audience`, `scope`, `analyzed_at`)
- `task_longlist` array with `id`, `task_statement`, `classification`, and numeric `composite_score`
- optional `next_steps`
