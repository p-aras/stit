import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import "./RateCalculator.css";

/* =========================
   CONFIG
   ========================= */
const SHEET_ID = "18KNc9xYqv-vnFFiIkot2Q1MoLvB0n4RukELnQUz-wtQ";
const TAB_NAME = "RateList";
const API_KEY = "AIzaSyAomDFBkOySlIxKWSKGHe6ATv9gvaBr7uk";
const RANGE = `${TAB_NAME}!A:F`; // ⬅️ now reading 6 cols (adds F = FULL/HALF)
const SHEETS_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(
  RANGE
)}?key=${API_KEY}`;

// ✅ Apps Script Web App endpoint
const GAS_WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbxNahLrvNXkvqwZaL0ITvO0RYYRza9RuTqR33lDEsmrv2XHx1zp7yPik_kRpoQsAcRi/exec";

/* Branding (edit these to your business) */
const ORG_NAME = "Your Company";
const ORG_ADDR_LINE1 = "Industrial Area, Jaipur";
const ORG_PHONE = "+91 98XXXXXXXX";
const ORG_GSTIN = "GSTIN: 22AAAAA0000A1Z5";

/* Slip style — 80mm thermal-like */
const RECEIPT = {
  WIDTH_PX: 576,
  PADDING: 18,
  DPI_SCALE: 2,
  LINE_H: 22,
  FONT_BODY:
    "14px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  FONT_BOLD:
    "bold 14px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  FONT_HDR:
    "bold 16px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  GREY: "#374151",
  LIGHT: "#9CA3AF",
  DARK: "#111827",
  ACCENT: "#000000",
};

/* Default Submitter options */
const DEFAULT_SUBMITTERS = ["Monu", "Sanjay", "Vinay", "Sonu", "Rohit"];

/* =========================
   INLINE STYLES
   ========================= */
const modalSx = {
  layer: {
    position: "fixed",
    inset: 0,
    zIndex: 60,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
  },
  backdrop: {
    position: "absolute",
    inset: 0,
    background: "rgba(2,6,23,.55)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
  },
  cardBase: {
    position: "relative",
    width: "min(880px, 96vw)",
    maxHeight: "90vh",
    display: "flex",
    flexDirection: "column",
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,.15)",
    background:
      "linear-gradient(0deg, rgba(248,250,252,.9), rgba(248,250,252,.9))",
    overflow: "hidden",
  },
  cardNarrow: { width: "min(560px, 94vw)" },
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    padding: "12px 16px 8px",
    flexShrink: 0,
  },
  scrollArea: {
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
    padding: "0 16px 8px",
  },
  actionsRow: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    padding: 16,
    borderTop: "1px solid rgba(15,23,42,.08)",
    background: "rgba(255,255,255,.75)",
    backdropFilter: "saturate(120%) blur(2px)",
    flexShrink: 0,
  },
  pillTotal: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    background: "#eef2ff",
    border: "1px solid #c7d2fe",
    color: "#111827",
    padding: "10px 14px",
    borderRadius: 999,
    fontWeight: 700,
    fontSize: 14,
  },
  title: { margin: 0, fontSize: 20, fontWeight: 800, color: "#0f172a" },
  sub: { margin: "2px 0 0 0", fontSize: 13, color: "#334155" },
  btnGhost: {
    background: "transparent",
    border: "1px solid rgba(15,23,42,.15)",
    padding: "10px 14px",
    borderRadius: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  btnPrimary: {
    background: "linear-gradient(180deg,#2563eb,#1e40af)",
    color: "#fff",
    border: "1px solid #1e40af",
    padding: "10px 14px",
    borderRadius: 12,
    fontWeight: 700,
    boxShadow: "0 6px 16px rgba(37,99,235,.35)",
    cursor: "pointer",
  },
  tableWrap: {
    margin: "8px 0 0",
    borderRadius: 12,
    overflow: "hidden",
    border: "1px solid #e5e7eb",
  },
  hint: { fontSize: 12, color: "#475569", marginTop: 6 },
};

/* =========================
   UTILITIES
   ========================= */
const formatINR = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(n || 0));

function nowISTParts() {
  const d = new Date();
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = fmt
    .formatToParts(d)
    .reduce((acc, p) => ((acc[p.type] = p.value), acc), {});
  const yyyy = parts.year,
    mm = parts.month,
    dd = parts.day,
    HH = parts.hour,
    MM = parts.minute;
  return {
    yyyy,
    mm,
    dd,
    HH,
    MM,
    display: `${dd}/${mm}/${yyyy} ${HH}:${MM} IST`,
  };
}

function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/* =========================
   TEXT & CANVAS HELPERS
   ========================= */
function textW(ctx, t) {
  return ctx.measureText(t).width;
}
function dashed(ctx, x1, y1, x2, y2) {
  ctx.save();
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}
function wrapTextMeasure(ctx, text, maxW) {
  const words = String(text || "").split(/\s+/);
  const lines = [];
  let line = "";
  for (let i = 0; i < words.length; i++) {
    const probe = line ? line + " " + words[i] : words[i];
    if (textW(ctx, probe) <= maxW) {
      line = probe;
    } else {
      if (line) lines.push(line);
      line = words[i];
    }
  }
  if (line) lines.push(line);
  return lines;
}

/* =========================
   A4 BLACK-ONLY JPEG BUILDER (with checkbox column & page border)
   ========================= */
async function buildAndDownloadJPEG_Receipt_A4({
  category,
  billRows,
  total,
  submitterName,
  lotNo,
  checkedRows,
}) {
  const DPI_SCALE = 2;
  const PAGE_WIDTH = 794; // A4 width at 96 DPI
  const PAGE_HEIGHT = 1123; // A4 height at 96 DPI
  const PADDING = 40;
  const LINE_H = 32;
  const FONT_BODY = "16px 'Courier New', monospace";
  const FONT_BOLD = "bold 16px 'Arial Black', Arial, sans-serif";
  const FONT_HDR = "bold 22px 'Courier New', monospace";

  const ctxMeasure = document.createElement("canvas").getContext("2d");
  ctxMeasure.font = FONT_BODY;

  const wrapText = (ctx, text, maxW) => {
    const words = String(text || "").split(/\s+/);
    const lines = [];
    let line = "";
    for (const word of words) {
      const testLine = line ? line + " " + word : word;
      if (ctx.measureText(testLine).width <= maxW) {
        line = testLine;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    return lines;
  };

  const formatINR = (n) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(Number(n || 0));

  // Columns
  const col1 = PADDING; // Attribute
  const col2 = col1 + 180; // Option
  const col3 = col2 + 140; // Rate
  const col4 = col3 + 80; // Qty
  const col5 = col4 + 80; // Check
  const col6 = col5 + 80; // Amount
  const col7 = PAGE_WIDTH - PADDING; // Right edge
  const labelWidth = col2 - col1 - 15;

  // Measure total rows
  let rowCount = 0;
  billRows.forEach((r) => {
    const lines = wrapText(ctxMeasure, `${r.attr}`, labelWidth);
    rowCount += Math.max(lines.length, 1);
  });

  const metaRows = 6;
  const signatureGap = 4;
  const tableHeight = (rowCount + metaRows + signatureGap) * LINE_H;
  const canvasHeight = Math.max(PAGE_HEIGHT, tableHeight + PADDING * 2);

  const canvas = document.createElement("canvas");
  canvas.width = PAGE_WIDTH * DPI_SCALE;
  canvas.height = canvasHeight * DPI_SCALE;
  const ctx = canvas.getContext("2d");

  // Reset & base
  ctx.scale(DPI_SCALE, DPI_SCALE);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = "#000000";
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;
  ctx.font = FONT_BODY;

  // White background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, PAGE_WIDTH, canvasHeight);

  // Page border (solid black)
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, PAGE_WIDTH - 8, canvasHeight - 8);

  let y = PADDING;

  // Title
  ctx.font = FONT_BOLD;
  ctx.fillStyle = "#000000";
  const title = "RATE LIST";
  const titleWidth = ctx.measureText(title).width;
  ctx.fillText(title, (PAGE_WIDTH - titleWidth) / 2, y);
  y += LINE_H * 1.5;

  // Metadata
  ctx.font = FONT_BOLD;
  ctx.fillStyle = "#000000";
  const { display } = nowISTParts();
  ctx.fillText(`Category: ${category || "-"}`, col1, y);
  y += LINE_H;
  ctx.fillText(`Submitter: ${submitterName || "-"}`, col1, y);
  y += LINE_H;
  ctx.fillText(`Date: ${display}`, col1, y);
  y += LINE_H * 1.5;
  ctx.fillText(`Lot No.: ${lotNo || "-"}`, col1, y);
  y += LINE_H;

  const crisp = (v) => Math.round(v) + 0.5;
  const vline = (x, y1, y2) => {
    ctx.beginPath();
    ctx.moveTo(crisp(x), crisp(y1));
    ctx.lineTo(crisp(x), crisp(y2));
    ctx.stroke();
  };

  const COLS = [col1, col2, col3, col4, col5, col6, col7];

  // Header row
  ctx.font = FONT_BOLD;
  ctx.fillStyle = "#000000";
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;

  ctx.strokeRect(col1, y, col7 - col1, LINE_H);
  for (let i = 1; i < COLS.length; i++) {
    if (i < COLS.length - 1) vline(COLS[i], y, y + LINE_H);
  }
  ctx.fillText("Attribute", col1 + 8, y + 22);
  ctx.fillText("Option", col2 + 8, y + 22);
  ctx.fillText("Rate", col3 + 8, y + 22);
  ctx.fillText("Qty", col4 + 8, y + 22);
  ctx.fillText("Check", col5 + 20, y + 22);
  const amountHeaderText = "Amount";
  const amountHeaderWidth = ctx.measureText(amountHeaderText).width;
  ctx.fillText(
    amountHeaderText,
    col6 + (col7 - col6 - amountHeaderWidth - 8),
    y + 22
  );
  y += LINE_H;

  // Rows
  ctx.font = FONT_BOLD;
  billRows.forEach((r, idx) => {
    const lines = wrapText(ctx, r.attr, labelWidth);
    const rowHeight = Math.max(lines.length * LINE_H, LINE_H);

    ctx.strokeRect(col1, y, col7 - col1, rowHeight);
    for (let i = 1; i < COLS.length; i++) {
      if (i < COLS.length - 1) vline(COLS[i], y, y + rowHeight);
    }

    lines.forEach((line, j) => {
      const yPos = y + (j + 1) * LINE_H - 8;
      ctx.fillText(line, col1 + 8, yPos);
    });

    // Option
    let optionText = r.opt ?? "";
    const maxOptionWidth = col3 - col2 - 16;
    if (ctx.measureText(optionText).width > maxOptionWidth) {
      while (
        optionText.length > 3 &&
        ctx.measureText(optionText + "...").width > maxOptionWidth
      ) {
        optionText = optionText.slice(0, -1);
      }
      optionText = optionText + "...";
    }
    ctx.fillText(optionText, col2 + 8, y + 22);

    // Rate centered
    const rateStr = formatINR(r.rate);
    const rateWidth = ctx.measureText(rateStr).width;
    const rateX = col3 + (col4 - col3 - rateWidth) / 2;
    ctx.fillText(rateStr, rateX, y + 22);

    // Qty centered
    const qtyStr = String(r.qty);
    const qtyWidth = ctx.measureText(qtyStr).width;
    const qtyX = col4 + (col5 - col4 - qtyWidth) / 2;
    ctx.fillText(qtyStr, qtyX, y + 22);

    // Amount right aligned
    const amtStr = formatINR(r.amount);
    const amountWidth = ctx.measureText(amtStr).width;
    const amountX = col6 + (col7 - col6 - amountWidth - 8);
    ctx.fillText(amtStr, amountX, y + 22);

    // Checkbox
    const checkboxX = col5 + 20;
    const checkboxY = y + 10;
    const checkboxSize = 14;
    ctx.strokeRect(checkboxX, checkboxY, checkboxSize, checkboxSize);

    y += rowHeight;
  });

  // Total row
  ctx.strokeRect(col1, y, col7 - col1, LINE_H);
  for (let i = 1; i < COLS.length; i++) {
    if (i < COLS.length - 1) vline(COLS[i], y, y + LINE_H);
  }
  const totalStr = formatINR(total);
  ctx.fillText("TOTAL", col1 + 8, y + 22);
  const totalAmountWidth = ctx.measureText(totalStr).width;
  const totalAmountX = col6 + (col7 - col6 - totalAmountWidth - 8);
  ctx.fillText(totalStr, totalAmountX, y + 22);
  y += LINE_H * 1.5;

  // Signature boxes...
  const contentEnd = y + LINE_H * 3;
  if (contentEnd < canvas.height / DPI_SCALE - PADDING) {
    y = canvas.height / DPI_SCALE - LINE_H * 3;
  }

  ctx.font = FONT_BOLD;
  const BOX_GAP = 12;
  const totalW = col7 - col1;
  const boxW = Math.floor((totalW - BOX_GAP * 3) / 4); // 4 boxes
  const boxH = Math.max(LINE_H * 2.5, 80);
  const topY = y;

  function hline(x1, x2, yy) {
    ctx.beginPath();
    ctx.moveTo(Math.round(x1) + 0.5, Math.round(yy) + 0.5);
    ctx.lineTo(Math.round(x2) + 0.5, Math.round(yy) + 0.5);
    ctx.stroke();
  }

  function drawSignatureBox(x, yTop, w, h, labelText) {
    ctx.strokeRect(x, yTop, w, h);
    const lineY = yTop + Math.min(42, h * 0.55);
    hline(x + 12, x + w - 12, lineY);
    const labelWidth = ctx.measureText(labelText).width;
    ctx.fillText(labelText, x + (w - labelWidth) / 2, lineY + 18);
  }

  drawSignatureBox(col1, topY, boxW, boxH, "Pintu ");
  drawSignatureBox(col1 + (boxW + BOX_GAP) * 1, topY, boxW, boxH, "Mohit Sir ");
  drawSignatureBox(col1 + (boxW + BOX_GAP) * 2, topY, boxW, boxH, "Submitter ");

  const acX = col1 + (boxW + BOX_GAP) * 3;
  const acY = topY;
  const acW = boxW;
  const acH = boxH;
  ctx.strokeRect(acX, acY, acW, acH);
  ctx.fillText("Any Change: Yes/No", acX + 12, acY + 22);
  const innerPad = 12;
  const innerTop = acY + 28;
  const innerH = acH - (innerTop - acY) - innerPad;
  ctx.strokeRect(acX + innerPad, innerTop, acW - innerPad * 2, innerH);

  y = topY + boxH + LINE_H * 0.5;

  // Download
  const { yyyy, mm, dd, HH, MM } = nowISTParts();
  const safeCategory = (category || "RateList").replace(/[^\w-]+/g, "_");
  const safeSubmitter = (submitterName || "NA").replace(/[^\w-]+/g, "_");
  const filename = `RateList_A4_${safeCategory}_${safeSubmitter}_${yyyy}${mm}${dd}_${HH}${MM}.jpg`;
  const jpeg = canvas.toDataURL("image/jpeg", 0.95);
  downloadDataUrl(jpeg, filename);
}

/* =========================
   SMALL UI HELPERS
   ========================= */
function useClickOutside(ref, onOutside) {
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) onOutside?.();
    }
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [ref, onOutside]);
}

/* =========================
   DROPDOWNS
   ========================= */
function MultiSelectDropdown({
  label,
  options,
  selected = [],
  onChange,
  placeholder = "Select options",
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrapRef = useRef(null);
  useClickOutside(wrapRef, () => setOpen(false));

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return options;
    return options.filter(({ option }) => option.toLowerCase().includes(t));
  }, [q, options]);

  const toggle = (opt) => {
    const exists = selected.includes(opt);
    const next = exists ? selected.filter((o) => o !== opt) : [...selected, opt];
    onChange(next);
  };

  const clearAll = () => onChange([]);

  const summaryText =
    selected.length === 0
      ? placeholder
      : selected.length === 1
      ? selected[0]
      : `${selected.length} selected`;

  return (
    <div className="dd" ref={wrapRef}>
      <button
        type="button"
        className={`dd-control ${open ? "open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={summaryText}
      >
        <span className={`dd-value ${selected.length ? "strong" : ""}`}>
          {summaryText}
        </span>
        <span className="dd-arrow">▾</span>
      </button>

      {open && (
        <div className="dd-menu" role="listbox" aria-multiselectable="true">
          <div className="dd-search">
            <input
              className="dd-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search…"
            />
            {!!selected.length && (
              <button className="dd-clear" onClick={clearAll} type="button" title="Clear all">
                Clear
              </button>
            )}
          </div>

          <div className="dd-list">
            {filtered.length ? (
              filtered.map(({ option, rate }) => (
                <label
                  className={`dd-item ${selected.includes(option) ? "checked" : ""}`}
                  key={`${option}-${rate}`}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(option)}
                    onChange={() => toggle(option)}
                  />
                  <span className="dd-item-text">{option}</span>
                  <span className="dd-item-rate">{formatINR(rate)}</span>
                </label>
              ))
            ) : (
              <div className="dd-empty">No matches</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SingleSelectDropdown({ options, value = "", onChange, placeholder = "Select option" }) {
  return (
    <div className="dd">
      <div className="rc-select-wrap">
        <select
          className="rc-select rc-select-strong"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{`— ${placeholder} —`}</option>
          {options.map(({ option, rate }) => (
            <option key={`${option}-${rate}`} value={option}>
              {option} ({formatINR(rate)})
            </option>
          ))}
        </select>
        <span className="rc-chev" aria-hidden>
          ▾
        </span>
      </div>
    </div>
  );
}

/* =========================
   ATTRIBUTE NORMALIZATION (EN + HINDI → canonical keys)
   ========================= */
function toCanonicalAttr(attrRaw = "") {
  const a = String(attrRaw).trim().toLowerCase();

  // English
  if (a === "cut") return "cut";
  if (a === "label") return "label";
  if (a === "bone") return "bone";
  if (a === "gulla") return "gulla";
  if (a === "teera" || a === "tira" || a === "tera") return "teera";

  // Hindi variants (common spellings)
  if (a === "कट") return "cut";
  if (a === "लेबल") return "label";
  if (a === "बोन") return "bone";
  if (a === "गुल्ला" || a === "गुल्ला ") return "gulla";
  if (a === "तीरा" || a === "टीरा" || a === "तीरा ") return "teera";

  // Fallback: not qty-based
  return "other";
}

const QTY_KEYS = new Set(["cut", "label", "bone", "gulla", "teera"]);
const isQtyKey = (k) => QTY_KEYS.has(k);

/* =========================
   ANIMATIONS: Confetti + Overlays
   ========================= */
function launchConfetti(durationMs = 1200, particleCount = 180) {
  const canvas = document.createElement("canvas");
  canvas.className = "confetti-canvas";
  const ctx = canvas.getContext("2d");
  document.body.appendChild(canvas);

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  const onRes = () => resize();
  window.addEventListener("resize", onRes);

  const colors = ["#ef4444","#f59e0b","#10b981","#3b82f6","#8b5cf6","#ec4899"];
  const P = Array.from({ length: particleCount }).map(() => ({
    x: Math.random() * canvas.width,
    y: -10 - Math.random() * 80,
    r: 4 + Math.random() * 6,
    c: colors[(Math.random() * colors.length) | 0],
    vx: -2 + Math.random() * 4,
    vy: 2 + Math.random() * 3,
    spin: Math.random() * Math.PI * 2,
    vr: -0.2 + Math.random() * 0.4,
    life: durationMs + Math.random() * 400
  }));

  let last = performance.now();
  function tick(t) {
    const dt = Math.min(32, t - last);
    last = t;

    ctx.clearRect(0,0,canvas.width,canvas.height);
    P.forEach(p => {
      p.vy += 0.06; // gravity
      p.x += p.vx;
      p.y += p.vy;
      p.spin += p.vr;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.r, -p.r, p.r*2, p.r*2 * (0.6 + Math.abs(Math.sin(p.spin))*0.6));
      ctx.restore();

      p.life -= dt;
    });

    if (performance.now() - last < durationMs || P.some(p => p.life > 0 && p.y < canvas.height + 40)) {
      requestAnimationFrame(tick);
    } else {
      window.removeEventListener("resize", onRes);
      canvas.remove();
    }
  }
  requestAnimationFrame(tick);
}

function LoadingOverlay({
  messages = [
    "Connecting to server…",
    "Saving to Google Sheets…",
    "Generating A4 JPEG…",
    "Almost done…",
  ],
  intervalMs = 1100,
  staticMessage = "Please wait for a while till we create your document…",
}) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % messages.length), intervalMs);
    return () => clearInterval(t);
  }, [messages.length, intervalMs]);

  return (
    <div className="rc-fullscreen" role="alert" aria-live="assertive">
      <div className="rc-fs-card">
        <h3 className="rc-fs-title">Processing your submission</h3>

        <div className="dance" aria-hidden>
          <span></span><span></span><span></span>
        </div>

        <div className="rc-progress" aria-hidden></div>

        <div className="rc-rotator" aria-live="polite">
          <div key={idx} className="rot-line">{messages[idx]}</div>
        </div>

        <p className="rc-fs-sub" style={{marginTop: 8}}>{staticMessage}</p>
      </div>
    </div>
  );
}

