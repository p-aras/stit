import React, { useEffect, useMemo, useState, useCallback } from 'react';

// Google Sheets API configuration
const SPREADSHEET_ID = '1fKSwGBIpzWEFk566WRQ4bzQ0anJlmasoY8TwrTLQHXI';
const API_KEY = 'AIzaSyAomDFBkOySlIxKWSKGHe6ATv9gvaBr7uk';
const SHEET_NAME = 'JObOrder';

// New spreadsheet for karigar/supervisor data
const KARIGAR_SPREADSHEET_ID = '17qqixpHOXvG1U3RlRwaHON5JCkugpy4RIu5N9zR9ScM';
const KARIGAR_SHEET_NAME = 'KarigarProfiles';

// Separate endpoints for fetching and storing data
const FETCH_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzojcfOjNEbv1UgtGGZA747A7vd_g6T_vSb2WSNIc0T-3IiIknoWvTPXettOYBPE6HRZQ/exec';
const STORE_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzAIkU5fyiJbIFa7NR1ZkYFe0q7D5-sBKSZ225ccKbPBpQo4Wyuw7B7f2Py_09TnqlB/exec';

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
  // Remove commas and convert to number
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

// Enhanced parseMatrix function to properly extract data from Cutting sheet
function parseMatrix(rows, lotNo) {
  console.log('========== PARSING CUTTING SHEET MATRIX ==========');
  console.log('Parsing matrix for lot:', lotNo);
  console.log('Total rows received:', rows.length);
  
  let lotNumber = norm(lotNo);
  let style = '';
  let fabric = '';
  let garmentType = '';

  // First, extract lot information from the top section
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const r = rows[i] || [];
    
    // Look for "Lot Number:" pattern
    if (r[0] && includes(r[0], 'lot number')) {
      if (r[1]) lotNumber = norm(r[1]);
      
      // Look for Style in the same row or next columns
      for (let j = 0; j < r.length; j++) {
        if (includes(r[j], 'style') && r[j+1]) {
          style = norm(r[j+1]);
          break;
        }
      }
    }
    
    // Look for "Fabric:" pattern
    if (r[0] && includes(r[0], 'fabric')) {
      if (r[1]) fabric = norm(r[1]);
      
      // Look for Garment Type in the same row or next columns
      for (let j = 0; j < r.length; j++) {
        if (includes(r[j], 'garment type') && r[j+1]) {
          garmentType = norm(r[j+1]);
          break;
        }
      }
    }
  }

  console.log('Extracted details:', { lotNumber, style, fabric, garmentType });

  // Find the header row (contains "Color", "Cutting Table", "Total Pcs")
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] || [];
    const rowText = r.join(' ').toLowerCase();
    
    // Check if this row contains color and total pcs
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

  // Parse size columns (between Cutting Table and Total Pcs)
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

  // Parse data rows
  const body = [];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    
    // Skip empty rows
    if (!row[0] || row[0].trim() === '') continue;
    
    // Stop if we hit a total row
    if (includes(row[0], 'total')) break;

    const color = norm(row[idxColor]);
    if (!color) continue;

    const cuttingTable = idxCT !== -1 && row[idxCT] ? toNumOrNull(row[idxCT]) : null;

    // Get total from Total Pcs column (this is what we want!)
    const totalPcs = idxTotal !== -1 && row[idxTotal] ? toNumOrNull(row[idxTotal]) : 0;

    // Parse size quantities
    const sizeMap = {};
    for (const s of sizeCols) {
      if (row[s.index]) {
        const qty = toNumOrNull(row[s.index]);
        if (qty !== null) {
          sizeMap[s.key] = qty;
        }
      }
    }

    body.push({ 
      color, 
      cuttingTable, 
      sizes: sizeMap, 
      totalPcs: totalPcs || 0  // Use Total Pcs column value
    });

    console.log(`Parsed row: ${color} - Total Pcs: ${totalPcs}`);
  }

  // Calculate grand total
  const grandTotal = body.reduce((sum, row) => sum + (row.totalPcs || 0), 0);

  console.log('Parsed body rows:', body.length);
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

