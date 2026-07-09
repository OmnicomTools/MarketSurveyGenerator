/* Survey generation core — runs in the browser (via index.html) and in Node (for tests). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SurveyCore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const BLUE = "FF1F4E79";
  const INPUT_GREEN = "FFE2EFDA";
  const DATA_START_COL = 3; // A = codes (hidden), B = labels, C.. = years

  // [code, label, kind, children]
  // kind: block = bold section total, calc = computed subtotal, input = contact enters
  const SERIES = [
    ["TV",               "TELEVISION TOTAL",                  "block", ["TV.FREE", "TV.PAY"]],
    ["TV.FREE.LIN",      "Free TV — Linear",                  "input", null],
    ["TV.FREE.DIG",      "Free TV — Digital",                 "input", null],
    ["TV.FREE",          "Free TV — Total",                   "calc",  ["TV.FREE.LIN", "TV.FREE.DIG"]],
    ["TV.PAY.LIN",       "Pay/Mch TV — Linear",               "input", null],
    ["TV.PAY.DIG",       "Pay/Mch TV — Digital",              "input", null],
    ["TV.PAY",           "Pay/Mch TV — Total",                "calc",  ["TV.PAY.LIN", "TV.PAY.DIG"]],
    [null, null, "gap", null],
    ["DIG",              "DIGITAL",                           "block", ["DSP.DISPLAY", "DSP.OTHER", "RET"]],
    ["DSP.DISPLAY.DESK", "Static Display — Desktop",          "input", null],
    ["DSP.DISPLAY.MOB",  "Static Display — Mobile",           "input", null],
    ["DSP.DISPLAY",      "Static Display — Total",            "calc",  ["DSP.DISPLAY.DESK", "DSP.DISPLAY.MOB"]],
    ["DSP.OTHER.DESK",   "Other Digital Formats — Desktop",   "input", null],
    ["DSP.OTHER.MOB",    "Other Digital Formats — Mobile",    "input", null],
    ["DSP.OTHER",        "Other Digital Formats — Total",     "calc",  ["DSP.OTHER.DESK", "DSP.OTHER.MOB"]],
    ["RET",              "Digital Retail Media",              "input", null],
    [null, null, "gap", null],
    ["PUB",              "PUBLISHING",                        "block", ["PUB.NEWS", "PUB.MAG"]],
    ["PUB.NEWS.LIN",     "News Brands — Linear",              "input", null],
    ["PUB.NEWS.DIG",     "News Brands — Digital",             "input", null],
    ["PUB.NEWS",         "News Brands — Total",               "calc",  ["PUB.NEWS.LIN", "PUB.NEWS.DIG"]],
    ["PUB.MAG.LIN",      "Magazine Brands — Linear",          "input", null],
    ["PUB.MAG.DIG",      "Magazine Brands — Digital",         "input", null],
    ["PUB.MAG",          "Magazine Brands — Total",           "calc",  ["PUB.MAG.LIN", "PUB.MAG.DIG"]],
    [null, null, "gap", null],
    ["AUD",              "AUDIO MEDIA",                       "block", ["AUD.LIN", "AUD.STREAM", "AUD.POD"]],
    ["AUD.LIN",          "Audio — Linear (broadcast radio)",  "input", null],
    ["AUD.STREAM",       "Audio — Streaming",                 "input", null],
    ["AUD.POD",          "Audio — Podcasts",                  "input", null],
    [null, null, "gap", null],
    ["OOH",              "OUT OF HOME",                       "block", ["OOH.LIN", "OOH.DIG"]],
    ["OOH.LIN",          "OOH — Traditional",                 "input", null],
    ["OOH.DIG",          "OOH — Digital",                     "input", null],
    [null, null, "gap", null],
    ["CIN",              "CINEMA",                            "block-input", null],
    [null, null, "gap", null],
    ["TOTAL",            "TOTAL MEDIA (SURVEY SCOPE)",        "block", ["TV", "DIG", "PUB", "AUD", "OOH", "CIN"]],
  ];

  // [market, currency]
  const MARKETS = [
    ["Argentina", "ARS"], ["Australia", "AUD"], ["Austria", "EUR"], ["Bahrain", "BHD"],
    ["Bangladesh", "BDT"], ["Belgium", "EUR"], ["Brazil", "BRL"], ["Bulgaria", "BGN"],
    ["Canada", "CAD"], ["Chile", "CLP"], ["China", "RMB"], ["Colombia", "COP"],
    ["Costa Rica", "CRC"], ["Croatia", "HRK"], ["Czech Republic", "CZK"], ["Denmark", "DKK"],
    ["Ecuador", "USD"], ["Egypt", "USD"], ["Estonia", "EUR"], ["Finland", "EUR"],
    ["France", "EUR"], ["Germany", "EUR"], ["Greece", "EUR"], ["Gulf countries", "USD"],
    ["Hong Kong", "HKD"], ["Hungary", "HUF"], ["India", "INR"], ["Indonesia", "IDR"],
    ["Ireland", "EUR"], ["Italy", "EUR"], ["Japan", "JPY"], ["Kazakhstan", "USD"],
    ["Kenya", "KES"], ["Kuwait", "KWD"], ["Latvia", "LVL"], ["Lebanon", "USD"],
    ["Lithuania", "LTL"], ["Macedonia", "MKD"], ["Malaysia", "MYR"], ["Mexico", "MXN"],
    ["Montenegro", "EUR"], ["Morocco", "MAD"], ["Netherlands", "EUR"], ["New Zealand", "NZD"],
    ["Nigeria", "NGN"], ["Norway", "NOK"], ["Oman", "OMR"], ["Pakistan", "PKR"],
    ["Panama", "USD"], ["Peru", "USD"], ["Philippines", "PHP"], ["Poland", "PLN"],
    ["Portugal", "EUR"], ["Puerto Rico", "USD"], ["Qatar", "QR"], ["Romania", "USD"],
    ["Russia", "RUB"], ["Saudi Arabia", "SAR"], ["Serbia", "EUR"], ["Singapore", "SGD"],
    ["Slovakia", "EUR"], ["Slovenia", "EUR"], ["South Africa", "ZAR"], ["South Korea", "KRW"],
    ["Spain", "EUR"], ["Sri Lanka", "SLR"], ["Sweden", "SEK"], ["Switzerland", "CHF"],
    ["Taiwan", "TWD"], ["Thailand", "THB"], ["Turkey", "TRY"], ["Ukraine", "USD"],
    ["United Arab Emirates", "AED"], ["United Kingdom", "GBP"], ["United States", "USD"],
    ["Uruguay", "UYU"], ["Venezuela", "VEF"], ["Vietnam", "VND"],
  ];

  // [name, text] — text "" means section header
  const DEFINITIONS = [
    ["As a reminder, below are the definitions we use for each media format:", ""],
    ["Television", ""],
    ["Free TV (linear)", "Net ad revenues of linear free TV networks (commercials+sponsorship). It generally includes two to six “historic” channels (e.g. ITV1, Channel 4 and Channel 5 in the UK), plus a number of digital free-to-view themed channels (e.g. ITV2, ITV3 etc. in the UK)."],
    ["Pay/Multichannel TV (linear)", "Net ad revenues of linear pay/Multichannel TV networks (commercials+sponsorship) e.g. Sky channels in Germany and the UK."],
    ["Free TV (digital)", "Non-linear net ad revenues of traditional broadcasters (mostly BVOD ad sales)."],
    ["Pay/Multichannel TV (digital)", "Non-linear ad revenues of pay/Multichannel TV operators (mostly streaming) PLUS the ad sales of premium long-form pure-players like Amazon Prime and Netflix."],
    ["Digital", ""],
    ["Static Display", "Static banners on browsers and mobile phones. Excludes social media."],
    ["Other Digital Formats", "All digital pureplay display-type formats not covered above. Excludes search, social media, digital video and retail media, which are estimated centrally."],
    ["Digital Retail Media", "Digital retail media refers to the advertising spend on retailer-owned websites, apps, and other digital platforms, including pure-play online retailers (e.g., Amazon, eBay, Alibaba, Rakuten, Mercado Libre, Meituan/Dianping) and digitally enabled stores of physical chains (e.g., Walmart, Carrefour, Aldi, Tesco, The Home Depot, Reliance)."],
    ["Other Media", ""],
    ["Newspapers (linear)", "Traditional ad pages. Includes paper daily, weekly, and monthly newspapers."],
    ["Magazines (linear)", "Traditional ad pages. Includes paper daily, weekly, monthly, and specialty consumer magazines."],
    ["Newspapers (digital)", "Advertising on newspaper digital platforms. Includes desktop, mobile, and app inventory across daily, weekly, and monthly newspaper brands."],
    ["Magazines (digital)", "Advertising on magazine-owned digital platforms, including desktop websites, mobile web, and apps. Covers daily, weekly, monthly, and specialty consumer magazine brands across display, video, and native formats."],
    ["Radio", "Local and national broadcast radio. Includes satellite radio; does not include streaming audio or podcasts."],
    ["Streaming Audio", "Audio content, including music and spoken word, delivered via live streaming or direct download on any device. Includes music streaming services (ex. Spotify), AM/FM online streams. Does not include satellite radio or owned music (ex. MP3s)."],
    ["Podcasts", "Podcasting sponsorships and commercials."],
    ["Traditional OOH", "Includes indoor and outdoor traditional (paper or vinyl) formats, such as roadside billboards, transit, and street furniture."],
    ["Digital OOH", "Digital signage (LCD etc.) managed by traditional OOH vendors in traditional environments, as well as digital place-based specialists in special environments such as gas stations, gyms, buildings, taxis, elevators, etc."],
    ["Cinema", "Advertising shown in cinemas, including on-screen and in-foyer formats."],
  ];

  function colLetter(n) {
    let s = "";
    while (n > 0) {
      const m = (n - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  function growthFormula(colL, prevL, row) {
    const cur = `${colL}${row - 1}`;
    const prev = `${prevL}${row - 1}`;
    return `IF(OR(${prev}="",${prev}=0,${cur}=""),"-----",${cur}/${prev}-1)`;
  }

  function buildDefinitionsSheet(wb) {
    const ws = wb.addWorksheet("Definitions");
    let r = 1;
    for (const [name, text] of DEFINITIONS) {
      const nameCell = ws.getRow(r).getCell(2);
      nameCell.value = name;
      nameCell.font = { bold: true };
      if (text) ws.getRow(r).getCell(3).value = text;
      r += 1;
    }
    ws.getColumn(2).width = 28;
    ws.getColumn(3).width = 110;
    ws.eachRow((row) => {
      row.eachCell((c) => {
        c.alignment = { wrapText: true, vertical: "top" };
      });
    });
    return ws.protect("", {});
  }

  function buildMarketSheet(wb, market, currency, years, editableYears, supplemental) {
    const ws = wb.addWorksheet(market.slice(0, 31));
    const editable = new Set(editableYears);

    const title = supplemental ? `${market} — HISTORICAL RESTATEMENT` : market;
    const note = supplemental
      ? "Please restate historical figures only where your source data has changed."
      : "Please complete the green cells. Leave a cell BLANK if the figure is not available — enter 0 only for a true zero.";
    const b1 = ws.getRow(1).getCell(2);
    b1.value = title;
    b1.font = { bold: true, size: 14 };
    const b2 = ws.getRow(2).getCell(2);
    b2.value = `LOCAL CURRENCY (${currency}), MILLIONS`;
    b2.font = { bold: true };
    const b3 = ws.getRow(3).getCell(2);
    b3.value = note;
    b3.font = { italic: true, size: 9 };

    const hdrRow = 4;
    years.forEach((y, i) => {
      const c = ws.getRow(hdrRow).getCell(DATA_START_COL + i);
      c.value = y;
      c.font = { bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
      c.alignment = { horizontal: "center" };
    });

    // first pass: assign rows so totals can reference children defined below them
    const rowOf = {};
    let r = hdrRow + 1;
    for (const [code, , kind] of SERIES) {
      if (kind === "gap") { r += 1; continue; }
      rowOf[code] = r;
      r += 2; // data row + growth row
    }

    r = hdrRow + 1;
    for (const [code, label, kind, children] of SERIES) {
      if (kind === "gap") { r += 1; continue; }
      ws.getRow(r).getCell(1).value = code;
      const lab = ws.getRow(r).getCell(2);
      lab.value = label;
      if (kind.startsWith("block")) lab.font = { bold: true };
      const isInput = kind === "input" || kind === "block-input";
      years.forEach((y, i) => {
        const col = DATA_START_COL + i;
        const cell = ws.getRow(r).getCell(col);
        cell.numFmt = "#,##0.0";
        if (children) {
          const refs = children.map((ch) => `${colLetter(col)}${rowOf[ch]}`).join("+");
          cell.value = { formula: refs };
        } else if (isInput && editable.has(y)) {
          cell.protection = { locked: false };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INPUT_GREEN } };
        }
      });
      r += 1;
      const gl = ws.getRow(r).getCell(2);
      gl.value = "• Growth";
      gl.font = { italic: true, size: 9 };
      years.forEach((y, i) => {
        const col = DATA_START_COL + i;
        const g = ws.getRow(r).getCell(col);
        g.numFmt = "0.0%";
        g.font = { italic: true, size: 9 };
        if (i === 0) g.value = "-----";
        else g.value = { formula: growthFormula(colLetter(col), colLetter(col - 1), r) };
      });
      r += 1;
    }

    ws.getColumn(1).hidden = true;
    ws.getColumn(2).width = 34;
    years.forEach((_, i) => { ws.getColumn(DATA_START_COL + i).width = 11; });
    ws.views = [{ state: "frozen", xSplit: DATA_START_COL - 1, ySplit: hdrRow }];
    return ws.protect("", {});
  }

  // options: { market, currency, years: [..], editableYears: [..], supplemental: bool }
  async function buildWorkbook(ExcelJS, opts) {
    const wb = new ExcelJS.Workbook();
    await buildDefinitionsSheet(wb);
    await buildMarketSheet(wb, opts.market, opts.currency, opts.years, opts.editableYears, opts.supplemental);
    return wb;
  }

  function range(from, to) {
    const out = [];
    for (let y = from; y <= to; y++) out.push(y);
    return out;
  }

  return { SERIES, MARKETS, DEFINITIONS, buildWorkbook, range };
});
