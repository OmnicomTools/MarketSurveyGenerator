# Market Survey Generator

Web app that generates standardized Global Media Landscape survey templates (.xlsx).

**How it works:** everything runs in the browser — no server, no uploads. Pick the survey
type, the year columns, which years should be editable, whether to pre-fill locked years
from historical data, and the markets, then click **Generate surveys**. You get a ZIP of
one workbook per market (or a single .xlsx if one market is selected).

Each generated workbook has:
- a **Definitions** tab
- a market tab with the standardized cross-platform layout
- only the selected editable years unlocked (green cells) — all other cells are protected
- live rollup totals and growth % formulas
- optional pre-filled values in locked years (from `data/historical-values.json`)

**Survey types:**
- *Main survey* — defaults: columns 1999–2026, editable 2025–2026
- *Historical restatement (supplemental)* — defaults: columns and editable years 2018–2024

**Historical data:**
- Extracted from the latest files in `AllSurveyTemplates/` into `data/historical-values.json`
- Refresh with: `node scripts/extract-historical.js` (run from this folder; needs the sibling `AllSurveyTemplates` folder)
- This is a stand-in until values are served from a database

## Hosting

Static site — currently hosted on GitHub Pages from the `main` branch. No build step.

## Files

- `index.html` / `app.js` — page and UI logic
- `survey-core.js` — market list, canonical revenue-line structure, and workbook builder
- `data/historical-values.json` — pre-fill values for locked years
- `scripts/extract-historical.js` — rebuilds the JSON from AllSurveyTemplates
- `vendor/` — ExcelJS 4.4.0 and JSZip 3.10.1 (vendored so no CDN is needed)
