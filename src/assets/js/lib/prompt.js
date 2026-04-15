export function buildPrompt(values) {
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
audience: ${tokens.audience}                     # Required. Primary user group (e.g., "small business owners applying for SBA loans")
scope: ${tokens.scope}                        # Required. "entire site" | "section: /path" | "specific journey: X"
business_context: ${tokens.business_context}             # Optional. Org mission, known pain points, stakeholder goals
existing_data: ${tokens.existing_data}                # Optional. Analytics, search logs, support tickets, prior research
constraints: ${tokens.constraints}                  # Optional. Compliance (e.g., Section 508, USWDS), tech stack, timeline
max_tasks: ${tokens.max_tasks}                          # Optional. Default 25. Target longlist size before voting
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

## Required Output Format
Return output in **two parts, in this exact order**:

1. A valid JSON object matching the schema below
2. A structured Markdown report that summarizes the same findings for human review

Do not omit either part.

## Structured Output
Return valid JSON matching this schema.

Set \`summary\` to ≤150 words covering top 3–5 tasks, key risks, and what to validate with users next.

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

## Markdown Report Requirements
After the JSON, output a Markdown report with the following structure:

\`\`\`markdown
# Top Task Identification Report

## 1. Analysis Overview
- URL:
- Audience:
- Scope:
- Analyzed at:
- Analyst confidence:
- Report status:

## 2. Executive Summary
A concise summary of the top 3–5 tasks, major risks, and recommended validation steps.

## 3. Evidence Gaps
- List any missing evidence, unclear scope areas, blocked pages, or assumptions.

## 4. Top Tasks
### T01 — <task statement>
- Intent category:
- Classification:
- Composite score:
- Scores:
  - Frequency:
  - Impact:
  - Findability:
  - Completability:
- Why it matters:
- Evidence:
  - \`<source_url>\` — \`<element>\`: \`<note>\`

## 5. Secondary Tasks
Repeat the same format for tasks classified as \`secondary\`.

## 6. Tiny Tasks
Repeat the same format for tasks classified as \`tiny\`, but keep rationale concise.

## 7. Prioritized Top Task List
1. T## — Task statement
2. T## — Task statement
3. T## — Task statement

## 8. Recommended Voting Survey
- Instructions:
- Task list for voting:
- Recommended sample size:
- Target segments:

## 9. Next Steps
- Bullet list of recommended research, design, analytics, or content actions.
\`\`\`

## Rules
- Write tasks in the user's voice, not the org's. "Apply for benefits," not "Benefits application portal."
- No task longer than 9 words.
- Every score must cite evidence; if evidence is missing, mark it in \`evidence_gaps\` and lower \`analyst_confidence\`.
- If the URL cannot be fetched or scope is unclear, return an \`error\` object with \`missing_inputs\` instead of guessing.
- Deterministic: same inputs should yield substantively the same longlist and rankings.
- The Markdown report must be fully consistent with the JSON output.
- Do not wrap the entire response in a single code fence.
- JSON must remain valid and parseable.

Before the Markdown report, print this exact separator line:
---MARKDOWN_REPORT---`;
}
