# DCF Model Reviewer

AI-graded feedback for Prepped Talent candidate DCF models. Upload an `.xlsx`, get a scored report (out of 100) within 60 seconds.

## Architecture

| Layer | Tech |
|---|---|
| Frontend | Vanilla JS / HTML (`index.html` + `app.js`), no build step |
| Backend | Supabase Edge Function (`supabase/functions/grade-dcf/index.ts`) — Deno + ExcelJS |
| AI | Anthropic Claude Haiku (model `claude-haiku-4-5-20251001`) |
| Hosting | Vercel (static frontend) + Supabase (Edge Function) |
| Storage | None — files are processed in-memory and discarded after grading |

## Repo layout

```
dcf-grader/
├── index.html                          # Upload form + report renderer
├── app.js                              # Vanilla JS state + fetch
├── config/
│   ├── rubric.md                       # Scoring rubric (filled)
│   └── model-answer.md                 # Reference numbers (Happy Hour Co)
├── supabase/functions/grade-dcf/
│   └── index.ts                        # Edge Function: parse + Claude call
├── sample-models/
│   └── nba-happy-hour-v2.xlsx          # Reference build (banker-style)
├── tools/
│   ├── inspect.js                      # Dev: dump structure + colours
│   └── extract-reference.js            # Dev: pull reference values
├── package.json                        # Dev deps (exceljs)
└── .gitignore
```

## Local dev

```bash
# Inspect a candidate model
cd dcf-grader
npm install
node tools/inspect.js sample-models/nba-happy-hour-v2.xlsx
node tools/extract-reference.js sample-models/nba-happy-hour-v2.xlsx
```

## Deployment checklist

- [ ] Set `ANTHROPIC_API_KEY` in Supabase project secrets (project: `dsnkabdmposyukcedduy`)
- [ ] Deploy `grade-dcf` Edge Function
- [ ] Create new Vercel project pointed at the `dcf-grader/` subdirectory
- [ ] Update GRADE_ENDPOINT in `app.js` if Supabase project changes
- [ ] Add custom domain (e.g. `dcf.preppedtalent.com.au`) — optional

## Updating the rubric / model answer

Edit `config/rubric.md` or `config/model-answer.md`, then sync the relevant constants in `supabase/functions/grade-dcf/index.ts` (the Edge Function embeds them at deploy time). Redeploy the function.

## Required candidate template

The grader expects exactly 3 tabs, named:
- `P&L`
- `Valuation Calculation`
- `Assumptions`

Other tab structures will be penalised under FMT-04.
