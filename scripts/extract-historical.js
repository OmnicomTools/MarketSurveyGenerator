/**
 * One-off / refresh script: reads AllSurveyTemplates/*.xlsx and writes
 * data/historical-values.json for the web app to pre-populate locked years.
 *
 * Run from MarketSurveyGenerator/:
 *   node scripts/extract-historical.js
 */
"use strict";

const fs = require("fs");
const path = require("path");
const ExcelJS = require("../vendor/exceljs.min.js");

const ROOT = path.resolve(__dirname, "..");
const TEMPLATES = path.resolve(ROOT, "..", "AllSurveyTemplates");
const OUT = path.join(ROOT, "data", "historical-values.json");

const MARKET_ALIASES = {
  "UNITED KINGDOM": "UK",
  "U.K.": "UK",
  "U.K": "UK",
  "SOUTH KOREA": "South Korea",
};

function cellText(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "string") return v.trim();
  if (typeof v === "object") {
    if (v.richText) return v.richText.map((t) => t.text).join("").trim();
    if (v.text) return String(v.text).trim();
    if (v.result != null) return String(v.result);
  }
  return null;
}

function cellNumber(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "object" && typeof v.result === "number" && Number.isFinite(v.result)) return v.result;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

function normalizeMarketName(raw, fileBase) {
  const fromFile = fileBase.replace(/\s+Survey(?:\s+[\d.]+)?$/i, "").trim();
  let name = (raw || fromFile || "").trim();
  if (!name) return fromFile;
  const upper = name.toUpperCase();
  if (MARKET_ALIASES[upper]) return MARKET_ALIASES[upper];
  // Title-case all-caps names from old templates
  if (name === name.toUpperCase() && name.length > 2) {
    name = name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }
  if (name === "Uk") return "UK";
  if (name === "Gcc") return "GCC";
  return name;
}

/**
 * Walk a sheet top-to-bottom and map hierarchical "of which" rows onto
 * the new canonical series codes used by survey-core.js.
 */
function mapCrossPlatformRows(ws, labelCol) {
  const rows = [];
  let section = null;
  let subsection = null;

  for (let r = 1; r <= (ws.rowCount || 120); r++) {
    const label = cellText(ws.getRow(r).getCell(labelCol).value);
    if (!label || label.startsWith("•") || /^LOCAL CURRENCY/i.test(label)) continue;
    if (/^(DECEMBER|PUBLICATION)/i.test(label)) continue;
    // Skip market title rows (single word / short all-caps without media keywords)
    const u = label.toUpperCase();
    if (
      !/TELEVISION|FREE TV|PAY\/?MCH|DIGITAL|STATIC|OTHER DIGITAL|PUBLISHING|NEWS|MAGAZINE|AUDIO|OUT OF HOME|OOH|CINEMA|RETAIL|PODCAST|STREAMING|TOTAL/.test(u) &&
      !/^of which/i.test(label)
    ) {
      continue;
    }

    let code = null;
    if (/^TELEVISION TOTAL$/i.test(label)) {
      section = "TV"; subsection = null; code = "TV";
    } else if (/^Free TV\s*-\s*Total$/i.test(label)) {
      section = "TV"; subsection = "TV.FREE"; code = "TV.FREE";
    } else if (/^Pay\/?Mch TV\s*-\s*Total$/i.test(label)) {
      section = "TV"; subsection = "TV.PAY"; code = "TV.PAY";
    } else if (/^DIGITAL( PUREPLAY TOTAL)?$/i.test(label)) {
      section = "DIG"; subsection = null; code = "DIG";
    } else if (/^STATIC DISPLAY/i.test(label)) {
      section = "DIG"; subsection = "DSP.DISPLAY"; code = "DSP.DISPLAY";
    } else if (/^OTHER DIGITAL FORMATS$/i.test(label)) {
      section = "DIG"; subsection = "DSP.OTHER"; code = "DSP.OTHER";
    } else if (/RETAIL/i.test(label)) {
      section = "DIG"; subsection = null; code = "RET";
    } else if (/^PUBLISHING$/i.test(label)) {
      section = "PUB"; subsection = null; code = "PUB";
    } else if (/^NEWS BRANDS$/i.test(label)) {
      section = "PUB"; subsection = "PUB.NEWS"; code = "PUB.NEWS";
    } else if (/^MAGAZINE BRANDS$/i.test(label)) {
      section = "PUB"; subsection = "PUB.MAG"; code = "PUB.MAG";
    } else if (/^AUDIO MEDIA$/i.test(label)) {
      section = "AUD"; subsection = null; code = "AUD";
    } else if (/PODCAST/i.test(label)) {
      section = "AUD"; subsection = null; code = "AUD.POD";
    } else if (/STREAMING/i.test(label) && /AUDIO|STREAM/i.test(label)) {
      section = "AUD"; subsection = null; code = "AUD.STREAM";
    } else if (/^OUT OF HOME$/i.test(label)) {
      section = "OOH"; subsection = null; code = "OOH";
    } else if (/^CINEMA$/i.test(label)) {
      section = "CIN"; subsection = null; code = "CIN";
    } else if (/^TOTAL TRAD MEDIA$/i.test(label) || /^TOTAL MEDIA/i.test(label)) {
      code = "TOTAL";
    } else if (/^of which Linear/i.test(label)) {
      if (subsection === "TV.FREE") code = "TV.FREE.LIN";
      else if (subsection === "TV.PAY") code = "TV.PAY.LIN";
      else if (section === "TV" && !subsection) code = null; // TV total linear — skip
      else if (subsection === "PUB.NEWS") code = "PUB.NEWS.LIN";
      else if (subsection === "PUB.MAG") code = "PUB.MAG.LIN";
      else if (section === "PUB" && !subsection) code = null;
      else if (section === "AUD") code = "AUD.LIN";
      else if (section === "OOH") code = "OOH.LIN";
    } else if (/^of which Digital/i.test(label)) {
      if (subsection === "TV.FREE") code = "TV.FREE.DIG";
      else if (subsection === "TV.PAY") code = "TV.PAY.DIG";
      else if (section === "TV" && !subsection) code = null;
      else if (subsection === "PUB.NEWS") code = "PUB.NEWS.DIG";
      else if (subsection === "PUB.MAG") code = "PUB.MAG.DIG";
      else if (section === "PUB" && !subsection) code = null;
      else if (section === "AUD") {
        // Old templates often have a single digital audio bucket — map to streaming.
        code = "AUD.STREAM";
      } else if (section === "OOH") code = "OOH.DIG";
    } else if (/^PUBLISHING TOTAL$/i.test(label)) {
      section = "PUB"; subsection = null; code = "PUB";
    } else if (/^AUDIO MEDIA TOTAL$/i.test(label)) {
      section = "AUD"; subsection = null; code = "AUD";
    } else if (/^Of which Desktop$/i.test(label)) {
      if (subsection === "DSP.DISPLAY") code = "DSP.DISPLAY.DESK";
      else if (subsection === "DSP.OTHER") code = "DSP.OTHER.DESK";
    } else if (/^Of which Mobile$/i.test(label)) {
      if (subsection === "DSP.DISPLAY") code = "DSP.DISPLAY.MOB";
      else if (subsection === "DSP.OTHER") code = "DSP.OTHER.MOB";
    }

    if (code) rows.push({ row: r, code, label });
  }
  return rows;
}

