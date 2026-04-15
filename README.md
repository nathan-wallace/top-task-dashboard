# Top Task Dashboard

A static dashboard that reads report JSON files from `reports/`, visualizes task scoring, and exports any loaded report as Markdown. The build step now generates one static page per report so each report has a direct URL.

## Pages

- `index.html`: report explorer with report-level drill-down.
- `overview.html`: portfolio view showing summary stats across all reports.

## Styling

The UI is authored in `styles.scss` (Sass syntax) and committed as `styles.css` for static hosting.

## Add reports

1. Drop one or more report files into `reports/` (e.g. `my-site.json`).
2. Run `npm run build:site` to regenerate `reports/index.json` and static report pages under `reports/<report-slug>/index.html`.
3. Run `npm run validate:reports` to validate required fields.

## Local usage

Because the dashboard loads JSON via `fetch`, serve it with a local static server.

```bash
python3 -m http.server 4173
# open http://localhost:4173
```

## CI/CD (GitHub Pages + nojekyll)

- CI workflow (`.github/workflows/ci.yml`) validates the reports.
- Deploy workflow (`.github/workflows/deploy-pages.yml`) runs `npm run build:site`, publishes to GitHub Pages, and creates `.nojekyll` in the artifact.

## Expected report shape

The app and validator enforce a shared data model aligned with the Prompt Builder output schema:

- `meta` object with `url`, `audience`, `scope`, `analyzed_at`, `analyst_confidence`, `evidence_gaps`, and `report_status`
  - `analyst_confidence` must be one of `low`, `medium`, or `high`
  - `report_status` must be one of `Unreviewed`, `Reviewed`, or `Approved`
- `task_longlist` non-empty array; each task must include:
  - `id`, `task_statement`, `user_intent_category`, `evidence`, `scores`, `composite_score`, `classification`, `rationale`
  - `classification` must be one of `top`, `secondary`, or `tiny`
- `top_tasks` and `tiny_tasks` arrays of IDs that must exist in `task_longlist`
- `recommended_survey` object with `instructions`, `task_list_for_voting`, `recommended_sample_size`, `target_segments`
- `next_steps` array
