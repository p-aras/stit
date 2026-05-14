import React, { useEffect, useMemo, useState, useCallback } from 'react';

// Google Sheets API configuration
const SPREADSHEET_ID = '1fKSwGBIpzWEFk566WRQ4bzQ0anJlmasoY8TwrTLQHXI';
const API_KEY = 'AIzaSyAomDFBkOySlIxKWSKGHe6ATv9gvaBr7uk';
const SHEET_NAME = 'JObOrder';

// New spreadsheet for karigar/supervisor data
const KARIGAR_SPREADSHEET_ID = '17qqixpHOXvG1U3RlRwaHON5JCkugpy4RIu5N9zR9ScM';
const KARIGAR_SHEET_NAME = 'KarigarProfiles';

// Separate endpoints for fetching and storing data
const FETCH_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxgyW91VU1maXiZOJ5emRTaMrDR65beE1ocD6SQNzSLXkXo1chkAI2a5YXKlNttAMuG/exec';
const STORE_ENDPOINT = 'https://script.google.com/macros/s/AKfycbw92YhPlv8kMhPRQWaenw4w_ikUds4JTKS-ELEx9eRjheMsYgltBYFpVxBic1tkK0w/exec';

// Add these constants for Index and Cutting sheets
const CUTTING_SHEET_ID = "1Hj3JeJEKB43aYYWv8gk2UhdU6BWuEQfCg5pBlTdBMNA";
const INDEX_SHEET_NAME = "Index";
const CUTTING_SHEET_NAME = "Cutting";

// Helper functions
function norm(v) {
  return (v ?? '').toString().trim();
}

function includes(hay, needle) {
  return norm(hay).toLowerCase().includes(norm(needle).toLowerCase());
}

function digitsOnly(s) {
  const m = String(s ?? '').match(/\d+/g);
  return m ? m.join('') : '';
}

function classifyLot(lotInput) {
  const d = digitsOnly(lotInput);
  const n = parseInt(d, 10);
  const isOld = d.length === 4 && Number.isFinite(n) && n < 10000;
  const searchKey = d;
  const lot4 = d.length >= 4 ? d.slice(-4) : d;
  return { isOld, searchKey, lot4 };
}