function detectLayout(ws) {
  // Cross-platform long history: years on row 2 starting col 2, labels in col 1
  const y2 = cellNumber(ws.getRow(2).getCell(2).value);
  if (y2 && y2 > 1900 && y2 < 2100) {
    return { kind: "cross", yearRow: 2, yearStartCol: 2, labelCol: 1 };
  }
  // Compact / GCC-style: years on row 3
  let yearStartCol = null;
  for (let c = 3; c <= 8; c++) {
    const y = cellNumber(ws.getRow(3).getCell(c).value);
    if (y && y > 1900 && y < 2100) { yearStartCol = c; break; }
  }
  if (!yearStartCol) return null;

  let labelCol = 3;
  for (const cand of [3, 2]) {
    const sample = cellText(ws.getRow(6).getCell(cand).value) || "";
    if (/TELEVISION|PUBLISHING|AUDIO|OUT OF HOME|CINEMA|STATIC/i.test(sample)) {
      labelCol = cand;
      break;
    }
  }
  return { kind: "compact", yearRow: 3, yearStartCol, labelCol };
}

function readYears(ws, layout) {
  const years = [];
  for (let c = layout.yearStartCol; c <= layout.yearStartCol + 80; c++) {
    const y = cellNumber(ws.getRow(layout.yearRow).getCell(c).value);
    if (y == null) break;
    if (y < 1900 || y > 2100) break;
    years.push({ col: c, year: y });
  }
  return years;
}

function pickDataSheet(wb, fileBase) {
  const want = fileBase.replace(/\s+Survey(?:\s+[\d.]+)?$/i, "").trim().toLowerCase();
  for (const ws of wb.worksheets) {
    if (/def/i.test(ws.name)) continue;
    if (ws.name.toLowerCase() === want) return ws;
  }
  for (const ws of wb.worksheets) {
    if (!/def/i.test(ws.name)) return ws;
  }
  return wb.worksheets[0];
}

