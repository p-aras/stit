import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import "./RateCalculator.css";

/* =========================
   CONFIG
   ========================= */
const SHEET_ID = "18KNc9xYqv-vnFFiIkot2Q1MoLvB0n4RukELnQUz-wtQ";
const TAB_NAME = "RateList";
const API_KEY = "AIzaSyAomDFBkOySlIxKWSKGHe6ATv9gvaBr7uk";
const RANGE = `${TAB_NAME}!A:H`;
const SHEETS_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(
  RANGE
)}?key=${API_KEY}`;

const GET_SHEETS_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?key=${API_KEY}`;

const GAS_WEB_APP_URL =
  "https://script.google.com/macros/s/AKfycbxAcQIKPzXy4oEkQ6hO8aSZjO3NtA0sSQxnc4UTMTreYHX39ueLguDz-bwX97HX3IFf/exec";

const EXISTING_LOTS_SHEET_ID = "1AhDU_LPVXJB-jZoeJ7gt7uZ2r1lLMRG5AJdZkYGVaUs";
const EXISTING_LOTS_TAB_NAME = "Master List";
const EXISTING_LOTS_RANGE = `${EXISTING_LOTS_TAB_NAME}!A:L`;

/* Branding */
const ORG_NAME = "Your Company";
const ORG_ADDR_LINE1 = "Industrial Area, Jaipur";
const ORG_PHONE = "+91 98XXXXXXXX";
const ORG_GSTIN = "GSTIN: 22AAAAA0000A1Z5";

const DEFAULT_SUBMITTERS = ["Monu", "Sanjay", "Vinay", "Sonu", "Rohit", "Enjmam", "Kamal", "Sahib"];

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

function cleanText(text) {
  if (!text) return "";
  return String(text)
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s\u0900-\u097F-]/g, '');
}

function extractNumericValue(str) {
  if (!str) return 0;
  const match = String(str).match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
}

function parseLotData(row, headers, sheetName) {
  const lotData = {
    submissionId: cleanText(row[0] || ""),
    timestamp: cleanText(row[1] || ""),
    submitter: cleanText(row[2] || ""),
    category: cleanText(row[3] || sheetName),
    displayCategory: cleanText(row[4] || ""),
    subcategory: cleanText(row[5] || ""),
    jacketType: cleanText(row[6] || ""),
    lotNo: cleanText(row[7] || ""),
    selections: [],
    total: 0,
    rawData: row,
    sheetName: sheetName,
    originalHeaders: headers
  };

  if (!lotData.lotNo) {
    return null;
  }

  let totalIndex = -1;
  for (let i = 0; i < headers.length; i++) {
    const header = cleanText(headers[i] || "");
    if (header.toLowerCase() === "total") {
      totalIndex = i;
      break;
    }
  }

  if (totalIndex !== -1 && row[totalIndex]) {
    lotData.total = extractNumericValue(row[totalIndex]);
  }

  const startCol = 8;
  const endCol = totalIndex !== -1 ? totalIndex : row.length - 1;

  for (let i = startCol; i < endCol; i++) {
    const header = headers[i] || `Column_${i}`;
    const cellValue = row[i];
    
    if (!cellValue) continue;
    
    const rawValue = String(cellValue).trim();
    if (!rawValue || rawValue === "") continue;
    
    if (rawValue.includes('@')) {
      const parsed = parseDetailsString(rawValue);
      
      if (parsed) {
        lotData.selections.push({
          attribute: cleanText(header),
          option: parsed.attribute || "Default",
          rate: parsed.rate,
          qty: 1,
          amount: parsed.amount,
          rawValue: rawValue
        });
      }
    }
  }

  return lotData;
}

function parseDetailsString(details) {
  if (!details) return null;
  
  const detailsStr = String(details).trim();
  const match = detailsStr.match(/([^@]+)@\s*[₹]\s*([\d.]+)\s*=\s*[₹]\s*([\d.]+)/);
  if (match) {
    return {
      attribute: cleanText(match[1]),
      rate: parseFloat(match[2]) || 0,
      amount: parseFloat(match[3]) || 0
    };
  }
  
  return null;
}

// Parse selections from summary string
function parseSelectionsFromSummary(summary) {
  if (!summary) return [];
  
  const selections = [];
  const parts = summary.split(';');
  
  for (const part of parts) {
    const trimmedPart = part.trim();
    if (!trimmedPart) continue;
    
    const colonIndex = trimmedPart.indexOf(':');
    if (colonIndex === -1) continue;
    
    const attribute = cleanText(trimmedPart.substring(0, colonIndex));
    const rest = trimmedPart.substring(colonIndex + 1).trim();
    
    const parenMatch = rest.match(/(.+?)\s*\(₹([\d.]+)\)/);
    if (parenMatch) {
      const option = cleanText(parenMatch[1]);
      const amount = parseFloat(parenMatch[2]);
      
      selections.push({
        attribute: attribute,
        option: option,
        rate: amount,
        qty: 1,
        amount: amount
      });
    }
  }
  
  return selections;
}

// Check if lot number already exists in Master List
async function checkLotExistsInMasterList(lotNo) {
  try {
    if (!lotNo) return { exists: false };
    
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${EXISTING_LOTS_SHEET_ID}/values/${encodeURIComponent(EXISTING_LOTS_RANGE)}?key=${API_KEY}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      return { exists: false, error: `Failed to check existing lots: ${response.status}` };
    }
    
    const data = await response.json();
    const rows = data.values || [];
    
    if (rows.length < 2) {
      return { exists: false };
    }
    
    const headers = rows[0];
    
    // Find Lot No column - should be column I (index 8)
    let lotNoColumnIndex = 8; // Default to column I
    
    for (let i = 0; i < headers.length; i++) {
      const header = cleanText(headers[i] || "").toLowerCase();
      if (header === "lot no" || header === "lotno" || header === "lot number") {
        lotNoColumnIndex = i;
        break;
      }
    }
    
    const searchLotNo = String(lotNo).trim();
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row && row.length > lotNoColumnIndex) {
        const existingLotNo = cleanText(row[lotNoColumnIndex] || "");
        
        if (existingLotNo === searchLotNo) {
          return {
            exists: true,
            submissionId: cleanText(row[1] || "Unknown"),
            submitter: cleanText(row[3] || "Unknown"),
            timestamp: cleanText(row[2] || "Unknown"),
            category: cleanText(row[4] || "Unknown"),
            displayCategory: cleanText(row[5] || ""),
            subcategory: cleanText(row[6] || ""),
            jacketType: cleanText(row[7] || ""),
            lotNo: existingLotNo,
            total: extractNumericValue(row[9] || "0"),
            selectionsSummary: row[11] || ""
          };
        }
      }
    }
    
    return { exists: false };
    
  } catch (error) {
    console.error("Error checking Master List:", error);
    return { exists: false, error: error.message };
  }
}

// Fetch lot from Master List by number
async function fetchLotFromMasterList(lotNo) {
  try {
    if (!lotNo) return null;
    
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${EXISTING_LOTS_SHEET_ID}/values/${encodeURIComponent(EXISTING_LOTS_RANGE)}?key=${API_KEY}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    const rows = data.values || [];
    
    if (rows.length < 2) {
      return null;
    }
    
    const headers = rows[0];
    
    // Find Lot No column
    let lotNoColumnIndex = 8;
    for (let i = 0; i < headers.length; i++) {
      const header = cleanText(headers[i] || "").toLowerCase();
      if (header === "lot no" || header === "lotno") {
        lotNoColumnIndex = i;
        break;
      }
    }
    
    const searchLotNo = String(lotNo).trim();
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row && row.length > lotNoColumnIndex) {
        const existingLotNo = cleanText(row[lotNoColumnIndex] || "");
        
        if (existingLotNo === searchLotNo) {
          const category = cleanText(row[4] || "");
          const displayCategory = cleanText(row[5] || "");
          const subcategory = cleanText(row[6] || "");
          const jacketType = cleanText(row[7] || "");
          const selectionsSummary = row[11] || "";
          
          // Parse selections from summary
          const selections = parseSelectionsFromSummary(selectionsSummary);
          
          return {
            lotNo: existingLotNo,
            submitter: cleanText(row[3] || ""),
            timestamp: cleanText(row[2] || ""),
            submissionId: cleanText(row[1] || ""),
            category: displayCategory || category,
            actualCategory: category,
            subcategory: subcategory,
            jacketType: jacketType,
            total: extractNumericValue(row[9] || "0"),
            selections: selections,
            rawData: row
          };
        }
      }
    }
    
    return null;
    
  } catch (error) {
    console.error("Error fetching lot from Master List:", error);
    return null;
  }
}