function SuccessOverlay({ submitterName, totalINR, onClose }) {
  useEffect(() => {
    launchConfetti();
  }, []);

  return (
    <div className="rc-fullscreen" role="dialog" aria-modal="true" aria-label="Submission successful">
      <div className="rc-fs-card">
        <div className="check-wrap" aria-hidden>
          <svg viewBox="0 0 120 120">
            <circle className="circle" cx="60" cy="60" r="48" fill="none" stroke="#16a34a" strokeWidth="8" />
            <path className="tick" d="M36 62 L54 78 L86 42" fill="none" stroke="#16a34a" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <h3 className="rc-fs-title">Submitted successfully!</h3>
        <p className="rc-fs-sub">
          Thank you{submitterName ? `, ${submitterName}` : ""}! Your document has been created.
        </p>
        {typeof totalINR === "string" && (
          <p className="rc-fs-sub" style={{marginTop: 6}}>
            Total: <b>{totalINR}</b>
          </p>
        )}
        <button className="rc-fs-btn" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

/* =========================
   CATEGORY CARD COMPONENT
   ========================= */
function CategoryCard({ category, onClick, isSelected = false }) {
  return (
    <div 
      className={`rc-category-card ${isSelected ? "rc-category-card--selected" : ""}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={`Select ${category} category`}
    >
      <div className="rc-category-card__icon">
        <span className="rc-category-card__emoji">📁</span>
      </div>
      <div className="rc-category-card__content">
        <h3 className="rc-category-card__title">{category}</h3>
        <p className="rc-category-card__subtitle">Click to view rates</p>
      </div>
      <div className="rc-category-card__arrow">
        <span>→</span>
      </div>
    </div>
  );
}

/* =========================
   MAIN COMPONENT
   ========================= */
export default function RateCalculator() {
  const [rows, setRows] = useState([]);
  const [category, setCategory] = useState("");
  const [form, setForm] = useState({});
  const [qty, setQty] = useState({ Cut: 1, Label: 0, Bone: 0, Gulla: 0, Teera: 0 });
  const [qtyByAttr, setQtyByAttr] = useState({}); // ⬅️ NEW: dynamic per-attribute qty from sheet
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitterOpen, setSubmitterOpen] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);

  const [submitter, setSubmitter] = useState(DEFAULT_SUBMITTERS[0] || "");
  const [useCustomSubmitter, setUseCustomSubmitter] = useState(false);
  const [customSubmitter, setCustomSubmitter] = useState("");
  const [lotNo, setLotNo] = useState("");

  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitErr, setSubmitErr] = useState("");
  const [pendingTotalINR, setPendingTotalINR] = useState("");

  // NEW: animation/overlay state
  const [pendingSubmitterName, setPendingSubmitterName] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  const confirmCardRef = useRef(null);
  const [confirmDialogPng, setConfirmDialogPng] = useState(null);

  // NEW: Track if we're on category selection screen
  const [showCategorySelection, setShowCategorySelection] = useState(true);

  // NEW: Track subcategory selection for Jacket
  const [selectedSubcategory, setSelectedSubcategory] = useState("");
  // NEW: Track jacket type selection (Full/Half) for ALL jacket subcategories
  const [selectedJacketType, setSelectedJacketType] = useState("");

  const fetchRates = useCallback(async () => {
    setErr("");
    setLoading(true);
    try {
      const res = await fetch(SHEETS_URL);
      if (!res.ok) throw new Error(`Sheets API ${res.status}`);
      const data = await res.json();
      const values = data.values || [];
      const [, ...body] = values;
      const parsed = body
        .map((r) => ({
          Category: (r[0] || "").trim(),
          Attribute: (r[1] || "").trim(),
          Option: (r[2] || "").trim(),
          Rate: Number(r[3] || 0),
          NeedsQty: String(r[4] || "").trim().toLowerCase() === "yes", // ⬅️ NEW
          FullHalf: (r[5] || "").trim().toUpperCase(), // ⬅️ NEW: FULL/HALF column
        }))
        .filter((r) => r.Category && r.Attribute && r.Option);
      setRows(parsed);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  // NEW: Group categories with Jacket as main category
  const categories = useMemo(() => {
    const allCategories = new Set(rows.map((r) => r.Category));
    const categoriesArray = Array.from(allCategories).sort();
    
    // Check which jacket-related categories exist
    const hasWindcheater = categoriesArray.includes("WINDCHEATER");
    const hasFillingJacket = categoriesArray.includes("FILLING JACKET");
    const hasLeather = categoriesArray.includes("LEATHER");
    
    // Create grouped categories
    const groupedCategories = [];
    
    // Add Jacket as main category if subcategories exist
    if (hasWindcheater || hasFillingJacket || hasLeather) {
      groupedCategories.push("Jacket");
    }
    
    // Add other categories except the jacket subcategories
    categoriesArray.forEach(cat => {
      if (cat !== "WINDCHEATER" && cat !== "FILLING JACKET" && cat !== "LEATHER") {
        groupedCategories.push(cat);
      }
    });
    
    return groupedCategories;
  }, [rows]);

  // Also update the jacketSubcategories useMemo:
  const jacketSubcategories = useMemo(() => {
    const subcats = [];
    if (rows.some(r => r.Category === "WINDCHEATER")) {
      subcats.push("WINDCHEATER");
    }
    if (rows.some(r => r.Category === "FILLING JACKET")) {
      subcats.push("FILLING JACKET");
    }
    if (rows.some(r => r.Category === "LEATHER")) {
      subcats.push("LEATHER");
    }
    return subcats;
  }, [rows]);

  // Map of attribute -> [{option, rate}] - UPDATED to handle subcategories and FULL/HALF for ALL jacket types
  const attributes = useMemo(() => {
    const map = {};
    
    console.log('Current category:', category);
    console.log('Current subcategory:', selectedSubcategory);
    console.log('Current jacket type:', selectedJacketType);
    console.log('All rows count:', rows.length);
    
    if (category === "Jacket" && selectedSubcategory) {
      // For ALL Jacket subcategories with selected type (Full/Half) - filter by FULL/HALF column
      let jacketRows = rows.filter((r) => 
        r.Category === selectedSubcategory && 
        (r.FullHalf === selectedJacketType.toUpperCase() || !r.FullHalf)
      );
      
      console.log('Jacket rows for', selectedSubcategory, 'type', selectedJacketType, ':', jacketRows.length);
      
      jacketRows.forEach((r) => {
        if (!map[r.Attribute]) map[r.Attribute] = [];
        map[r.Attribute].push({ option: r.Option, rate: r.Rate });
      });
    } else if (category && category !== "Jacket") {
      // For regular categories - include all rows (ignore FULL/HALF for non-jacket)
      const categoryRows = rows.filter((r) => r.Category === category);
      console.log('Category rows for', category, ':', categoryRows.length);
      
      categoryRows.forEach((r) => {
        if (!map[r.Attribute]) map[r.Attribute] = [];
        map[r.Attribute].push({ option: r.Option, rate: r.Rate });
      });
    }
    
    console.log('Final attributes map:', Object.keys(map));
    
    // de-dup same (option,rate)
    Object.keys(map).forEach((attr) => {
      const seen = new Set();
      map[attr] = map[attr].filter((x) => {
        const k = `${x.option}|${x.rate}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    });
    return map;
  }, [rows, category, selectedSubcategory, selectedJacketType]);

  // Set of attributes that require quantity (from Sheet col E) for current category - UPDATED
  const quantityAttrSet = useMemo(() => {
    const s = new Set();
    
    if (category === "Jacket" && selectedSubcategory) {
      // For ALL Jacket subcategories with selected type
      const jacketRows = rows.filter((r) => 
        r.Category === selectedSubcategory && 
        (r.FullHalf === selectedJacketType.toUpperCase() || !r.FullHalf)
      );
      
      jacketRows
        .filter((r) => r.NeedsQty)
        .forEach((r) => s.add(r.Attribute));
    } else {
      rows
        .filter((r) => r.Category === category && r.NeedsQty)
        .forEach((r) => s.add(r.Attribute));
    }
    
    return s;
  }, [rows, category, selectedSubcategory, selectedJacketType]);

  const getRate = (attr, opt) => {
    let match;
    
    if (category === "Jacket" && selectedSubcategory) {
      // For ALL Jacket subcategories - filter by selected type
      match = rows.find(
        (r) =>
          r.Category === selectedSubcategory && 
          r.Attribute === attr && 
          r.Option === opt &&
          (r.FullHalf === selectedJacketType.toUpperCase() || !r.FullHalf)
      );
    } else {
      match = rows.find(
        (r) =>
          r.Category === category && r.Attribute === attr && r.Option === opt
      );
    }
    
    return match?.Rate ?? 0;
  };

  const normalizedForm = useMemo(() => {
    const out = {};
    Object.entries(form).forEach(([attr, val]) => {
      if (Array.isArray(val)) out[attr] = val;
      else if (val == null || val === "") out[attr] = [];
      else out[attr] = [val];
    });
    return out;
  }, [form]);

  // Quantity lookup using canonical key (legacy fixed ones)
  const qtyForKey = (key) => {
    switch (key) {
      case "cut":
        return Math.max(1, Number(qty.Cut || 1));
      case "label":
        return Math.max(0, Number(qty.Label || 0));
      case "bone":
        return Math.max(0, Number(qty.Bone || 0));
      case "gulla":
        return Math.max(0, Number(qty.Gulla || 0));
      case "teera":
        return Math.max(0, Number(qty.Teera || 0));
      default:
        return 1;
    }
  };

  const billRows = useMemo(() => {
    const lines = [];
    Object.entries(normalizedForm).forEach(([attr, opts]) => {
      const key = toCanonicalAttr(attr);
      const attrNeedsQty = quantityAttrSet.has(attr) || isQtyKey(key);

      // decide qty value
      let qtyVal = 1;
      if (quantityAttrSet.has(attr)) {
        const v = Number(qtyByAttr[attr] ?? 1);
        qtyVal = Math.max(1, isNaN(v) ? 1 : v);
      } else if (isQtyKey(key)) {
        qtyVal = qtyForKey(key);
      }

      opts.forEach((opt) => {
        const rate = getRate(attr, opt) || 0;
        const amount = attrNeedsQty ? rate * qtyVal : rate;
        lines.push({ attr, opt, rate, qty: attrNeedsQty ? qtyVal : 1, amount });
      });
    });
    return lines.sort(
      (a, b) => a.attr.localeCompare(b.attr) || a.opt.localeCompare(b.opt)
    );
  }, [
    normalizedForm,
    qty.Cut,
    qty.Label,
    qty.Bone,
    qty.Gulla,
    qty.Teera,
    rows,
    category,
    selectedSubcategory,
    selectedJacketType,
    quantityAttrSet,
    qtyByAttr,
  ]);

  const total = useMemo(
    () => billRows.reduce((s, r) => s + r.amount, 0),
    [billRows]
  );

  const resetForm = () => {
    setForm({});
    setQty({ Cut: 1, Label: 0, Bone: 0, Gulla: 0, Teera: 0 });
    setQtyByAttr({}); // ⬅️ reset dynamic qtys
    setConfirmOpen(false);
    setSubmitterOpen(false);
    setSubmitErr("");
    setSubmitLoading(false);
    setLotNo("");
    setSelectedJacketType(""); // Reset jacket type
  };

  const handleCategorySelect = (selectedCategory) => {
    setCategory(selectedCategory);
    
    // If Jacket is selected, show subcategory selection, else go directly to calculator
    if (selectedCategory === "Jacket") {
      setShowCategorySelection(false);
      // Don't reset form here, wait for subcategory selection
    } else {
      setShowCategorySelection(false);
      resetForm();
    }
  };

  const handleSubcategorySelect = (subcategory) => {
    setSelectedSubcategory(subcategory);
    setSelectedJacketType(""); // Reset jacket type when changing subcategory
    
    // For ALL jacket subcategories, we need to select type first
    resetForm();
  };

  const handleJacketTypeSelect = (jacketType) => {
    setSelectedJacketType(jacketType);
    // Reset form when jacket type is selected to start fresh
    setForm({});
    setQty({ Cut: 1, Label: 0, Bone: 0, Gulla: 0, Teera: 0 });
    setQtyByAttr({});
  };

  const handleBackToCategories = () => {
    setShowCategorySelection(true);
    setCategory("");
    setSelectedSubcategory(""); // Reset subcategory when going back
    setSelectedJacketType(""); // Reset jacket type
    resetForm();
  };

  const handleBackToSubcategories = () => {
    setSelectedSubcategory("");
    setSelectedJacketType(""); // Reset jacket type
    resetForm();
  };

  const handleBackToJacketTypes = () => {
    setSelectedJacketType("");
    resetForm();
  };

  const onConfirmSubmit = async () => {
    try {
      if (confirmCardRef.current) {
        const dataUrl = await nodeToPng(confirmCardRef.current, 2);
        setConfirmDialogPng(dataUrl);
      }
    } catch {
      setConfirmDialogPng(null);
    } finally {
      setConfirmOpen(false);
      setSubmitterOpen(true);
    }
  };

  async function onSubmitWithSubmitter() {
    setSubmitErr("");
    const finalSubmitter = (useCustomSubmitter
      ? customSubmitter.trim()
      : submitter.trim()) || "";
    if (!finalSubmitter) {
      setSubmitErr("Please choose or enter a submitter name.");
      return;
    }
    
    // For Jacket category, ensure subcategory is selected
    if (category === "Jacket" && !selectedSubcategory) {
      setSubmitErr("Please select a jacket subcategory.");
      return;
    }
    
    // For ALL jacket subcategories, ensure type is selected
    if (category === "Jacket" && !selectedJacketType) {
      setSubmitErr("Please select jacket type (Full/Half).");
      return;
    }
    
    if (!category || billRows.length === 0) {
      setSubmitErr("Please select category and at least one option.");
      return;
    }
    const finalLotNo = String(lotNo || "").trim();
    if (!finalLotNo) {
      setSubmitErr("Please enter a Lot No.");
      return;
    }

    // Remember who to thank on success
    setPendingSubmitterName(finalSubmitter);

    const timestampIST = nowISTParts().display;
    
    // Determine the actual category for saving (use subcategory for Jacket)
    const actualCategory = category === "Jacket" ? selectedSubcategory : category;
    
    const payload = {
      action: "submitQuote",
      data: {
        timestampIST,
        category: actualCategory, // Use actual category for saving
        displayCategory: category, // Keep display category for UI
        subcategory: category === "Jacket" ? selectedSubcategory : null,
        jacketType: category === "Jacket" ? selectedJacketType : null,
        total,
        submitterName: finalSubmitter,
        lotNo: finalLotNo,
        qty,            // legacy fixed qtys
        qtyByAttr,      // ⬅️ NEW: dynamic per-attribute qtys from sheet's Quantity = Yes
        selections: billRows,
      },
    };

    try {
      setSubmitLoading(true);

      const savePromise = fetch(GAS_WEB_APP_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });

      const jpegPromise = buildAndDownloadJPEG_Receipt_A4({
        category: actualCategory + (selectedJacketType ? ` - ${selectedJacketType}` : ''), // Include jacket type in filename
        billRows,
        total,
        submitterName: finalSubmitter,
        lotNo: finalLotNo,
        checkedRows: billRows.map(() => true),
      });

      const res = await savePromise;
      if (!res.ok) throw new Error(`Apps Script HTTP ${res.status}`);
      const result = await res.json().catch(() => ({}));
      if (result?.status && result.status !== "ok") {
        throw new Error(result?.message || "Apps Script responded with an error");
      }

      await jpegPromise;

      setPendingTotalINR(formatINR(total));

      setShowSuccess(true);
      setSubmitterOpen(false);
      setJustSubmitted(true);
      setTimeout(() => setJustSubmitted(false), 2500);

      resetForm();
      setShowCategorySelection(true); // Go back to category selection after successful submission
      setCategory("");
      setSelectedSubcategory("");
      setSelectedJacketType("");
      setConfirmDialogPng(null);
    } catch (e) {
      setSubmitErr(String(e.message || e));
    } finally {
      setSubmitLoading(false);
    }
  }

  const pageClass = `rc-page ${confirmOpen || submitterOpen ? "modal-open" : ""}`;

  return (
    <div className={pageClass}>
      <div className="rc-gradient" aria-hidden />
      <div className="rc-wrap">
        {/* MAIN HEADER */}
        <header
          className="rc-header"
          style={{
            background: "#bcc4d6ff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            boxShadow:
              "0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.10)",
            padding: 16,
            marginBottom: 16,
          }}
        >
          <div className="rc-title">
            <span className="rc-logo" aria-hidden>💰</span>
            <div>
              <h1>
                Rate Calculator <span className="rc-emoji">🧮</span>
              </h1>
              <p>
                {showCategorySelection 
                  ? "Select a category to get started" 
                  : category === "Jacket" && !selectedSubcategory
                  ? "Select jacket type"
                  : category === "Jacket" && !selectedJacketType
                  ? "Select jacket style"
                  : `Building rates for: ${category}${selectedSubcategory ? ` - ${selectedSubcategory}` : ''}${selectedJacketType ? ` - ${selectedJacketType}` : ''}`}
              </p>
            </div>
          </div>
          <div className="rc-actions">
            {!showCategorySelection && (
              <>
                {category === "Jacket" && selectedJacketType && (
                  <button
                    type="button"
                    className="rc-btn ghost"
                    onClick={handleBackToJacketTypes}
                    title="Back to jacket styles"
                    aria-label="Back to jacket styles"
                  >
                    <span className="rc-btn-emoji">👕</span> Jacket Style
                  </button>
                )}
                {category === "Jacket" && selectedSubcategory && (
                  <button
                    type="button"
                    className="rc-btn ghost"
                    onClick={handleBackToSubcategories}
                    title="Back to jacket types"
                    aria-label="Back to jacket types"
                  >
                    <span className="rc-btn-emoji">🧥</span> Jacket Types
                  </button>
                )}
                <button
                  type="button"
                  className="rc-btn ghost"
                  onClick={handleBackToCategories}
                  title="Back to categories"
                  aria-label="Back to categories"
                >
                  <span className="rc-btn-emoji">📁</span> Categories
                </button>
              </>
            )}
            
            <button
              type="button"
              className="rc-btn ghost"
              onClick={fetchRates}
              disabled={loading}
              title="Refresh rates from Google Sheets"
              aria-label="Refresh rates"
            >
              <span className="rc-btn-emoji">{loading ? "⏳" : "🔃"}</span>
              {loading ? "Refreshing…" : "Refresh"}
            </button>

            {!showCategorySelection && category && (category !== "Jacket" || (selectedSubcategory && selectedJacketType)) && (
              <button
                type="button"
                className="rc-btn ghost"
                onClick={() => {
                  resetForm();
                }}
                title="Clear all selections"
              >
                <span className="rc-btn-emoji">🔄</span> Reset
              </button>
            )}
          </div>
        </header>

        {err && (
          <div className="rc-alert" role="alert">
            <span className="rc-alert-emoji">❌</span>
            <div>
              <strong>Unable to load rates</strong>
              <span>{err}</span>
            </div>
          </div>
        )}

        {/* CATEGORY SELECTION SCREEN */}
        {showCategorySelection && (
          <div className="rc-category-screen">
            <div className="rc-card rc-main-card">
              <div className="rc-card-header">
                <span className="rc-card-emoji">📁</span>
                <h2>Select Category</h2>
              </div>

              {loading && (
                <div className="rc-category-grid">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div className="rc-category-skeleton" key={i}>
                      <div className="rc-category-skeleton-icon">⏳</div>
                      <div className="rc-category-skeleton-text"></div>
                    </div>
                  ))}
                </div>
              )}

              {!loading && categories.length > 0 && (
                <div className="rc-category-grid">
                  {categories.map((cat) => (
                    <CategoryCard
                      key={cat}
                      category={cat}
                      onClick={() => handleCategorySelect(cat)}
                      isSelected={category === cat}
                    />
                  ))}
                </div>
              )}

              {!loading && categories.length === 0 && (
                <div className="rc-empty-state">
                  <span className="rc-empty-emoji">📝</span>
                  <p>No categories found. Please check your Google Sheets data.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SUBCATEGORY SELECTION SCREEN FOR JACKET */}
        {!showCategorySelection && category === "Jacket" && !selectedSubcategory && (
          <div className="rc-category-screen">
            <div className="rc-card rc-main-card">
              <div className="rc-card-header">
                <span className="rc-card-emoji">🧥</span>
                <h2>Select Jacket Type</h2>
                <p className="rc-card-subtitle">Choose the specific type of jacket</p>
              </div>

              {loading && (
                <div className="rc-category-grid">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div className="rc-category-skeleton" key={i}>
                      <div className="rc-category-skeleton-icon">⏳</div>
                      <div className="rc-category-skeleton-text"></div>
                    </div>
                  ))}
                </div>
              )}

              {!loading && jacketSubcategories.length > 0 && (
                <div className="rc-category-grid">
                  {jacketSubcategories.map((subcat) => (
                    <CategoryCard
                      key={subcat}
                      category={subcat}
                      onClick={() => handleSubcategorySelect(subcat)}
                      isSelected={selectedSubcategory === subcat}
                    />
                  ))}
                </div>
              )}

              {!loading && jacketSubcategories.length === 0 && (
                <div className="rc-empty-state">
                  <span className="rc-empty-emoji">📝</span>
                  <p>No jacket types found. Please check your Google Sheets data.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* JACKET TYPE SELECTION SCREEN (FULL/HALF) FOR ALL JACKET SUBCATEGORIES */}
        {!showCategorySelection && category === "Jacket" && selectedSubcategory && !selectedJacketType && (
          <div className="rc-category-screen">
            <div className="rc-card rc-main-card">
              <div className="rc-card-header">
                <span className="rc-card-emoji">👕</span>
                <h2>Select Jacket Style</h2>
                <p className="rc-card-subtitle">Choose the style for {selectedSubcategory}</p>
              </div>

              {loading && (
                <div className="rc-category-grid">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div className="rc-category-skeleton" key={i}>
                      <div className="rc-category-skeleton-icon">⏳</div>
                      <div className="rc-category-skeleton-text"></div>
                    </div>
                  ))}
                </div>
              )}

              {!loading && (
                <div className="rc-category-grid">
                  <CategoryCard
                    category="Full"
                    onClick={() => handleJacketTypeSelect("Full")}
                    isSelected={selectedJacketType === "Full"}
                  />
                  <CategoryCard
                    category="Half"
                    onClick={() => handleJacketTypeSelect("Half")}
                    isSelected={selectedJacketType === "Half"}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* RATE CALCULATOR SCREEN */}
        {!showCategorySelection && category && (category !== "Jacket" || (selectedSubcategory && selectedJacketType)) && (
          <div className="rc-layout">
            {/* Left: Selector Card */}
            <div className="rc-card rc-main-card">
              <div className="rc-card-header">
                <span className="rc-card-emoji">🔧</span>
                <h2>Attributes & Options</h2>
                <span className="rc-current-category">
                  {category}
                  {selectedSubcategory && ` - ${selectedSubcategory}`}
                  {selectedJacketType && ` - ${selectedJacketType}`}
                </span>
              </div>

              {/* Loading Skeleton */}
              {loading && (
                <div className="rc-grid">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div className="rc-skel" key={i}>
                      <div className="rc-skel-emoji">⏳</div>
                      <div className="rc-skel-text"></div>
                    </div>
                  ))}
                </div>
              )}

              {/* Attributes */}
              {!loading && !!category && (category !== "Jacket" || (selectedSubcategory && selectedJacketType)) && (
                <div className="rc-grid">
                  {Object.keys(attributes).length === 0 ? (
                    <div className="rc-empty-state">
                      <span className="rc-empty-emoji">📝</span>
                      <p>No attributes found for {category}{selectedSubcategory ? ` - ${selectedSubcategory}` : ''}{selectedJacketType ? ` - ${selectedJacketType}` : ''}. Please check your Google Sheets data.</p>
                    </div>
                  ) : (
                    Object.keys(attributes).map((attr) => {
                      const opts = attributes[attr] || [];
                      const selArr =
                        (form[attr] &&
                          (Array.isArray(form[attr]) ? form[attr] : [form[attr]])) ||
                        [];
                      const key = toCanonicalAttr(attr);

                      // Qty requirement: sheet-driven OR legacy fixed ones
                      const needsQty = quantityAttrSet.has(attr) || isQtyKey(key);

                      // UI behavior: qty-based -> single select + qty input; others -> multi select
                      const isSingle = needsQty;

                      // Label for qty field
                      const qtyLabelFromKey =
                        key === "cut"
                          ? "How many cuts?"
                          : key === "label"
                          ? "Label quantity"
                          : key === "bone"
                          ? "How many bone?"
                          : key === "gulla"
                          ? "How many gulla?"
                          : key === "teera"
                          ? "How many teera?"
                          : "How many quantity?";

                      // Current qty value
                      const qtyValue =
                        quantityAttrSet.has(attr)
                          ? (qtyByAttr[attr] ?? 1)
                          : key === "cut"
                          ? qty.Cut
                          : key === "label"
                          ? qty.Label
                          : key === "bone"
                          ? qty.Bone
                          : key === "gulla"
                          ? qty.Gulla
                          : key === "teera"
                          ? qty.Teera
                          : 1;

                      const qtyMin =
                        quantityAttrSet.has(attr) || key === "cut" ? 1 : 0;

                      return (
                        <div className="rc-field rc-field-card rc-field-glow" key={attr}>
                          <label className="rc-label">
                            <span className="rc-label-emoji">🔧</span>
                            {attr}
                          </label>

                          {!isSingle ? (
                            <MultiSelectDropdown
                              label={attr}
                              options={opts}
                              selected={selArr}
                              onChange={(next) =>
                                setForm((prev) => ({ ...prev, [attr]: next }))
                              }
                              placeholder={`Select ${attr}`}
                            />
                          ) : (
                            <>
                              <SingleSelectDropdown
                                options={opts}
                                value={selArr[0] || ""}
                                onChange={(v) => {
                                  setForm((prev) => ({
                                    ...prev,
                                    [attr]: v ? [v] : [],
                                  }));
                                  // Auto set qty to 1 for qty-based attr if currently 0
                                  if (v) {
                                    if (quantityAttrSet.has(attr)) {
                                      setQtyByAttr((q) => ({
                                        ...q,
                                        [attr]: Math.max(1, Number(q[attr] ?? 1)),
                                      }));
                                    } else {
                                      // legacy keys
                                      if (key === "label" && !qty.Label)
                                        setQty((q) => ({ ...q, Label: 1 }));
                                      if (key === "bone" && !qty.Bone)
                                        setQty((q) => ({ ...q, Bone: 1 }));
                                      if (key === "gulla" && !qty.Gulla)
                                        setQty((q) => ({ ...q, Gulla: 1 }));
                                      if (key === "teera" && !qty.Teera)
                                        setQty((q) => ({ ...q, Teera: 1 }));
                                    }
                                  }
                                }}
                                placeholder={`Select ${attr}`}
                              />

                              {selArr[0] && (
                                <div className="rc-qty-row">
                                  <label className="rc-label small">
                                    <span className="rc-label-emoji">🔢</span>
                                    {qtyLabelFromKey}
                                  </label>
                                  <div className="rc-input-group">
                                    <input
                                      type="number"
                                      min={qtyMin}
                                      className="rc-input rc-input-strong"
                                      value={qtyValue}
                                      onChange={(e) => {
                                        const val = Number(e.target.value || qtyMin);
                                        if (quantityAttrSet.has(attr)) {
                                          setQtyByAttr((q) => ({
                                            ...q,
                                            [attr]: Math.max(qtyMin, val),
                                          }));
                                        } else {
                                          setQty((q) => {
                                            if (key === "cut") return { ...q, Cut: val };
                                            if (key === "label") return { ...q, Label: val };
                                            if (key === "bone") return { ...q, Bone: val };
                                            if (key === "gulla") return { ...q, Gulla: val };
                                            if (key === "teera") return { ...q, Teera: val };
                                            return q;
                                          });
                                        }
                                      }}
                                      placeholder={String(qtyMin)}
                                    />
                                    <span className="rc-input-emoji">📦</span>
                                  </div>
                                  <span className="rc-hint">
                                    Per-{quantityAttrSet.has(attr) ? "unit" : key} rate:{" "}
                                    <b>{formatINR(getRate(attr, selArr[0]))}</b>
                                  </span>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Right: Summary Card */}
            <div className="rc-card rc-summary-card rc-sticky">
              <div className="rc-card-header">
                <span className="rc-card-emoji">💰</span>
                <h2>Price Summary</h2>
              </div>

              <div className="rc-summary">
                <div className="rc-total" aria-live="polite">
                  <span>Total Amount</span>
                  <div className="rc-total-amount">
                    <strong>{formatINR(total)}</strong>
                    <span className="rc-total-emoji">💰</span>
                  </div>
                </div>

                <div className="rc-selections">
                  <h3 className="rc-selections-title">Selected Options</h3>
                  <div className="rc-pills">
                    {billRows.length ? (
                      billRows.map((r, i) => {
                        const key = toCanonicalAttr(r.attr);
                        const sheetQty = quantityAttrSet.has(r.attr);
                        const showQty = sheetQty || isQtyKey(key);
                        return (
                          <span
                            className="rc-pill rc-pill-strong"
                            key={`${r.attr}-${r.opt}-${i}`}
                            title={`${r.attr}: ${r.opt}`}
                          >
                            <span className="rc-pill-emoji">✅</span>
                            <b>{r.attr}</b>
                            <em>{r.opt}</em>
                            {showQty && <em> × {r.qty}</em>}
                            <em className="rc-pill-rate">{formatINR(r.rate)}</em>
                          </span>
                        );
                      })
                    ) : (
                      <div className="rc-empty-state">
                        <span className="rc-empty-emoji">📝</span>No selections yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="rc-actions-bottom">
                <button
                  className="rc-btn primary rc-btn-submit"
                  disabled={!category || billRows.length === 0}
                  onClick={() => setConfirmOpen(true)}
                >
                  <span className="rc-btn-emoji">📤</span> Review & Confirm
                </button>
                <button
                  className="rc-btn ghost"
                  onClick={resetForm}
                  title="Clear selections"
                >
                  <span className="rc-btn-emoji">🗑️</span> Clear
                </button>
              </div>
            </div>
          </div>
        )}

        <footer className="rc-foot">
          <span className="rc-foot-emoji">💡</span>
          <span>
            {showCategorySelection 
              ? "Select a category to start building your rate calculation"
              : category === "Jacket" && !selectedSubcategory
              ? "Select the specific type of jacket to view its rates"
              : category === "Jacket" && !selectedJacketType
              ? "Select jacket style (Full/Half) to view rates"
              : "Tip: Use the dropdowns; most attributes support multiple selection via checkboxes. Items marked with Quantity in the sheet will ask for a count."}
          </span>
        </footer>
      </div>

      {/* Modal 1: Review & Confirm */}
      {confirmOpen && (
        <div
          className="rc-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Review and confirm"
          style={modalSx.layer}
        >
          <div
            className="rc-modal-backdrop"
            onClick={() => setConfirmOpen(false)}
            style={modalSx.backdrop}
          />
          <div
            className="rc-modal-card rc-bill"
            style={{ ...modalSx.cardBase }}
            ref={confirmCardRef}
          >
            <div style={modalSx.headerRow}>
              <div>
                <h3 className="rc-modal-title" style={modalSx.title}>
                  <span className="rc-modal-emoji">📋</span> Review Your Selections
                </h3>
                <p className="rc-modal-sub" style={modalSx.sub}>
                  <span>Category:</span> <b>{category || "—"}{selectedSubcategory ? ` - ${selectedSubcategory}` : ''}{selectedJacketType ? ` - ${selectedJacketType}` : ''}</b>
                </p>
              </div>
              <div className="rc-bill-total" style={modalSx.pillTotal}>
                <span>Total</span>
                <strong>{formatINR(total)}</strong>
                <span className="rc-bill-emoji">💰</span>
              </div>
            </div>

            <div style={modalSx.scrollArea}>
              <div
                className="rc-bill-table rc-bill-table-strong"
                style={modalSx.tableWrap}
              >
                <div
                  className="rc-bill-row rc-bill-row--head"
                  style={{ background: "#f8fafc" }}
                >
                  <div>Attribute</div>
                  <div>Option</div>
                  <div className="rc-right">Rate</div>
                  <div className="rc-right">Qty</div>
                  <div className="rc-right">Amount</div>
                </div>
                {billRows.length ? (
                  billRows.map((r, i) => (
                    <div
                      className="rc-bill-row"
                      key={i}
                      style={{
                        background: i % 2 ? "rgba(248,250,252,.75)" : "transparent",
                      }}
                    >
                      <div>🔧 {r.attr}</div>
                      <div>{r.opt}</div>
                      <div className="rc-right">{formatINR(r.rate)}</div>
                      <div className="rc-right">{r.qty}</div>
                      <div className="rc-right">{formatINR(r.amount)}</div>
                    </div>
                  ))
                ) : (
                  <div className="rc-bill-empty" style={{ padding: 16 }}>
                    <span className="rc-empty-emoji">📝</span>Nothing selected.
                  </div>
                )}
              </div>
            </div>

            <div className="rc-modal-actions" style={modalSx.actionsRow}>
              <button
                className="rc-btn ghost"
                style={modalSx.btnGhost}
                onClick={() => setConfirmOpen(false)}
              >
                <span className="rc-btn-emoji">✏️</span> Edit
              </button>
              <button
                className="rc-btn primary"
                style={modalSx.btnPrimary}
                onClick={onConfirmSubmit}
              >
                <span className="rc-btn-emoji">✅</span> Confirm & Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Submitter */}
      {submitterOpen && (
        <div
          className="rc-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Submitter name"
          style={modalSx.layer}
        >
          <div
            className="rc-modal-backdrop"
            onClick={() => setSubmitterOpen(false)}
            style={modalSx.backdrop}
          />
          <div
            className="rc-modal-card"
            style={{ ...modalSx.cardBase, ...modalSx.cardNarrow }}
          >
            <div className="rc-card-header" style={modalSx.headerRow}>
              <div>
                <h3 style={modalSx.title}>
                  <span className="rc-card-emoji">👤</span> Submitter Details
                </h3>
                <p style={modalSx.sub}>Choose an existing name or enter a custom one.</p>
              </div>
            </div>

            <div style={{ ...modalSx.scrollArea, paddingTop: 4 }}>
              <div className="rc-field" style={{ padding: "8px 16px 0" }}>
                <label className="rc-label" style={{ marginBottom: 8 }}>
                  <span className="rc-label-emoji">📝</span>Select Submitter
                </label>

                <div
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    background: "rgba(255,255,255,.8)",
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    padding: "4px 10px",
                  }}
                >
                  <select
                    style={{
                      appearance: "none",
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      width: "100%",
                      padding: "8px 28px 8px 4px",
                      fontWeight: 600,
                      color: "#0f172a",
                    }}
                    value={useCustomSubmitter ? "__custom__" : submitter}
                    onChange={(e) => {
                      if (e.target.value === "__custom__") setUseCustomSubmitter(true);
                      else {
                        setUseCustomSubmitter(false);
                        setSubmitter(e.target.value);
                      }
                    }}
                  >
                    {DEFAULT_SUBMITTERS.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                    <option value="__custom__">— Custom name… —</option>
                  </select>
                  <span aria-hidden style={{ position: "absolute", right: 10 }}>
                    ▾
                  </span>
                </div>

                {useCustomSubmitter && (
                  <div
                    style={{
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      background: "rgba(255,255,255,.8)",
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      padding: "4px 10px",
                      marginTop: 10,
                    }}
                  >
                    <input
                      type="text"
                      style={{
                        border: "none",
                        outline: "none",
                        background: "transparent",
                        width: "100%",
                        padding: "8px 4px",
                        fontWeight: 600,
                        color: "#0f172a",
                      }}
                      placeholder="Enter custom name"
                      value={customSubmitter}
                      onChange={(e) => setCustomSubmitter(e.target.value)}
                    />
                    <span className="rc-input-emoji" aria-hidden>✍️</span>
                  </div>
                )}

                <div className="rc-field" style={{ marginTop: 12 }}>
                  <label className="rc-label" style={{ marginBottom: 8 }}>
                    <span className="rc-label-emoji">🏷️</span> Lot No.
                  </label>
                  <div
                    style={{
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      background: "rgba(255,255,255,.8)",
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      padding: "4px 10px",
                    }}
                  >
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      style={{
                        border: "none",
                        outline: "none",
                        background: "transparent",
                        width: "100%",
                        padding: "8px 4px",
                        fontWeight: 600,
                        color: "#0f172a",
                      }}
                      placeholder="Enter Lot No."
                      value={lotNo}
                      onChange={(e) => setLotNo(e.target.value)}
                    />
                    <span className="rc-input-emoji" aria-hidden>🔢</span>
                  </div>
                  <p className="rc-hint" style={{ marginTop: 6 }}>
                    This will be saved with the submission in Google Sheets.
                  </p>
                </div>

                {!!submitErr && (
                  <div className="rc-alert" role="alert" style={{ marginTop: 12 }}>
                    <span className="rc-alert-emoji">⚠️</span>
                    <div>
                      <strong>Cannot submit</strong>
                      <span>{submitErr}</span>
                    </div>
                  </div>
                )}

                <p style={modalSx.hint}>
                  Submitting will save to Google Sheet and download a <b>small JPEG receipt</b>.
                </p>
              </div>
            </div>

            <div className="rc-modal-actions" style={modalSx.actionsRow}>
              <button
                className="rc-btn ghost"
                style={modalSx.btnGhost}
                onClick={() => setSubmitterOpen(false)}
              >
                <span className="rc-btn-emoji">↩️</span> Back
              </button>
              <button
                className="rc-btn primary"
                style={modalSx.btnPrimary}
                onClick={onSubmitWithSubmitter}
                disabled={submitLoading}
              >
                <span className="rc-btn-emoji">{submitLoading ? "⏳" : "🚀"}</span>
                {submitLoading ? "Submitting…" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW: Full-screen loading overlay while submitting */}
      {submitLoading && (
        <LoadingOverlay
          messages={[
            "Connecting to server…",
            "Saving to Google Sheets…",
            "Generating A4 JPEG…",
            "Almost done…",
          ]}
          staticMessage="Please wait for a while till we create your document…"
        />
      )}

      {/* NEW: Success screen with confetti & thanks */}
      {showSuccess && (
        <SuccessOverlay
          submitterName={pendingSubmitterName}
          totalINR={pendingTotalINR}
          onClose={() => setShowSuccess(false)}
        />
      )}

      {/* Toast */}
      {justSubmitted && (
        <div className="rc-toast">
          <span className="rc-toast-emoji">🎉</span>
          Small Rate Slip Generated! (Saved & JPEG downloaded)
        </div>
      )}
    </div>
  );

  // simple DOM->PNG helper (still used in review step)
  async function nodeToPng(node, scale = 2) {
    const rect = node.getBoundingClientRect();
    const width = Math.ceil(rect.width);
    const height = Math.ceil(rect.height);
    const cloned = node.cloneNode(true);
    const wrapper = document.createElement("div");
    wrapper.style.margin = "0";
    wrapper.style.padding = "0";
    wrapper.style.background = "transparent";
    wrapper.appendChild(cloned);
    wrapper.setAttribute(
      "style",
      `margin:0;padding:0;background:transparent;width:${width}px;height:${height}px;`
    );
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject x="0" y="0" width="100%" height="100%">${new XMLSerializer().serializeToString(
      wrapper
    )}</foreignObject></svg>`;
    const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    try {
      const img = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = url;
        i.crossOrigin = "anonymous";
      });
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.floor(width * scale));
      canvas.height = Math.max(1, Math.floor(height * scale));
      const ctx = canvas.getContext("2d");
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.drawImage(img, 0, 0);
      return canvas.toDataURL("image/png");
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}