function readMarketTitle(ws, layout, fileBase) {
  if (layout.kind === "compact") {
    // Title sits just left of the year block (col 3 for most, col 2 for GCC)
    const t =
      cellText(ws.getRow(2).getCell(layout.labelCol).value) ||
      cellText(ws.getRow(2).getCell(3).value) ||
      cellText(ws.getRow(2).getCell(2).value);
    return normalizeMarketName(t, fileBase);
  }
  const t = cellText(ws.getRow(1).getCell(1).value);
  return normalizeMarketName(t, fileBase);
}

async function extractFile(filePath) {
  const fileBase = path.basename(filePath, path.extname(filePath));
  if (!/Survey/i.test(fileBase)) return null;
  if (/5\.14\.26/i.test(fileBase)) return null; // alternate Turkey layout — skip

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(fs.readFileSync(filePath));
  const ws = pickDataSheet(wb, fileBase);
  if (!ws) return null;

  const layout = detectLayout(ws);
  if (!layout) {
    console.warn("  skip (unknown layout):", path.basename(filePath));
    return null;
  }

  const market = readMarketTitle(ws, layout, fileBase);
  const years = readYears(ws, layout);
  const mapped = mapCrossPlatformRows(ws, layout.labelCol);

  const values = {}; // code -> { year: number }
  for (const { row, code } of mapped) {
    if (!values[code]) values[code] = {};
    for (const { col, year } of years) {
      const n = cellNumber(ws.getRow(row).getCell(col).value);
      if (n != null) values[code][year] = n;
    }
  }

  // Compact templates often only store parent totals. Promote those onto the
  // primary leaf input so the new template's SUM formulas still roll up correctly.
  const PROMOTIONS = [
    ["TV.FREE", "TV.FREE.LIN"],
    ["TV.PAY", "TV.PAY.LIN"],
    ["PUB.NEWS", "PUB.NEWS.LIN"],
    ["PUB.MAG", "PUB.MAG.LIN"],
    ["AUD", "AUD.LIN"],
    ["DSP.DISPLAY", "DSP.DISPLAY.DESK"],
    ["DSP.OTHER", "DSP.OTHER.DESK"],
    ["OOH", "OOH.LIN"],
  ];
  for (const [parent, leaf] of PROMOTIONS) {
    if (!values[parent]) continue;
    if (!values[leaf]) values[leaf] = {};
    for (const [y, v] of Object.entries(values[parent])) {
      if (values[leaf][y] == null) values[leaf][y] = v;
    }
  }

  return {
    market,
    source: path.basename(filePath),
    layout: layout.kind,
    years: years.map((y) => y.year),
    values,
  };
}

async function main() {
  const files = fs
    .readdirSync(TEMPLATES)
    .filter((f) => f.toLowerCase().endsWith(".xlsx") && /survey/i.test(f))
    .map((f) => path.join(TEMPLATES, f));

  console.log("Reading", files.length, "survey files from", TEMPLATES);
  const byMarket = {};
  const notes = [];

  for (const f of files) {
    process.stdout.write("  " + path.basename(f) + " ... ");
    try {
      const extracted = await extractFile(f);
      if (!extracted) {
        console.log("skipped");
        continue;
      }
      const existing = byMarket[extracted.market];
      // Prefer the richer cross-platform layout when both exist
      if (!existing || (extracted.layout === "cross" && existing.layout !== "cross")) {
        byMarket[extracted.market] = extracted;
        console.log("ok", extracted.layout, extracted.years[0] + "-" + extracted.years.at(-1), Object.keys(extracted.values).length, "series");
      } else if (existing && extracted.layout === "compact" && existing.layout === "cross") {
        // Merge any codes/years missing from the preferred file
        let added = 0;
        for (const [code, yearMap] of Object.entries(extracted.values)) {
          if (!existing.values[code]) existing.values[code] = {};
          for (const [y, v] of Object.entries(yearMap)) {
            if (existing.values[code][y] == null) {
              existing.values[code][y] = v;
              added++;
            }
          }
        }
        console.log("merged into cross (+" + added + " cells)");
      } else {
        console.log("kept existing");
      }
    } catch (e) {
      console.log("ERROR", e.message);
      notes.push(path.basename(f) + ": " + e.message);
    }
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    sourceFolder: "AllSurveyTemplates",
    note:
      "Historical values extracted from the latest survey templates. " +
      "Used to pre-fill non-editable (locked) years. Editable years stay blank for contacts. " +
      "Replace with a live database later.",
    markets: byMarket,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload));
  const sizeKb = Math.round(fs.statSync(OUT).size / 1024);
  console.log("\nWrote", OUT, "(" + sizeKb + " KB,", Object.keys(byMarket).length, "markets)");
  if (notes.length) console.log("Notes:", notes);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