async function fetchAllSheets() {
  try {
    const response = await fetch(GET_SHEETS_URL);
    if (!response.ok) throw new Error(`Failed to fetch sheets: ${response.status}`);
    const data = await response.json();
    
    const sheets = data.sheets.map(sheet => ({
      name: sheet.properties.title,
      sheetId: sheet.properties.sheetId,
      index: sheet.properties.index
    }));
    
    return sheets;
  } catch (error) {
    console.error("Error fetching sheets:", error);
    throw error;
  }
}

async function fetchSheetData(sheetName, range = 'A:H', retries = 3) {
  for (let i = 0; i <= retries; i++) {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(sheetName + '!' + range)}?key=${API_KEY}`;
      
      const response = await fetch(url);
      
      if (response.status === 429) {
        if (i < retries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
          continue;
        }
      }
      
      if (!response.ok) {
        if (i < retries) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        throw new Error(`Failed to fetch sheet data: ${response.status}`);
      }
      
      const data = await response.json();
      return data.values || [];
    } catch (error) {
      if (i === retries) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  return [];
}

function parseHeaders(rows) {
  if (!rows || rows.length === 0) return [];
  const headerRow = rows[0];
  return headerRow.map(header => cleanText(header || ""));
}

async function fetchSpecificLot(category, lotNo) {
  try {
    if (!lotNo) return null;
    
    const sheetName = "Lower";
    const lot = await searchLotInSheet(sheetName, lotNo);
    
    if (lot) {
      return lot;
    }
    
    return null;
  } catch (error) {
    console.error("Error fetching specific lot:", error);
    return null;
  }
}

async function searchLotInSheet(sheetName, lotNo) {
  try {
    const rows = await fetchSheetData(sheetName, 'A:ZZZ');
    
    if (!rows || rows.length < 2) {
      return null;
    }
    
    const headers = rows[0] || [];
    
    let totalPosition = -1;
    for (let i = 0; i < headers.length; i++) {
      if (cleanText(headers[i] || "").toLowerCase() === "total") {
        totalPosition = i;
        break;
      }
    }
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row && row.length > 7) {
        const rowLotNo = cleanText(row[7] || "");
        
        if (rowLotNo === String(lotNo).trim()) {
          const lotData = parseLotData(row, headers, sheetName);
          return lotData;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Error searching in sheet ${sheetName}:`, error);
    return null;
  }
}

async function buildAndDownloadJPEG_Receipt_A4({
  category,
  billRows,
  total,
  submitterName,
  lotNo,
  checkedRows,
  showEnglish = false,
}) {
  const DPI_SCALE = 2;
  const PAGE_WIDTH = 794;
  const PAGE_HEIGHT = 1123;
  const PADDING = 40;
  const LINE_H = 32;
  const FONT_BODY = "16px 'Courier New', monospace";
  const FONT_BOLD = "bold 16px Arial, sans-serif";
  const FONT_HDR = "bold 26px Arial, sans-serif";

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

  const col1 = PADDING;
  const col2 = col1 + 180;
  const col3 = col2 + 140;
  const col4 = col3 + 80;
  const col5 = col4 + 100;
  const col6 = col5 + 80;
  const col7 = PAGE_WIDTH - PADDING;
  const labelWidth = col2 - col1 - 15;
  const optionWidth = col3 - col2 - 16;

  let rowCount = 0;
  billRows.forEach((r) => {
    const displayAttr = showEnglish && r.attrEnglish ? r.attrEnglish : r.attr;
    const attrLines = wrapText(ctxMeasure, displayAttr, labelWidth);
    const displayOpt = showEnglish && r.optEnglish ? r.optEnglish : (r.opt || "-");
    const optLines = wrapText(ctxMeasure, displayOpt, optionWidth);
    rowCount += Math.max(attrLines.length, optLines.length, 1);
  });

  const metaRows = 8;
  const signatureGap = 5;
  const tableHeight = (rowCount + metaRows + signatureGap) * LINE_H;
  const canvasHeight = Math.max(PAGE_HEIGHT, tableHeight + PADDING * 2);

  const canvas = document.createElement("canvas");
  canvas.width = PAGE_WIDTH * DPI_SCALE;
  canvas.height = canvasHeight * DPI_SCALE;
  const ctx = canvas.getContext("2d");

  ctx.scale(DPI_SCALE, DPI_SCALE);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, PAGE_WIDTH, canvasHeight);

  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, PAGE_WIDTH - 20, canvasHeight - 20);

  let y = PADDING;

  const titleBoxH = 60;
  const fullW = col7 - col1;
  
  ctx.lineWidth = 3;
  ctx.strokeRect(col1, y, fullW, titleBoxH);
  ctx.lineWidth = 1;
  ctx.strokeRect(col1 + 4, y + 4, fullW - 8, titleBoxH - 8);

  ctx.font = FONT_HDR;
  ctx.fillStyle = "#000000";
  const titleStr = `RATE LIST OF ${lotNo || "N/A"}`;
  const titleW = ctx.measureText(titleStr).width;
  ctx.fillText(titleStr, col1 + (fullW - titleW) / 2, y + 40);
  
  y += titleBoxH + 30;

  ctx.font = "bold 16px Arial";
  const { display } = nowISTParts();
  
  ctx.fillText(`CATEGORY :  ${(category || "-").toUpperCase()}`, col1, y);
  const dateStr = `DATE: ${display}`;
  const dateW = ctx.measureText(dateStr).width;
  ctx.fillText(dateStr, col7 - dateW, y);
  
  y += LINE_H;
  ctx.fillText(`SUBMITTER:  ${(submitterName || "-").toUpperCase()}`, col1, y);
  
  y += LINE_H * 1.5;

  const crisp = (v) => Math.round(v) + 0.5;
  const vline = (x, y1, y2) => {
    ctx.beginPath();
    ctx.moveTo(crisp(x), crisp(y1));
    ctx.lineTo(crisp(x), crisp(y2));
    ctx.stroke();
  };

  const COLS = [col1, col2, col3, col4, col5, col6, col7];

  ctx.font = FONT_BOLD;
  ctx.fillStyle = "#f2f2f2";
  ctx.fillRect(col1, y, col7 - col1, LINE_H);
  ctx.fillStyle = "#000000";
  ctx.strokeRect(col1, y, col7 - col1, LINE_H);

  for (let i = 1; i < COLS.length; i++) {
    if (i < COLS.length - 1) vline(COLS[i], y, y + LINE_H);
  }

  ctx.fillText("Attribute", col1 + 8, y + 22);
  ctx.fillText("Option", col2 + 8, y + 22);
  ctx.fillText("Rate", col3 + 8, y + 22);
  ctx.fillText("Qty", col4 + 8, y + 22);
  ctx.fillText("Amount", col5 + 8, y + 22);
  ctx.fillText("Check", col6 + 20, y + 22);
  
  y += LINE_H;

  ctx.font = "16px Arial";
  billRows.forEach((r) => {
    const displayAttr = showEnglish && r.attrEnglish ? r.attrEnglish : r.attr;
    const displayOpt = showEnglish && r.optEnglish ? r.optEnglish : (r.opt || "-");
    
    const attrLines = wrapText(ctx, displayAttr, labelWidth);
    const optLines = wrapText(ctx, displayOpt, optionWidth);
    
    const rowHeight = Math.max(attrLines.length, optLines.length, 1) * LINE_H;

    ctx.strokeRect(col1, y, col7 - col1, rowHeight);
    for (let i = 1; i < COLS.length; i++) {
      if (i < COLS.length - 1) vline(COLS[i], y, y + rowHeight);
    }

    attrLines.forEach((line, j) => {
      const yPos = y + (j + 1) * LINE_H - 8;
      ctx.fillText(line, col1 + 8, yPos);
    });

    optLines.forEach((line, j) => {
      const yPos = y + (j + 1) * LINE_H - 8;
      ctx.fillText(line, col2 + 8, yPos);
    });

    const rateStr = formatINR(r.rate);
    const rateWidth = ctx.measureText(rateStr).width;
    ctx.fillText(rateStr, col3 + (col4 - col3 - rateWidth) / 2, y + 22);

    const qtyStr = String(r.qty);
    const qtyWidth = ctx.measureText(qtyStr).width;
    ctx.fillText(qtyStr, col4 + (col5 - col4 - qtyWidth) / 2, y + 22);

    const amtStr = formatINR(r.amount);
    const amountWidth = ctx.measureText(amtStr).width;
    ctx.fillText(amtStr, col5 + (col6 - col5 - amountWidth) / 2, y + 22);

    const isChecked = checkedRows && checkedRows.includes(r.id);
    if (isChecked) {
      ctx.fillStyle = "#000000";
      ctx.fillRect(col6 + 24, y + 8, 12, 12);
    }
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.strokeRect(col6 + 24, y + 8, 12, 12);
    ctx.fillStyle = "#000000";

    y += rowHeight;
  });

  ctx.font = FONT_BOLD;
  ctx.strokeRect(col1, y, col7 - col1, LINE_H);
  for (let i = 1; i < COLS.length; i++) {
    if (i < COLS.length - 1) vline(COLS[i], y, y + LINE_H);
  }
  ctx.fillText("TOTAL AMOUNT", col1 + 8, y + 22);
  const totalStr = formatINR(total);
  const totalAmountWidth = ctx.measureText(totalStr).width;
  ctx.fillText(totalStr, col5 + (col6 - col5 - totalAmountWidth) / 2, y + 22);

  y += LINE_H * 2;

  const footerSpace = 120;
  if (y < (canvasHeight / DPI_SCALE) - footerSpace - PADDING) {
      y = (canvasHeight / DPI_SCALE) - footerSpace - PADDING;
  }

  const BOX_GAP = 12;
  const totalW = col7 - col1;
  const boxW = Math.floor((totalW - BOX_GAP * 3) / 4);
  const boxH = 80;

  function drawSignatureBox(x, yTop, w, h, labelText) {
    ctx.lineWidth = 1;
    ctx.strokeRect(x, yTop, w, h);
    const lineY = yTop + 50;
    ctx.beginPath();
    ctx.moveTo(x + 10, lineY);
    ctx.lineTo(x + w - 10, lineY);
    ctx.stroke();
    const labelW = ctx.measureText(labelText).width;
    ctx.fillText(labelText, x + (w - labelW) / 2, lineY + 20);
  }

  drawSignatureBox(col1, y, boxW, boxH, "Pintu");
  drawSignatureBox(col1 + (boxW + BOX_GAP), y, boxW, boxH, "Mohit Sir");
  drawSignatureBox(col1 + (boxW + BOX_GAP) * 2, y, boxW, boxH, "Submitter");

  const acX = col1 + (boxW + BOX_GAP) * 3;
  ctx.strokeRect(acX, y, boxW, boxH);
  ctx.font = "bold 12px Arial";
  ctx.fillText("Any Change: Yes/No", acX + 8, y + 20);
  ctx.strokeRect(acX + 8, y + 28, boxW - 16, 40);

  const filename = `RateList_${lotNo}.jpg`;
  const jpeg = canvas.toDataURL("image/jpeg", 0.9);
  downloadDataUrl(jpeg, filename);
}

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