// Function to fetch from Cutting using Index info
async function fetchFromCuttingUsingIndex(lotInfo, signal) {
  const { startRow, numRows, lotNumber } = lotInfo;

  const endRow = startRow + numRows - 1;
  const range = encodeURIComponent(`${CUTTING_SHEET_NAME}!A${startRow}:Z${endRow}`);

  try {
    const rows = await fetchSheetDataCached(CUTTING_SHEET_ID, range, signal);
    
    console.log(`Fetched ${rows.length} rows from Cutting sheet using index`);

    const parsed = parseMatrix(rows, lotNumber);
    if (parsed && parsed.rows && parsed.rows.length > 0) {
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
    // First, try to find in Index sheet
    const indexData = await fetchIndexSheet(signal);
    const lotInfo = findLotInIndex(indexData, searchKey);
    
    if (lotInfo) {
      console.log('✅ Found lot in Index sheet:', lotInfo);
      const result = await fetchFromCuttingUsingIndex(lotInfo, signal);
      result.source = 'cutting';
      // Add the additional info from Index sheet
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
  const [karigars, setKarigars] = useState({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [previewRows, setPreviewRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // New state for sheet data
  const [sheetData, setSheetData] = useState([]);
  const [loadingSheetData, setLoadingSheetData] = useState(false);
  const [sheetColumns, setSheetColumns] = useState([]);
  const [filteredSheetData, setFilteredSheetData] = useState([]);
  const [sheetError, setSheetError] = useState('');

  // New state for lot matrix from Cutting sheet
  const [lotMatrix, setLotMatrix] = useState(null);

  // New state for supervisors
  const [supervisors, setSupervisors] = useState([]);
  const [loadingSupervisors, setLoadingSupervisors] = useState(false);
  const [showSupervisorDropdown, setShowSupervisorDropdown] = useState(false);
  const [selectedSupervisor, setSelectedSupervisor] = useState('');

  // New state for details sidebar
  const [showDetailsSidebar, setShowDetailsSidebar] = useState(false);
  const [selectedSupervisorDetails, setSelectedSupervisorDetails] = useState(null);
  const [karigarDetails, setKarigarDetails] = useState([]);
  const [loadingKarigarDetails, setLoadingKarigarDetails] = useState(false);
  
  // New state for karigar search in sidebar
  const [karigarSearchTerm, setKarigarSearchTerm] = useState('');
  const [filteredKarigars, setFilteredKarigars] = useState([]);
  
  // Track which shade is currently being assigned
  const [activeShadeForAssignment, setActiveShadeForAssignment] = useState(null);
  
  // Enhanced assignment mode
  const [quickAssignMode, setQuickAssignMode] = useState(false);
  const [selectedShadeForQuickAssign, setSelectedShadeForQuickAssign] = useState(null);
  const [assignmentHistory, setAssignmentHistory] = useState([]);
  const [showAssignmentHistory, setShowAssignmentHistory] = useState(false);
  
  // New state to store karigar names along with IDs
  const [karigarNames, setKarigarNames] = useState({});

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
    
    // Load assignment history
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

  // Clear search history
  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('lotSearchHistory');
  };

  // Save assignment to history
  const addToAssignmentHistory = (shade, karigarId, karigarName) => {
    const assignment = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      lot: selectedLot,
      shade,
      karigarId,
      karigarName,
      pcs: shadePcs[shade] || 0
    };
    
    const updated = [assignment, ...assignmentHistory].slice(0, 20);
    setAssignmentHistory(updated);
    localStorage.setItem('assignmentHistory', JSON.stringify(updated));
  };

  // Clear assignment history
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
        
        // Create a mapping of karigar IDs to names for display
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
  };

  // Handle karigar selection for a specific shade
  const handleKarigarSelect = (shade, karigarId, karigarName) => {
    // Update the assignment for this specific shade
    setKarigars(prev => ({
      ...prev,
      [shade]: karigarId
    }));
    
    // Store the karigar name for display
    setKarigarNames(prev => ({
      ...prev,
      [karigarId]: karigarName
    }));
    
    // Add to history
    addToAssignmentHistory(shade, karigarId, karigarName);
    
    const displayName = `${karigarId} (${karigarName})`;
    const pcs = shadePcs[shade] || 0;
    
    setStatus({
      type: 'success',
      message: `✅ Assigned ${displayName} to shade "${shade}" (${pcs} pcs)`
    });
    
    // Clear active shade after assignment
    setActiveShadeForAssignment(null);
  };

  // Handle shade click to set active shade for assignment
  const handleShadeClick = (shade) => {
    if (!selectedSupervisor) {
      setStatus({
        type: 'warning',
        message: '⚠️ Please select a supervisor first'
      });
      return;
    }
    
    setActiveShadeForAssignment(shade);
    setSelectedShadeForQuickAssign(shade);
    
    if (!showDetailsSidebar) {
      handleViewDetails();
    } else {
      // Scroll to top of sidebar and highlight search
      const searchInput = document.querySelector('.karigar-search-input');
      if (searchInput) {
        searchInput.focus();
      }
      
      setStatus({
        type: 'info',
        message: `🎯 Now assigning for shade: "${shade}" (${shadePcs[shade] || 0} pcs). Select a karigar from the list.`
      });
    }
  };

  // Handle quick assign from sidebar (click on assign button)
  const handleQuickAssign = (karigarId, karigarName) => {
    if (activeShadeForAssignment) {
      handleKarigarSelect(activeShadeForAssignment, karigarId, karigarName);
    } else if (shades.length === 1) {
      // If only one shade, auto-assign to that shade
      handleKarigarSelect(shades[0], karigarId, karigarName);
    } else {
      setStatus({
        type: 'warning',
        message: '⚠️ Please click on a shade first to select which shade to assign'
      });
    }
  };

  // Handle batch assign - assign same karigar to all unassigned shades
  const handleBatchAssign = (karigarId, karigarName) => {
    const unassignedShades = shades.filter(shade => !karigars[shade] || karigars[shade].trim() === '');
    
    if (unassignedShades.length === 0) {
      setStatus({
        type: 'warning',
        message: '⚠️ All shades already have assigned karigars'
      });
      return;
    }
    
    const newAssignments = { ...karigars };
    unassignedShades.forEach(shade => {
      newAssignments[shade] = karigarId;
      addToAssignmentHistory(shade, karigarId, karigarName);
    });
    
    setKarigars(newAssignments);
    
    // Store karigar name
    setKarigarNames(prev => ({
      ...prev,
      [karigarId]: karigarName
    }));
    
    setStatus({
      type: 'success',
      message: `✅ Batch assigned ${karigarId} (${karigarName}) to ${unassignedShades.length} unassigned shades`
    });
  };

  // Handle removing assignment for a shade
  const handleRemoveAssignment = (shade) => {
    setKarigars(prev => ({
      ...prev,
      [shade]: ''
    }));
    
    setStatus({
      type: 'info',
      message: `🗑️ Removed assignment for shade "${shade}"`
    });
  };

  // Function to fetch lot data from Index and Cutting sheets (PRIORITY)
  const fetchLotFromCuttingSheet = async (lotNumber) => {
    setLoadingSheetData(true);
    setSheetError('');
    
    try {
      const matrix = await fetchLotMatrix(lotNumber);
      console.log('Matrix received from Cutting sheet:', matrix);
      setLotMatrix(matrix);
      
      // Convert matrix data to shades and pcs
      if (matrix && matrix.rows && matrix.rows.length > 0) {
        const shadesList = [];
        const pcsMap = {};
        
        matrix.rows.forEach(row => {
          if (row.color) {
            // Handle potential color names with parentheses
            let colorName = row.color;
            // We'll keep the full color name as is
            shadesList.push(colorName);
            pcsMap[colorName] = row.totalPcs || 0;
          }
        });
        
        console.log('Setting shades from Cutting sheet:', shadesList);
        console.log('Setting pcs map from Cutting sheet:', pcsMap);
        console.log('Total pieces from Cutting sheet:', matrix.totals?.grand || 0);
        
        setShades(shadesList);
        setShadePcs(pcsMap);
        
        // Initialize karigar assignments
        const init = {};
        shadesList.forEach(s => (init[s] = ''));
        setKarigars(init);
        
        // Create filteredSheetData for lot summary using data from Index sheet
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
          message: `✅ Found lot ${lotNumber} from Cutting sheet with ${shadesList.length} shades (Total: ${totalPcs} pcs)` 
        });
      } else {
        throw new Error('No data found in matrix');
      }
    } catch (error) {
      console.error('Error fetching from Cutting sheet:', error);
      setSheetError(error.message);
      setStatus({ 
        type: 'error', 
        message: `❌ Failed to fetch lot from Cutting sheet: ${error.message}` 
      });
    } finally {
      setLoadingSheetData(false);
    }
  };

  // fetchSheetData now PRIORITIZES Cutting sheet first
  const fetchSheetData = async (lotNumber) => {
    setLoadingSheetData(true);
    setSheetError('');
    
    try {
      // FIRST TRY: Cutting sheet (primary source)
      console.log('🔍 First trying Cutting sheet for lot:', lotNumber);
      await fetchLotFromCuttingSheet(lotNumber);
      
    } catch (cuttingError) {
      console.log('⚠️ Lot not found in Cutting sheet, trying JObOrder as fallback...', cuttingError);
      
      // SECOND TRY: JObOrder sheet (fallback)
      try {
        const sheetNameEncoded = encodeURIComponent(SHEET_NAME);
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${sheetNameEncoded}?key=${API_KEY}`;
        
        console.log('Fetching from JObOrder sheet (fallback):', url);
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
          
          console.log('Filtered rows from JObOrder for lot', lotNumber, ':', filtered);
          setFilteredSheetData(filtered);
          
          if (filtered.length > 0) {
            // Parse shades from JObOrder data
            const shadesList = [];
            const pcsMap = {};
            
            filtered.forEach(row => {
              const shade = row['Shade'] || row['shade'] || row['COLOR'] || row['Color'] || '';
              const qty = parseInt(row['Quantity'] || row['Qty'] || row['Pcs'] || '0') || 0;
              
              if (shade && qty > 0) {
                // Handle multiple shades in one cell (comma-separated)
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
              
              const init = {};
              shadesList.forEach(s => (init[s] = ''));
              setKarigars(init);
              
              const totalPcs = Object.values(pcsMap).reduce((sum, pcs) => sum + pcs, 0);
              
              setStatus({ 
                type: 'success', 
                message: `✅ Found lot ${lotNumber} in JObOrder (fallback) with ${shadesList.length} shades (Total: ${totalPcs} pcs)` 
              });
            } else {
              throw new Error('No shades found in JObOrder data');
            }
          } else {
            throw new Error('Lot not found in JObOrder sheet');
          }
        } else {
          throw new Error('No data in JObOrder sheet');
        }
      } catch (jobOrderError) {
        console.error('Error in JObOrder fetch:', jobOrderError);
        setSheetError(jobOrderError.message);
        setStatus({ 
          type: 'error', 
          message: `❌ Failed to fetch lot data from both Cutting and JObOrder sheets: ${jobOrderError.message}` 
        });
      }
    } finally {
      setLoadingSheetData(false);
    }
  };

  // Handle lot search/submit
  const handleLotSearch = async (lotToSearch = lotSearch) => {
    if (!lotToSearch.trim()) {
      setStatus({ type: 'warning', message: '⚠️ Please enter a lot number' });
      return;
    }

    setSelectedLot(lotToSearch);
    setShades([]);
    setShadePcs({});
    setKarigars({});
    setPreviewRows([]);
    setFilteredSheetData([]);
    setLotMatrix(null);
    setSheetError('');
    setStatus({ type: '', message: '' });
    setLoading(true);

    try {
      await fetchSheetData(lotToSearch);
      addToHistory(lotToSearch);
      
      // Fetch existing assignments
      const r2 = await fetch(`${FETCH_ENDPOINT}?action=getKarigarAssignments&lot=${encodeURIComponent(lotToSearch)}`);
      const j2 = await r2.json();
      
      if (j2?.success && Array.isArray(j2.rows)) {
        setPreviewRows(j2.rows);
        const existingAssignments = {};
        j2.rows.forEach(row => {
          if (row.karigar) {
            existingAssignments[row.shade] = row.karigar;
          }
        });
        setKarigars(prev => ({ ...prev, ...existingAssignments }));
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

  const handleInput = (shade, val) => {
    setKarigars(prev => ({ ...prev, [shade]: val }));
  };

  const handleSave = async () => {
    setSaving(true);
    setStatus({ type: '', message: '' });
    try {
      const lotDetails = filteredSheetData.length > 0 ? filteredSheetData[0] : {};
      
      // Create assignments with pcs for each shade
      const assignmentsWithPcs = {};
      Object.entries(karigars).forEach(([shade, karigar]) => {
        if (karigar && karigar.toString().trim() !== '') {
          assignmentsWithPcs[shade] = {
            karigarId: karigar,
            pcs: shadePcs[shade] || 0
          };
        }
      });
      
      // Create the complete payload
      const completePayload = { 
        lot: selectedLot,
        brand: lotMatrix?.brand || lotDetails['Brand'] || lotDetails['BRAND'] || '',
        fabric: lotMatrix?.fabric || lotDetails['Fabric'] || lotDetails['FABRIC'] || '',
        style: lotMatrix?.style || lotDetails['Style'] || lotDetails['STYLE'] || '',
        garmentType: lotMatrix?.garmentType || lotDetails['Garment Type'] || lotDetails['GarmentType'] || lotDetails['GARMENT TYPE'] || '',
        partyName: lotMatrix?.partyName || lotDetails['Party Name'] || lotDetails['PARTY NAME'] || '',
        season: lotMatrix?.season || lotDetails['Season'] || lotDetails['SEASON'] || '',
        karigars: assignmentsWithPcs,
        savedBy: 'Current User',
        supervisor: selectedSupervisor || 'Not Assigned'
      };
      
      console.log('Complete payload:', completePayload);
      
      // Create URL-encoded form data with ALL fields at top level
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
      
      console.log('Form data being sent:', formData.toString());

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
        setStatus({ 
          type: 'success', 
          message: `✅ Successfully saved ${json.savedRows} assignments with piece counts. Supervisor: ${selectedSupervisor || 'Not assigned'}` 
        });
        
        // Refresh preview
        const r2 = await fetch(`${FETCH_ENDPOINT}?action=getKarigarAssignments&lot=${encodeURIComponent(selectedLot)}`);
        const j2 = await r2.json();
        if (j2?.success && Array.isArray(j2.rows)) setPreviewRows(j2.rows);
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
    
    // Calculate total pcs from shadePcs
    const totalPcs = Object.values(shadePcs).reduce((sum, pcs) => sum + pcs, 0);
    
    // If we have preview rows with pcs, we could also calculate from there
    const previewTotalPcs = previewRows.reduce((sum, row) => sum + (parseInt(row.pcs) || 0), 0);
    
    return {
      brand: lotMatrix?.brand || firstRow['Brand'] || firstRow['BRAND'] || 'N/A',
      fabric: lotMatrix?.fabric || firstRow['Fabric'] || firstRow['FABRIC'] || 'N/A',
      style: lotMatrix?.style || firstRow['Style'] || firstRow['STYLE'] || 'N/A',
      garmentType: lotMatrix?.garmentType || firstRow['Garment Type'] || firstRow['GarmentType'] || firstRow['GARMENT TYPE'] || 'N/A',
      partyName: lotMatrix?.partyName || firstRow['Party Name'] || firstRow['PARTY NAME'] || 'N/A',
      season: lotMatrix?.season || firstRow['Season'] || firstRow['SEASON'] || 'N/A',
      date: firstRow['Date'] || firstRow['DATE'] || 'N/A',
      totalPcs: totalPcs || previewTotalPcs || 0
    };
  }, [filteredSheetData, lotMatrix, shadePcs, previewRows]);

  const lotSummary = getLotSummary();

  // Calculate total assigned pcs
  const totalAssignedPcs = useMemo(() => {
    let total = 0;
    Object.entries(karigars).forEach(([shade, karigar]) => {
      if (karigar && karigar.toString().trim() !== '') {
        total += shadePcs[shade] || 0;
      }
    });
    return total;
  }, [karigars, shadePcs]);

  // Get unassigned shades count
  const unassignedShadesCount = useMemo(() => {
    return shades.filter(shade => !karigars[shade] || karigars[shade].trim() === '').length;
  }, [shades, karigars]);

  return (
    <div style={styles.container}>
      {/* Compact Header */}
      <div style={styles.compactHeader}>
        <div style={styles.headerLeft}>
          <span style={styles.headerIcon}>👔</span>
          <div>
            <h1 style={styles.compactTitle}>Karigar Assignment</h1>
            <p style={styles.compactSubtitle}>Assign karigars to production lots</p>
          </div>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.headerStats}>
            <span style={styles.statPill}>
              <span style={styles.statPillIcon}>📋</span>
              {previewRows.length} Assignments
            </span>
            <span style={styles.statPill}>
              <span style={styles.statPillIcon}>🎨</span>
              {shades.length} Shades
            </span>
            <span style={styles.statPill}>
              <span style={styles.statPillIcon}>📦</span>
              {totalAssignedPcs} / {lotSummary?.totalPcs || 0} Pcs
            </span>
          </div>
          <button
            onClick={() => setShowAssignmentHistory(!showAssignmentHistory)}
            style={styles.historyButton}
          >
            <span style={styles.historyButtonIcon}>📜</span>
            History
          </button>
          <button
            onClick={() => alert('Rate List feature coming soon!')}
            style={styles.rateListButton}
          >
            <span style={styles.rateListButtonIcon}>💰</span>
            Create Rate List
          </button>
        </div>
      </div>

      {/* Assignment History Dropdown */}
      {showAssignmentHistory && (
        <div style={styles.historyDropdown}>
          <div style={styles.historyHeader}>
            <span>📜 Recent Assignments</span>
            <div>
              <button onClick={clearAssignmentHistory} style={styles.clearHistorySmall}>Clear</button>
              <button onClick={() => setShowAssignmentHistory(false)} style={styles.closeDropdownButton}>✕</button>
            </div>
          </div>
          <div style={styles.historyList}>
            {assignmentHistory.length > 0 ? (
              assignmentHistory.map(entry => (
                <div key={entry.id} style={styles.historyItem}>
                  <div style={styles.historyItemLeft}>
                    <span style={styles.historyItemLot}>Lot: {entry.lot}</span>
                    <span style={styles.historyItemShade}>Shade: {entry.shade}</span>
                    <span style={styles.historyItemKarigar}>ID: {entry.karigarId}</span>
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

      {/* Supervisor Button Row */}
      <div style={styles.supervisorRow}>
        <button
          onClick={fetchSupervisors}
          disabled={loadingSupervisors}
          style={styles.supervisorButton}
        >
          <span style={styles.supervisorButtonIcon}>
            {loadingSupervisors ? '⏳' : '👥'}
          </span>
          {loadingSupervisors ? 'Loading...' : 'Select Supervisor / Thekedar'}
        </button>
        
        {selectedSupervisor && (
          <>
            <div style={styles.selectedSupervisorBadge}>
              <span style={styles.selectedSupervisorIcon}>✓</span>
              <span style={styles.selectedSupervisorLabel}>Selected:</span>
              <span style={styles.selectedSupervisorName}>{selectedSupervisor}</span>
              <button
                onClick={() => setSelectedSupervisor('')}
                style={styles.clearSupervisorButton}
              >
                ✕
              </button>
            </div>
            
            {/* View Details Button */}
            <button
              onClick={handleViewDetails}
              style={styles.detailsButton}
              disabled={!selectedSupervisor}
            >
              <span style={styles.detailsButtonIcon}>📋</span>
              View Karigar Details
            </button>

            {/* Quick Assign Status */}
            {quickAssignMode && (
              <div style={styles.quickAssignBadge}>
                <span style={styles.quickAssignIcon}>⚡</span>
                Quick Assign Mode
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

      {/* Details Sidebar */}
      {showDetailsSidebar && (
        <div style={styles.sidebarOverlay} onClick={closeSidebar}>
          <div style={styles.sidebar} onClick={e => e.stopPropagation()}>
            <div style={styles.sidebarHeader}>
              <h3 style={styles.sidebarTitle}>
                <span style={styles.sidebarTitleIcon}>👥</span>
                Karigar Details
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
                    <span>Assigning to shade:</span>
                    <strong>"{activeShadeForAssignment}"</strong>
                    {shadePcs[activeShadeForAssignment] && 
                      <span style={styles.activeAssignmentPcs}>
                        ({shadePcs[activeShadeForAssignment]} pcs)
                      </span>
                    }
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
                  <span>Click on any shade card above to start assigning</span>
                </div>
              )}
              
              {/* Search Bar */}
              <div style={styles.karigarSearchContainer}>
                <span style={styles.karigarSearchIcon}>🔍</span>
                <input
                  type="text"
                  placeholder="Search karigar by ID or name..."
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
                  <p>Loading karigar details...</p>
                </div>
              ) : (
                <>
                  <div style={styles.karigarCount}>
                    <span style={styles.karigarCountIcon}>👤</span>
                    {filteredKarigars.length} Karigar{filteredKarigars.length !== 1 ? 's' : ''} Found
                    {karigarSearchTerm && filteredKarigars.length !== karigarDetails.length && (
                      <span style={styles.filteredHint}>(filtered)</span>
                    )}
                  </div>
                  
                  {/* Batch Assign Button (shown when multiple unassigned shades) */}
                  {unassignedShadesCount > 1 && activeShadeForAssignment && (
                    <div style={styles.batchAssignHint}>
                      <span>💡 Tip: </span>
                      <span>You can also </span>
                      <button
                        onClick={() => {
                          if (filteredKarigars.length > 0) {
                            handleBatchAssign(filteredKarigars[0].karigarId, filteredKarigars[0].karigarName);
                          }
                        }}
                        style={styles.batchAssignLink}
                      >
                        batch assign
                      </button>
                      <span> the same karigar to all {unassignedShadesCount} unassigned shades</span>
                    </div>
                  )}
                  
                  {filteredKarigars.length > 0 ? (
                    <div style={styles.karigarList}>
                      {/* Table Header */}
                      <div style={styles.karigarTableHeader}>
                        <span style={styles.headerSrNo}>Sr. No.</span>
                        <span style={styles.headerId}>Karigar ID</span>
                        <span style={styles.headerName}>Karigar Name</span>
                        <span style={styles.headerAction}>Action</span>
                      </div>
                      
                      {filteredKarigars.map((karigar) => (
                        <div 
                          key={karigar.srNo} 
                          style={styles.karigarCard}
                        >
                          <span style={styles.karigarSrNo}>{karigar.srNo}</span>
                          <span style={styles.karigarIdValue}>{karigar.karigarId}</span>
                          <span style={styles.karigarNameValue}>{karigar.karigarName}</span>
                          <div style={styles.karigarActions}>
                            <button
                              onClick={() => handleQuickAssign(karigar.karigarId, karigar.karigarName)}
                              style={{
                                ...styles.selectKarigarButton,
                                ...(!activeShadeForAssignment ? styles.selectKarigarButtonDisabled : {})
                              }}
                              disabled={!activeShadeForAssignment}
                              title={activeShadeForAssignment ? `Assign to "${activeShadeForAssignment}"` : 'Select a shade first'}
                            >
                              {activeShadeForAssignment ? 'Assign' : 'Select'}
                            </button>
                            {unassignedShadesCount > 1 && (
                              <button
                                onClick={() => handleBatchAssign(karigar.karigarId, karigar.karigarName)}
                                style={styles.batchAssignButton}
                                title={`Assign to all ${unassignedShadesCount} unassigned shades`}
                              >
                                📦
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={styles.noKarigars}>
                      <span style={styles.noKarigarsIcon}>📭</span>
                      <p>
                        {karigarSearchTerm 
                          ? `No karigars found matching "${karigarSearchTerm}"` 
                          : 'No karigars found for this supervisor'}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Search Bar */}
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
            {loading ? 'Searching...' : 'Search'}
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
            {/* Active Lot Badge */}
            <div style={styles.activeLotCard}>
              <span style={styles.activeLotIcon}>🎯</span>
              <span style={styles.activeLotLabel}>Active Lot:</span>
              <span style={styles.activeLotNumber}>{selectedLot}</span>
              {unassignedShadesCount > 0 && (
                <span style={styles.unassignedBadge}>
                  {unassignedShadesCount} unassigned
                </span>
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
                    <span style={styles.summaryLabel}>Brand:</span>
                    <span style={styles.summaryValue}>{lotSummary.brand}</span>
                  </div>
                  <div style={styles.summaryRow}>
                    <span style={styles.summaryLabel}>Fabric:</span>
                    <span style={styles.summaryValue}>{lotSummary.fabric}</span>
                  </div>
                  <div style={styles.summaryRow}>
                    <span style={styles.summaryLabel}>Style:</span>
                    <span style={styles.summaryValue}>{lotSummary.style}</span>
                  </div>
                  <div style={styles.summaryRow}>
                    <span style={styles.summaryLabel}>Garment:</span>
                    <span style={styles.summaryValue}>{lotSummary.garmentType}</span>
                  </div>
                  <div style={styles.summaryRow}>
                    <span style={styles.summaryLabel}>Party:</span>
                    <span style={styles.summaryValue}>{lotSummary.partyName}</span>
                  </div>
                  <div style={styles.summaryRow}>
                    <span style={styles.summaryLabel}>Season:</span>
                    <span style={styles.summaryValue}>{lotSummary.season}</span>
                  </div>
                  <div style={styles.summaryRow}>
                    <span style={styles.summaryLabel}>Date:</span>
                    <span style={styles.summaryValue}>{formatDate(lotSummary.date)}</span>
                  </div>
                  <div style={styles.summaryRow}>
                    <span style={styles.summaryLabel}>Total Pcs:</span>
                    <span style={{...styles.summaryValue, ...styles.summaryValueTotal}}>{lotSummary.totalPcs}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Preview Table */}
            {previewRows.length > 0 && (
              <div style={styles.previewCard}>
                <div style={styles.previewCardHeader}>
                  <span style={styles.previewIcon}>📋</span>
                  <h3 style={styles.previewTitle}>Current Assignments</h3>
                  <span style={styles.previewCount}>{previewRows.length}</span>
                </div>
                <div style={styles.previewList}>
                  {previewRows.slice(0, 5).map((r, i) => (
                    <div key={i} style={styles.previewItem}>
                      <div style={styles.previewItemLeft}>
                        <span style={styles.previewShade}>{r.shade}</span>
                        {r.karigar ? (
                          <span style={styles.previewKarigar}>
                            <span>🆔</span> {r.karigar}
                          </span>
                        ) : (
                          <span style={styles.previewUnassigned}>⚪ Unassigned</span>
                        )}
                      </div>
                      <span style={styles.previewQty}>{r.qty || r.pcs || 0}pcs</span>
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
                <p>Loading shades...</p>
              </div>
            ) : (
              <>
                {/* Status Message */}
                {status.message && (
                  <div style={{ ...styles.statusMessage, ...getStatusStyles() }}>
                    {status.message}
                  </div>
                )}

                {/* Shades Grid */}
                {shades.length > 0 && (
                  <>
                    <div style={styles.shadesHeader}>
                      <h3 style={styles.shadesTitle}>
                        <span style={styles.shadesTitleIcon}>🎨</span>
                        Assign Karigars to Shades
                      </h3>
                      <span style={styles.shadesCount}>{shades.length} shades</span>
                    </div>

                    {/* Active Assignment Hint */}
                    {activeShadeForAssignment && (
                      <div style={styles.activeShadeHint}>
                        <span style={styles.activeShadeHintIcon}>👉</span>
                        <div style={styles.activeShadeHintText}>
                          <span>Currently assigning to shade: </span>
                          <strong>"{activeShadeForAssignment}"</strong>
                          {shadePcs[activeShadeForAssignment] && 
                            <span style={styles.activeShadeHintPcs}>
                              ({shadePcs[activeShadeForAssignment]} pcs)
                            </span>
                          }
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
                      {shades.map((shade) => (
                        <div 
                          key={shade} 
                          style={{
                            ...styles.shadeItem,
                            ...(activeShadeForAssignment === shade ? styles.shadeItemActive : {}),
                            ...(karigars[shade] ? styles.shadeItemAssigned : {})
                          }}
                        >
                          <div style={styles.shadeItemHeader}>
                            <span style={styles.shadeItemName}>{shade}</span>
                            <span style={styles.shadeItemPcs}>{shadePcs[shade] || 0} pcs</span>
                          </div>
                          
                          {/* Display assigned karigar if any */}
                          {karigars[shade] && (
                            <div style={styles.assignedKarigarInfo}>
                              <span style={styles.assignedKarigarIcon}>🆔</span>
                              <span style={styles.assignedKarigarId}>{karigars[shade]}</span>
                              {karigarNames[karigars[shade]] && (
                                <span style={styles.assignedKarigarName}>
                                  ({karigarNames[karigars[shade]]})
                                </span>
                              )}
                            </div>
                          )}
                          
                          {/* Action Buttons */}
                          <div style={styles.shadeActionButtons}>
                            <button
                              onClick={() => handleShadeClick(shade)}
                              style={{
                                ...styles.selectShadeButton,
                                ...(!selectedSupervisor ? styles.selectShadeButtonDisabled : {}),
                                ...(karigars[shade] ? styles.changeButton : {})
                              }}
                              disabled={!selectedSupervisor}
                            >
                              {karigars[shade] ? 'Change Karigar' : 'Select Karigar'}
                            </button>
                            
                            {karigars[shade] && (
                              <button
                                onClick={() => handleRemoveAssignment(shade)}
                                style={styles.removeButton}
                                title="Remove assignment"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                          
                          {activeShadeForAssignment === shade && (
                            <div style={styles.activeShadeIndicator}>
                              👆 Select karigar from sidebar
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Assignment Summary */}
                    <div style={styles.assignmentSummary}>
                      <div style={styles.summaryStats}>
                        <span>
                          <span style={styles.summaryStatIcon}>✓</span>
                          Assigned: {Object.values(karigars).filter(Boolean).length} / {shades.length} shades
                        </span>
                        <span>
                          <span style={styles.summaryStatIcon}>📦</span>
                          Pcs: {totalAssignedPcs} / {lotSummary?.totalPcs || 0}
                        </span>
                      </div>
                      {unassignedShadesCount > 0 && (
                        <div style={styles.unassignedWarning}>
                          ⚠️ {unassignedShadesCount} shade{unassignedShadesCount > 1 ? 's' : ''} unassigned
                        </div>
                      )}
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
                          const empty = {};
                          shades.forEach(s => empty[s] = '');
                          setKarigars(empty);
                          setStatus({ type: 'info', message: '🧹 All assignments cleared' });
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
                    <p>{status.message || 'No shades found for this lot.'}</p>
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
                ? `Click on a karigar in the sidebar to assign to shade "${activeShadeForAssignment}"`
                : `Click "Select Karigar" button on any shade to assign a karigar from ${selectedSupervisor}'s team`
              : 'Select a supervisor first to assign karigar IDs'}
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
    padding: '20px',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    backgroundColor: '#ffffff',
    minHeight: '100vh',
    position: 'relative',
  },
  compactHeader: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: '16px 20px',
    marginBottom: 16,
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    border: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    fontSize: '32px',
  },
  compactTitle: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 600,
    color: '#003097',
  },
  compactSubtitle: {
    margin: '2px 0 0',
    fontSize: '12px',
    color: '#000000',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  headerStats: {
    display: 'flex',
    gap: 8,
  },
  statPill: {
    padding: '4px 12px',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    fontSize: '12px',
    color: '#000000',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    border: '1px solid #e5e7eb',
  },
  statPillIcon: {
    fontSize: '14px',
  },
  historyButton: {
    padding: '8px 16px',
    backgroundColor: '#8b5cf6',
    color: '#ffffff',
    border: 'none',
    borderRadius: 8,
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    transition: 'all 0.2s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  historyButtonIcon: {
    fontSize: '16px',
  },
  rateListButton: {
    padding: '8px 16px',
    backgroundColor: '#059669',
    color: '#ffffff',
    border: 'none',
    borderRadius: 8,
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    transition: 'all 0.2s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  rateListButtonIcon: {
    fontSize: '16px',
  },
  historyDropdown: {
    backgroundColor: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    marginBottom: 16,
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
    overflow: 'hidden',
  },
  historyHeader: {
    padding: '12px 16px',
    backgroundColor: '#f9fafb',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '13px',
    fontWeight: 500,
    color: '#111827',
  },
  historyList: {
    maxHeight: '200px',
    overflowY: 'auto',
    padding: '8px',
  },
  historyItem: {
    padding: '8px 12px',
    borderBottom: '1px solid #f3f4f6',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '12px',
  },
  historyItemLeft: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  historyItemLot: {
    fontWeight: 600,
    color: '#059669',
  },
  historyItemShade: {
    color: '#111827',
  },
  historyItemKarigar: {
    color: '#8b5cf6',
    fontFamily: 'monospace',
  },
  historyItemName: {
    color: '#6b7280',
    fontSize: '11px',
  },
  historyItemRight: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
  },
  historyItemPcs: {
    color: '#059669',
    fontWeight: 500,
  },
  historyItemTime: {
    color: '#9ca3af',
    fontSize: '11px',
  },
  noHistory: {
    padding: '20px',
    textAlign: 'center',
    color: '#6b7280',
    fontSize: '12px',
  },
  supervisorRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  supervisorButton: {
    padding: '10px 16px',
    backgroundColor: '#f3f4f6',
    color: '#111827',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    transition: 'all 0.2s',
    flex: '0 0 auto',
  },
  supervisorButtonIcon: {
    fontSize: '16px',
  },
  selectedSupervisorBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    backgroundColor: '#ecfdf5',
    border: '1px solid #a7f3d0',
    borderRadius: 20,
    fontSize: '13px',
    color: '#065f46',
    flex: '0 0 auto',
  },
  selectedSupervisorIcon: {
    fontSize: '14px',
    color: '#059669',
  },
  selectedSupervisorLabel: {
    fontSize: '12px',
    color: '#047857',
  },
  selectedSupervisorName: {
    fontWeight: 600,
    color: '#047857',
  },
  clearSupervisorButton: {
    background: 'none',
    border: 'none',
    color: '#9ca3af',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '2px 6px',
    marginLeft: 4,
  },
  detailsButton: {
    padding: '10px 16px',
    backgroundColor: '#e0f2fe',
    color: '#0369a1',
    border: '1px solid #bae6fd',
    borderRadius: 8,
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    transition: 'all 0.2s',
    flex: '0 0 auto',
  },
  detailsButtonIcon: {
    fontSize: '16px',
  },
  quickAssignBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 10px',
    backgroundColor: '#fef3c7',
    border: '1px solid #fde68a',
    borderRadius: 20,
    fontSize: '12px',
    color: '#92400e',
  },
  quickAssignIcon: {
    fontSize: '14px',
  },
  supervisorDropdown: {
    backgroundColor: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    marginBottom: 16,
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
    overflow: 'hidden',
  },
  supervisorDropdownHeader: {
    padding: '12px 16px',
    backgroundColor: '#f9fafb',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '13px',
    fontWeight: 500,
    color: '#111827',
  },
  closeDropdownButton: {
    background: 'none',
    border: 'none',
    color: '#6b7280',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '4px 8px',
  },
  supervisorList: {
    maxHeight: '300px',
    overflowY: 'auto',
    padding: '8px',
  },
  supervisorItem: {
    padding: '10px 12px',
    borderBottom: '1px solid #f3f4f6',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  supervisorItemLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  supervisorItemIcon: {
    fontSize: '16px',
    color: '#6b7280',
  },
  supervisorItemName: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#111827',
  },
  supervisorItemType: {
    fontSize: '11px',
    color: '#6b7280',
    marginTop: 2,
  },
  supervisorItemSelect: {
    fontSize: '11px',
    color: '#3b82f6',
    backgroundColor: '#eff6ff',
    padding: '2px 8px',
    borderRadius: 4,
  },
  // Sidebar Styles
  sidebarOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'flex-end',
    zIndex: 1000,
    animation: 'fadeIn 0.2s ease',
  },
  sidebar: {
    width: '600px',
    backgroundColor: '#ffffff',
    height: '100vh',
    boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.1)',
    animation: 'slideIn 0.2s ease',
    display: 'flex',
    flexDirection: 'column',
  },
  sidebarHeader: {
    padding: '20px',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  sidebarHeaderActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  quickAssignSidebarBadge: {
    padding: '4px 10px',
    backgroundColor: '#fef3c7',
    border: '1px solid #fde68a',
    borderRadius: 20,
    fontSize: '11px',
    color: '#92400e',
  },
  sidebarTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 600,
    color: '#111827',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  sidebarTitleIcon: {
    fontSize: '20px',
  },
  closeSidebarButton: {
    background: 'none',
    border: 'none',
    color: '#6b7280',
    cursor: 'pointer',
    fontSize: '18px',
    padding: '4px 8px',
    borderRadius: 4,
  },
  sidebarContent: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
  },
  supervisorInfo: {
    backgroundColor: '#f3f4f6',
    padding: '12px',
    borderRadius: 8,
    marginBottom: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  supervisorInfoLabel: {
    fontSize: '12px',
    color: '#6b7280',
  },
  supervisorInfoValue: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#111827',
  },
  supervisorInfoType: {
    fontSize: '12px',
    color: '#6b7280',
    backgroundColor: '#e5e7eb',
    padding: '2px 8px',
    borderRadius: 12,
  },
  activeAssignmentIndicator: {
    backgroundColor: '#fef3c7',
    border: '1px solid #fde68a',
    borderRadius: 8,
    padding: '12px',
    marginBottom: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: '13px',
    color: '#92400e',
  },
  activeAssignmentIcon: {
    fontSize: '16px',
  },
  activeAssignmentText: {
    flex: 1,
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
  },
  activeAssignmentPcs: {
    color: '#059669',
    fontWeight: 500,
    marginLeft: 4,
  },
  noActiveAssignment: {
    backgroundColor: '#f3f4f6',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: '12px',
    marginBottom: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: '13px',
    color: '#6b7280',
  },
  noActiveIcon: {
    fontSize: '16px',
  },
  cancelAssignmentButton: {
    marginLeft: 'auto',
    background: 'none',
    border: 'none',
    color: '#92400e',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '4px 8px',
    borderRadius: 4,
  },
  karigarSearchContainer: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  karigarSearchIcon: {
    padding: '0 12px',
    fontSize: '16px',
    color: '#9ca3af',
  },
  karigarSearchInput: {
    flex: 1,
    padding: '10px 0',
    border: 'none',
    fontSize: '13px',
    outline: 'none',
  },
  clearSearchButton: {
    background: 'none',
    border: 'none',
    color: '#9ca3af',
    cursor: 'pointer',
    padding: '0 12px',
    fontSize: '14px',
  },
  karigarCount: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 12px',
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    marginBottom: 16,
    fontSize: '13px',
    fontWeight: 500,
    color: '#0369a1',
  },
  karigarCountIcon: {
    fontSize: '16px',
  },
  filteredHint: {
    fontSize: '11px',
    color: '#6b7280',
    marginLeft: 4,
  },
  batchAssignHint: {
    backgroundColor: '#ecfdf5',
    border: '1px solid #a7f3d0',
    borderRadius: 8,
    padding: '10px 12px',
    marginBottom: 16,
    fontSize: '12px',
    color: '#065f46',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  batchAssignLink: {
    background: 'none',
    border: 'none',
    color: '#059669',
    fontWeight: 600,
    textDecoration: 'underline',
    cursor: 'pointer',
    padding: '0 2px',
  },
  karigarList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  karigarTableHeader: {
    display: 'grid',
    gridTemplateColumns: '60px 100px 1fr 100px',
    padding: '10px 14px',
    backgroundColor: '#f9fafb',
    borderRadius: 6,
    fontSize: '11px',
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    borderBottom: '2px solid #e5e7eb',
  },
  headerSrNo: {
    textAlign: 'center',
  },
  headerId: {
    paddingLeft: 4,
  },
  headerName: {
    paddingLeft: 8,
  },
  headerAction: {
    textAlign: 'center',
  },
  karigarCard: {
    display: 'grid',
    gridTemplateColumns: '60px 100px 1fr 100px',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: '10px 14px',
    transition: 'all 0.2s',
    gap: 4,
  },
  karigarSrNo: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#6b7280',
    textAlign: 'center',
  },
  karigarIdValue: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#059669',
    fontFamily: 'monospace',
    backgroundColor: '#d1fae5',
    padding: '2px 6px',
    borderRadius: 4,
    textAlign: 'left',
  },
  karigarNameValue: {
    fontSize: '13px',
    color: '#0369a1',
    paddingLeft: 8,
    fontWeight: 500,
    backgroundColor: '#e0f2fe',
    padding: '2px 6px',
    borderRadius: 4,
    marginLeft: 4,
  },
  karigarActions: {
    display: 'flex',
    gap: 4,
    justifyContent: 'center',
  },
  selectKarigarButton: {
    padding: '4px 8px',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    border: 'none',
    borderRadius: 4,
    fontSize: '11px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
    width: 'fit-content',
  },
  selectKarigarButtonDisabled: {
    backgroundColor: '#9ca3af',
    cursor: 'not-allowed',
    opacity: 0.5,
  },
  batchAssignButton: {
    padding: '4px 6px',
    backgroundColor: '#8b5cf6',
    color: '#ffffff',
    border: 'none',
    borderRadius: 4,
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  sidebarLoading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    color: '#6b7280',
  },
  loadingSpinnerSmall: {
    width: 24,
    height: 24,
    border: '2px solid #e5e7eb',
    borderTopColor: '#111827',
    borderRadius: '50%',
    margin: '0 auto 12px',
    animation: 'spin 1s linear infinite',
  },
  noKarigars: {
    textAlign: 'center',
    padding: '40px 20px',
    color: '#6b7280',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  noKarigarsIcon: {
    fontSize: '36px',
    display: 'block',
    marginBottom: 12,
  },
  searchSection: {
    marginBottom: 20,
    position: 'relative',
  },
  searchBar: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    overflow: 'hidden',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  },
  searchIcon: {
    padding: '0 12px',
    fontSize: '18px',
    color: '#00338b',
  },
  searchInput: {
    flex: 1,
    padding: '12px 0',
    border: 'none',
    fontSize: '14px',
    outline: 'none',
  },
  searchButton: {
    padding: '12px 20px',
    backgroundColor: '#111827',
    color: '#ffffff',
    border: 'none',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  suggestions: {
    position: 'absolute',
    top: 'calc(100% - 4px)',
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    marginTop: 4,
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
    zIndex: 10,
  },
  suggestionsHeader: {
    padding: '10px 16px',
    fontSize: '12px',
    color: '#6b7280',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clearHistorySmall: {
    padding: '2px 8px',
    backgroundColor: 'transparent',
    border: '1px solid #e5e7eb',
    borderRadius: 4,
    fontSize: '11px',
    color: '#6b7280',
    cursor: 'pointer',
  },
  suggestionItem: {
    padding: '10px 16px',
    cursor: 'pointer',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    borderBottom: '1px solid #f3f4f6',
  },
  suggestionIcon: {
    fontSize: '14px',
    color: '#9ca3af',
  },
  twoColumnLayout: {
    display: 'grid',
    gridTemplateColumns: '320px 1fr',
    gap: 16,
    marginBottom: 16,
  },
  leftColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  rightColumn: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: '16px',
    border: '1px solid #e5e7eb',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  activeLotCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: '14px 16px',
    border: '1px solid #e5e7eb',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  activeLotIcon: {
    fontSize: '18px',
  },
  activeLotLabel: {
    fontSize: '13px',
    color: '#f10014',
  },
  activeLotNumber: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#111827',
    backgroundColor: '#f3f4f6',
    padding: '4px 10px',
    borderRadius: 6,
  },
  unassignedBadge: {
    marginLeft: 'auto',
    padding: '4px 10px',
    backgroundColor: '#fef3c7',
    border: '1px solid #fde68a',
    borderRadius: 20,
    fontSize: '11px',
    color: '#92400e',
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    overflow: 'hidden',
  },
  summaryCardHeader: {
    padding: '14px 16px',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f9fafb',
  },
  summaryCardIcon: {
    fontSize: '18px',
  },
  summaryCardTitle: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 600,
    color: '#111827',
  },
  summaryGrid: {
    padding: '12px',
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid #f3f4f6',
  },
  summaryLabel: {
    fontSize: '12px',
    color: '#000000',
  },
  summaryValue: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#111827',
    backgroundColor: '#f9fafb',
    padding: '2px 8px',
    borderRadius: 4,
  },
  summaryValueTotal: {
    fontWeight: 600,
    color: '#059669',
    backgroundColor: '#d1fae5',
    border: '1px solid #a7f3d0',
  },
  previewCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    border: '1px solid #e5e7eb',
    overflow: 'hidden',
  },
  previewCardHeader: {
    padding: '14px 16px',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f9fafb',
  },
  previewIcon: {
    fontSize: '18px',
  },
  previewTitle: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 600,
    color: '#111827',
    flex: 1,
  },
  previewCount: {
    backgroundColor: '#e5e7eb',
    padding: '2px 8px',
    borderRadius: 12,
    fontSize: '11px',
    fontWeight: 500,
  },
  previewList: {
    padding: '8px',
  },
  previewItem: {
    padding: '10px',
    borderBottom: '1px solid #f3f4f6',
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
    fontSize: '13px',
    fontWeight: 600,
    color: '#111827',
  },
  previewKarigar: {
    fontSize: '11px',
    color: '#059669',
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#d1fae5',
    padding: '2px 6px',
    borderRadius: 4,
    width: 'fit-content',
  },
  previewUnassigned: {
    fontSize: '11px',
    color: '#9ca3af',
    display: 'flex',
    alignItems: 'center',
    gap: 2,
  },
  previewQty: {
    fontSize: '11px',
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    padding: '2px 6px',
    borderRadius: 4,
  },
  previewMore: {
    padding: '10px',
    fontSize: '11px',
    color: '#6b7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  statusMessage: {
    marginBottom: 16,
    padding: '10px 14px',
    borderRadius: 8,
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  statusSuccess: {
    backgroundColor: '#f0fdf4',
    color: '#166534',
    border: '1px solid #dcfce7',
  },
  statusError: {
    backgroundColor: '#fef2f2',
    color: '#991b1b',
    border: '1px solid #fee2e2',
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
  shadesHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  shadesTitle: {
    margin: 0,
    fontSize: '15px',
    fontWeight: 600,
    color: '#111827',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  shadesTitleIcon: {
    fontSize: '18px',
  },
  shadesCount: {
    fontSize: '12px',
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    padding: '4px 10px',
    borderRadius: 16,
  },
  activeShadeHint: {
    backgroundColor: '#fef3c7',
    border: '1px solid #fde68a',
    borderRadius: 8,
    padding: '10px 14px',
    marginBottom: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: '13px',
    color: '#92400e',
  },
  activeShadeHintIcon: {
    fontSize: '16px',
  },
  activeShadeHintText: {
    flex: 1,
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
  },
  activeShadeHintPcs: {
    color: '#059669',
    fontWeight: 500,
  },
  cancelShadeButton: {
    padding: '4px 10px',
    backgroundColor: 'transparent',
    border: '1px solid #fde68a',
    borderRadius: 4,
    color: '#92400e',
    fontSize: '11px',
    cursor: 'pointer',
  },
  shadesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 12,
    marginBottom: 16,
    maxHeight: 'calc(100vh - 400px)',
    overflowY: 'auto',
    padding: '2px',
  },
  shadeItem: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: '12px',
    border: '1px solid #e5e7eb',
    transition: 'all 0.2s',
    position: 'relative',
  },
  shadeItemActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
    boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.2)',
  },
  shadeItemAssigned: {
    backgroundColor: '#f0fdf4',
    borderColor: '#a7f3d0',
  },
  shadeItemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  shadeItemName: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#111827',
  },
  shadeItemPcs: {
    fontSize: '11px',
    color: '#059669',
    backgroundColor: '#d1fae5',
    padding: '2px 6px',
    borderRadius: 4,
  },
  assignedKarigarInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffffff',
    padding: '6px 8px',
    borderRadius: 4,
    marginBottom: 8,
    border: '1px solid #d1fae5',
  },
  assignedKarigarIcon: {
    fontSize: '12px',
    color: '#059669',
  },
  assignedKarigarId: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#059669',
    fontFamily: 'monospace',
  },
  assignedKarigarName: {
    fontSize: '11px',
    color: '#6b7280',
  },
  shadeActionButtons: {
    display: 'flex',
    gap: 6,
    marginTop: 4,
  },
  selectShadeButton: {
    flex: 1,
    padding: '6px 8px',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    border: 'none',
    borderRadius: 4,
    fontSize: '11px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  selectShadeButtonDisabled: {
    backgroundColor: '#9ca3af',
    cursor: 'not-allowed',
    opacity: 0.5,
  },
  changeButton: {
    backgroundColor: '#8b5cf6',
  },
  removeButton: {
    width: '28px',
    height: '28px',
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    border: '1px solid #fecaca',
    borderRadius: 4,
    fontSize: '14px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
  },
  activeShadeIndicator: {
    position: 'absolute',
    bottom: -6,
    left: '50%',
    transform: 'translateX(-50%)',
    fontSize: '9px',
    color: '#3b82f6',
    backgroundColor: '#eff6ff',
    padding: '2px 8px',
    borderRadius: 12,
    border: '1px solid #93c5fd',
    whiteSpace: 'nowrap',
  },
  assignmentSummary: {
    marginBottom: 16,
    padding: '10px',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    fontSize: '12px',
  },
  summaryStats: {
    display: 'flex',
    justifyContent: 'space-between',
    color: '#6b7280',
  },
  summaryStatIcon: {
    marginRight: 4,
  },
  unassignedWarning: {
    marginTop: 8,
    padding: '8px',
    backgroundColor: '#fef3c7',
    borderRadius: 6,
    fontSize: '11px',
    color: '#92400e',
    textAlign: 'center',
  },
  actionButtons: {
    display: 'flex',
    gap: 10,
    borderTop: '1px solid #e5e7eb',
    paddingTop: 16,
  },
  saveButton: {
    flex: 2,
    padding: '12px',
    backgroundColor: '#111827',
    color: '#ffffff',
    border: 'none',
    borderRadius: 8,
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    transition: 'all 0.2s',
  },
  saveButtonDisabled: {
    backgroundColor: '#9ca3af',
    cursor: 'not-allowed',
  },
  clearButton: {
    flex: 1,
    padding: '12px',
    backgroundColor: '#ffffff',
    color: '#4b5563',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    fontSize: '13px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    transition: 'all 0.2s',
  },
  loadingContainer: {
    padding: '40px 20px',
    textAlign: 'center',
    color: '#6b7280',
  },
  loadingSpinner: {
    width: 32,
    height: 32,
    border: '2px solid #e5e7eb',
    borderTopColor: '#111827',
    borderRadius: '50%',
    margin: '0 auto 12px',
    animation: 'spin 1s linear infinite',
  },
  noShades: {
    padding: '40px 20px',
    textAlign: 'center',
    color: '#6b7280',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  noShadesIcon: {
    fontSize: '36px',
    display: 'block',
    marginBottom: 12,
  },
  tipBox: {
    backgroundColor: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: '10px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  tipIcon: {
    fontSize: '16px',
  },
  tipText: {
    fontSize: '12px',
    color: '#6b7280',
  },
};

// Add global styles
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  @keyframes slideIn {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }
  
  input:focus {
    border-color: #111827 !important;
    box-shadow: 0 0 0 2px rgba(17, 24, 39, 0.1) !important;
  }
  
  button:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
  }
  
  .shade-item:hover {
    border-color: #d1d5db;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  }
  
  .suggestion-item:hover {
    background-color: #f9fafb;
  }
  
  .supervisor-item:hover {
    background-color: #f9fafb;
  }
  
  .karigar-card:hover {
    border-color: #3b82f6;
    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
  }
  
  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  
  ::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 3px;
  }
  
  ::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 3px;
  }
  
  ::-webkit-scrollbar-thumb:hover {
    background: #a1a1a1;
  }
`;
document.head.appendChild(style);