function toNumOrNull(v) {
  const t = norm(v);
  if (t === '' || t === null || t === undefined) return null;
  const n = parseFloat(t.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

// Cache implementation
class ApiCache {
  constructor() {
    this.cache = new Map();
    this.maxSize = 100;
    this.ttl = 5 * 60 * 1000; // 5 minutes
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(key, data) {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clear() {
    this.cache.clear();
  }

  delete(key) {
    this.cache.delete(key);
  }

  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

const sheetDataCache = new ApiCache();

function generateSheetCacheKey(sheetId, range) {
  return `sheet_${sheetId}_${range}`;
}

async function fetchSheetDataCached(sheetId, range, signal) {
  const cacheKey = generateSheetCacheKey(sheetId, range);
  
  const cached = sheetDataCache.get(cacheKey);
  if (cached) {
    console.log('📦 Cache HIT for sheet data');
    return cached;
  }

  console.log('🔄 Cache MISS for sheet data');
  
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${API_KEY}`;
  const res = await fetch(url, { signal });
  
  if (!res.ok) {
    throw new Error(`Failed to fetch sheet data: ${res.status}`);
  }

  const data = await res.json();
  const result = data?.values || [];
  
  sheetDataCache.set(cacheKey, result);
  
  return result;
}

// Function to fetch Index sheet data
async function fetchIndexSheet(signal) {
  const range = encodeURIComponent(`${INDEX_SHEET_NAME}!A1:Z`);
  return await fetchSheetDataCached(CUTTING_SHEET_ID, range, signal);
}

// Function to find lot in Index sheet
function findLotInIndex(indexData, lotNo) {
  if (!indexData || indexData.length < 2) return null;

  const headers = indexData[0].map(norm);
  const lotNumberCol = headers.findIndex(h => includes(h, 'lot number'));
  const startRowCol = headers.findIndex(h => includes(h, 'startrow'));
  const numRowsCol = headers.findIndex(h => includes(h, 'numrows'));
  const headerColsCol = headers.findIndex(h => includes(h, 'headercols'));
  const fabricCol = headers.findIndex(h => includes(h, 'fabric'));
  const garmentTypeCol = headers.findIndex(h => includes(h, 'garment type'));
  const styleCol = headers.findIndex(h => includes(h, 'style'));
  const partyNameCol = headers.findIndex(h => includes(h, 'party name'));
  const brandCol = headers.findIndex(h => includes(h, 'brand'));
  const seasonCol = headers.findIndex(h => includes(h, 'season'));

  if (lotNumberCol === -1) {
    console.log('Lot Number column not found in Index sheet');
    return null;
  }

  for (let i = 1; i < indexData.length; i++) {
    const row = indexData[i] || [];
    const rowLotNo = norm(row[lotNumberCol]);

    if (rowLotNo === norm(lotNo)) {
      return {
        lotNumber: rowLotNo,
        startRow: startRowCol !== -1 ? parseInt(row[startRowCol]) || 1 : 1,
        numRows: numRowsCol !== -1 ? parseInt(row[numRowsCol]) || 20 : 20,
        headerCols: headerColsCol !== -1 ? parseInt(row[headerColsCol]) || 7 : 7,
        fabric: fabricCol !== -1 ? row[fabricCol] || '' : '',
        garmentType: garmentTypeCol !== -1 ? row[garmentTypeCol] || '' : '',
        style: styleCol !== -1 ? row[styleCol] || '' : '',
        partyName: partyNameCol !== -1 ? row[partyNameCol] || '' : '',
        brand: brandCol !== -1 ? row[brandCol] || '' : '',
        season: seasonCol !== -1 ? row[seasonCol] || '' : ''
      };
    }
  }

  return null;
}

// Enhanced parseMatrix function that properly stops at Total row and groups by shade
function parseMatrix(rows, lotNo) {
  console.log('========== PARSING CUTTING SHEET MATRIX ==========');
  console.log('Parsing matrix for lot:', lotNo);
  console.log('Total rows received:', rows.length);
  
  let lotNumber = norm(lotNo);
  let style = '';
  let fabric = '';
  let garmentType = '';

  // First, extract lot information from the top section (first 10 rows only)
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const r = rows[i] || [];
    
    if (r[0] && includes(r[0], 'lot number')) {
      if (r[1]) lotNumber = norm(r[1]);
      
      for (let j = 0; j < r.length; j++) {
        if (includes(r[j], 'style') && r[j+1]) {
          style = norm(r[j+1]);
          break;
        }
      }
    }
    
    if (r[0] && includes(r[0], 'fabric')) {
      if (r[1]) fabric = norm(r[1]);
      
      for (let j = 0; j < r.length; j++) {
        if (includes(r[j], 'garment type') && r[j+1]) {
          garmentType = norm(r[j+1]);
          break;
        }
      }
    }
  }

  console.log('Extracted details:', { lotNumber, style, fabric, garmentType });

  // Find the header row (contains "Color" and "Total Pcs")
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const r = rows[i] || [];
    const rowText = r.join(' ').toLowerCase();
    
    if ((includes(rowText, 'color') || includes(rowText, 'colour')) && 
        (includes(rowText, 'total pcs') || includes(rowText, 'total'))) {
      headerIdx = i;
      console.log('Found header at row:', i, 'Header:', r);
      break;
    }
  }

  if (headerIdx === -1) {
    console.error('Could not find header row');
    return { 
      lotNumber, 
      style, 
      fabric, 
      garmentType, 
      sizes: [], 
      rows: [], 
      totals: { grand: 0 } 
    };
  }

  const header = rows[headerIdx].map(h => norm(h));
  console.log('Header row:', header);

  // Find column indices
  const idxColor = header.findIndex(c => includes(c, 'color') || includes(c, 'colour'));
  const idxCT = header.findIndex(c => includes(c, 'cutting table') || includes(c, 'table'));
  const idxTotal = header.findIndex(c => includes(c, 'total pcs') || includes(c, 'total'));

  console.log('Column indices - Color:', idxColor, 'Cutting Table:', idxCT, 'Total Pcs:', idxTotal);

  if (idxColor === -1 || idxTotal === -1) {
    console.error('Could not find required columns');
    return { 
      lotNumber, 
      style, 
      fabric, 
      garmentType, 
      sizes: [], 
      rows: [], 
      totals: { grand: 0 } 
    };
  }

  // Parse size columns
  const sizeCols = [];
  if (idxCT !== -1 && idxTotal !== -1) {
    for (let i = idxCT + 1; i < idxTotal; i++) {
      if (i < header.length && header[i] && header[i].trim() !== '') {
        sizeCols.push({ key: header[i], index: i });
      }
    }
  }
  const sizeKeys = sizeCols.map(s => s.key);
  console.log('Size columns found:', sizeKeys);

  // Use a Map to group shades (in case of duplicates)
  const shadesMap = new Map();
  
  // Parse data rows and STOP at the first "Total" row
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const firstCell = row[0] ? norm(row[0]) : '';
    
    // CRITICAL: STOP when we encounter a "Total" row
    if (includes(firstCell, 'total')) {
      console.log(`Stopped parsing at row ${r} - found "Total" row`);
      break;
    }
    
    // Skip empty rows
    if (!firstCell || firstCell === '') continue;
    
    // Skip rows that look like Index data (numeric IDs like "11646 14486...")
    if (firstCell.match(/^\d+\s+\d+/) && row.length > 1) {
      console.log(`Skipping non-shade row: ${firstCell}`);
      continue;
    }

    let colorName = norm(row[idxColor]);
    if (!colorName || colorName === '') continue;
    
    colorName = colorName.replace(/\s+/g, ' ').trim();

    const cuttingTable = idxCT !== -1 && row[idxCT] ? toNumOrNull(row[idxCT]) : null;
    const totalPcs = idxTotal !== -1 && row[idxTotal] ? toNumOrNull(row[idxTotal]) : 0;

    // Parse size quantities
    const sizeMap = {};
    for (const s of sizeCols) {
      if (row[s.index]) {
        const qty = toNumOrNull(row[s.index]);
        if (qty !== null && qty > 0) {
          sizeMap[s.key] = (sizeMap[s.key] || 0) + qty;
        }
      }
    }

    // Group by exact color name
    if (shadesMap.has(colorName)) {
      const existing = shadesMap.get(colorName);
      existing.totalPcs += totalPcs;
      
      for (const [size, qty] of Object.entries(sizeMap)) {
        existing.sizes[size] = (existing.sizes[size] || 0) + qty;
      }
      
      console.log(`Merged duplicate shade: ${colorName} - New total: ${existing.totalPcs}`);
    } else {
      shadesMap.set(colorName, {
        color: colorName,
        cuttingTable: cuttingTable,
        sizes: sizeMap,
        totalPcs: totalPcs || 0
      });
    }

    console.log(`Parsed row: "${colorName}" - Total Pcs: ${totalPcs}`);
  }

  const body = [];
  for (const [color, data] of shadesMap) {
    body.push({
      color: data.color,
      cuttingTable: data.cuttingTable,
      sizes: data.sizes,
      totalPcs: data.totalPcs
    });
  }

  const grandTotal = body.reduce((sum, row) => sum + (row.totalPcs || 0), 0);

  console.log(`✅ Parsed ${body.length} unique shades`);
  console.log('Grand Total:', grandTotal);

  return { 
    lotNumber, 
    style, 
    fabric, 
    garmentType, 
    imageUrl: '', 
    sizes: sizeKeys, 
    rows: body, 
    totals: { grand: grandTotal } 
  };
}

async function fetchFromCuttingUsingIndex(lotInfo, signal) {
  const { startRow, numRows, lotNumber } = lotInfo;

  const endRow = startRow + numRows - 1;
  const range = encodeURIComponent(`${CUTTING_SHEET_NAME}!A${startRow}:Z${endRow}`);

  console.log(`Fetching Cutting sheet range: ${startRow} to ${endRow} (${numRows} rows expected)`);

  try {
    const rows = await fetchSheetDataCached(CUTTING_SHEET_ID, range, signal);
    
    console.log(`Fetched ${rows.length} rows from Cutting sheet using index`);

    const parsed = parseMatrix(rows, lotNumber);
    
    if (parsed && parsed.rows && parsed.rows.length > 0) {
      console.log(`Successfully parsed ${parsed.rows.length} shades`);
      return parsed;
    }

    throw new Error('Failed to parse data');

  } catch (err) {
    console.error('Error fetching using index:', err.message);
    throw err;
  }
}

// Main function to fetch lot matrix
async function fetchLotMatrix(lotNo, signal) {
  console.log('🔄 Fetching lot matrix for:', lotNo);

  if (!API_KEY || !CUTTING_SHEET_ID) {
    throw new Error('Missing API key or Sheet ID.');
  }

  const { searchKey } = classifyLot(lotNo);

  try {
    const indexData = await fetchIndexSheet(signal);
    const lotInfo = findLotInIndex(indexData, searchKey);
    
    if (lotInfo) {
      console.log('✅ Found lot in Index sheet:', lotInfo);
      const result = await fetchFromCuttingUsingIndex(lotInfo, signal);
      result.source = 'cutting';
      result.partyName = lotInfo.partyName || '';
      result.brand = lotInfo.brand || '';
      result.season = lotInfo.season || '';
      return result;
    } else {
      throw new Error(`Lot ${searchKey} not found in Index sheet`);
    }
  } catch (err) {
    console.warn('Failed to fetch from Index/Cutting:', err?.message);
    throw new Error(`Lot ${searchKey} not found`);
  }
}

export default function KarigarAssignment() {
  const [lotSearch, setLotSearch] = useState('');
  const [selectedLot, setSelectedLot] = useState('');
  const [shades, setShades] = useState([]);
  const [shadePcs, setShadePcs] = useState({});
  
  // NEW: Support multiple karigars per shade
  const [shadeAssignments, setShadeAssignments] = useState({}); // { shadeName: [{id, karigarId, karigarName, assignedPcs}] }
  const [nextAssignmentId, setNextAssignmentId] = useState(1);
  
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [previewRows, setPreviewRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [lockedShades, setLockedShades] = useState(new Set());
  const [existingAssignments, setExistingAssignments] = useState({});
  
  const [sheetData, setSheetData] = useState([]);
  const [loadingSheetData, setLoadingSheetData] = useState(false);
  const [sheetColumns, setSheetColumns] = useState([]);
  const [filteredSheetData, setFilteredSheetData] = useState([]);
  const [sheetError, setSheetError] = useState('');

  const [lotMatrix, setLotMatrix] = useState(null);

  const [supervisors, setSupervisors] = useState([]);
  const [loadingSupervisors, setLoadingSupervisors] = useState(false);
  const [showSupervisorDropdown, setShowSupervisorDropdown] = useState(false);
  const [selectedSupervisor, setSelectedSupervisor] = useState('');

  const [showDetailsSidebar, setShowDetailsSidebar] = useState(false);
  const [selectedSupervisorDetails, setSelectedSupervisorDetails] = useState(null);
  const [karigarDetails, setKarigarDetails] = useState([]);
  const [loadingKarigarDetails, setLoadingKarigarDetails] = useState(false);
  
  const [karigarSearchTerm, setKarigarSearchTerm] = useState('');
  const [filteredKarigars, setFilteredKarigars] = useState([]);
  
  const [activeShadeForAssignment, setActiveShadeForAssignment] = useState(null);
  
  const [quickAssignMode, setQuickAssignMode] = useState(false);
  const [selectedShadeForQuickAssign, setSelectedShadeForQuickAssign] = useState(null);
  const [assignmentHistory, setAssignmentHistory] = useState([]);
  const [showAssignmentHistory, setShowAssignmentHistory] = useState(false);
  
  const [karigarNames, setKarigarNames] = useState({});
  
  // NEW: State for tracking partial assignment
  const [assigningQuantity, setAssigningQuantity] = useState({});
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [pendingAssignment, setPendingAssignment] = useState({ shade: null, karigarId: null, karigarName: null });

  // Helper functions for multiple karigars per shade
  const getShadeAssignments = (shade) => {
    return shadeAssignments[shade] || [];
  };

  const getTotalAssignedPcsForShade = (shade) => {
    const assignments = shadeAssignments[shade] || [];
    return assignments.reduce((sum, assign) => sum + (assign.assignedPcs || 0), 0);
  };

  const getRemainingPcsForShade = (shade) => {
    const total = shadePcs[shade] || 0;
    const assigned = getTotalAssignedPcsForShade(shade);
    return total - assigned;
  };

  const isShadeFullyAssigned = (shade) => {
    return getRemainingPcsForShade(shade) <= 0;
  };

  const isShadePartiallyAssigned = (shade) => {
    const total = shadePcs[shade] || 0;
    const assigned = getTotalAssignedPcsForShade(shade);
    return assigned > 0 && assigned < total;
  };

  const addAssignmentToShade = (shade, karigarId, karigarName, assignedPcs) => {
    const newAssignment = {
      id: nextAssignmentId,
      karigarId: karigarId,
      karigarName: karigarName,
      assignedPcs: assignedPcs,
      timestamp: new Date().toISOString()
    };
    
    setShadeAssignments(prev => ({
      ...prev,
      [shade]: [...(prev[shade] || []), newAssignment]
    }));
    
    setNextAssignmentId(prev => prev + 1);
    
    // Store karigar name mapping
    setKarigarNames(prev => ({
      ...prev,
      [karigarId]: karigarName
    }));
    
    return newAssignment.id;
  };

  const removeAssignmentFromShade = (shade, assignmentId) => {
    setShadeAssignments(prev => ({
      ...prev,
      [shade]: (prev[shade] || []).filter(assign => assign.id !== assignmentId)
    }));
  };

  const updateAssignmentQuantity = (shade, assignmentId, newPcs) => {
    setShadeAssignments(prev => ({
      ...prev,
      [shade]: (prev[shade] || []).map(assign => 
        assign.id === assignmentId ? { ...assign, assignedPcs: newPcs } : assign
      )
    }));
  };

  // Cache cleanup on component mount
  useEffect(() => {
    const interval = setInterval(() => {
      sheetDataCache.cleanup();
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // Load search history from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('lotSearchHistory');
    if (saved) {
      setSearchHistory(JSON.parse(saved).slice(0, 5));
    }
    
    const savedHistory = localStorage.getItem('assignmentHistory');
    if (savedHistory) {
      setAssignmentHistory(JSON.parse(savedHistory).slice(0, 20));
    }
  }, []);

  // Filter karigars based on search term
  useEffect(() => {
    if (karigarDetails.length > 0) {
      const filtered = karigarDetails.filter(karigar => 
        karigar.karigarName.toLowerCase().includes(karigarSearchTerm.toLowerCase()) ||
        karigar.karigarId.toLowerCase().includes(karigarSearchTerm.toLowerCase())
      );
      setFilteredKarigars(filtered);
    } else {
      setFilteredKarigars([]);
    }
  }, [karigarSearchTerm, karigarDetails]);

  // Save search history to localStorage
  const addToHistory = (lot) => {
    if (!lot) return;
    const updated = [lot, ...searchHistory.filter(item => item !== lot)].slice(0, 5);
    setSearchHistory(updated);
    localStorage.setItem('lotSearchHistory', JSON.stringify(updated));
  };

  // Add this function near the other history-related functions (around line 400-420):

// Clear search history
const clearHistory = () => {
  setSearchHistory([]);
  localStorage.removeItem('lotSearchHistory');
};
  // Save assignment to history
  const addToAssignmentHistory = (shade, karigarId, karigarName, pcs) => {
    const assignment = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      lot: selectedLot,
      shade,
      karigarId,
      karigarName,
      pcs: pcs
    };
    
    const updated = [assignment, ...assignmentHistory].slice(0, 20);
    setAssignmentHistory(updated);
    localStorage.setItem('assignmentHistory', JSON.stringify(updated));
  };

  const clearAssignmentHistory = () => {
    setAssignmentHistory([]);
    localStorage.removeItem('assignmentHistory');
  };

  // Fetch supervisors from karigar sheet
  const fetchSupervisors = async () => {
    setLoadingSupervisors(true);
    setStatus({ type: '', message: '' });
    
    try {
      const sheetNameEncoded = encodeURIComponent(KARIGAR_SHEET_NAME);
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${KARIGAR_SPREADSHEET_ID}/values/${sheetNameEncoded}?key=${API_KEY}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.values && data.values.length > 0) {
        const headers = data.values[0];
        
        const supervisorNameIndex = headers.findIndex(h => 
          h.toLowerCase().includes('supervisor name') || 
          h.toLowerCase() === 'supervisor' ||
          h.toLowerCase() === 'thekedar'
        );
        
        const supervisorTypeIndex = headers.findIndex(h => 
          h.toLowerCase().includes('supervisor type') || 
          h.toLowerCase() === 'type'
        );
        
        if (supervisorNameIndex === -1) {
          throw new Error('Supervisor Name column not found in sheet');
        }
        
        const supervisorMap = new Map();
        
        data.values.slice(1).forEach(row => {
          const rawSupervisorName = row[supervisorNameIndex]?.trim() || '';
          const supervisorType = supervisorTypeIndex !== -1 ? row[supervisorTypeIndex]?.trim() : '';
          
          if (rawSupervisorName && rawSupervisorName !== '') {
            const normalizedName = rawSupervisorName
              .toLowerCase()
              .split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ')
              .replace(/\s+/g, ' ')
              .trim();
            
            if (!supervisorMap.has(normalizedName)) {
              supervisorMap.set(normalizedName, {
                name: normalizedName,
                originalName: rawSupervisorName,
                type: supervisorType || 'Supervisor'
              });
            }
          }
        });
        
        const uniqueSupervisors = Array.from(supervisorMap.values())
          .sort((a, b) => a.name.localeCompare(b.name));
        
        setSupervisors(uniqueSupervisors);
        
        if (uniqueSupervisors.length > 0) {
          setStatus({ 
            type: 'success', 
            message: `✅ Found ${uniqueSupervisors.length} unique supervisors` 
          });
        } else {
          setStatus({ 
            type: 'warning', 
            message: '⚠️ No supervisors found in the sheet' 
          });
        }
        
        setShowSupervisorDropdown(true);
      } else {
        throw new Error('No data found in karigar sheet');
      }
    } catch (error) {
      console.error('Error fetching supervisors:', error);
      setStatus({ 
        type: 'error', 
        message: `❌ Failed to fetch supervisors: ${error.message}` 
      });
    } finally {
      setLoadingSupervisors(false);
    }
  };

  // Fetch karigar details for selected supervisor
  const fetchKarigarDetails = async (supervisorName) => {
    setLoadingKarigarDetails(true);
    setKarigarDetails([]);
    setKarigarSearchTerm('');
    
    try {
      const sheetNameEncoded = encodeURIComponent(KARIGAR_SHEET_NAME);
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${KARIGAR_SPREADSHEET_ID}/values/${sheetNameEncoded}?key=${API_KEY}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.values && data.values.length > 0) {
        const headers = data.values[0];
        
        const supervisorNameIndex = headers.findIndex(h => 
          h.toLowerCase().includes('supervisor name')
        );
        const karigarIdIndex = headers.findIndex(h => 
          h.toLowerCase().includes('karigar id') || 
          h.toLowerCase().includes('employee id') ||
          h.toLowerCase().includes('id')
        );
        const karigarNameIndex = headers.findIndex(h => 
          h.toLowerCase().includes('karigar name') || 
          h.toLowerCase().includes('employee name') ||
          h.toLowerCase().includes('name')
        );
        
        if (supervisorNameIndex === -1 || karigarIdIndex === -1 || karigarNameIndex === -1) {
          throw new Error('Required columns not found in sheet');
        }
        
        const details = data.values.slice(1)
          .filter(row => {
            const rowSupervisor = row[supervisorNameIndex]?.trim() || '';
            const normalizedRowSupervisor = rowSupervisor
              .toLowerCase()
              .split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ')
              .replace(/\s+/g, ' ')
              .trim();
            
            return normalizedRowSupervisor === supervisorName;
          })
          .map((row, index) => ({
            srNo: index + 1,
            karigarId: row[karigarIdIndex]?.trim() || 'N/A',
            karigarName: row[karigarNameIndex]?.trim() || 'N/A'
          }));
        
        setKarigarDetails(details);
        setFilteredKarigars(details);
        
        const nameMap = {};
        details.forEach(k => {
          nameMap[k.karigarId] = k.karigarName;
        });
        setKarigarNames(prev => ({ ...prev, ...nameMap }));
        
        if (details.length === 0) {
          setStatus({
            type: 'warning',
            message: `⚠️ No karigars found for supervisor ${supervisorName}`
          });
        } else {
          setStatus({
            type: 'success',
            message: `✅ Found ${details.length} karigars for ${supervisorName}`
          });
        }
      }
    } catch (error) {
      console.error('Error fetching karigar details:', error);
      setStatus({
        type: 'error',
        message: `❌ Failed to fetch karigar details: ${error.message}`
      });
    } finally {
      setLoadingKarigarDetails(false);
    }
  };

  // Handle supervisor selection
  const handleSupervisorSelect = (supervisor) => {
    setSelectedSupervisor(supervisor.name);
    setSelectedSupervisorDetails(supervisor);
    setShowSupervisorDropdown(false);
    setStatus({ 
      type: 'success', 
      message: `✅ Selected supervisor: ${supervisor.name} (${supervisor.type})` 
    });
  };

  // Handle view details button click
  const handleViewDetails = () => {
    if (selectedSupervisor) {
      fetchKarigarDetails(selectedSupervisor);
      setShowDetailsSidebar(true);
      setQuickAssignMode(true);
      setStatus({
        type: 'info',
        message: `🔄 Quick assign mode enabled. Click on any shade to assign from ${selectedSupervisor}'s team`
      });
    }
  };

  // Close sidebar
  const closeSidebar = () => {
    setShowDetailsSidebar(false);
    setKarigarDetails([]);
    setFilteredKarigars([]);
    setKarigarSearchTerm('');
    setActiveShadeForAssignment(null);
    setQuickAssignMode(false);
    setSelectedShadeForQuickAssign(null);
    setShowQuantityModal(false);
    setPendingAssignment({ shade: null, karigarId: null, karigarName: null });
  };

  // Handle shade click to start assignment process
  const handleShadeClick = (shade) => {
    if (!selectedSupervisor) {
      setStatus({
        type: 'warning',
        message: '⚠️ Please select a supervisor first'
      });
      return;
    }
    
    const remainingPcs = getRemainingPcsForShade(shade);
    if (remainingPcs <= 0) {
      setStatus({ 
        type: 'warning', 
        message: `⚠️ Shade "${shade}" is already fully assigned (${shadePcs[shade]} / ${shadePcs[shade]} pcs assigned)` 
      });
      return;
    }
    
    setActiveShadeForAssignment(shade);
    setSelectedShadeForQuickAssign(shade);
    
    if (!showDetailsSidebar) {
      handleViewDetails();
    } else {
      const searchInput = document.querySelector('.karigar-search-input');
      if (searchInput) {
        searchInput.focus();
      }
      
      setStatus({
        type: 'info',
        message: `🎯 Assigning for shade: "${shade}" (${remainingPcs} pcs remaining out of ${shadePcs[shade]} total). Select a karigar and enter quantity.`
      });
    }
  };

  // Open quantity modal for assignment
  const openQuantityModal = (shade, karigarId, karigarName) => {
    const maxPcs = getRemainingPcsForShade(shade);
    if (maxPcs <= 0) {
      setStatus({
        type: 'warning',
        message: `⚠️ No remaining pieces to assign for shade "${shade}"`
      });
      return;
    }
    
    setPendingAssignment({ shade, karigarId, karigarName });
    setAssigningQuantity({ [shade]: maxPcs });
    setShowQuantityModal(true);
  };

  // Handle quantity confirmation and assignment
  const confirmAssignment = () => {
    const { shade, karigarId, karigarName } = pendingAssignment;
    if (!shade) return;
    
    const quantity = assigningQuantity[shade];
    if (!quantity || quantity <= 0) {
      setStatus({
        type: 'warning',
        message: '⚠️ Please enter a valid quantity'
      });
      return;
    }
    
    const remainingPcs = getRemainingPcsForShade(shade);
    if (quantity > remainingPcs) {
      setStatus({
        type: 'warning',
        message: `⚠️ Cannot assign more than remaining pieces (${remainingPcs} left)`
      });
      return;
    }
    
    // Add the assignment
    addAssignmentToShade(shade, karigarId, karigarName, quantity);
    addToAssignmentHistory(shade, karigarId, karigarName, quantity);
    
    setStatus({
      type: 'success',
      message: `✅ Assigned ${quantity} pcs to ${karigarId} (${karigarName}) for shade "${shade}"`
    });
    
    // Close modal and clear active shade
    setShowQuantityModal(false);
    setPendingAssignment({ shade: null, karigarId: null, karigarName: null });
    
    // Check if shade is now fully assigned
    if (getRemainingPcsForShade(shade) <= 0) {
      setStatus({
        type: 'success',
        message: `✅ Shade "${shade}" is now fully assigned! Total: ${shadePcs[shade]} pcs`
      });
      setActiveShadeForAssignment(null);
    }
  };

  // Handle quick assign from sidebar
  const handleQuickAssign = (karigarId, karigarName) => {
    if (activeShadeForAssignment) {
      openQuantityModal(activeShadeForAssignment, karigarId, karigarName);
    } else if (shades.length === 1) {
      openQuantityModal(shades[0], karigarId, karigarName);
    } else {
      setStatus({
        type: 'warning',
        message: '⚠️ Please click on a shade first to select which shade to assign'
      });
    }
  };

  // Handle remove assignment
  const handleRemoveAssignment = (shade, assignmentId) => {
    const assignment = getShadeAssignments(shade).find(a => a.id === assignmentId);
    if (assignment) {
      removeAssignmentFromShade(shade, assignmentId);
      setStatus({
        type: 'info',
        message: `🗑️ Removed assignment of ${assignment.assignedPcs} pcs from ${assignment.karigarId} for shade "${shade}"`
      });
    }
  };

  // Handle edit assignment quantity
  const handleEditQuantity = (shade, assignmentId, currentPcs) => {
    const newPcs = prompt(`Enter new quantity for this assignment (max ${getRemainingPcsForShade(shade) + currentPcs}):`, currentPcs);
    if (newPcs && !isNaN(newPcs)) {
      const newQuantity = parseInt(newPcs);
      const maxAllowed = getRemainingPcsForShade(shade) + currentPcs;
      if (newQuantity > maxAllowed) {
        setStatus({
          type: 'warning',
          message: `⚠️ Cannot exceed total shade quantity (${shadePcs[shade]} pcs)`
        });
      } else if (newQuantity > 0) {
        updateAssignmentQuantity(shade, assignmentId, newQuantity);
        setStatus({
          type: 'success',
          message: `✅ Updated quantity to ${newQuantity} pcs`
        });
      }
    }
  };

  const fetchLotFromCuttingSheet = async (lotNumber) => {
    setLoadingSheetData(true);
    setSheetError('');
    
    try {
      const matrix = await fetchLotMatrix(lotNumber);
      console.log('Matrix received from Cutting sheet:', matrix);
      setLotMatrix(matrix);
      
      if (matrix && matrix.rows && matrix.rows.length > 0) {
        const shadesList = [];
        const pcsMap = {};
        
        matrix.rows.forEach(row => {
          if (row.color) {
            let colorName = row.color.trim();
            shadesList.push(colorName);
            pcsMap[colorName] = row.totalPcs || 0;
          }
        });
        
        console.log('Setting shades:', shadesList);
        setShades(shadesList);
        setShadePcs(pcsMap);
        
        // Initialize empty assignments for each shade
        const initialAssignments = {};
        shadesList.forEach(s => {
          initialAssignments[s] = [];
        });
        setShadeAssignments(initialAssignments);
        
        const lotData = [{
          'Lot Number': matrix.lotNumber,
          'Brand': matrix.brand || '',
          'Fabric': matrix.fabric || '',
          'Style': matrix.style || '',
          'Garment Type': matrix.garmentType || '',
          'Party Name': matrix.partyName || '',
          'Season': matrix.season || '',
          'Date': new Date().toISOString().split('T')[0]
        }];
        setFilteredSheetData(lotData);
        
        const totalPcs = Object.values(pcsMap).reduce((sum, pcs) => sum + pcs, 0);
        
        setStatus({ 
          type: 'success', 
          message: `✅ Found lot ${lotNumber} with ${shadesList.length} shades (Total: ${totalPcs} pcs)` 
        });
      } else {
        throw new Error('No data found in matrix');
      }
    } catch (error) {
      console.error('Error fetching from Cutting sheet:', error);
      setSheetError(error.message);
      setStatus({ 
        type: 'error', 
        message: `❌ Failed to fetch lot: ${error.message}` 
      });
    } finally {
      setLoadingSheetData(false);
    }
  };

  const fetchSheetData = async (lotNumber) => {
    setLoadingSheetData(true);
    setSheetError('');
    
    try {
      await fetchLotFromCuttingSheet(lotNumber);
    } catch (cuttingError) {
      console.log('⚠️ Lot not found in Cutting sheet:', cuttingError);
      
      try {
        const sheetNameEncoded = encodeURIComponent(SHEET_NAME);
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${sheetNameEncoded}?key=${API_KEY}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.values && data.values.length > 0) {
          const headers = data.values[0];
          setSheetColumns(headers);
          
          const rows = data.values.slice(1).map(row => {
            const obj = {};
            headers.forEach((header, index) => {
              obj[header] = row[index] || '';
            });
            return obj;
          });
          
          setSheetData(rows);
          
          const possibleLotColumns = [
            'Lot Number', 'Lot', 'lot', 'LOT', 
            'Job Order No', 'JobOrder', 'JOB ORDER',
            'Lot No', 'LotNo', 'LOT NO'
          ];
          
          const filtered = rows.filter(row => {
            for (const col of possibleLotColumns) {
              if (row[col] && row[col].toString() === lotNumber.toString()) {
                return true;
              }
            }
            return Object.values(row).some(val => 
              val && val.toString() === lotNumber.toString()
            );
          });
          
          setFilteredSheetData(filtered);
          
          if (filtered.length > 0) {
            const shadesList = [];
            const pcsMap = {};
            
            filtered.forEach(row => {
              const shade = row['Shade'] || row['shade'] || row['COLOR'] || row['Color'] || '';
              const qty = parseInt(row['Quantity'] || row['Qty'] || row['Pcs'] || '0') || 0;
              
              if (shade && qty > 0) {
                if (shade.includes(',')) {
                  const shadeParts = shade.split(',').map(s => s.trim());
                  const pcsPerShade = Math.floor(qty / shadeParts.length);
                  const remainder = qty % shadeParts.length;
                  
                  shadeParts.forEach((part, idx) => {
                    const shadeName = part;
                    const shadeQty = pcsPerShade + (idx === 0 ? remainder : 0);
                    
                    if (!shadesList.includes(shadeName)) {
                      shadesList.push(shadeName);
                    }
                    pcsMap[shadeName] = (pcsMap[shadeName] || 0) + shadeQty;
                  });
                } else {
                  if (!shadesList.includes(shade)) {
                    shadesList.push(shade);
                  }
                  pcsMap[shade] = (pcsMap[shade] || 0) + qty;
                }
              }
            });
            
            if (shadesList.length > 0) {
              setShades(shadesList);
              setShadePcs(pcsMap);
              
              const initialAssignments = {};
              shadesList.forEach(s => {
                initialAssignments[s] = [];
              });
              setShadeAssignments(initialAssignments);
              
              const totalPcs = Object.values(pcsMap).reduce((sum, pcs) => sum + pcs, 0);
              
              setStatus({ 
                type: 'success', 
                message: `✅ Found lot ${lotNumber} with ${shadesList.length} shades (Total: ${totalPcs} pcs)` 
              });
            } else {
              throw new Error('No shades found');
            }
          } else {
            throw new Error('Lot not found');
          }
        } else {
          throw new Error('No data in sheet');
        }
      } catch (jobOrderError) {
        console.error('Error:', jobOrderError);
        setSheetError(jobOrderError.message);
        setStatus({ 
          type: 'error', 
          message: `❌ Failed to fetch lot: ${jobOrderError.message}` 
        });
      }
    } finally {
      setLoadingSheetData(false);
    }
  };

  const handleLotSearch = async (lotToSearch = lotSearch) => {
    if (!lotToSearch.trim()) {
      setStatus({ type: 'warning', message: '⚠️ Please enter a lot number' });
      return;
    }

    setSelectedLot(lotToSearch);
    setShades([]);
    setShadePcs({});
    setShadeAssignments({});
    setPreviewRows([]);
    setFilteredSheetData([]);
    setLotMatrix(null);
    setSheetError('');
    setStatus({ type: '', message: '' });
    setLoading(true);

    try {
      await fetchSheetData(lotToSearch);
      addToHistory(lotToSearch);
      
      // Fetch existing assignments from database
      const assignmentsRes = await fetch(`${FETCH_ENDPOINT}?action=getKarigarAssignments&lot=${encodeURIComponent(lotToSearch)}`);
      const assignmentsData = await assignmentsRes.json();
      
      if (assignmentsData?.success && Array.isArray(assignmentsData.rows)) {
        setPreviewRows(assignmentsData.rows);
        
        // Load existing assignments into the new structure
        const loadedAssignments = {};
        shades.forEach(shade => {
          loadedAssignments[shade] = [];
        });
        
        assignmentsData.rows.forEach(row => {
          if (row.karigar && row.karigar.toString().trim() !== '') {
            loadedAssignments[row.shade].push({
              id: row.id || Date.now(),
              karigarId: row.karigar,
              karigarName: row.karigarName || row.karigar,
              assignedPcs: parseInt(row.pcs) || 0,
              timestamp: row.timestamp
            });
          }
        });
        
        setShadeAssignments(loadedAssignments);
        
        // Mark shades with existing assignments as LOCKED for editing existing assignments
        const lockedSet = new Set();
        assignmentsData.rows.forEach(row => {
          if (row.karigar && row.karigar.toString().trim() !== '') {
            lockedSet.add(row.shade);
          }
        });
        setLockedShades(lockedSet);
        
        const lockedCount = lockedSet.size;
        if (lockedCount > 0) {
          setStatus({ 
            type: 'info', 
            message: `🔒 ${lockedCount} shade(s) have existing assignments. You can add more karigars to these shades.` 
          });
        }
      }
      
    } catch (e) {
      console.error(e);
      setStatus({ type: 'error', message: '❌ Failed to load lot details. Please try again.' });
    } finally {
      setLoading(false);
      setShowSuggestions(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleLotSearch();
    }
  };

  const canSave = useMemo(() => {
    return selectedLot && shades.length > 0;
  }, [selectedLot, shades]);

  // Save function that supports multiple karigars per shade
// Replace your existing handleSave function with this updated version
// Update your handleSave function to use URLSearchParams (working approach)
const handleSave = async () => {
  setSaving(true);
  setStatus({ type: '', message: '' });
  
  try {
    const lotDetails = filteredSheetData.length > 0 ? filteredSheetData[0] : {};
    
    // Build assignments object with multiple karigars per shade
    const assignmentsWithPcs = {};
    
    Object.entries(shadeAssignments).forEach(([shade, assignments]) => {
      if (assignments && assignments.length > 0) {
        // Send as array of objects
        assignmentsWithPcs[shade] = assignments.map(assign => ({
          karigarId: assign.karigarId,
          pcs: assign.assignedPcs
        }));
      }
    });
    
    const completePayload = { 
      lot: selectedLot,
      brand: lotMatrix?.brand || lotDetails['Brand'] || '',
      fabric: lotMatrix?.fabric || lotDetails['Fabric'] || '',
      style: lotMatrix?.style || lotDetails['Style'] || '',
      garmentType: lotMatrix?.garmentType || lotDetails['Garment Type'] || '',
      partyName: lotMatrix?.partyName || lotDetails['Party Name'] || '',
      season: lotMatrix?.season || lotDetails['Season'] || '',
      karigars: assignmentsWithPcs,
      savedBy: 'Current User',
      supervisor: selectedSupervisor || 'Not Assigned'
    };
    
    console.log('Saving multi-karigar assignments:', completePayload);
    
    // Use URLSearchParams (this was working before)
    const formData = new URLSearchParams();
    formData.append('action', 'saveKarigarAssignments');
    formData.append('lot', selectedLot);
    formData.append('brand', completePayload.brand);
    formData.append('fabric', completePayload.fabric);
    formData.append('style', completePayload.style);
    formData.append('garmentType', completePayload.garmentType);
    formData.append('partyName', completePayload.partyName);
    formData.append('season', completePayload.season);
    formData.append('karigars', JSON.stringify(assignmentsWithPcs));
    formData.append('savedBy', 'Current User');
    formData.append('supervisor', selectedSupervisor || 'Not Assigned');

    const res = await fetch(STORE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: formData.toString(),
    });

    const responseText = await res.text();
    console.log('Raw response:', responseText);
    
    let json;
    try {
      json = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse response:', parseError);
      setStatus({ type: 'error', message: '❌ Invalid response from server' });
      return;
    }
    
    if (json?.success) {
      const totalAssignments = Object.values(assignmentsWithPcs).reduce((sum, assigns) => sum + assigns.length, 0);
      setStatus({ 
        type: 'success', 
        message: `✅ Successfully saved ${totalAssignments} assignment(s) for lot ${selectedLot}` 
      });
      
      // Refresh preview
      const refreshRes = await fetch(`${FETCH_ENDPOINT}?action=getKarigarAssignments&lot=${encodeURIComponent(selectedLot)}`);
      const refreshData = await refreshRes.json();
      if (refreshData?.success && Array.isArray(refreshData.rows)) {
        setPreviewRows(refreshData.rows);
      }
    } else {
      setStatus({ type: 'error', message: `❌ Failed to save: ${json?.error || 'Unknown error'}` });
    }
  } catch (e) {
    console.error('Save error:', e);
    setStatus({ type: 'error', message: `❌ Network error: ${e.message}` });
  } finally {
    setSaving(false);
  }
};

  const getStatusStyles = () => {
    switch (status.type) {
      case 'success': return styles.statusSuccess;
      case 'error': return styles.statusError;
      case 'warning': return styles.statusWarning;
      default: return styles.statusInfo;
    }
  };

  const formatDate = useCallback((dateString) => {
    if (!dateString || dateString.trim() === '') return 'N/A';
    
    try {
      const date = new Date(dateString);
      
      if (isNaN(date.getTime())) {
        const parts = dateString.split(/[\/\-]/);
        if (parts.length === 3) {
          const newDate = new Date(parts[2], parts[1] - 1, parts[0]);
          if (!isNaN(newDate.getTime())) {
            return newDate.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            });
          }
        }
        return dateString;
      }
      
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  }, []);

  const getLotSummary = useCallback(() => {
    if (filteredSheetData.length === 0 && !lotMatrix) return null;
    
    const firstRow = filteredSheetData[0] || {};
    const totalPcs = Object.values(shadePcs).reduce((sum, pcs) => sum + pcs, 0);
    
    return {
      brand: lotMatrix?.brand || firstRow['Brand'] || 'N/A',
      fabric: lotMatrix?.fabric || firstRow['Fabric'] || 'N/A',
      style: lotMatrix?.style || firstRow['Style'] || 'N/A',
      garmentType: lotMatrix?.garmentType || firstRow['Garment Type'] || 'N/A',
      partyName: lotMatrix?.partyName || firstRow['Party Name'] || 'N/A',
      season: lotMatrix?.season || firstRow['Season'] || 'N/A',
      date: firstRow['Date'] || 'N/A',
      totalPcs: totalPcs || 0
    };
  }, [filteredSheetData, lotMatrix, shadePcs]);

  const lotSummary = getLotSummary();

  // Calculate total assigned pcs across all shades
  const totalAssignedPcs = useMemo(() => {
    let total = 0;
    Object.values(shadeAssignments).forEach(assignments => {
      assignments.forEach(assign => {
        total += assign.assignedPcs || 0;
      });
    });
    return total;
  }, [shadeAssignments]);

  // Get total unassigned pieces
  const totalUnassignedPcs = useMemo(() => {
    return (lotSummary?.totalPcs || 0) - totalAssignedPcs;
  }, [lotSummary, totalAssignedPcs]);

  // Count total assignments (number of karigar-shade pairs)
  const totalAssignmentsCount = useMemo(() => {
    return Object.values(shadeAssignments).reduce((sum, assigns) => sum + assigns.length, 0);
  }, [shadeAssignments]);

  return (
    <div style={styles.container}>
      {/* Compact Header */}
      <div style={styles.compactHeader}>
        <div style={styles.headerLeft}>
          <div style={styles.logoIcon}>🎨</div>
          <div>
            <h1 style={styles.compactTitle}>
              <span style={styles.titleHighlight}>Karigar</span> Assignment
            </h1>
            <p style={styles.compactSubtitle}>Assign multiple karigars per shade with split quantities</p>
          </div>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.headerStats}>
            <div style={styles.statCard}>
              <span style={styles.statValue}>{totalAssignmentsCount}</span>
              <span style={styles.statLabel}>Assignments</span>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statValue}>{shades.length}</span>
              <span style={styles.statLabel}>Shades</span>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statValue}>{totalAssignedPcs} / {lotSummary?.totalPcs || 0}</span>
              <span style={styles.statLabel}>Pieces</span>
            </div>
          </div>
          <button
            onClick={() => setShowAssignmentHistory(!showAssignmentHistory)}
            style={styles.historyButton}
          >
            <span style={styles.historyButtonIcon}>📜</span>
            History
          </button>
        </div>
      </div>

      {/* Assignment History Dropdown */}
      {showAssignmentHistory && (
        <div style={styles.historyDropdown}>
          <div style={styles.historyHeader}>
            <span>📋 Recent Assignment History</span>
            <div>
              <button onClick={clearAssignmentHistory} style={styles.clearHistorySmall}>Clear All</button>
              <button onClick={() => setShowAssignmentHistory(false)} style={styles.closeDropdownButton}>✕</button>
            </div>
          </div>
          <div style={styles.historyList}>
            {assignmentHistory.length > 0 ? (
              assignmentHistory.map(entry => (
                <div key={entry.id} style={styles.historyItem}>
                  <div style={styles.historyItemLeft}>
                    <span style={styles.historyItemLot}>Lot {entry.lot}</span>
                    <span style={styles.historyItemShade}>🎨 {entry.shade}</span>
                    <span style={styles.historyItemKarigar}>🆔 {entry.karigarId}</span>
                    {entry.karigarName && <span style={styles.historyItemName}>({entry.karigarName})</span>}
                  </div>
                  <div style={styles.historyItemRight}>
                    <span style={styles.historyItemPcs}>{entry.pcs} pcs</span>
                    <span style={styles.historyItemTime}>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))
            ) : (
              <div style={styles.noHistory}>No assignment history yet</div>
            )}
          </div>
        </div>
      )}

      {/* Supervisor Selection Section */}
      <div style={styles.supervisorSection}>
        <div style={styles.supervisorRow}>
          <button
            onClick={fetchSupervisors}
            disabled={loadingSupervisors}
            style={styles.supervisorButton}
          >
            <span style={styles.supervisorButtonIcon}>
              {loadingSupervisors ? (
                <div style={styles.spinnerMini}></div>
              ) : (
                '👥'
              )}
            </span>
            {loadingSupervisors ? 'Loading Supervisors...' : 'Select Supervisor / Thekedar'}
          </button>
          
          {selectedSupervisor && (
            <>
              <div style={styles.selectedSupervisorBadge}>
                <span style={styles.selectedSupervisorIcon}>✓</span>
                <span style={styles.selectedSupervisorLabel}>Active Supervisor:</span>
                <span style={styles.selectedSupervisorName}>{selectedSupervisor}</span>
                <button
                  onClick={() => setSelectedSupervisor('')}
                  style={styles.clearSupervisorButton}
                >
                  ✕
                </button>
              </div>
              
              <button
                onClick={handleViewDetails}
                style={styles.detailsButton}
                disabled={!selectedSupervisor}
              >
                <span style={styles.detailsButtonIcon}>👥</span>
                View Team ({karigarDetails.length})
              </button>

              {quickAssignMode && (
                <div style={styles.quickAssignBadge}>
                  <span style={styles.quickAssignIcon}>⚡</span>
                  Quick Assign Mode Active
                </div>
              )}
            </>
          )}
        </div>

        {/* Supervisor Dropdown */}
        {showSupervisorDropdown && supervisors.length > 0 && (
          <div style={styles.supervisorDropdown}>
            <div style={styles.supervisorDropdownHeader}>
              <span>👥 Select a Supervisor ({supervisors.length} available)</span>
              <button
                onClick={() => setShowSupervisorDropdown(false)}
                style={styles.closeDropdownButton}
              >
                ✕
              </button>
            </div>
            <div style={styles.supervisorList}>
              {supervisors.map((supervisor, index) => (
                <div
                  key={index}
                  style={styles.supervisorItem}
                  onClick={() => handleSupervisorSelect(supervisor)}
                >
                  <div style={styles.supervisorItemLeft}>
                    <span style={styles.supervisorItemIcon}>👤</span>
                    <div>
                      <div style={styles.supervisorItemName}>{supervisor.name}</div>
                      <div style={styles.supervisorItemType}>{supervisor.type}</div>
                    </div>
                  </div>
                  <span style={styles.supervisorItemSelect}>Select →</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quantity Assignment Modal */}
      {showQuantityModal && (
        <div style={styles.modalOverlay} onClick={() => setShowQuantityModal(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Assign Quantity</h3>
              <button onClick={() => setShowQuantityModal(false)} style={styles.modalClose}>✕</button>
            </div>
            <div style={styles.modalBody}>
              <p style={styles.modalText}>
                Assigning to shade: <strong>{pendingAssignment.shade}</strong>
              </p>
              <p style={styles.modalText}>
                Karigar: <strong>{pendingAssignment.karigarId} ({pendingAssignment.karigarName})</strong>
              </p>
              <p style={styles.modalText}>
                Remaining pieces: <strong>{getRemainingPcsForShade(pendingAssignment.shade)}</strong> out of <strong>{shadePcs[pendingAssignment.shade]}</strong>
              </p>
              <div style={styles.modalInputGroup}>
                <label style={styles.modalLabel}>Quantity to assign:</label>
                <input
                  type="number"
                  value={assigningQuantity[pendingAssignment.shade] || ''}
                  onChange={(e) => setAssigningQuantity({ [pendingAssignment.shade]: parseInt(e.target.value) || 0 })}
                  max={getRemainingPcsForShade(pendingAssignment.shade)}
                  min={1}
                  style={styles.modalInput}
                  autoFocus
                />
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setShowQuantityModal(false)} style={styles.modalCancelButton}>
                Cancel
              </button>
              <button onClick={confirmAssignment} style={styles.modalConfirmButton}>
                Confirm Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details Sidebar */}
      {showDetailsSidebar && (
        <div style={styles.sidebarOverlay} onClick={closeSidebar}>
          <div style={styles.sidebar} onClick={e => e.stopPropagation()}>
            <div style={styles.sidebarHeader}>
              <h3 style={styles.sidebarTitle}>
                <span style={styles.sidebarTitleIcon}>👥</span>
                Team Members
              </h3>
              <div style={styles.sidebarHeaderActions}>
                {quickAssignMode && (
                  <span style={styles.quickAssignSidebarBadge}>⚡ Quick Assign</span>
                )}
                <button onClick={closeSidebar} style={styles.closeSidebarButton}>✕</button>
              </div>
            </div>
            
            <div style={styles.sidebarContent}>
              {selectedSupervisorDetails && (
                <div style={styles.supervisorInfo}>
                  <span style={styles.supervisorInfoLabel}>Supervisor:</span>
                  <span style={styles.supervisorInfoValue}>{selectedSupervisorDetails.name}</span>
                  <span style={styles.supervisorInfoType}>({selectedSupervisorDetails.type})</span>
                </div>
              )}
              
              {/* Active Assignment Indicator */}
              {activeShadeForAssignment ? (
                <div style={styles.activeAssignmentIndicator}>
                  <span style={styles.activeAssignmentIcon}>🎯</span>
                  <div style={styles.activeAssignmentText}>
                    <span>Assigning to:</span>
                    <strong>"{activeShadeForAssignment}"</strong>
                    <span style={styles.activeAssignmentPcs}>
                      ({getRemainingPcsForShade(activeShadeForAssignment)}/{shadePcs[activeShadeForAssignment]} pcs remaining)
                    </span>
                  </div>
                  <button 
                    onClick={() => setActiveShadeForAssignment(null)}
                    style={styles.cancelAssignmentButton}
                    title="Cancel assignment"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div style={styles.noActiveAssignment}>
                  <span style={styles.noActiveIcon}>👆</span>
                  <span>Click on any shade card to start assigning</span>
                </div>
              )}
              
              {/* Search Bar */}
              <div style={styles.karigarSearchContainer}>
                <span style={styles.karigarSearchIcon}>🔍</span>
                <input
                  type="text"
                  placeholder="Search by ID or name..."
                  value={karigarSearchTerm}
                  onChange={(e) => setKarigarSearchTerm(e.target.value)}
                  style={styles.karigarSearchInput}
                  className="karigar-search-input"
                  autoFocus
                />
                {karigarSearchTerm && (
                  <button 
                    onClick={() => setKarigarSearchTerm('')}
                    style={styles.clearSearchButton}
                  >
                    ✕
                  </button>
                )}
              </div>
              
              {loadingKarigarDetails ? (
                <div style={styles.sidebarLoading}>
                  <div style={styles.loadingSpinnerSmall}></div>
                  <p>Loading team members...</p>
                </div>
              ) : (
                <>
                  <div style={styles.karigarCount}>
                    <span style={styles.karigarCountIcon}>👤</span>
                    {filteredKarigars.length} Member{filteredKarigars.length !== 1 ? 's' : ''}
                    {karigarSearchTerm && filteredKarigars.length !== karigarDetails.length && (
                      <span style={styles.filteredHint}>(filtered)</span>
                    )}
                  </div>
                  
                  {filteredKarigars.length > 0 ? (
                    <div style={styles.karigarList}>
                      {filteredKarigars.map((karigar) => (
                        <div 
                          key={karigar.srNo} 
                          style={styles.karigarCard}
                        >
                          <div style={styles.karigarCardHeader}>
                            <div style={styles.karigarCardInfo}>
                              <div style={styles.karigarIdBadge}>{karigar.karigarId}</div>
                              <div style={styles.karigarNameText}>{karigar.karigarName}</div>
                            </div>
                            <button
                              onClick={() => handleQuickAssign(karigar.karigarId, karigar.karigarName)}
                              style={{
                                ...styles.selectKarigarButton,
                                ...(!activeShadeForAssignment ? styles.selectKarigarButtonDisabled : {})
                              }}
                              disabled={!activeShadeForAssignment}
                              title={activeShadeForAssignment ? `Assign to "${activeShadeForAssignment}"` : 'Select a shade first'}
                            >
                              {activeShadeForAssignment ? 'Assign' : 'Select Shade First'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={styles.noKarigars}>
                      <span style={styles.noKarigarsIcon}>📭</span>
                      <p>
                        {karigarSearchTerm 
                          ? `No members found matching "${karigarSearchTerm}"` 
                          : 'No team members found for this supervisor'}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Search Section */}
      <div style={styles.searchSection}>
        <div style={styles.searchBar}>
          <span style={styles.searchIcon}>🔍</span>
          <input
            type="text"
            value={lotSearch}
            onChange={(e) => {
              setLotSearch(e.target.value);
              setShowSuggestions(true);
            }}
            onKeyPress={handleKeyPress}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Enter lot number (e.g., 11028)"
            style={styles.searchInput}
          />
          <button 
            onClick={() => handleLotSearch()}
            disabled={loading}
            style={styles.searchButton}
          >
            {loading ? <div style={styles.spinnerSmallLight}></div> : 'Search Lot'}
          </button>
        </div>

        {/* Search Suggestions */}
        {showSuggestions && searchHistory.length > 0 && lotSearch === '' && (
          <div style={styles.suggestions}>
            <div style={styles.suggestionsHeader}>
              <span>🕒 Recent Searches</span>
              <button onClick={clearHistory} style={styles.clearHistorySmall}>Clear</button>
            </div>
            {searchHistory.map((lot, index) => (
              <div
                key={index}
                style={styles.suggestionItem}
                onClick={() => {
                  setLotSearch(lot);
                  handleLotSearch(lot);
                }}
              >
                <span style={styles.suggestionIcon}>📦</span>
                {lot}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main Content - 2 Column Layout */}
      {selectedLot && (
        <div style={styles.twoColumnLayout}>
          {/* Left Column - Lot Info & Summary */}
          <div style={styles.leftColumn}>
            {/* Active Lot Card */}
            <div style={styles.activeLotCard}>
              <div style={styles.activeLotIcon}>🎯</div>
              <div style={styles.activeLotContent}>
                <div style={styles.activeLotLabel}>Active Production Lot</div>
                <div style={styles.activeLotNumber}>{selectedLot}</div>
              </div>
              {totalUnassignedPcs > 0 ? (
                <div style={styles.unassignedBadge}>
                  {totalUnassignedPcs} Pcs Unassigned
                </div>
              ) : (
                <div style={styles.fullyAssignedBadge}>
                  ✓ Fully Assigned
                </div>
              )}
            </div>

            {/* Lot Summary Card */}
            {lotSummary && (
              <div style={styles.summaryCard}>
                <div style={styles.summaryCardHeader}>
                  <span style={styles.summaryCardIcon}>📋</span>
                  <h3 style={styles.summaryCardTitle}>Lot Details</h3>
                </div>
                <div style={styles.summaryGrid}>
                  <div style={styles.summaryRow}>
                    <span style={styles.summaryLabel}>Brand</span>
                    <span style={styles.summaryValue}>{lotSummary.brand}</span>
                  </div>
                  <div style={styles.summaryRow}>
                    <span style={styles.summaryLabel}>Fabric</span>
                    <span style={styles.summaryValue}>{lotSummary.fabric}</span>
                  </div>
                  <div style={styles.summaryRow}>
                    <span style={styles.summaryLabel}>Style</span>
                    <span style={styles.summaryValue}>{lotSummary.style}</span>
                  </div>
                  <div style={styles.summaryRow}>
                    <span style={styles.summaryLabel}>Garment</span>
                    <span style={styles.summaryValue}>{lotSummary.garmentType}</span>
                  </div>
                  <div style={styles.summaryRow}>
                    <span style={styles.summaryLabel}>Party</span>
                    <span style={styles.summaryValue}>{lotSummary.partyName}</span>
                  </div>
                  <div style={styles.summaryRow}>
                    <span style={styles.summaryLabel}>Season</span>
                    <span style={styles.summaryValue}>{lotSummary.season}</span>
                  </div>
                  <div style={styles.summaryRow}>
                    <span style={styles.summaryLabel}>Date</span>
                    <span style={styles.summaryValue}>{formatDate(lotSummary.date)}</span>
                  </div>
                  <div style={styles.summaryDivider} />
                  <div style={styles.summaryRow}>
                    <span style={styles.summaryLabelTotal}>Total Pieces</span>
                    <span style={styles.summaryValueTotal}>{lotSummary.totalPcs.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Preview Table */}
            {previewRows.length > 0 && (
              <div style={styles.previewCard}>
                <div style={styles.previewCardHeader}>
                  <span style={styles.previewIcon}>📋</span>
                  <h3 style={styles.previewTitle}>Recent Assignments</h3>
                  <span style={styles.previewCount}>{previewRows.length}</span>
                </div>
                <div style={styles.previewList}>
                  {previewRows.slice(0, 5).map((r, i) => (
                    <div key={i} style={styles.previewItem}>
                      <div style={styles.previewItemLeft}>
                        <span style={styles.previewShade}>{r.shade}</span>
                        {r.karigar ? (
                          <span style={styles.previewKarigar}>
                            🔒 {r.karigar} - {r.pcs || r.qty || 0} pcs
                          </span>
                        ) : (
                          <span style={styles.previewUnassigned}>⚪ Unassigned</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {previewRows.length > 5 && (
                    <div style={styles.previewMore}>
                      +{previewRows.length - 5} more assignments
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Shade Assignment */}
          <div style={styles.rightColumn}>
            {loadingSheetData ? (
              <div style={styles.loadingContainer}>
                <div style={styles.loadingSpinner}></div>
                <p>Loading shades from production data...</p>
              </div>
            ) : (
              <>
                {/* Status Message */}
                {status.message && (
                  <div style={{ ...styles.statusMessage, ...getStatusStyles() }}>
                    <span style={styles.statusIcon}>
                      {status.type === 'success' && '✅'}
                      {status.type === 'error' && '❌'}
                      {status.type === 'warning' && '⚠️'}
                      {status.type === 'info' && 'ℹ️'}
                    </span>
                    {status.message}
                  </div>
                )}

                {/* Shades Grid */}
                {shades.length > 0 && (
                  <>
                    <div style={styles.shadesHeader}>
                      <div style={styles.shadesTitleContainer}>
                        <span style={styles.shadesTitleIcon}>🎨</span>
                        <h3 style={styles.shadesTitle}>Shade Assignments</h3>
                      </div>
                      <div style={styles.shadesStats}>
                        <span style={styles.assignedCount}>
                          ✓ {totalAssignedPcs} / {lotSummary?.totalPcs || 0} pcs
                        </span>
                        <span style={styles.unassignedCount}>
                          ⚪ {totalUnassignedPcs} pcs left
                        </span>
                        <span style={styles.shadesCount}>
                          {shades.length} shades
                        </span>
                      </div>
                    </div>

                    {/* Active Assignment Hint */}
                    {activeShadeForAssignment && (
                      <div style={styles.activeShadeHint}>
                        <span style={styles.activeShadeHintIcon}>🎯</span>
                        <div style={styles.activeShadeHintText}>
                          <span>Currently assigning to: </span>
                          <strong>"{activeShadeForAssignment}"</strong>
                          <span style={styles.activeShadeHintPcs}>
                            ({getRemainingPcsForShade(activeShadeForAssignment)}/{shadePcs[activeShadeForAssignment]} pcs remaining)
                          </span>
                        </div>
                        <button 
                          onClick={() => setActiveShadeForAssignment(null)}
                          style={styles.cancelShadeButton}
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    <div style={styles.shadesGrid}>
                      {shades.map((shade) => {
                        const assignments = getShadeAssignments(shade);
                        const remainingPcs = getRemainingPcsForShade(shade);
                        const isFullyAssigned = remainingPcs <= 0;
                        const totalAssigned = getTotalAssignedPcsForShade(shade);
                        const total = shadePcs[shade] || 0;
                        const progressPercent = total > 0 ? (totalAssigned / total) * 100 : 0;
                        
                        return (
                          <div 
                            key={shade} 
                            style={{
                              ...styles.shadeItem,
                              ...(activeShadeForAssignment === shade ? styles.shadeItemActive : {}),
                              ...(isFullyAssigned ? styles.shadeItemFullyAssigned : {}),
                              ...(assignments.length > 0 ? styles.shadeItemHasAssignments : {})
                            }}
                          >
                            <div style={styles.shadeItemHeader}>
                              <div style={styles.shadeItemNameWrapper}>
                                <span style={styles.shadeItemName}>{shade}</span>
                                {isFullyAssigned && <span style={styles.fullyAssignedBadgeSmall}>✓ Full</span>}
                                {!isFullyAssigned && assignments.length > 0 && (
                                  <span style={styles.partialBadge}>Partial</span>
                                )}
                              </div>
                              <div style={styles.shadeItemPcs}>{total.toLocaleString()} pcs</div>
                            </div>
                            
                            {/* Progress bar for this shade */}
                            <div style={styles.shadeProgressBar}>
                              <div style={{ ...styles.shadeProgressFill, width: `${progressPercent}%` }}></div>
                            </div>
                            
                            {/* List of assigned karigars for this shade */}
                            {assignments.length > 0 && (
                              <div style={styles.assignedKarigarsList}>
                                {assignments.map((assign) => (
                                  <div key={assign.id} style={styles.assignedKarigarItem}>
                                    <div style={styles.assignedKarigarInfo}>
                                      <span style={styles.assignedKarigarIcon}>🆔</span>
                                      <span style={styles.assignedKarigarId}>{assign.karigarId}</span>
                                      {assign.karigarName && (
                                        <span style={styles.assignedKarigarName}>{assign.karigarName}</span>
                                      )}
                                      <span style={styles.assignedPcsBadge}>{assign.assignedPcs} pcs</span>
                                    </div>
                                    <div style={styles.assignedActions}>
                                      <button
                                        onClick={() => handleEditQuantity(shade, assign.id, assign.assignedPcs)}
                                        style={styles.editButton}
                                        title="Edit quantity"
                                      >
                                        ✏️
                                      </button>
                                      <button
                                        onClick={() => handleRemoveAssignment(shade, assign.id)}
                                        style={styles.removeButtonSmall}
                                        title="Remove assignment"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {/* Action Buttons */}
                            <div style={styles.shadeActionButtons}>
                              <button
                                onClick={() => handleShadeClick(shade)}
                                style={{
                                  ...styles.assignMoreButton,
                                  ...(!selectedSupervisor ? styles.assignMoreButtonDisabled : {}),
                                  ...(isFullyAssigned ? styles.assignMoreButtonDisabled : {})
                                }}
                                disabled={!selectedSupervisor || isFullyAssigned}
                                title={isFullyAssigned ? 'Shade is fully assigned' : 'Assign more karigars'}
                              >
                                {isFullyAssigned ? '✓ Fully Assigned' : (assignments.length > 0 ? '+ Add More' : 'Assign Karigar')}
                              </button>
                            </div>
                            
                            {!isFullyAssigned && remainingPcs > 0 && remainingPcs < total && (
                              <div style={styles.remainingPcsIndicator}>
                                {remainingPcs} pcs remaining
                              </div>
                            )}
                            
                            {activeShadeForAssignment === shade && !isFullyAssigned && (
                              <div style={styles.activeShadeIndicator}>
                                👆 Click a member from sidebar to assign
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Overall Progress Bar */}
                    <div style={styles.progressSection}>
                      <div style={styles.progressLabel}>
                        <span>Overall Assignment Progress</span>
                        <span>{totalAssignedPcs} / {lotSummary?.totalPcs || 0} pieces ({Math.round((totalAssignedPcs / (lotSummary?.totalPcs || 1)) * 100)}%)</span>
                      </div>
                      <div style={styles.progressBar}>
                        <div style={{
                          ...styles.progressFill,
                          width: `${(totalAssignedPcs / (lotSummary?.totalPcs || 1)) * 100}%`
                        }}></div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={styles.actionButtons}>
                      <button
                        style={{
                          ...styles.saveButton,
                          ...(!canSave || saving ? styles.saveButtonDisabled : {}),
                        }}
                        onClick={handleSave}
                        disabled={!canSave || saving}
                      >
                        <span>{saving ? '⏳' : '💾'}</span>
                        {saving ? 'Saving...' : 'Save All Assignments'}
                      </button>
                      <button
                        style={styles.clearButton}
                        onClick={() => {
                          if (window.confirm('⚠️ This will clear all unsaved assignments. Are you sure?')) {
                            // Reset assignments while keeping shades
                            const resetAssignments = {};
                            shades.forEach(shade => {
                              resetAssignments[shade] = [];
                            });
                            setShadeAssignments(resetAssignments);
                            setActiveShadeForAssignment(null);
                            setStatus({ type: 'info', message: '🧹 Cleared all unsaved assignments' });
                          }
                        }}
                      >
                        <span>🗑️</span>
                        Clear All
                      </button>
                    </div>
                  </>
                )}

                {/* No Shades Message */}
                {shades.length === 0 && !loadingSheetData && (
                  <div style={styles.noShades}>
                    <span style={styles.noShadesIcon}>📭</span>
                    <p>No shades found for this lot</p>
                    <button 
                      onClick={() => handleLotSearch(lotSearch)}
                      style={styles.retryButton}
                    >
                      Try Again
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Tip Box */}
      {selectedLot && shades.length > 0 && (
        <div style={styles.tipBox}>
          <span style={styles.tipIcon}>💡</span>
          <span style={styles.tipText}>
            {selectedSupervisor 
              ? activeShadeForAssignment
                ? `Click on a team member to assign them to "${activeShadeForAssignment}" - you can assign multiple karigars to the same shade with split quantities`
                : `Click "Assign Karigar" on any shade to assign multiple karigars. Each shade can have multiple karigars with divided quantities.`
              : 'Select a supervisor first to view and assign team members'}
          </span>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: 2200,
    margin: '0 auto',
    padding: '16px 25px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    backgroundColor: '#ffffff',
    minHeight: '100vh',
  },
  compactHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    flexWrap: 'wrap',
    gap: 16,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 17,
  },
  logoIcon: {
    width: 48,
    height: 48,
    background: 'linear-gradient(145deg, #1e3a8a, #3b82f6, #6366f1)',
    borderRadius: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 28,
    color: '#fff',
    boxShadow: '0 12px 20px -10px rgba(59, 130, 246, 0.4)',
  },
  compactTitle: {
    margin: 0,
    fontSize: 26,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    color: '#0f172a',
  },
  titleHighlight: {
    background: 'linear-gradient(135deg, #2563eb, #4f46e5, #7c3aed)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  compactSubtitle: {
    margin: '4px 0 0',
    fontSize: 13,
    color: '#334155',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  headerStats: {
    display: 'flex',
    gap: 12,
  },
  statCard: {
    backgroundColor: '#ffffff',
    padding: '8px 20px',
    borderRadius: 20,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02), 0 1px 2px rgba(0, 0, 0, 0.03)',
    border: '1px solid rgba(59,130,246,0.12)',
    textAlign: 'center',
    minWidth: 100,
    backdropFilter: 'blur(2px)',
    transition: 'all 0.2s ease',
  },
  statValue: {
    display: 'block',
    fontSize: 22,
    fontWeight: 800,
    color: '#1e293b',
  },
  statLabel: {
    fontSize: 11,
    color: '#4b5563',
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    fontWeight: 500,
  },
  historyButton: {
    padding: '10px 22px',
    background: 'linear-gradient(105deg, #2563eb, #4f46e5)',
    color: '#fff',
    border: 'none',
    borderRadius: 40,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    transition: 'all 0.25s',
    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
  },
  historyButtonIcon: {
    fontSize: 16,
  },
  // History Dropdown
  historyDropdown: {
    position: 'absolute',
    top: 100,
    right: 25,
    width: 400,
    backgroundColor: '#fff',
    borderRadius: 20,
    boxShadow: '0 20px 35px -12px rgba(0,0,0,0.2)',
    border: '1px solid #eef2ff',
    zIndex: 100,
    maxHeight: 400,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  historyHeader: {
    padding: '14px 20px',
    borderBottom: '1px solid #eef2ff',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontWeight: 600,
    backgroundColor: '#fafdff',
  },
  historyList: {
    overflowY: 'auto',
    maxHeight: 350,
  },
  historyItem: {
    padding: '12px 20px',
    borderBottom: '1px solid #f8fafc',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 13,
  },
  historyItemLeft: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  historyItemLot: {
    fontWeight: 700,
    color: '#2563eb',
  },
  historyItemShade: {
    color: '#0f172a',
  },
  historyItemKarigar: {
    fontFamily: 'monospace',
    backgroundColor: '#f1f5f9',
    padding: '2px 8px',
    borderRadius: 12,
    fontSize: 11,
  },
  historyItemName: {
    fontSize: 11,
    color: '#64748b',
  },
  historyItemRight: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
  },
  historyItemPcs: {
    fontWeight: 600,
    color: '#059669',
  },
  historyItemTime: {
    fontSize: 10,
    color: '#94a3b8',
  },
  noHistory: {
    padding: '40px',
    textAlign: 'center',
    color: '#94a3b8',
  },
  clearHistorySmall: {
    padding: '4px 12px',
    backgroundColor: '#f1f5f9',
    border: 'none',
    borderRadius: 20,
    fontSize: 11,
    cursor: 'pointer',
    marginRight: 8,
  },
  closeDropdownButton: {
    background: 'none',
    border: 'none',
    fontSize: 18,
    cursor: 'pointer',
    color: '#94a3b8',
    padding: '0 4px',
  },
  // Supervisor Section
  supervisorSection: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: '18px 24px',
    marginBottom: 24,
    border: '1px solid #eef2ff',
    boxShadow: '0 8px 20px -6px rgba(0, 0, 0, 0.05)',
  },
  supervisorRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  supervisorButton: {
    padding: '10px 24px',
    backgroundColor: '#f1f5f9',
    color: '#1f2937',
    border: '1px solid #e2e8f0',
    borderRadius: 40,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    transition: 'all 0.2s',
  },
  supervisorButtonIcon: {
    fontSize: 16,
  },
  selectedSupervisorBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 18px',
    backgroundColor: '#eef2ff',
    borderRadius: 40,
    border: '1px solid #c7d2fe',
  },
  selectedSupervisorIcon: {
    fontSize: 14,
    color: '#2563eb',
  },
  selectedSupervisorLabel: {
    fontSize: 12,
    color: '#1e40af',
    fontWeight: 500,
  },
  selectedSupervisorName: {
    fontWeight: 700,
    color: '#1e3a8a',
  },
  clearSupervisorButton: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: 14,
    padding: '2px 6px',
  },
  detailsButton: {
    padding: '10px 20px',
    backgroundColor: '#e0f2fe',
    color: '#0284c7',
    border: '1px solid #bae6fd',
    borderRadius: 40,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  detailsButtonIcon: {
    fontSize: 14,
  },
  quickAssignBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 16px',
    backgroundColor: '#fef9c3',
    borderRadius: 40,
    fontSize: 12,
    fontWeight: 600,
    color: '#854d0e',
  },
  quickAssignIcon: {
    fontSize: 12,
  },
  supervisorDropdown: {
    marginTop: 18,
    border: '1px solid #e2e8f0',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#fff',
    boxShadow: '0 12px 24px -12px rgba(0,0,0,0.12)',
  },
  supervisorDropdownHeader: {
    padding: '14px 20px',
    backgroundColor: '#fafcff',
    borderBottom: '1px solid #eef2ff',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 14,
    fontWeight: 600,
    color: '#1e293b',
  },
  supervisorList: {
    maxHeight: 280,
    overflowY: 'auto',
  },
  supervisorItem: {
    padding: '12px 20px',
    borderBottom: '1px solid #f1f5f9',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  supervisorItemLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  supervisorItemIcon: {
    fontSize: 18,
    color: '#3b82f6',
  },
  supervisorItemName: {
    fontWeight: 600,
    fontSize: 14,
    color: '#0f172a',
  },
  supervisorItemType: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  supervisorItemSelect: {
    fontSize: 12,
    color: '#2563eb',
    backgroundColor: '#eff6ff',
    padding: '4px 12px',
    borderRadius: 30,
    fontWeight: 500,
  },
  // Modal Styles
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 24,
    width: 450,
    maxWidth: '90%',
    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
  },
  modalHeader: {
    padding: '20px 24px',
    borderBottom: '1px solid #eef2ff',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 700,
    color: '#0f172a',
  },
  modalClose: {
    background: 'none',
    border: 'none',
    fontSize: 20,
    cursor: 'pointer',
    color: '#94a3b8',
  },
  modalBody: {
    padding: '24px',
  },
  modalText: {
    margin: '0 0 12px 0',
    fontSize: 14,
    color: '#334155',
  },
  modalInputGroup: {
    marginTop: 16,
  },
  modalLabel: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: '#1e293b',
    marginBottom: 8,
  },
  modalInput: {
    width: '100%',
    padding: '12px 16px',
    border: '1px solid #cbd5e1',
    borderRadius: 12,
    fontSize: 14,
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  modalFooter: {
    padding: '16px 24px',
    borderTop: '1px solid #eef2ff',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalCancelButton: {
    padding: '10px 20px',
    backgroundColor: '#f1f5f9',
    border: 'none',
    borderRadius: 40,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    color: '#475569',
  },
  modalConfirmButton: {
    padding: '10px 20px',
    backgroundColor: '#3b82f6',
    border: 'none',
    borderRadius: 40,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    color: '#fff',
  },
  // Sidebar Styles
  sidebarOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    display: 'flex',
    justifyContent: 'flex-end',
    zIndex: 1000,
    backdropFilter: 'blur(6px)',
  },
  sidebar: {
    width: 520,
    backgroundColor: '#ffffff',
    height: '100vh',
    boxShadow: '-8px 0 30px rgba(0, 0, 0, 0.08)',
    display: 'flex',
    flexDirection: 'column',
    borderTopLeftRadius: 28,
    borderBottomLeftRadius: 28,
  },
  sidebarHeader: {
    padding: '22px 28px',
    borderBottom: '1px solid #eef2ff',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
  },
  sidebarTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    color: '#0f172a',
  },
  sidebarTitleIcon: {
    fontSize: 24,
  },
  sidebarContent: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px 28px',
  },
  sidebarHeaderActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  quickAssignSidebarBadge: {
    padding: '4px 14px',
    backgroundColor: '#fef9c3',
    borderRadius: 40,
    fontSize: 12,
    fontWeight: 600,
    color: '#854d0e',
  },
  closeSidebarButton: {
    background: 'none',
    border: 'none',
    fontSize: 22,
    cursor: 'pointer',
    color: '#94a3b8',
    padding: '4px 8px',
    transition: 'color 0.2s',
  },
  supervisorInfo: {
    backgroundColor: '#f8fafc',
    padding: '14px 18px',
    borderRadius: 20,
    marginBottom: 24,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    border: '1px solid #eef2ff',
  },
  supervisorInfoLabel: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: 500,
  },
  supervisorInfoValue: {
    fontSize: 15,
    fontWeight: 700,
    color: '#0f172a',
  },
  supervisorInfoType: {
    fontSize: 11,
    color: '#475569',
    backgroundColor: '#e2e8f0',
    padding: '2px 10px',
    borderRadius: 40,
  },
  activeAssignmentIndicator: {
    backgroundColor: '#fffbeb',
    border: '1px solid #fde68a',
    borderRadius: 20,
    padding: '14px 18px',
    marginBottom: 24,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    fontSize: 13,
    color: '#b45309',
  },
  activeAssignmentIcon: {
    fontSize: 18,
  },
  activeAssignmentText: {
    flex: 1,
  },
  activeAssignmentPcs: {
    fontSize: 11,
    color: '#92400e',
    marginLeft: 6,
  },
  noActiveAssignment: {
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
    padding: '14px 18px',
    marginBottom: 24,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 13,
    color: '#475569',
  },
  noActiveIcon: {
    fontSize: 16,
  },
  cancelAssignmentButton: {
    marginLeft: 'auto',
    background: 'none',
    border: 'none',
    fontSize: 16,
    cursor: 'pointer',
    color: '#b45309',
    padding: '4px 8px',
  },
  karigarSearchContainer: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 60,
    padding: '4px 18px',
    marginBottom: 24,
    border: '1px solid #cbd5e1',
    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
    transition: 'all 0.2s',
  },
  karigarSearchIcon: {
    fontSize: 16,
    color: '#3b82f6',
  },
  karigarSearchInput: {
    flex: 1,
    padding: '12px 10px',
    border: 'none',
    fontSize: 14,
    backgroundColor: 'transparent',
    outline: 'none',
  },
  clearSearchButton: {
    background: 'none',
    border: 'none',
    fontSize: 16,
    cursor: 'pointer',
    color: '#94a3b8',
    padding: '4px 8px',
  },
  karigarCount: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 18,
    fontSize: 13,
    fontWeight: 600,
    color: '#1d4ed8',
  },
  karigarCountIcon: {
    fontSize: 14,
  },
  filteredHint: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: 'normal',
  },
  karigarList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  karigarCard: {
    backgroundColor: '#ffffff',
    border: '1px solid #eef2ff',
    borderRadius: 20,
    padding: '16px',
    transition: 'all 0.2s',
    boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
  },
  karigarCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  karigarCardInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  karigarIdBadge: {
    padding: '4px 14px',
    backgroundColor: '#dbeafe',
    borderRadius: 40,
    fontSize: 13,
    fontWeight: 700,
    color: '#1e40af',
    fontFamily: 'monospace',
  },
  karigarNameText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: 500,
  },
  selectKarigarButton: {
    padding: '8px 20px',
    backgroundColor: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: 40,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  selectKarigarButtonDisabled: {
    backgroundColor: '#94a3b8',
    cursor: 'not-allowed',
    opacity: 0.6,
  },
  noKarigars: {
    textAlign: 'center',
    padding: '48px 20px',
    color: '#94a3b8',
  },
  noKarigarsIcon: {
    fontSize: 48,
    display: 'block',
    marginBottom: 12,
  },
  sidebarLoading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '48px',
    color: '#2563eb',
  },
  loadingSpinnerSmall: {
    width: 32,
    height: 32,
    border: '3px solid #e2e8f0',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: 12,
  },
  spinnerSmallLight: {
    width: 18,
    height: 18,
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  spinnerMini: {
    width: 16,
    height: 16,
    border: '2px solid #e2e8f0',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  // Search Section
  searchSection: {
    marginBottom: 24,
    position: 'relative',
  },
  searchBar: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 60,
    overflow: 'hidden',
    border: '1px solid #e2e8f0',
    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.02)',
  },
  searchIcon: {
    padding: '0 18px',
    fontSize: 18,
    color: '#3b82f6',
  },
  searchInput: {
    flex: 1,
    padding: '14px 0',
    border: 'none',
    fontSize: 15,
    outline: 'none',
  },
  searchButton: {
    padding: '14px 32px',
    background: 'linear-gradient(100deg, #2563eb, #4f46e5)',
    color: '#fff',
    border: 'none',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
    minWidth: 130,
  },
  suggestions: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    border: '1px solid #eef2ff',
    boxShadow: '0 20px 30px -12px rgba(0,0,0,0.12)',
    zIndex: 10,
  },
  suggestionsHeader: {
    padding: '14px 20px',
    fontSize: 12,
    color: '#1e40af',
    borderBottom: '1px solid #f1f5f9',
    display: 'flex',
    justifyContent: 'space-between',
    fontWeight: 600,
  },
  suggestionItem: {
    padding: '12px 20px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    borderBottom: '1px solid #f8fafc',
    transition: 'background 0.2s',
  },
  suggestionIcon: {
    fontSize: 14,
    color: '#64748b',
  },
  // Two Column Layout
  twoColumnLayout: {
    display: 'grid',
    gridTemplateColumns: '380px 1fr',
    gap: 28,
    marginBottom: 24,
  },
  leftColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  rightColumn: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: '24px 28px',
    border: '1px solid #eef2ff',
    boxShadow: '0 12px 24px -12px rgba(0, 0, 0, 0.06)',
  },
  // Left Column Cards
  activeLotCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: '20px 24px',
    border: '1px solid #eef2ff',
    display: 'flex',
    alignItems: 'center',
    gap: 20,
    boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
  },
  activeLotIcon: {
    width: 56,
    height: 56,
    backgroundColor: '#fee2e2',
    borderRadius: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 28,
    color: '#b91c1c',
  },
  activeLotContent: {
    flex: 1,
  },
  activeLotLabel: {
    fontSize: 11,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    fontWeight: 600,
  },
  activeLotNumber: {
    fontSize: 26,
    fontWeight: 800,
    color: '#dc2626',
  },
  unassignedBadge: {
    padding: '6px 16px',
    backgroundColor: '#fef9c3',
    borderRadius: 40,
    fontSize: 12,
    fontWeight: 600,
    color: '#854d0e',
  },
  fullyAssignedBadge: {
    padding: '6px 16px',
    backgroundColor: '#d1fae5',
    borderRadius: 40,
    fontSize: 12,
    fontWeight: 600,
    color: '#065f46',
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    border: '1px solid #eef2ff',
    overflow: 'hidden',
    boxShadow: '0 4px 14px rgba(0,0,0,0.02)',
  },
  summaryCardHeader: {
    padding: '16px 24px',
    borderBottom: '1px solid #eef2ff',
    backgroundColor: '#fafdff',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  summaryCardIcon: {
    fontSize: 20,
    color: '#2563eb',
  },
  summaryCardTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 700,
    color: '#0f172a',
  },
  summaryGrid: {
    padding: '16px 24px',
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
  },
  summaryLabel: {
    fontSize: 13,
    color: '#2563eb',
    fontWeight: 500,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: 600,
    color: '#1e293b',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#eef2ff',
    margin: '8px 0',
  },
  summaryLabelTotal: {
    fontSize: 14,
    fontWeight: 700,
    color: '#0f172a',
  },
  summaryValueTotal: {
    fontSize: 20,
    fontWeight: 800,
    color: '#059669',
  },
  previewCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    border: '1px solid #eef2ff',
    overflow: 'hidden',
  },
  previewCardHeader: {
    padding: '16px 24px',
    borderBottom: '1px solid #eef2ff',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fafdff',
  },
  previewIcon: {
    fontSize: 18,
  },
  previewTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 700,
    flex: 1,
    color: '#0f172a',
  },
  previewCount: {
    backgroundColor: '#e2e8f0',
    padding: '2px 12px',
    borderRadius: 40,
    fontSize: 12,
    fontWeight: 600,
  },
  previewList: {
    padding: '4px 0',
  },
  previewItem: {
    padding: '12px 24px',
    borderBottom: '1px solid #f8fafc',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewItemLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  previewShade: {
    fontSize: 14,
    fontWeight: 700,
    color: '#0f172a',
  },
  previewKarigar: {
    fontSize: 11,
    color: '#059669',
    fontWeight: 500,
  },
  previewUnassigned: {
    fontSize: 11,
    color: '#94a3b8',
  },
  previewQty: {
    fontSize: 13,
    fontWeight: 600,
    color: '#475569',
  },
  previewMore: {
    padding: '14px 24px',
    textAlign: 'center',
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: 500,
  },
  // Shades Grid
  shadesHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    flexWrap: 'wrap',
    gap: 12,
  },
  shadesTitleContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  shadesTitleIcon: {
    fontSize: 24,
    color: '#2563eb',
  },
  shadesTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 800,
    color: '#0f172a',
  },
  shadesStats: {
    display: 'flex',
    gap: 12,
  },
  assignedCount: {
    fontSize: 13,
    color: '#059669',
    backgroundColor: '#ecfdf5',
    padding: '6px 16px',
    borderRadius: 40,
    fontWeight: 600,
  },
  unassignedCount: {
    fontSize: 13,
    color: '#d97706',
    backgroundColor: '#fef9c3',
    padding: '6px 16px',
    borderRadius: 40,
    fontWeight: 600,
  },
  shadesCount: {
    fontSize: 13,
    color: '#2563eb',
    backgroundColor: '#eff6ff',
    padding: '6px 16px',
    borderRadius: 40,
    fontWeight: 600,
  },
  activeShadeHint: {
    backgroundColor: '#fef9c3',
    borderRadius: 20,
    padding: '14px 20px',
    marginBottom: 24,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    fontSize: 13,
    border: '1px solid #fde68a',
  },
  activeShadeHintIcon: {
    fontSize: 18,
  },
  activeShadeHintText: {
    flex: 1,
  },
  activeShadeHintPcs: {
    fontSize: 11,
    color: '#92400e',
    marginLeft: 6,
  },
  cancelShadeButton: {
    marginLeft: 'auto',
    background: 'none',
    border: '1px solid #fde68a',
    padding: '6px 16px',
    borderRadius: 40,
    fontSize: 11,
    cursor: 'pointer',
    color: '#92400e',
  },
  shadesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
    gap: 18,
    marginBottom: 24,
    maxHeight: 'calc(100vh - 400px)',
    overflowY: 'auto',
    padding: '2px',
  },
  shadeItem: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: '20px',
    border: '1px solid #eef2ff',
    transition: 'all 0.25s',
    position: 'relative',
    boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
  },
  shadeItemActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#f5f9ff',
    boxShadow: '0 12px 24px -14px rgba(59,130,246,0.2)',
  },
  shadeItemHasAssignments: {
    backgroundColor: '#f0fdf9',
    borderColor: '#a7f3d0',
  },
  shadeItemFullyAssigned: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  shadeItemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  shadeItemNameWrapper: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  shadeItemName: {
    fontSize: 16,
    fontWeight: 800,
    color: '#0f172a',
  },
  shadeItemPcs: {
    fontSize: 13,
    fontWeight: 700,
    color: '#b91c1c',
    backgroundColor: '#fee2e2',
    padding: '4px 12px',
    borderRadius: 40,
  },
  fullyAssignedBadgeSmall: {
    fontSize: 10,
    padding: '2px 8px',
    backgroundColor: '#bbf7d0',
    borderRadius: 20,
    color: '#065f46',
    fontWeight: 600,
  },
  partialBadge: {
    fontSize: 10,
    padding: '2px 8px',
    backgroundColor: '#fed7aa',
    borderRadius: 20,
    color: '#9a3412',
    fontWeight: 600,
  },
  shadeProgressBar: {
    height: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 14,
  },
  shadeProgressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #10b981, #34d399)',
    borderRadius: 10,
    transition: 'width 0.3s ease',
  },
  assignedKarigarsList: {
    marginBottom: 14,
    maxHeight: 120,
    overflowY: 'auto',
  },
  assignedKarigarItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: '8px 12px',
    borderRadius: 16,
    marginBottom: 6,
    border: '1px solid #e2e8f0',
  },
  assignedKarigarInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  assignedKarigarIcon: {
    fontSize: 11,
  },
  assignedKarigarId: {
    fontSize: 12,
    fontWeight: 700,
    color: '#059669',
    fontFamily: 'monospace',
  },
  assignedKarigarName: {
    fontSize: 11,
    color: '#334155',
  },
  assignedPcsBadge: {
    fontSize: 10,
    padding: '2px 8px',
    backgroundColor: '#d1fae5',
    borderRadius: 20,
    color: '#065f46',
    fontWeight: 600,
  },
  assignedActions: {
    display: 'flex',
    gap: 6,
  },
  editButton: {
    background: 'none',
    border: 'none',
    fontSize: 12,
    cursor: 'pointer',
    padding: '4px 6px',
    borderRadius: 8,
    color: '#3b82f6',
  },
  removeButtonSmall: {
    background: 'none',
    border: 'none',
    fontSize: 12,
    cursor: 'pointer',
    padding: '4px 6px',
    borderRadius: 8,
    color: '#ef4444',
  },
  shadeActionButtons: {
    display: 'flex',
    gap: 10,
  },
  assignMoreButton: {
    flex: 1,
    padding: '10px 14px',
    backgroundColor: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: 40,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  assignMoreButtonDisabled: {
    backgroundColor: '#94a3b8',
    cursor: 'not-allowed',
    opacity: 0.6,
  },
  remainingPcsIndicator: {
    position: 'absolute',
    bottom: -8,
    left: '50%',
    transform: 'translateX(-50%)',
    fontSize: 10,
    color: '#d97706',
    backgroundColor: '#fef9c3',
    padding: '2px 10px',
    borderRadius: 20,
    whiteSpace: 'nowrap',
    border: '1px solid #fde68a',
  },
  activeShadeIndicator: {
    position: 'absolute',
    bottom: -10,
    left: '50%',
    transform: 'translateX(-50%)',
    fontSize: 10,
    color: '#2563eb',
    backgroundColor: '#eff6ff',
    padding: '4px 14px',
    borderRadius: 40,
    whiteSpace: 'nowrap',
    border: '1px solid #bfdbfe',
    fontWeight: 600,
  },
  progressSection: {
    marginBottom: 24,
  },
  progressLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 12,
    color: '#475569',
    marginBottom: 8,
    fontWeight: 500,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #3b82f6, #6366f1)',
    borderRadius: 10,
    transition: 'width 0.3s ease',
  },
  actionButtons: {
    display: 'flex',
    gap: 14,
  },
  saveButton: {
    flex: 2,
    padding: '14px 22px',
    background: 'linear-gradient(105deg, #2563eb, #4f46e5)',
    color: '#fff',
    border: 'none',
    borderRadius: 60,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    boxShadow: '0 4px 12px rgba(37,99,235,0.3)',
  },
  saveButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  clearButton: {
    flex: 1,
    padding: '14px 22px',
    backgroundColor: '#fff',
    color: '#475569',
    border: '1px solid #cbd5e1',
    borderRadius: 60,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  statusMessage: {
    marginBottom: 24,
    padding: '14px 20px',
    borderRadius: 20,
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  statusSuccess: {
    backgroundColor: '#ecfdf5',
    color: '#065f46',
    border: '1px solid #a7f3d0',
  },
  statusError: {
    backgroundColor: '#fef2f2',
    color: '#991b1b',
    border: '1px solid #fecaca',
  },
  statusWarning: {
    backgroundColor: '#fffbeb',
    color: '#92400e',
    border: '1px solid #fef3c7',
  },
  statusInfo: {
    backgroundColor: '#eff6ff',
    color: '#1e40af',
    border: '1px solid #dbeafe',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 20px',
    color: '#3b82f6',
  },
  loadingSpinner: {
    width: 44,
    height: 44,
    border: '3px solid #e2e8f0',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: 16,
  },
  noShades: {
    textAlign: 'center',
    padding: '80px 20px',
    color: '#94a3b8',
  },
  noShadesIcon: {
    fontSize: 56,
    marginBottom: 20,
    display: 'block',
    color: '#cbd5e1',
  },
  retryButton: {
    marginTop: 20,
    padding: '10px 28px',
    backgroundColor: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: 40,
    cursor: 'pointer',
    fontWeight: 600,
  },
  tipBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    padding: '14px 24px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    fontSize: 13,
    color: '#1e293b',
    border: '1px solid #eef2ff',
  },
  tipIcon: {
    fontSize: 18,
    color: '#3b82f6',
  },
  tipText: {
    flex: 1,
  },
};

// Add keyframes for animations
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(styleSheet);