function SearchBar({ value, onChange, placeholder = "Search attributes or options..." }) {
  return (
    <div className="rc2-search-bar">
      <span className="rc2-search-icon">🔍</span>
      <input
        type="text"
        className="rc2-search-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value && (
        <button 
          className="rc2-search-clear"
          onClick={() => onChange("")}
          aria-label="Clear search"
        >
          ✕
        </button>
      )}
    </div>
  );
}

function LotLoader({ onLoadLot, onClose }) {
  const [lotNumber, setLotNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [foundLot, setFoundLot] = useState(null);

  const handleSearch = async () => {
    if (!lotNumber.trim()) {
      setError("Please enter a lot number");
      return;
    }

    setLoading(true);
    setError("");
    setFoundLot(null);

    try {
      const lot = await fetchLotFromMasterList(lotNumber.trim());
      
      if (lot) {
        setFoundLot(lot);
      } else {
        setError(`No lot found with number ${lotNumber}`);
      }
    } catch (err) {
      console.error("Search error:", err);
      setError(err.message || "Failed to search for lot");
    } finally {
      setLoading(false);
    }
  };

  const handleLoad = () => {
    if (foundLot) {
      onLoadLot(foundLot);
      onClose();
    }
  };

  return (
    <div className="rc2-modal" role="dialog" aria-modal="true" aria-label="Load existing lot">
      <div className="rc2-modal-backdrop" onClick={onClose} />
      <div className="rc2-modal-content rc2-modal-narrow">
        <div className="rc2-modal-header">
          <div>
            <h3 className="rc2-modal-title">
              <span className="rc2-modal-icon">📋</span> Load Existing Lot
            </h3>
            <p className="rc2-modal-subtitle">
              Enter lot number to load existing submission for reference
            </p>
          </div>
          <button className="rc2-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="rc2-modal-body">
          <div className="rc2-form-group">
            <label className="rc2-form-label">
              <span className="rc2-form-icon">🔢</span> Lot Number
            </label>
            <div className="rc2-input-with-button">
              <div className="rc2-input-wrapper" style={{ flex: 1 }}>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="rc2-input"
                  placeholder="Enter lot number (e.g., 61025)"
                  value={lotNumber}
                  onChange={(e) => {
                    setLotNumber(e.target.value);
                    setError("");
                    setFoundLot(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch();
                    }
                  }}
                  disabled={loading}
                />
                <span className="rc2-input-icon">🏷️</span>
              </div>
              <button
                className="rc2-btn rc2-btn-primary"
                onClick={handleSearch}
                disabled={loading || !lotNumber.trim()}
                style={{ marginLeft: '8px' }}
              >
                {loading ? "🔍..." : "Search"}
              </button>
            </div>
            <p className="rc2-form-hint">
              Enter the lot number you want to load as reference
            </p>
          </div>

          {error && (
            <div className="rc2-alert rc2-alert-error" role="alert">
              <span className="rc2-alert-icon">❌</span>
              <div className="rc2-alert-content">
                <strong>Lot not found</strong>
                <span>{error}</span>
              </div>
            </div>
          )}

          {loading && (
            <div className="rc2-loading-lots">
              <div className="rc2-lot-skeleton">
                <div className="rc2-skeleton-line"></div>
                <div className="rc2-skeleton-line"></div>
                <div className="rc2-skeleton-line"></div>
              </div>
            </div>
          )}

          {foundLot && (
            <div className="rc2-lot-preview">
              <h4 className="rc2-preview-title">Lot Found</h4>
              <div className="rc2-lot-card">
                <div className="rc2-lot-header">
                  <span className="rc2-lot-badge">Lot #{foundLot.lotNo}</span>
                  <span className="rc2-lot-submission">{foundLot.submissionId}</span>
                </div>
                <div className="rc2-lot-details">
                  <div className="rc2-lot-detail">
                    <span className="rc2-detail-label">Submitter:</span>
                    <span className="rc2-detail-value">{foundLot.submitter}</span>
                  </div>
                  <div className="rc2-lot-detail">
                    <span className="rc2-detail-label">Date:</span>
                    <span className="rc2-detail-value">{foundLot.timestamp}</span>
                  </div>
                  <div className="rc2-lot-detail">
                    <span className="rc2-detail-label">Category:</span>
                    <span className="rc2-detail-value">{foundLot.category}</span>
                  </div>
                  {foundLot.jacketType && (
                    <div className="rc2-lot-detail">
                      <span className="rc2-detail-label">Jacket Type:</span>
                      <span className="rc2-detail-value">{foundLot.jacketType}</span>
                    </div>
                  )}
                  <div className="rc2-lot-detail">
                    <span className="rc2-detail-label">Total:</span>
                    <span className="rc2-detail-value">{formatINR(foundLot.total)}</span>
                  </div>
                </div>
                {foundLot.selections && foundLot.selections.length > 0 && (
                  <div className="rc2-lot-selections-preview">
                    <strong>Selections:</strong>
                    <ul>
                      {foundLot.selections.slice(0, 5).map((sel, idx) => (
                        <li key={idx}>{sel.attribute}: {sel.option}</li>
                      ))}
                      {foundLot.selections.length > 5 && (
                        <li>+{foundLot.selections.length - 5} more</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="rc2-modal-footer">
          <button
            className="rc2-btn rc2-btn-secondary"
            onClick={onClose}
          >
            <span className="rc2-btn-icon">↩️</span> Cancel
          </button>
          {foundLot && (
            <button
              className="rc2-btn rc2-btn-primary"
              onClick={handleLoad}
            >
              <span className="rc2-btn-icon">📂</span> Load This Lot
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MultiSelectDropdown({
  label,
  options,
  selected = [],
  onChange,
  placeholder = "Select options",
  showEnglish = false,
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrapRef = useRef(null);
  useClickOutside(wrapRef, () => setOpen(false));

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return options;
    return options.filter(({ option, optionEnglish }) => {
      const hindiMatch = option.toLowerCase().includes(t);
      const englishMatch = optionEnglish?.toLowerCase().includes(t);
      return hindiMatch || englishMatch;
    });
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
      ? (showEnglish && options.find(o => o.option === selected[0])?.optionEnglish) || selected[0]
      : `${selected.length} selected`;

  return (
    <div className="rc2-dd" ref={wrapRef}>
      <button
        type="button"
        className={`rc2-dd-control ${open ? "rc2-open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={summaryText}
      >
        <span className={`rc2-dd-value ${selected.length ? "rc2-strong" : ""}`}>
          {summaryText}
        </span>
        <span className="rc2-dd-arrow">▾</span>
      </button>

      {open && (
        <div className="rc2-dd-menu" role="listbox" aria-multiselectable="true">
          <div className="rc2-dd-search">
            <input
              className="rc2-dd-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search…"
            />
            {!!selected.length && (
              <button className="rc2-dd-clear" onClick={clearAll} type="button" title="Clear all">
                Clear
              </button>
            )}
          </div>

          <div className="rc2-dd-list">
            {filtered.length ? (
              filtered.map(({ option, optionEnglish, rate }) => (
                <label
                  className={`rc2-dd-item ${selected.includes(option) ? "rc2-checked" : ""}`}
                  key={`${option}-${rate}`}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(option)}
                    onChange={() => toggle(option)}
                  />
                  <span className="rc2-dd-item-text">
                    {showEnglish && optionEnglish ? optionEnglish : option}
                    {showEnglish && option && optionEnglish && (
                      <span className="rc2-dd-item-hindi"> ({option})</span>
                    )}
                  </span>
                  <span className="rc2-dd-item-rate">{formatINR(rate)}</span>
                </label>
              ))
            ) : (
              <div className="rc2-dd-empty">No matches</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SingleSelectDropdown({ options, value = "", onChange, placeholder = "Select option", showEnglish = false }) {
  return (
    <div className="rc2-dd">
      <div className="rc2-select-wrap">
        <select
          className="rc2-select rc2-select-strong"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{`— ${placeholder} —`}</option>
          {options.map(({ option, optionEnglish, rate }) => (
            <option key={`${option}-${rate}`} value={option}>
              {showEnglish && optionEnglish ? optionEnglish : option} ({formatINR(rate)})
              {showEnglish && option && optionEnglish && ` (${option})`}
            </option>
          ))}
        </select>
        <span className="rc2-chev" aria-hidden>
          ▾
        </span>
      </div>
    </div>
  );
}

function toCanonicalAttr(attrRaw = "") {
  const a = String(attrRaw).trim().toLowerCase();

  if (a === "cut") return "cut";
  if (a === "label") return "label";
  if (a === "bone") return "bone";
  if (a === "gulla") return "gulla";
  if (a === "teera" || a === "tira" || a === "tera") return "teera";

  if (a === "कट") return "cut";
  if (a === "लेबल") return "label";
  if (a === "बोन") return "bone";
  if (a === "गुल्ला" || a === "गुल्ला ") return "gulla";
  if (a === "तीरा" || a === "टीरा" || a === "तीरा ") return "teera";

  return "other";
}

const QTY_KEYS = new Set(["cut", "label", "bone", "gulla", "teera"]);
const isQtyKey = (k) => QTY_KEYS.has(k);

function launchConfetti(durationMs = 1200, particleCount = 180) {
  const canvas = document.createElement("canvas");
  canvas.className = "rc2-confetti-canvas";
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
      p.vy += 0.06;
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
    <div className="rc2-fullscreen" role="alert" aria-live="assertive">
      <div className="rc2-fs-card">
        <h3 className="rc2-fs-title">Processing your submission</h3>

        <div className="rc2-dance" aria-hidden>
          <span></span><span></span><span></span>
        </div>

        <div className="rc2-progress" aria-hidden></div>

        <div className="rc2-rotator" aria-live="polite">
          <div key={idx} className="rc2-rot-line">{messages[idx]}</div>
        </div>

        <p className="rc2-fs-sub" style={{marginTop: 8}}>{staticMessage}</p>
      </div>
    </div>
  );
}

function SuccessOverlay({ submitterName, totalINR, onClose }) {
  useEffect(() => {
    launchConfetti();
  }, []);

  return (
    <div className="rc2-fullscreen" role="dialog" aria-modal="true" aria-label="Submission successful">
      <div className="rc2-fs-card">
        <div className="rc2-check-wrap" aria-hidden>
          <svg viewBox="0 0 120 120">
            <circle className="rc2-circle" cx="60" cy="60" r="48" fill="none" stroke="#16a34a" strokeWidth="8" />
            <path className="rc2-tick" d="M36 62 L54 78 L86 42" fill="none" stroke="#16a34a" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <h3 className="rc2-fs-title">Submitted successfully!</h3>
        <p className="rc2-fs-sub">
          Thank you{submitterName ? `, ${submitterName}` : ""}! Your document has been created.
        </p>
        {typeof totalINR === "string" && (
          <p className="rc2-fs-sub" style={{marginTop: 6}}>
            Total: <b>{totalINR}</b>
          </p>
        )}
        <button className="rc2-fs-btn" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

function CategoryCard({ category, onClick, isSelected = false, icon = "📁" }) {
  return (
    <div 
      className={`rc2-category-card ${isSelected ? "rc2-category-card--selected" : ""}`}
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
      <div className="rc2-category-card__icon">
        <span className="rc2-category-card__emoji">{icon}</span>
      </div>
      <div className="rc2-category-card__content">
        <h3 className="rc2-category-card__title">{category}</h3>
        <p className="rc2-category-card__subtitle">Click to view rates</p>
      </div>
      <div className="rc2-category-card__arrow">
        <span>→</span>
      </div>
    </div>
  );
}

export default function RateCalculator() {
  const [rows, setRows] = useState([]);
  const [category, setCategory] = useState("");
  const [form, setForm] = useState({});
  const [qty, setQty] = useState({ Cut: 1, Label: 0, Bone: 0, Gulla: 0, Teera: 0 });
  const [qtyByAttr, setQtyByAttr] = useState({});
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitterOpen, setSubmitterOpen] = useState(false);
  const [lotLoaderOpen, setLotLoaderOpen] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);

  const [submitter, setSubmitter] = useState(DEFAULT_SUBMITTERS[0] || "");
  const [useCustomSubmitter, setUseCustomSubmitter] = useState(false);
  const [customSubmitter, setCustomSubmitter] = useState("");
  const [lotNo, setLotNo] = useState("");

  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitErr, setSubmitErr] = useState("");
  const [pendingTotalINR, setPendingTotalINR] = useState("");

  const [showEnglish, setShowEnglish] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [pendingSubmitterName, setPendingSubmitterName] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  
  // New state for language warning modal
  const [showLanguageWarning, setShowLanguageWarning] = useState(false);

  const confirmCardRef = useRef(null);
  const [confirmDialogPng, setConfirmDialogPng] = useState(null);

  const [showCategorySelection, setShowCategorySelection] = useState(true);
  const [selectedSubcategory, setSelectedSubcategory] = useState("");
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
          NeedsQty: String(r[4] || "").trim().toLowerCase() === "yes",
          FullHalf: (r[5] || "").trim().toUpperCase(),
          AttributeEnglish: (r[6] || "").trim(),
          OptionEnglish: (r[7] || "").trim(),
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

  const handleLoadLot = (lot) => {
    console.log("Loading lot with data:", lot);
    
    setLotNo(lot.lotNo);
    
    if (DEFAULT_SUBMITTERS.includes(lot.submitter)) {
      setSubmitter(lot.submitter);
      setUseCustomSubmitter(false);
    } else {
      setCustomSubmitter(lot.submitter);
      setUseCustomSubmitter(true);
    }
    
    // Set category
    if (lot.category) {
      setCategory(lot.category);
      setShowCategorySelection(false);
    }
    
    // Handle jacket categories
    if (lot.category === "Jacket" || lot.category === "WINDCHEATER" || lot.category === "FILLING JACKET" || lot.category === "LEATHER") {
      if (lot.actualCategory && (lot.actualCategory === "WINDCHEATER" || lot.actualCategory === "FILLING JACKET" || lot.actualCategory === "LEATHER")) {
        setSelectedSubcategory(lot.actualCategory);
      } else if (lot.subcategory) {
        setSelectedSubcategory(lot.subcategory);
      } else {
        setSelectedSubcategory(lot.category);
      }
      
      const jacketType = lot.jacketType || "Full";
      setSelectedJacketType(jacketType);
    }
    
    // Load selections
    if (lot.selections && lot.selections.length > 0) {
      const newForm = {};
      const newQtyByAttr = {};
      const newQty = { Cut: 1, Label: 0, Bone: 0, Gulla: 0, Teera: 0 };
      
      lot.selections.forEach(selection => {
        const attr = selection.attribute;
        const option = selection.option || "Default";
        
        if (!newForm[attr]) {
          newForm[attr] = [];
        }
        
        if (!newForm[attr].includes(option)) {
          newForm[attr].push(option);
        }
        
        const attrLower = attr.toLowerCase();
        
        if (attrLower.includes('cut') || attrLower === 'cut' || 
            attrLower.includes('कट') || attrLower === 'कट') {
          newQty.Cut = selection.qty || 1;
        } 
        else if (attrLower.includes('label') || attrLower === 'label' || 
                 attrLower.includes('लेबल') || attrLower === 'लेबल') {
          newQty.Label = selection.qty || 0;
        } 
        else if (attrLower.includes('bone') || attrLower === 'bone' || 
                 attrLower.includes('बोन') || attrLower === 'बोन') {
          newQty.Bone = selection.qty || 0;
        } 
        else if (attrLower.includes('gulla') || attrLower === 'gulla' || 
                 attrLower.includes('गुल्ला') || attrLower === 'गुल्ला') {
          newQty.Gulla = selection.qty || 0;
        } 
        else if (attrLower.includes('teera') || attrLower === 'teera' || 
                 attrLower.includes('तीरा') || attrLower === 'तीरा') {
          newQty.Teera = selection.qty || 0;
        }
        
        if (selection.qty > 1 || (selection.qty && selection.qty !== 1)) {
          newQtyByAttr[attr] = selection.qty;
        }
      });
      
      setForm(newForm);
      setQty(newQty);
      setQtyByAttr(newQtyByAttr);
      
      console.log("Restored form with selections:", newForm);
    }
    
    setSearchQuery("");
  };

  const toggleLanguage = () => {
    setShowEnglish(prev => !prev);
  };

  const getDisplayText = (hindi, english) => {
    return showEnglish && english ? english : hindi;
  };

  const categories = useMemo(() => {
    const allCategories = new Set(rows.map((r) => r.Category));
    const categoriesArray = Array.from(allCategories).sort();
    
    const hasWindcheater = categoriesArray.includes("WINDCHEATER");
    const hasFillingJacket = categoriesArray.includes("FILLING JACKET");
    const hasLeather = categoriesArray.includes("LEATHER");
    
    const groupedCategories = [];
    
    if (hasWindcheater || hasFillingJacket || hasLeather) {
      groupedCategories.push("Jacket");
    }
    
    categoriesArray.forEach(cat => {
      if (cat !== "WINDCHEATER" && cat !== "FILLING JACKET" && cat !== "LEATHER") {
        groupedCategories.push(cat);
      }
    });
    
    return groupedCategories;
  }, [rows]);

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

  const getAttributeEnglish = useCallback((attr) => {
    const row = rows.find(r => r.Attribute === attr);
    return row?.AttributeEnglish || "";
  }, [rows]);

  const attributes = useMemo(() => {
    const map = {};
    
    if (category === "Jacket" && selectedSubcategory) {
      let jacketRows = rows.filter((r) => 
        r.Category === selectedSubcategory && 
        (r.FullHalf === selectedJacketType.toUpperCase() || !r.FullHalf)
      );
      
      jacketRows.forEach((r) => {
        if (!map[r.Attribute]) map[r.Attribute] = [];
        map[r.Attribute].push({ 
          option: r.Option, 
          rate: r.Rate,
          optionEnglish: r.OptionEnglish
        });
      });
    } else if (category && category !== "Jacket") {
      const categoryRows = rows.filter((r) => r.Category === category);
      
      categoryRows.forEach((r) => {
        if (!map[r.Attribute]) map[r.Attribute] = [];
        map[r.Attribute].push({ 
          option: r.Option, 
          rate: r.Rate,
          optionEnglish: r.OptionEnglish
        });
      });
    }
    
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

  const filteredAttributes = useMemo(() => {
    if (!searchQuery.trim()) return attributes;
    
    const query = searchQuery.toLowerCase().trim();
    const filtered = {};
    
    Object.keys(attributes).forEach((attr) => {
      const attrEnglish = getAttributeEnglish(attr);
      const attrMatches = attr.toLowerCase().includes(query) || 
                         (attrEnglish && attrEnglish.toLowerCase().includes(query));
      
      const options = attributes[attr];
      const filteredOptions = options.filter(opt => {
        return opt.option.toLowerCase().includes(query) || 
               (opt.optionEnglish && opt.optionEnglish.toLowerCase().includes(query));
      });
      
      if (attrMatches || filteredOptions.length > 0) {
        filtered[attr] = attrMatches ? options : filteredOptions;
      }
    });
    
    return filtered;
  }, [attributes, searchQuery, getAttributeEnglish]);

  const quantityAttrSet = useMemo(() => {
    const s = new Set();
    
    if (category === "Jacket" && selectedSubcategory) {
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
    if (!rows || rows.length === 0) return 0;
    
    let match;
    
    if (category === "Jacket" && selectedSubcategory) {
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
        lines.push({ 
          attr, 
          opt, 
          rate, 
          qty: attrNeedsQty ? qtyVal : 1, 
          amount,
          attrEnglish: getAttributeEnglish(attr),
          optEnglish: rows.find(r => r.Option === opt)?.OptionEnglish || ""
        });
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
    getAttributeEnglish
  ]);

  const total = useMemo(
    () => billRows.reduce((s, r) => s + r.amount, 0),
    [billRows]
  );

  const resetForm = () => {
    setForm({});
    setQty({ Cut: 1, Label: 0, Bone: 0, Gulla: 0, Teera: 0 });
    setQtyByAttr({});
    setConfirmOpen(false);
    setSubmitterOpen(false);
    setSubmitErr("");
    setSubmitLoading(false);
    setLotNo("");
    setSelectedJacketType("");
    setSearchQuery("");
  };

  const handleCategorySelect = (selectedCategory) => {
    setCategory(selectedCategory);
    setSearchQuery("");
    
    if (selectedCategory === "Jacket") {
      setShowCategorySelection(false);
    } else {
      setShowCategorySelection(false);
      resetForm();
    }
  };

  const handleSubcategorySelect = (subcategory) => {
    setSelectedSubcategory(subcategory);
    setSelectedJacketType("");
    setSearchQuery("");
    resetForm();
  };

  const handleJacketTypeSelect = (jacketType) => {
    setSelectedJacketType(jacketType);
    setSearchQuery("");
    setForm({});
    setQty({ Cut: 1, Label: 0, Bone: 0, Gulla: 0, Teera: 0 });
    setQtyByAttr({});
  };

  const handleBackToCategories = () => {
    setShowCategorySelection(true);
    setCategory("");
    setSelectedSubcategory("");
    setSelectedJacketType("");
    setSearchQuery("");
    resetForm();
  };

  const handleBackToSubcategories = () => {
    setSelectedSubcategory("");
    setSelectedJacketType("");
    setSearchQuery("");
    resetForm();
  };

  const handleBackToJacketTypes = () => {
    setSelectedJacketType("");
    setSearchQuery("");
    resetForm();
  };

  // Modified confirm submit with language check
  const onConfirmSubmit = async () => {
    // Check if user is in English mode
    if (showEnglish) {
      setShowLanguageWarning(true);
      return;
    }
    
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
    
    if (category === "Jacket" && !selectedSubcategory) {
      setSubmitErr("Please select a jacket subcategory.");
      return;
    }
    
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

    setSubmitLoading(true);
    try {
      const existingLotCheck = await checkLotExistsInMasterList(finalLotNo);
      
      if (existingLotCheck.exists) {
        setSubmitErr(
          `❌ Lot No. ${finalLotNo} already exists!\n\n` +
          `Submitted by: ${existingLotCheck.submitter}\n` +
          `Date: ${existingLotCheck.timestamp}\n` +
          `Category: ${existingLotCheck.category}\n\n` +
          `Please use a different lot number.`
        );
        setSubmitLoading(false);
        return;
      }
      
    } catch (checkError) {
      console.error("Error checking existing lots:", checkError);
      const proceedAnyway = window.confirm(
        "⚠️ Unable to verify if this lot already exists.\n\n" +
        "Do you want to proceed with the submission?"
      );
      if (!proceedAnyway) {
        setSubmitLoading(false);
        return;
      }
    }

    setPendingSubmitterName(finalSubmitter);

    const timestampIST = nowISTParts().display;
    
    const actualCategory = category === "Jacket" ? selectedSubcategory : category;
    
    const payload = {
      action: "submitQuote",
      data: {
        timestampIST,
        category: actualCategory,
        displayCategory: category,
        subcategory: category === "Jacket" ? selectedSubcategory : null,
        jacketType: category === "Jacket" ? selectedJacketType : null,
        total,
        submitterName: finalSubmitter,
        lotNo: finalLotNo,
        qty,
        qtyByAttr,
        selections: billRows,
        showEnglish,
      },
    };

    try {
      const savePromise = fetch(GAS_WEB_APP_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });

      const jpegPromise = buildAndDownloadJPEG_Receipt_A4({
        category: actualCategory + (selectedJacketType ? ` - ${selectedJacketType}` : ''),
        billRows,
        total,
        submitterName: finalSubmitter,
        lotNo: finalLotNo,
        checkedRows: billRows.map(() => true),
        showEnglish: false, // Force Hindi for the receipt
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
      setShowCategorySelection(true);
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

  return (
    <div className="rc2-container">
      <header className="rc2-header">
        <div className="rc2-header-content">
          <div className="rc2-header-left">
            <div className="rc2-logo">
              <span className="rc2-logo-icon">💰</span>
              <h1>Rate Calculator</h1>
            </div>
            <p className="rc2-header-subtitle">
              {showCategorySelection 
                ? "Select a category to get started"
                : category === "Jacket" && !selectedSubcategory
                ? "Select jacket type"
                : category === "Jacket" && !selectedJacketType
                ? "Select jacket style"
                : `Building rates for: ${category}${selectedSubcategory ? ` - ${selectedSubcategory}` : ''}${selectedJacketType ? ` - ${selectedJacketType}` : ''}`}
            </p>
          </div>
          
          <div className="rc2-header-actions">
            <button
              type="button"
              className="rc2-btn rc2-btn-outline"
              onClick={() => setLotLoaderOpen(true)}
              title="Load existing lot by number"
            >
              <span className="rc2-btn-icon">📂</span>
              Load Lot
            </button>

            <button
              type="button"
              className="rc2-btn rc2-btn-outline"
              onClick={toggleLanguage}
              title={showEnglish ? "Show Hindi" : "Show English"}
            >
              <span className="rc2-btn-icon">{showEnglish ? "🇮🇳" : "🇬🇧"}</span>
              {showEnglish ? "हिंदी" : "English"}
            </button>

            {!showCategorySelection && (
              <>
                {category === "Jacket" && selectedJacketType && (
                  <button
                    type="button"
                    className="rc2-btn rc2-btn-outline"
                    onClick={handleBackToJacketTypes}
                  >
                    <span className="rc2-btn-icon">👕</span> Style
                  </button>
                )}
                {category === "Jacket" && selectedSubcategory && (
                  <button
                    type="button"
                    className="rc2-btn rc2-btn-outline"
                    onClick={handleBackToSubcategories}
                  >
                    <span className="rc2-btn-icon">🧥</span> Types
                  </button>
                )}
                <button
                  type="button"
                  className="rc2-btn rc2-btn-outline"
                  onClick={handleBackToCategories}
                >
                  <span className="rc2-btn-icon">📁</span> Categories
                </button>
              </>
            )}
            
            <button
              type="button"
              className="rc2-btn rc2-btn-outline"
              onClick={fetchRates}
              disabled={loading}
            >
              <span className="rc2-btn-icon">{loading ? "⏳" : "🔄"}</span>
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>
      </header>

      <main className="rc2-main">
        {err && (
          <div className="rc2-alert rc2-alert-error" role="alert">
            <span className="rc2-alert-icon">❌</span>
            <div className="rc2-alert-content">
              <strong>Unable to load rates</strong>
              <span>{err}</span>
            </div>
          </div>
        )}

        {showCategorySelection && (
          <div className="rc2-screen">
            <div className="rc2-screen-header">
              <h2>Select Category</h2>
              <p>Choose a category to view available rates</p>
            </div>

            {loading ? (
              <div className="rc2-grid rc2-grid-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div className="rc2-skeleton-card" key={i}>
                    <div className="rc2-skeleton-icon"></div>
                    <div className="rc2-skeleton-title"></div>
                    <div className="rc2-skeleton-subtitle"></div>
                  </div>
                ))}
              </div>
            ) : categories.length > 0 ? (
              <div className="rc2-grid rc2-grid-4">
                {categories.map((cat) => (
                  <CategoryCard
                    key={cat}
                    category={cat}
                    onClick={() => handleCategorySelect(cat)}
                    isSelected={category === cat}
                    icon={cat === "Jacket" ? "🧥" : "📁"}
                  />
                ))}
              </div>
            ) : (
              <div className="rc2-empty-state">
                <span className="rc2-empty-icon">📝</span>
                <h3>No categories found</h3>
                <p>Please check your Google Sheets data.</p>
              </div>
            )}
          </div>
        )}

        {!showCategorySelection && category === "Jacket" && !selectedSubcategory && (
          <div className="rc2-screen">
            <div className="rc2-screen-header">
              <h2>Select Jacket Type</h2>
              <p>Choose the specific type of jacket</p>
            </div>

            {loading ? (
              <div className="rc2-grid rc2-grid-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div className="rc2-skeleton-card" key={i}>
                    <div className="rc2-skeleton-icon"></div>
                    <div className="rc2-skeleton-title"></div>
                    <div className="rc2-skeleton-subtitle"></div>
                  </div>
                ))}
              </div>
            ) : jacketSubcategories.length > 0 ? (
              <div className="rc2-grid rc2-grid-3">
                {jacketSubcategories.map((subcat) => (
                  <CategoryCard
                    key={subcat}
                    category={subcat}
                    onClick={() => handleSubcategorySelect(subcat)}
                    isSelected={selectedSubcategory === subcat}
                    icon={subcat === "LEATHER" ? "🧥" : subcat === "WINDCHEATER" ? "🧥" : "🧥"}
                  />
                ))}
              </div>
            ) : (
              <div className="rc2-empty-state">
                <span className="rc2-empty-icon">📝</span>
                <h3>No jacket types found</h3>
                <p>Please check your Google Sheets data.</p>
              </div>
            )}
          </div>
        )}

        {!showCategorySelection && category === "Jacket" && selectedSubcategory && !selectedJacketType && (
          <div className="rc2-screen">
            <div className="rc2-screen-header">
              <h2>Select Jacket Style</h2>
              <p>Choose the style for {selectedSubcategory}</p>
            </div>

            <div className="rc2-grid rc2-grid-2">
              <CategoryCard
                category="Full"
                onClick={() => handleJacketTypeSelect("Full")}
                isSelected={selectedJacketType === "Full"}
                icon="👔"
              />
              <CategoryCard
                category="Half"
                onClick={() => handleJacketTypeSelect("Half")}
                isSelected={selectedJacketType === "Half"}
                icon="👕"
              />
            </div>
          </div>
        )}

        {!showCategorySelection && category && (category !== "Jacket" || (selectedSubcategory && selectedJacketType)) && (
          <div className="rc2-calculator-layout">
            <div className="rc2-left-panel">
              <div className="rc2-panel-header">
                <div className="rc2-panel-title">
                  <span className="rc2-panel-icon">🔧</span>
                  <h2>Attributes & Options</h2>
                </div>
                <div className="rc2-panel-badge">
                  {category}
                  {selectedSubcategory && ` • ${selectedSubcategory}`}
                  {selectedJacketType && ` • ${selectedJacketType}`}
                </div>
              </div>

              <SearchBar 
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search attributes or options..."
              />

              {loading ? (
                <div className="rc2-attributes-grid">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div className="rc2-attribute-skeleton" key={i}>
                      <div className="rc2-skeleton-label"></div>
                      <div className="rc2-skeleton-control"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rc2-attributes-grid">
                  {Object.keys(filteredAttributes).length === 0 ? (
                    <div className="rc2-empty-state rc2-empty-small">
                      <span className="rc2-empty-icon">🔍</span>
                      <p>
                        {searchQuery 
                          ? `No matches found for "${searchQuery}"`
                          : `No attributes found for this category`}
                      </p>
                    </div>
                  ) : (
                    Object.keys(filteredAttributes).map((attr) => {
                      const opts = filteredAttributes[attr] || [];
                      const selArr =
                        (form[attr] &&
                          (Array.isArray(form[attr]) ? form[attr] : [form[attr]])) ||
                        [];
                      const key = toCanonicalAttr(attr);
                      const attrEnglish = getAttributeEnglish(attr);

                      const needsQty = quantityAttrSet.has(attr) || isQtyKey(key);
                      const isSingle = needsQty;

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
                          : "Quantity";

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
                        <div className="rc2-attribute-card" key={attr}>
                          <div className="rc2-attribute-label">
                            <span className="rc2-attribute-icon">🔧</span>
                            <span>{getDisplayText(attr, attrEnglish)}</span>
                          </div>

                          {!isSingle ? (
                            <MultiSelectDropdown
                              label={attr}
                              options={opts}
                              selected={selArr}
                              onChange={(next) =>
                                setForm((prev) => ({ ...prev, [attr]: next }))
                              }
                              placeholder={`Select options`}
                              showEnglish={showEnglish}
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
                                  if (v) {
                                    if (quantityAttrSet.has(attr)) {
                                      setQtyByAttr((q) => ({
                                        ...q,
                                        [attr]: Math.max(1, Number(q[attr] ?? 1)),
                                      }));
                                    } else {
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
                                placeholder={`Select option`}
                                showEnglish={showEnglish}
                              />

                              {selArr[0] && (
                                <div className="rc2-quantity-row">
                                  <label className="rc2-quantity-label">
                                    <span className="rc2-quantity-icon">🔢</span>
                                    {qtyLabelFromKey}
                                  </label>
                                  <div className="rc2-quantity-input-group">
                                    <input
                                      type="number"
                                      min={qtyMin}
                                      className="rc2-quantity-input"
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
                                    <span className="rc2-quantity-unit">units</span>
                                  </div>
                                  <div className="rc2-quantity-rate">
                                    Rate: <span>{formatINR(getRate(attr, selArr[0]))}</span>
                                  </div>
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

            <div className="rc2-right-panel">
              <div className="rc2-summary-card">
                <div className="rc2-summary-header">
                  <div className="rc2-summary-title">
                    <span className="rc2-summary-icon">💰</span>
                    <h2>Price Summary</h2>
                  </div>
                </div>

                <div className="rc2-total-section">
                  <span className="rc2-total-label">Total Amount</span>
                  <div className="rc2-total-value">
                    <span className="rc2-total-number">{formatINR(total)}</span>
                    <span className="rc2-total-emoji">💰</span>
                  </div>
                </div>

                <div className="rc2-selections-section">
                  <h3 className="rc2-selections-title">
                    <span>Selected Options</span>
                    <span className="rc2-selections-count">{billRows.length}</span>
                  </h3>
                  
                  <div className="rc2-selections-list">
                    {billRows.length ? (
                      billRows.map((r, i) => {
                        const key = toCanonicalAttr(r.attr);
                        const sheetQty = quantityAttrSet.has(r.attr);
                        const showQty = sheetQty || isQtyKey(key);
                        return (
                          <div className="rc2-selection-item" key={`${r.attr}-${r.opt}-${i}`}>
                            <div className="rc2-selection-details">
                              <span className="rc2-selection-emoji">✅</span>
                              <div className="rc2-selection-text">
                                <span className="rc2-selection-attr">
                                  {getDisplayText(r.attr, r.attrEnglish)}
                                </span>
                                <span className="rc2-selection-opt">
                                  {getDisplayText(r.opt, r.optEnglish)}
                                </span>
                              </div>
                            </div>
                            <div className="rc2-selection-meta">
                              {showQty && <span className="rc2-selection-qty">×{r.qty}</span>}
                              <span className="rc2-selection-rate">{formatINR(r.rate)}</span>
                              <span className="rc2-selection-amount">{formatINR(r.amount)}</span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="rc2-empty-selections">
                        <span className="rc2-empty-icon">📝</span>
                        <p>No selections yet</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="rc2-summary-actions">
                  <button
                    className="rc2-btn rc2-btn-primary rc2-btn-submit"
                    disabled={!category || billRows.length === 0}
                    onClick={() => setConfirmOpen(true)}
                  >
                    <span className="rc2-btn-icon">📤</span>
                    Review & Confirm
                  </button>
                  <button
                    className="rc2-btn rc2-btn-secondary"
                    onClick={resetForm}
                  >
                    <span className="rc2-btn-icon">🗑️</span>
                    Clear All
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <footer className="rc2-footer">
          <span className="rc2-footer-icon">💡</span>
          <span>
            {showCategorySelection 
              ? "Select a category to start building your rate calculation"
              : category === "Jacket" && !selectedSubcategory
              ? "Select the specific type of jacket to view its rates"
              : category === "Jacket" && !selectedJacketType
              ? "Select jacket style (Full/Half) to view rates"
              : "Use the search bar to quickly find attributes or options"}
          </span>
        </footer>
      </main>

      {lotLoaderOpen && (
        <LotLoader
          onLoadLot={handleLoadLot}
          onClose={() => setLotLoaderOpen(false)}
        />
      )}

      {confirmOpen && (
        <div className="rc2-modal" role="dialog" aria-modal="true" aria-label="Review and confirm">
          <div className="rc2-modal-backdrop" onClick={() => setConfirmOpen(false)} />
          <div className="rc2-modal-content rc2-modal-bill" ref={confirmCardRef}>
            <div className="rc2-modal-header">
              <div>
                <h3 className="rc2-modal-title">
                  <span className="rc2-modal-icon">📋</span> Review Your Selections
                </h3>
                <p className="rc2-modal-subtitle">
                  Category: <strong>{category || "—"}{selectedSubcategory ? ` - ${selectedSubcategory}` : ''}{selectedJacketType ? ` - ${selectedJacketType}` : ''}</strong>
                </p>
              </div>
              <div className="rc2-bill-total">
                <span>Total</span>
                <strong>{formatINR(total)}</strong>
              </div>
            </div>

            <div className="rc2-modal-body">
              <div className="rc2-bill-table">
                <div className="rc2-bill-row rc2-bill-header">
                  <div>Attribute</div>
                  <div>Option</div>
                  <div className="rc2-text-right">Rate</div>
                  <div className="rc2-text-right">Qty</div>
                  <div className="rc2-text-right">Amount</div>
                </div>
                {billRows.length ? (
                  billRows.map((r, i) => (
                    <div className="rc2-bill-row" key={i}>
                      <div className="rc2-bill-attr">
                        <span className="rc2-bill-icon">🔧</span>
                        {getDisplayText(r.attr, r.attrEnglish)}
                      </div>
                      <div className="rc2-bill-opt">{getDisplayText(r.opt, r.optEnglish)}</div>
                      <div className="rc2-text-right">{formatINR(r.rate)}</div>
                      <div className="rc2-text-right">{r.qty}</div>
                      <div className="rc2-text-right rc2-bill-amount">{formatINR(r.amount)}</div>
                    </div>
                  ))
                ) : (
                  <div className="rc2-bill-empty">
                    <span className="rc2-empty-icon">📝</span>
                    <p>Nothing selected</p>
                  </div>
                )}
              </div>
            </div>

            <div className="rc2-modal-footer">
              <button
                className="rc2-btn rc2-btn-secondary"
                onClick={() => setConfirmOpen(false)}
              >
                <span className="rc2-btn-icon">✏️</span> Edit
              </button>
              <button
                className="rc2-btn rc2-btn-primary"
                onClick={onConfirmSubmit}
              >
                <span className="rc2-btn-icon">✅</span> Confirm & Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Language Warning Modal */}
      {showLanguageWarning && (
        <div className="rc2-modal" role="dialog" aria-modal="true" aria-label="Language requirement">
          <div className="rc2-modal-backdrop" onClick={() => setShowLanguageWarning(false)} />
          <div className="rc2-modal-content rc2-modal-narrow">
            <div className="rc2-modal-header">
              <div>
                <h3 className="rc2-modal-title">
                  <span className="rc2-modal-icon">⚠️</span> Language Required
                </h3>
                <p className="rc2-modal-subtitle">
                  Please switch to Hindi before submitting
                </p>
              </div>
            </div>

            <div className="rc2-modal-body">
              <div className="rc2-alert rc2-alert-warning" role="alert">
                <span className="rc2-alert-icon">🌐</span>
                <div className="rc2-alert-content">
                  <strong>Important!</strong>
                  <span>
                    Before submitting, please switch to Hindi language mode by clicking the 
                    <strong style={{ margin: '0 4px' }}>"हिंदी"</strong> button at the top right corner of the screen.
                  </span>
                  <br />
                  <br />
                  <span>
                    This ensures that all attributes and options are displayed correctly in Hindi 
                    for accurate submission and documentation.
                  </span>
                </div>
              </div>
              
              <div style={{ marginTop: '16px', textAlign: 'center' }}>
                <button
                  className="rc2-btn rc2-btn-outline"
                  onClick={() => {
                    setShowLanguageWarning(false);
                    // Optional: Auto-switch to Hindi? Uncomment if desired
                    // if (showEnglish) {
                    //   toggleLanguage();
                    // }
                  }}
                >
                  <span className="rc2-btn-icon">↩️</span> Go Back
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {submitterOpen && (
        <div className="rc2-modal" role="dialog" aria-modal="true" aria-label="Submitter name">
          <div className="rc2-modal-backdrop" onClick={() => setSubmitterOpen(false)} />
          <div className="rc2-modal-content rc2-modal-narrow">
            <div className="rc2-modal-header">
              <div>
                <h3 className="rc2-modal-title">
                  <span className="rc2-modal-icon">👤</span> Submitter Details
                </h3>
                <p className="rc2-modal-subtitle">Choose an existing name or enter a custom one</p>
              </div>
            </div>

            <div className="rc2-modal-body">
              <div className="rc2-form-group">
                <label className="rc2-form-label">
                  <span className="rc2-form-icon">📝</span> Select Submitter
                </label>
                <div className="rc2-select-wrapper">
                  <select
                    className="rc2-select"
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
                    <option value="__custom__">— Custom name —</option>
                  </select>
                  <span className="rc2-select-arrow">▾</span>
                </div>

                {useCustomSubmitter && (
                  <div className="rc2-input-wrapper rc2-mt-2">
                    <input
                      type="text"
                      className="rc2-input"
                      placeholder="Enter custom name"
                      value={customSubmitter}
                      onChange={(e) => setCustomSubmitter(e.target.value)}
                    />
                    <span className="rc2-input-icon">✍️</span>
                  </div>
                )}
              </div>

              <div className="rc2-form-group">
                <label className="rc2-form-label">
                  <span className="rc2-form-icon">🏷️</span> Lot No.
                </label>
                <div className="rc2-input-wrapper">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="rc2-input"
                    placeholder="Enter Lot No."
                    value={lotNo}
                    onChange={(e) => setLotNo(e.target.value)}
                  />
                  <span className="rc2-input-icon">🔢</span>
                </div>
                <p className="rc2-form-hint">
                  This will be saved with the submission
                </p>
              </div>

              {submitErr && (
                <div className="rc2-alert rc2-alert-error" role="alert">
                  <span className="rc2-alert-icon">⚠️</span>
                  <div className="rc2-alert-content" style={{ whiteSpace: 'pre-line' }}>
                    <strong>Cannot submit</strong>
                    <span>{submitErr}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="rc2-modal-footer">
              <button
                className="rc2-btn rc2-btn-secondary"
                onClick={() => setSubmitterOpen(false)}
              >
                <span className="rc2-btn-icon">↩️</span> Back
              </button>
              <button
                className="rc2-btn rc2-btn-primary"
                onClick={onSubmitWithSubmitter}
                disabled={submitLoading}
              >
                <span className="rc2-btn-icon">{submitLoading ? "⏳" : "🚀"}</span>
                {submitLoading ? "Submitting..." : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {submitLoading && (
        <LoadingOverlay
          messages={[
            "Connecting to server…",
            "Saving to Google Sheets…",
            "Generating A4 JPEG…",
            "Almost done…",
          ]}
          staticMessage="Please wait while we process your request"
        />
      )}

      {showSuccess && (
        <SuccessOverlay
          submitterName={pendingSubmitterName}
          totalINR={pendingTotalINR}
          onClose={() => setShowSuccess(false)}
        />
      )}

      {justSubmitted && (
        <div className="rc2-toast">
          <span className="rc2-toast-icon">🎉</span>
          Rate slip generated and downloaded!
        </div>
      )}
    </div>
  );
}