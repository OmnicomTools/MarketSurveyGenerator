"use strict";
(function () {
  const { MARKETS, buildWorkbook, range } = SurveyCore;

  const grid = document.getElementById("marketGrid");
  const countEl = document.getElementById("marketCount");
  const statusEl = document.getElementById("status");
  const errorEl = document.getElementById("error");
  const btn = document.getElementById("generateBtn");

  let historicalDb = null;

  MARKETS.forEach(([market]) => {
    const label = document.createElement("label");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = market;
    cb.checked = true;
    cb.addEventListener("change", updateCount);
    label.appendChild(cb);
    label.appendChild(document.createTextNode(market));
    grid.appendChild(label);
  });

  function boxes() { return [...grid.querySelectorAll("input[type=checkbox]")]; }
  function updateCount() {
    countEl.textContent = `${boxes().filter((b) => b.checked).length} of ${MARKETS.length}`;
  }
  updateCount();

  document.getElementById("selectAll").addEventListener("click", () => {
    boxes().forEach((b) => { b.checked = true; });
    updateCount();
  });
  document.getElementById("selectNone").addEventListener("click", () => {
    boxes().forEach((b) => { b.checked = false; });
    updateCount();
  });

  document.querySelectorAll("input[name=stype]").forEach((r) => {
    r.addEventListener("change", () => {
      if (r.value === "supplemental" && r.checked) {
        setYears(2018, 2024, 2018, 2024);
      } else if (r.checked) {
        setYears(1999, 2026, 2025, 2026);
      }
    });
  });
  function setYears(yf, yt, ef, et) {
    document.getElementById("yearFrom").value = yf;
    document.getElementById("yearTo").value = yt;
    document.getElementById("editFrom").value = ef;
    document.getElementById("editTo").value = et;
  }

  function intVal(id) { return parseInt(document.getElementById(id).value, 10); }

  fetch("data/historical-values.json")
    .then((r) => {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then((data) => { historicalDb = data; })
    .catch((e) => {
      console.warn("Could not load historical values:", e);
      historicalDb = null;
    });

  btn.addEventListener("click", async () => {
    errorEl.textContent = "";
    const supplemental = document.querySelector("input[name=stype]:checked").value === "supplemental";
    const populateHistorical =
      document.querySelector("input[name=populate]:checked").value === "historical";
    const yf = intVal("yearFrom"), yt = intVal("yearTo");
    const ef = intVal("editFrom"), et = intVal("editTo");
    if ([yf, yt, ef, et].some(isNaN) || yf > yt || ef > et) {
      errorEl.textContent = "Please check the year ranges — 'from' must not be after 'to'.";
      return;
    }
    if (ef < yf || et > yt) {
      errorEl.textContent = "Editable years must fall within the year columns shown.";
      return;
    }
    const selected = MARKETS.filter(([m]) => boxes().some((b) => b.checked && b.value === m));
    if (!selected.length) {
      errorEl.textContent = "Select at least one market.";
      return;
    }
    if (populateHistorical && !historicalDb) {
      errorEl.textContent =
        "Historical data is not available. Choose blank templates, or refresh and try again.";
      return;
    }

    const years = range(yf, yt);
    const editableYears = range(ef, et);
    const suffix = supplemental ? "Historical Restatement" : "Survey";

    btn.disabled = true;
    try {
      const zip = new JSZip();
      let single = null;
      let missingHist = [];
      for (let i = 0; i < selected.length; i++) {
        const [market, currency] = selected[i];
        statusEl.textContent = `Generating ${market} (${i + 1}/${selected.length})...`;
        await new Promise((res) => setTimeout(res, 0));
        const histEntry = populateHistorical ? historicalDb.markets[market] : null;
        if (populateHistorical && !histEntry) missingHist.push(market);
        const wb = await buildWorkbook(ExcelJS, {
          market,
          currency,
          years,
          editableYears,
          supplemental,
          historicalValues: histEntry ? histEntry.values : null,
        });
        const buf = await wb.xlsx.writeBuffer();
        const fname = `${market} ${suffix}.xlsx`;
        if (selected.length === 1) single = { fname, buf };
        else zip.file(fname, buf);
      }
      if (single) {
        download(single.fname, new Blob([single.buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      } else {
        statusEl.textContent = "Zipping...";
        const blob = await zip.generateAsync({ type: "blob" });
        const stamp = new Date().toISOString().slice(0, 10);
        download(`${supplemental ? "Historical Restatements" : "Market Surveys"} ${stamp}.zip`, blob);
      }
      let msg = `Done — ${selected.length} file${selected.length > 1 ? "s" : ""} generated.`;
      if (missingHist.length) {
        msg += ` No historical data for: ${missingHist.join(", ")}.`;
      }
      statusEl.textContent = msg;
    } catch (e) {
      console.error(e);
      errorEl.textContent = `Something went wrong: ${e.message}`;
      statusEl.textContent = "";
    } finally {
      btn.disabled = false;
    }
  });

  function download(name, blob) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }
})();
