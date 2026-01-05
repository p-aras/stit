// src/MaterialStitchingOrder.jsx
import React, { useEffect, useState } from "react";
import { jsPDF } from "jspdf";

/** ========= CONFIG ========= */
const API_KEY = "AIzaSyAomDFBkOySlIxKWSKGHe6ATv9gvaBr7uk";
const SHEET_ID = "1Hj3JeJEKB43aYYWv8gk2UhdU6BWuEQfCg5pBlTdBMNA";
const INDEX_SHEET_RANGE = "Index!A:Z";
const CUTTING_SHEET_ID = "1Hj3JeJEKB43aYYWv8gk2UhdU6BWuEQfCg5pBlTdBMNA";
const MATERIAL_ORDERS_SHEET_ID = "18hFQb3kX_t-41J_BX7INFRQ1FdkgW8YKIu_3SAEn9mA";
const MATERIAL_ORDERS_RANGE = "MaterialOrders!A:Z";
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwpc543RUdQ75UAw9MCS_1RHvhIR3G7I3bME65cwJerTSe8PisY-pMdbtqDDe42JHxQjw/exec";

const STORAGE_KEY = "material_stitching_supervisors";

// Fetch existing MSO data to check for duplicate lots with quantities
async function fetchExistingMSOData(sheetId, apiKey) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(
    MATERIAL_ORDERS_RANGE
  )}?key=${apiKey}`;
  
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Sheets API error: ${resp.status}`);
  const data = await resp.json();
  const values = data.values || [];
  
  const existingOrders = new Map();
  
  // Skip header row (row 0)
  for (let i = 1; i < values.length; i++) {
    const row = values[i] || [];
    const msoNo = row[0] || ""; // MSO No column (A)
    const date = row[1] || ""; // Date column (B)
    const lotNo = row[2] || ""; // Lot No column (C)
    const brand = row[3] || ""; // Brand column (D)
    const garmentType = row[4] || ""; // Garment Type column (E)
    const quantity = parseInt(row[5]) || 0; // Quantity column (F)
    const unit = row[6] || ""; // Unit column (G)
    const priority = row[7] || ""; // Priority column (H)
    const remarks = row[8] || ""; // Remarks column (I)
    const createdBy = row[9] || ""; // Created By column (J)
    
    if (lotNo && lotNo.trim()) {
      const normalizedLot = lotNo.trim().toLowerCase();
      
      // If lot already exists in map, add to existing quantity
      if (existingOrders.has(normalizedLot)) {
        const existingOrder = existingOrders.get(normalizedLot);
        existingOrder.totalIssuedQuantity += quantity;
        existingOrder.msoNumbers.push(msoNo); // Track all MSO numbers for this lot
      } else {
        // First entry for this lot
        existingOrders.set(normalizedLot, {
          msoNumbers: [msoNo], // Array of all MSO numbers for this lot
          totalIssuedQuantity: quantity, // Sum of all quantities issued
          lastMSO: msoNo, // Keep track of the last MSO for reference
          date,
          lotNo,
          brand,
          garmentType,
          unit,
          priority,
          remarks,
          createdBy
        });
      }
    }
  }
  
  return existingOrders;
}

// Fetch index data to quickly locate lot matrices and supervisors
async function fetchLotIndex(sheetId, apiKey) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(
    INDEX_SHEET_RANGE
  )}?key=${apiKey}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Sheets API error: ${resp.status}`);
  const data = await resp.json();
  const values = data.values || [];
  
  const indexMap = new Map();
  const supervisors = new Set();
  
  for (let i = 1; i < values.length; i++) {
    const row = values[i] || [];
    const lotNumber = row[0] || ""; // Lot Number column (A)
    const startRow = row[1] || ""; // StartRow column (B)
    const numRows = row[2] || ""; // NumRows column (C)
    const headerCols = row[3] || ""; // HeaderCols column (D)
    const fabric = row[4] || ""; // Fabric column (E)
    const garmentType = row[5] || ""; // Garment Type column (F)
    const style = row[6] || ""; // Style column (G)
    const sizes = row[7] || ""; // Sizes column (H)
    const shades = row[8] || ""; // Shades column (I)
    const savedAt = row[9] || ""; // Saved At column (J)
    const dateOfIssue = row[10] || ""; // Date of Issue column (K)
    const supervisor = row[11] || ""; // Supervisor column (L) - index 11
    const imageUrl = row[12] || ""; // Image Url column (M) - index 12
    const partyName = row[13] || ""; // PARTY NAME column (N) - index 13
    const brand = row[14] || ""; // BRAND column (O) - index 14 (column 15)
    
    if (lotNumber && startRow) {
      indexMap.set(lotNumber.trim().toLowerCase(), {
        startRow: parseInt(startRow),
        numRows: parseInt(numRows) || 0,
        headerCols: parseInt(headerCols) || 0,
        fabric: fabric,
        garmentType: garmentType,
        style: style,
        supervisor: supervisor ? supervisor.trim().toUpperCase() : "",
        brand: brand ? brand.trim() : "" // Add brand from column O (index 14)
      });
    }
    
    // Collect supervisors from the supervisor column
    if (supervisor && supervisor.trim()) {
      supervisors.add(supervisor.trim().toUpperCase());
    }
  }
  
  return {
    indexMap,
    supervisors: Array.from(supervisors).sort()
  };
}

// Fetch specific lot data using index - ONLY FOR QUANTITY
async function fetchLotData(sheetId, lotNumber, apiKey) {
  try {
    const { indexMap } = await fetchLotIndex(sheetId, apiKey);
    const normalizedLot = lotNumber.trim().toLowerCase();
    const lotInfo = indexMap.get(normalizedLot);
    
    if (!lotInfo) {
      throw new Error(`Lot number ${lotNumber} not found in index`);
    }

    const endRow = lotInfo.startRow + lotInfo.numRows - 1;
    const range = `Cutting!A${lotInfo.startRow}:Z${endRow}`;
    
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(
      range
    )}?key=${apiKey}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Sheets API error: ${resp.status}`);
    const data = await resp.json();
    const values = data.values || [];
    
    return {
      lotNumber,
      matrix: values,
      headerCols: lotInfo.headerCols
    };
  } catch (error) {
    console.error('Error fetching lot data:', error);
    throw error;
  }
}

// Simplified function to get only total quantity from lot
function getLotTotalQuantity(lotData) {
  if (!lotData || !lotData.matrix || lotData.matrix.length === 0) {
    return 0;
  }

  const matrix = lotData.matrix;
  const headerCols = lotData.headerCols || 7;

  // Find the total row (usually the last row or contains "Total")
  const totalRow = matrix.find(row => 
    row[0] && (String(row[0]).toLowerCase().includes('total') || String(row[0]) === 'Total')
  );

  if (totalRow && totalRow.length >= headerCols) {
    return parseFloat(totalRow[headerCols - 1]) || 0;
  }

  // If no total row found, return 0
  return 0;
}

// Supervisor management functions
const getStoredSupervisors = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error reading supervisors from storage:', error);
  }
  return [];
};

const saveSupervisors = (supervisors) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(supervisors));
  } catch (error) {
    console.error('Error saving supervisors to storage:', error);
  }
};

// Optimized CSS Styles - Moved outside component to prevent re-renders
const styles = {
  container: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #ffffffff 0%, #ffffffff 100%)",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    padding: "20px",
  },
  card: {
    background: "rgba(255, 255, 255, 0.95)",
    backdropFilter: "blur(20px)",
    borderRadius: "20px",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    boxShadow: "0 20px 40px rgba(0, 0, 0, 0.1)",
    overflow: "hidden",
    maxWidth: "1800px",
    margin: "0 auto",
  },
  header: {
    background: "linear-gradient(135deg, #667eea 0%, #0003beff 100%)",
    padding: "40px 30px 30px",
    color: "white",
    textAlign: "center",
    position: "relative",
  },
  title: {
    fontSize: "2.5rem",
    fontWeight: "700",
    margin: "0 0 10px 0",
    background: "linear-gradient(45deg, #fff, #e2e8f0)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  subtitle: {
    fontSize: "1.1rem",
    opacity: "0.9",
    fontWeight: "300",
  },
  tabs: {
    display: "flex",
    background: "rgba(255, 255, 255, 0.15)",
    borderRadius: "12px",
    padding: "4px",
    margin: "25px auto 0",
    maxWidth: "500px",
  },
  tab: {
    flex: 1,
    padding: "12px 20px",
    textAlign: "center",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "14px",
    transition: "all 0.2s ease",
    color: "rgba(255, 255, 255, 0.8)",
  },
  activeTab: {
    background: "rgba(255, 255, 255, 0.25)",
    color: "white",
    boxShadow: "0 2px 10px rgba(255, 255, 255, 0.2)",
  },
  content: {
    padding: "30px",
    background: "#ffffffff",
    minHeight: "500px",
  },
  section: {
    background: "white",
    borderRadius: "12px",
    padding: "25px",
    marginBottom: "20px",
    boxShadow: "0 2px 10px rgba(0, 0, 0, 0.05)",
    border: "1px solid #e2e8f0",
  },
  sectionTitle: {
    fontSize: "1.5rem",
    fontWeight: "700",
    color: "#001f52ff",
    marginBottom: "20px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: "20px",
    marginBottom: "20px",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  label: {
    fontSize: "14px",
    fontWeight: "600",
    color: "#00368dff",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  input: {
    padding: "12px 16px",
    border: "2px solid #e2e8f0",
    borderRadius: "8px",
    fontSize: "14px",
    transition: "all 0.2s ease",
    outline: "none",
    background: "white",
  },
  select: {
    padding: "12px 16px",
    border: "2px solid #e2e8f0",
    borderRadius: "8px",
    fontSize: "14px",
    transition: "all 0.2s ease",
    outline: "none",
    background: "white",
    cursor: "pointer",
  },
  error: {
    color: "#dc2626",
    fontSize: "12px",
    fontWeight: "500",
    marginTop: "4px",
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  lookupGroup: {
    display: "flex",
    gap: "10px",
    alignItems: "flex-start",
  },
  lookupInput: {
    flex: 1,
  },
  button: {
    padding: "12px 24px",
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s ease",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  primaryButton: {
    background: "linear-gradient(135deg, #002766ff, #1d4ed8)",
    color: "white",
  },
  secondaryButton: {
    background: "white",
    color: "#64748b",
    border: "2px solid #d1d5db",
  },
  successButton: {
    background: "linear-gradient(135deg, #10b981, #059669)",
    color: "white",
  },
  accessoriesGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "15px",
  },
  accessoryItem: {
    padding: "20px",
    border: "2px solid #e2e8f0",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    background: "white",
  },
  accessorySelected: {
    borderColor: "#10b981",
    background: "rgba(16, 185, 129, 0.05)",
  },
  backButton: {
    position: "absolute",
    top: "20px",
    left: "20px",
    padding: "10px 16px",
    background: "rgba(255, 255, 255, 0.2)",
    border: "1px solid rgba(255, 255, 255, 0.3)",
    borderRadius: "8px",
    color: "white",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s ease",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  loadingOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  loadingSpinner: {
    width: "40px",
    height: "40px",
    border: "3px solid rgba(255, 255, 255, 0.3)",
    borderTop: "3px solid #3b82f6",
    borderRadius: "50%",
  },
  dialogOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "20px",
  },
  dialog: {
    background: "white",
    borderRadius: "12px",
    padding: "30px",
    maxWidth: "400px",
    width: "100%",
    boxShadow: "0 20px 40px rgba(0, 0, 0, 0.2)",
  },
  dialogTitle: {
    fontSize: "1.25rem",
    fontWeight: "700",
    marginBottom: "15px",
    color: "#1e293b",
  },
  dialogMessage: {
    marginBottom: "20px",
    color: "#64748b",
    lineHeight: "1.5",
  },
  dialogActions: {
    display: "flex",
    gap: "10px",
    justifyContent: "flex-end",
  },
};

export default function MaterialStitchingOrder({ fallbackPath = "/" }) {
  /** ------- STATE ------- */
  const [formData, setFormData] = useState({
    orderNo: "",
    lotNo: "",
    brand: "",
    garmentType: "",
    qty: "",
    priority: "Normal",
    remarks: "",
    supervisor: ""
  });

  const [accessories, setAccessories] = useState({
    label: false,
    washCare: false,
    silicon: false,
    size: false,
    zip: false,
    tapeLace: false,
    elastic: false,
  });

  const [supervisors, setSupervisors] = useState([]);
  const [existingOrders, setExistingOrders] = useState(new Map());
  const [currentLotQuantity, setCurrentLotQuantity] = useState(0);

  const [uiState, setUiState] = useState({
    loading: false,
    loadingLookup: false,
    loadingLotQty: false,
    loadingSupervisors: false,
    loadingExistingData: false,
    activeTab: "basic",
    showSubmitDialog: false,
    showSuccessDialog: false,
    showErrorDialog: false,
    showDuplicateWarning: false,
    dialogMessage: "",
  });

  const [errors, setErrors] = useState({
    lotNo: "",
    brand: "",
    garmentType: "",
    qty: "",
    supervisor: ""
  });

  /** ------- EFFECTS ------- */
  useEffect(() => {
    generateOrderNo();
    loadSupervisors();
    loadExistingMSOData();
  }, []);

  /** ------- BACK BUTTON HANDLER ------- */
  const handleBack = () => {
    window.history.back();
  };

  /** ------- EXISTING MSO DATA MANAGEMENT ------- */
  const loadExistingMSOData = async () => {
    updateUiState("loadingExistingData", true);
    try {
      const data = await fetchExistingMSOData(MATERIAL_ORDERS_SHEET_ID, API_KEY);
      setExistingOrders(data);
    } catch (error) {
      console.error('Error loading existing MSO data:', error);
    } finally {
      updateUiState("loadingExistingData", false);
    }
  };

  /** ------- Pending Quantity Validation ------- */
const checkForExistingOrder = (lotNumber, currentTotalQuantity) => {
  const normalizedLot = lotNumber.trim().toLowerCase();
  const existingOrder = existingOrders.get(normalizedLot);
  
  if (!existingOrder) return null;
  
  const totalIssuedQty = existingOrder.totalIssuedQuantity;
  const totalQty = parseInt(currentTotalQuantity) || 0;
  
  // Calculate pending quantity (total - all issued quantities)
  const pendingQty = Math.max(0, totalQty - totalIssuedQty);
  
  return {
    exists: true,
    order: existingOrder,
    totalIssuedQty, // Sum of all issued quantities
    totalQty, // This is the total from cutting sheet
    pendingQty, // This is what's available for new MSO
    canCreateNew: pendingQty > 0,
    msoCount: existingOrder.msoNumbers.length // Number of MSOs for this lot
  };
};



  /** ------- SUPERVISOR MANAGEMENT ------- */
  const loadSupervisors = async () => {
    updateUiState("loadingSupervisors", true);
    try {
      const { supervisors: sheetSupervisors } = await fetchLotIndex(SHEET_ID, API_KEY);
      const storedSupervisors = getStoredSupervisors();
      const allSupervisors = [...new Set([...sheetSupervisors, ...storedSupervisors])].sort();
      setSupervisors(allSupervisors);
    } catch (error) {
      console.error('Error loading supervisors:', error);
      const storedSupervisors = getStoredSupervisors();
      setSupervisors(storedSupervisors);
    } finally {
      updateUiState("loadingSupervisors", false);
    }
  };

  /** ------- UTILITIES ------- */
  const generateOrderNo = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const rand = Math.floor(Math.random() * 900) + 100;
    setFormData(prev => ({ ...prev, orderNo: `MSO-${y}${m}${dd}-${rand}` }));
  };

  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const updateUiState = (field, value) => {
    setUiState(prev => ({ ...prev, [field]: value }));
  };

  /** ------- DATA FETCHING ------- */
  const fetchLotDataFromIndex = async (lotNumber) => {
    try {
      const { indexMap, supervisors: sheetSupervisors } = await fetchLotIndex(SHEET_ID, API_KEY);
      const normalizedLot = lotNumber.trim().toLowerCase();
      const lotInfo = indexMap.get(normalizedLot);
      
      if (!lotInfo) {
        throw new Error(`Lot ${lotNumber} not found`);
      }

      if (sheetSupervisors.length > 0) {
        const currentSupervisors = new Set(supervisors);
        sheetSupervisors.forEach(sup => currentSupervisors.add(sup));
        const updatedSupervisors = Array.from(currentSupervisors).sort();
        setSupervisors(updatedSupervisors);
        saveSupervisors(updatedSupervisors);
      }
      
      return {
        brand: lotInfo.brand || "Auto-filled",
        garmentType: lotInfo.garmentType || "Auto-filled",
        supervisor: lotInfo.supervisor || ""
      };
    } catch (error) {
      console.error('Error in fetchLotDataFromIndex:', error);
      throw new Error(error.message || "Lookup failed");
    }
  };

  const fetchLotQuantity = async (lotNumber) => {
    try {
      const lotData = await fetchLotData(CUTTING_SHEET_ID, lotNumber, API_KEY);
      const totalQuantity = getLotTotalQuantity(lotData);
      setCurrentLotQuantity(totalQuantity);
      return totalQuantity;
    } catch (error) {
      console.error('Error fetching lot quantity:', error);
      throw new Error(`Failed to fetch quantity for lot ${lotNumber}: ${error.message}`);
    }
  };

  /** ------- Handle Lot Lookup ------- */
const handleLotLookup = async () => {
  if (!formData.lotNo.trim()) {
    setErrors(prev => ({ ...prev, lotNo: "Please enter Lot Number" }));
    return;
  }

  updateUiState("loadingLookup", true);
  setErrors(prev => ({ 
    ...prev, 
    lotNo: "", 
    brand: "", 
    garmentType: "", 
    supervisor: "", 
    qty: "" 
  }));

  // Clear previous data
  updateFormData("brand", "");
  updateFormData("garmentType", "");
  updateFormData("qty", "");
  updateFormData("supervisor", "");

  try {
    // Get all data from index sheet (brand, garment type, supervisor)
    const basicInfo = await fetchLotDataFromIndex(formData.lotNo.trim());
    
    // Get only quantity from cutting sheet
    updateUiState("loadingLotQty", true);
    const totalLotQuantity = await fetchLotQuantity(formData.lotNo.trim());
    
    // Check for existing orders and calculate available quantity
    const existingCheck = checkForExistingOrder(formData.lotNo.trim(), totalLotQuantity.toString());
    
    let availableQuantity = totalLotQuantity;
    let quantityMessage = "";
    let canProceed = true;
    
    if (existingCheck && existingCheck.exists) {
      // Calculate pending quantity (total - all issued quantities)
      availableQuantity = existingCheck.pendingQty;
      
      if (existingCheck.pendingQty <= 0) {
        // No pending quantity available - BLOCK creation
        canProceed = false;
        setErrors(prev => ({ 
          ...prev, 
          lotNo: `❌ ${existingCheck.msoCount} MSO(s) already exist. No pending quantity available. Total: ${totalLotQuantity} PCS, Already issued: ${existingCheck.totalIssuedQty} PCS`,
          qty: "🚫 Cannot create MSO - no pending quantity available"
        }));
      } else {
        // Pending quantity available
        quantityMessage = `✅ Pending quantity available: ${existingCheck.pendingQty} PCS (Total: ${totalLotQuantity} PCS, Issued: ${existingCheck.totalIssuedQty} PCS across ${existingCheck.msoCount} MSO(s))`;
        availableQuantity = existingCheck.pendingQty; // Set to pending quantity
      }
    }

    // Only update form if we can proceed
    if (canProceed) {
      setFormData(prev => ({
        ...prev,
        brand: basicInfo.brand,
        garmentType: basicInfo.garmentType,
        qty: availableQuantity.toString(), // This will be pending quantity if exists
        supervisor: basicInfo.supervisor
      }));

      // Set quantity info message
      if (quantityMessage) {
        setErrors(prev => ({ ...prev, lotNo: quantityMessage }));
      }
    }

    // Set errors if any required fields are missing (only if proceeding)
    if (canProceed) {
      const newErrors = {};
      if (!basicInfo.supervisor) {
        newErrors.supervisor = "Supervisor not found for this lot";
      }
      if (availableQuantity === 0) {
        newErrors.qty = "No available quantity for this lot";
      }
      if (Object.keys(newErrors).length > 0) {
        setErrors(prev => ({ ...prev, ...newErrors }));
      }
    }

  } catch (error) {
    setErrors(prev => ({ ...prev, lotNo: error.message }));
  } finally {
    updateUiState("loadingLookup", false);
    updateUiState("loadingLotQty", false);
  }
};

  /** ------- Validation ------- */
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.lotNo.trim()) newErrors.lotNo = "Lot Number is required";
    if (!formData.brand.trim()) newErrors.brand = "Brand is required";
    if (!formData.garmentType.trim()) newErrors.garmentType = "Garment Type is required";
    if (!formData.qty || Number(formData.qty) <= 0) newErrors.qty = "Valid quantity is required";
    if (!formData.supervisor.trim()) newErrors.supervisor = "Supervisor is required";

    const existingCheck = checkForExistingOrder(formData.lotNo, currentLotQuantity);
    if (existingCheck) {
      const requestedQty = Number(formData.qty);
      
      if (existingCheck.pendingQty <= 0) {
        newErrors.lotNo = `❌ No pending quantity available`;
        newErrors.qty = "🚫 Cannot create MSO";
      } else if (requestedQty > existingCheck.pendingQty) {
        newErrors.qty = `❌ Quantity exceeds pending quantity`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /** ------- Submit Handler ------- */
  const handleSubmit = async () => {
    const existingCheck = checkForExistingOrder(formData.lotNo, currentLotQuantity);
    
    if (existingCheck && existingCheck.pendingQty <= 0) {
      updateUiState("showErrorDialog", true);
      updateUiState("dialogMessage", `❌ Cannot create MSO for Lot ${formData.lotNo}\n\nNo pending quantity available.`);
      return;
    }

    if (existingCheck && Number(formData.qty) > existingCheck.pendingQty) {
      updateUiState("showErrorDialog", true);
      updateUiState("dialogMessage", `❌ Quantity exceeds available pending quantity`);
      return;
    }

    if (!validateForm()) return;

    if (existingCheck && !existingCheck.quantitiesMatch) {
      updateUiState("showDuplicateWarning", true);
      updateUiState("dialogMessage", 
        `⚠️ An MSO already exists for this lot with different quantity.\n\nAre you sure you want to create a new MSO?`
      );
    } else {
      updateUiState("showSubmitDialog", true);
    }
  };

  const confirmSubmit = async () => {
    updateUiState("loading", true);
    updateUiState("showSubmitDialog", false);
    updateUiState("showDuplicateWarning", false);

    const accessoryMap = {
      label: "LABEL",
      washCare: "WASH CARE",
      silicon: "SILICON",
      size: "SIZE",
      zip: "ZIP",
      tapeLace: "TAPE/LACE",
      elastic: "ELASTIC",
    };

    const selectedAccessories = Object.entries(accessories)
      .filter(([, value]) => value)
      .map(([key]) => accessoryMap[key]);

    const payload = {
      orderNo: formData.orderNo,
      lotNo: formData.lotNo.trim(),
      brand: formData.brand.trim(),
      garmentType: formData.garmentType.trim(),
      quantity: String(formData.qty),
      unit: "PCS",
      priority: formData.priority,
      accessories: selectedAccessories,
      remarks: formData.remarks,
      supervisor: formData.supervisor,
      createdAt: new Date().toISOString(),
    };

    try {
      const response = await fetch(WEB_APP_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ 
          action: "submitMSO", 
          data: payload
        }),
      });

      const result = await response.json();
      
      if (result.status !== "ok") {
        throw new Error(result.message || "Submission failed");
      }

      generatePDF(payload);
      updateUiState({ 
        showSuccessDialog: true, 
        dialogMessage: "Order submitted successfully! PDF has been downloaded." 
      });
      resetForm();
      
      await loadExistingMSOData();
      
    } catch (error) {
      updateUiState({ 
        showErrorDialog: true, 
        dialogMessage: `Submission failed: ${error.message}` 
      });
    } finally {
      updateUiState("loading", false);
    }
  };

  const proceedWithDifferentQuantity = () => {
    updateUiState("showDuplicateWarning", false);
    updateUiState("showSubmitDialog", true);
  };

 const generatePDF = (data) => {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // helpers
  const M = 36;
  const BORDER_INSET = 14;
  const line = (x1, y1, x2, y2, w = 1) => {
    doc.setLineWidth(w);
    doc.line(x1, y1, x2, y2);
  };
  const rect = (x, y, w, h, wid = 1) => {
    doc.setLineWidth(wid);
    doc.rect(x, y, w, h);
  };
  const drawCheck = (x, y) => {
    doc.setLineWidth(2);
    line(x - 8, y + 2, x - 3, y + 8);
    line(x - 3, y + 8, x + 10, y - 6);
    doc.setLineWidth(1);
  };
  const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

  // page border
  rect(BORDER_INSET, BORDER_INSET, W - 2 * BORDER_INSET, H - 2 * BORDER_INSET, 1.2);

  // header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("PO No.STM", M, M + 2);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("STITCHING MATERIAL ISSUE ORDER", W / 2, M + 16, { align: "center" });

  // left meta
  const leftX = M;
  let y = M + 56;
  const rowGap = 26,
    labelW = 74,
    valueW = 140;

  const drawField = (label, value = "") => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(label, leftX, y);
    const lx1 = leftX + labelW,
      lx2 = leftX + labelW + valueW,
      underlineY = y + 3;
    line(lx1, underlineY, lx2, underlineY, 0.9);
    if (value) {
      doc.setFont("helvetica", "normal");
      doc.text(String(value), lx1 + 4, y);
    }
    y += rowGap;
  };

  const dateVal = data.createdAt ? new Date(data.createdAt) : new Date();
  const dateStr = new Intl.DateTimeFormat("en-GB").format(dateVal); // dd/mm/yyyy
  const qtyStr = [data.quantity || "", data.unit || ""].join(" ").trim();

  drawField("Date:", dateStr);
  drawField("Lot No.:", data.lotNo || "");
  drawField("Item.:", (data.garmentType || "").toString().toUpperCase());
  drawField("Qty.:", qtyStr);
  drawField("Brand", data.brand || "");
  drawField("HEAD", data.supervisor || "");

  // right accessory tiles
  const picked = (data.accessories || []).map(norm);
  const pickSet = new Set(picked);

  // === Layout metrics ===
  const Tx = W - M - 260; // starting X
  const Ty = M + 50;      // starting Y
  const Tw = 125;         // box width
  const Th = 72;          // box height
  const Gx = 25;          // horizontal gap
  const Gy = 25;          // vertical gap

  // === Clean tile drawing (white background, no tick) ===
  const tile = (label, i, j) => {
    const x = Tx + i * (Tw + Gx);
    const yy = Ty + j * (Th + Gy);

    // Draw white background
    doc.setFillColor(255, 255, 255); // white fill
    doc.rect(x, yy, Tw, Th, "FD");   // filled + border rectangle

    // Text styling
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.text(label, x + Tw / 2, yy + Th / 2 + 5, { align: "center" });
  };

  // === Layout ===
  // Row 1: Two boxes side by side
  tile("LABEL", 0, 0);
  tile("SILICON", 1, 0);

  // Row 2: Single box centered below both
  const centerOffsetX = (Tw + Gx) / 2;
  const centerX = Tx + centerOffsetX;
  const centerY = Ty + (Th + Gy); // one row down

  doc.setFillColor(255, 255, 255);
  rect(centerX, centerY, Tw, Th, 1.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("WASH CARE", centerX + Tw / 2, centerY + Th / 2 + 5, { align: "center" });

  // table
  const tableTop = y + 12;
  const c1 = 60; // Sr. No.
  const c2 = 120; // Item Name
  const cSel = 70; // Selected (tick)
  const c3 = 100; // Date of Given
  const c4 = 90; // Qty Recd.
  const c5 = 90; // Receiver Sign
  const cols = [c1, c2, cSel, c3, c4, c5];
  const tableW = cols.reduce((a, b) => a + b, 0);
  const X = M;

  const headerH = 28;
  rect(X, tableTop, tableW, headerH, 1.2);
  const headTexts = [
    "Sr. No.",
    "ITEM NAME",
    "SELECTED",
    "DATE OF GIVEN",
    "QTY RECD.",
    "RECIEVER SIGN",
  ];
  let cx = X;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  headTexts.forEach((t, i) => {
    if (i > 0) line(cx, tableTop, cx, tableTop + headerH, 1.2);
    doc.text(t, cx + 8, tableTop + 18);
    cx += cols[i];
  });

  const base = ["LABEL", "WASH CARE", "SILICON", "SIZE", "ZIP", "TAPE/LACE"];
  const rows = pickSet.has(norm("ELASTIC")) ? [...base, "ELASTIC"] : base;
  let by = tableTop + headerH,
    rowH = 70;
  rows.forEach((name, i) => {
    rect(X, by, tableW, rowH, 1.0);
    let vx = X;
    cols.forEach((w, k) => {
      if (k > 0) line(vx, by, vx, by + rowH, 1.0);
      vx += w;
    });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(String(i + 1), X + 8, by + 24);
    doc.text(name, X + c1 + 8, by + 24);
    if (pickSet.has(norm(name))) {
      const selCenterX = X + c1 + c2 + cSel / 2;
      const selCenterY = by + rowH / 2;
      drawCheck(selCenterX, selCenterY);
    }
    by += rowH;
  });

  // footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const footer = [
    data.orderNo ? `MSO: ${data.orderNo}` : null,
    data.priority ? `Priority: ${data.priority}` : null,
    data.supervisor ? `Prepared by: ${data.supervisor}` : null,
  ]
    .filter(Boolean)
    .join(" • ");
  if (footer) doc.text(footer, X, by + 22);

  // save
  const fname = `MSO_${(data.orderNo || "draft").toString().replace(/[^\w-]/g, "")}.pdf`;
  doc.save(fname);
};

  const resetForm = () => {
    setFormData({
      orderNo: "",
      lotNo: "",
      brand: "",
      garmentType: "",
      qty: "",
      priority: "Normal",
      remarks: "",
      supervisor: ""
    });
    setAccessories({
      label: false,
      washCare: false,
      silicon: false,
      size: false,
      zip: false,
      tapeLace: false,
      elastic: false,
    });
    setErrors({});
    setCurrentLotQuantity(0);
    generateOrderNo();
    updateUiState("activeTab", "basic");
  };

  /** ------- RENDER COMPONENTS ------- */
  
  const renderLoadingOverlay = () => (
    <div style={styles.loadingOverlay}>
      <div style={styles.loadingSpinner}></div>
    </div>
  );

  const renderDialog = (title, message, actions, type = "submit") => (
    <div style={styles.dialogOverlay}>
      <div style={styles.dialog}>
        <h3 style={styles.dialogTitle}>{title}</h3>
        <p style={styles.dialogMessage}>{message}</p>
        <div style={styles.dialogActions}>
          {actions}
        </div>
      </div>
    </div>
  );

  const renderDuplicateWarningDialog = () => renderDialog(
    "⚠️ Existing MSO Found",
    uiState.dialogMessage,
    <>
      <button style={{ ...styles.button, ...styles.secondaryButton }} onClick={() => updateUiState("showDuplicateWarning", false)}>
        Cancel
      </button>
      <button style={{ ...styles.button, ...styles.primaryButton }} onClick={proceedWithDifferentQuantity}>
        Create New MSO
      </button>
    </>
  );

  const renderSubmitDialog = () => renderDialog(
    "🚀 Confirm Submission",
    "Are you sure you want to submit this Material Stitching Order? This will save the data and generate a PDF download.",
    <>
      <button style={{ ...styles.button, ...styles.secondaryButton }} onClick={() => updateUiState("showSubmitDialog", false)}>
        Cancel
      </button>
      <button style={{ ...styles.button, ...styles.successButton }} onClick={confirmSubmit}>
        Confirm & Generate PDF
      </button>
    </>
  );

  const renderSuccessDialog = () => renderDialog(
    "🎉 Success!",
    uiState.dialogMessage,
    <button style={{ ...styles.button, ...styles.primaryButton }} onClick={() => updateUiState("showSuccessDialog", false)}>
      Continue
    </button>
  );

  const renderErrorDialog = () => renderDialog(
    "❌ Error",
    uiState.dialogMessage,
    <button style={{ ...styles.button, ...styles.primaryButton }} onClick={() => updateUiState("showErrorDialog", false)}>
      OK
    </button>
  );

  // Basic Information Tab
  const renderBasicInfo = () => {
    const existingCheck = checkForExistingOrder(formData.lotNo, currentLotQuantity);
    const isBlocked = existingCheck && existingCheck.pendingQty <= 0;
    
    return (
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>
          📋 Basic Information
        </h3>
        
        {isBlocked && (
          <div style={{ background: "#fef3f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "15px", marginBottom: "20px" }}>
            <div style={{ color: "#dc2626", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px" }}>
              🚫 MSO Creation Blocked - No pending quantity available
            </div>
          </div>
        )}
        
        <div style={styles.formGrid}>
          <div style={styles.field}>
            <label style={styles.label}>🔢 MSO Reference Number</label>
            <input style={styles.input} value={formData.orderNo} readOnly />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>🏷️ Lot Number *</label>
            <div style={styles.lookupGroup}>
              <div style={styles.lookupInput}>
                <input
                  style={{
                    ...styles.input,
                    borderColor: isBlocked ? "#dc2626" : existingCheck ? "#f59e0b" : "#e2e8f0",
                  }}
                  value={formData.lotNo}
                  onChange={(e) => updateFormData("lotNo", e.target.value)}
                  placeholder="Enter lot number"
                  onKeyDown={(e) => e.key === "Enter" && handleLotLookup()}
                />
                {errors.lotNo && <span style={styles.error}>{errors.lotNo}</span>}
              </div>
              <button
                style={{ ...styles.button, ...styles.primaryButton }}
                onClick={handleLotLookup}
                disabled={uiState.loadingLookup}
              >
                {uiState.loadingLookup ? "..." : " Lookup"}
              </button>
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>🏢 Brand *</label>
            <input style={styles.input} value={formData.brand} readOnly placeholder="Auto-filled from lookup" />
            {errors.brand && <span style={styles.error}>{errors.brand}</span>}
          </div>

          <div style={styles.field}>
            <label style={styles.label}>👕 Garment Type *</label>
            <input style={styles.input} value={formData.garmentType} readOnly placeholder="Auto-filled from lookup" />
            {errors.garmentType && <span style={styles.error}>{errors.garmentType}</span>}
          </div>

          <div style={styles.field}>
            <label style={styles.label}>📦 Quantity (PCS) *</label>
            <input
              type="number"
              style={styles.input}
              value={formData.qty}
              readOnly={isBlocked}
              onChange={(e) => !isBlocked && updateFormData("qty", e.target.value)}
              placeholder={isBlocked ? "No quantity available" : "Auto-filled from lot data"}
            />
            {errors.qty && <span style={styles.error}>{errors.qty}</span>}
          </div>

          <div style={styles.field}>
            <label style={styles.label}>🎯 Priority Level</label>
            <select style={styles.select} value={formData.priority} onChange={(e) => updateFormData("priority", e.target.value)}>
              <option value="High">🚨 High Priority</option>
              <option value="Normal">✅ Normal Priority</option>
              <option value="Low">💤 Low Priority</option>
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>👥 Supervisor *</label>
            <input style={styles.input} value={formData.supervisor} readOnly placeholder="Auto-filled from lot data" />
            {errors.supervisor && <span style={styles.error}>{errors.supervisor}</span>}
          </div>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>💬 Additional Remarks</label>
          <textarea style={{ ...styles.input, minHeight: "80px" }} value={formData.remarks} onChange={(e) => updateFormData("remarks", e.target.value)} />
        </div>
      </div>
    );
  };

  // Accessories Tab
  const renderAccessories = () => {
    const existingCheck = checkForExistingOrder(formData.lotNo, currentLotQuantity);
    const isBlocked = existingCheck && existingCheck.pendingQty <= 0;
    
    return (
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>🎁 Required Accessories</h3>
        
        {!isBlocked && (
          <>
            <p style={{ color: "#64748b", marginBottom: "20px" }}>
              Select all accessories needed for this stitching order.
            </p>
            
            <div style={styles.accessoriesGrid}>
              {[
                { key: "label", label: "Label", emoji: "🏷️" },
                { key: "washCare", label: "Wash Care", emoji: "🧼" },
                { key: "silicon", label: "Silicon", emoji: "🔘" },
                { key: "size", label: "Size", emoji: "📐" },
                { key: "zip", label: "Zip", emoji: "🤐" },
                { key: "tapeLace", label: "Tape/Lace", emoji: "🎀" },
                { key: "elastic", label: "Elastic", emoji: "🔄" },
              ].map(({ key, label, emoji }) => (
                <div
                  key={key}
                  style={{
                    ...styles.accessoryItem,
                    ...(accessories[key] && styles.accessorySelected)
                  }}
                  onClick={() => setAccessories(prev => ({ ...prev, [key]: !prev[key] }))}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "24px" }}>{emoji}</span>
                    <span style={{ fontWeight: "600" }}>{label}</span>
                    {accessories[key] && <span style={{ marginLeft: "auto", color: "#10b981" }}>✓</span>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  // Review Tab
  const renderReview = () => {
    const existingCheck = checkForExistingOrder(formData.lotNo, currentLotQuantity);
    const isBlocked = existingCheck && existingCheck.pendingQty <= 0;
    
    return (
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>👁️ Order Review</h3>
        
        {!isBlocked && (
          <>
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "20px", marginBottom: "20px" }}>
              <h4 style={{ margin: "0 0 10px 0", color: "#059669" }}>Order Summary</h4>
              <div style={styles.formGrid}>
                <div><strong>MSO Number:</strong> {formData.orderNo}</div>
                <div><strong>Supervisor:</strong> {formData.supervisor}</div>
                <div><strong>Lot Number:</strong> {formData.lotNo}</div>
                <div><strong>Brand:</strong> {formData.brand}</div>
                <div><strong>Garment Type:</strong> {formData.garmentType}</div>
                <div><strong>Quantity:</strong> {formData.qty} PCS</div>
                <div><strong>Priority:</strong> {formData.priority}</div>
              </div>
              
              <div style={{ marginTop: "15px" }}>
                <strong>Selected Accessories:</strong>{" "}
                {Object.entries(accessories).filter(([, value]) => value).length > 0 
                  ? Object.entries(accessories).filter(([, value]) => value).map(([key]) => key).join(", ")
                  : "None"}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  // Navigation Buttons
  const renderNavigation = () => {
    const existingCheck = checkForExistingOrder(formData.lotNo, currentLotQuantity);
    const isBlocked = existingCheck && existingCheck.pendingQty <= 0;
    
    const missingFields = [];
    if (!formData.lotNo.trim()) missingFields.push("Lot Number");
    if (!formData.brand.trim()) missingFields.push("Brand");
    if (!formData.garmentType.trim()) missingFields.push("Garment Type");
    if (!formData.qty || Number(formData.qty) <= 0) missingFields.push("Quantity");
    if (!formData.supervisor.trim()) missingFields.push("Supervisor");
    
    const isBasicInfoComplete = missingFields.length === 0;

    return (
      <div style={{ display: "flex", gap: "15px", justifyContent: "center", marginTop: "30px", flexWrap: "wrap" }}>
        {uiState.activeTab === "basic" && (
          <button
            style={{ ...styles.button, ...styles.primaryButton }}
            onClick={() => !isBlocked && isBasicInfoComplete && updateUiState("activeTab", "accessories")}
            disabled={!isBasicInfoComplete || isBlocked}
          >
            Next: Accessories →
          </button>
        )}

        {uiState.activeTab === "accessories" && (
          <>
            <button style={{ ...styles.button, ...styles.secondaryButton }} onClick={() => updateUiState("activeTab", "basic")}>
              ← Back to Basic Info
            </button>
            <button style={{ ...styles.button, ...styles.primaryButton }} onClick={() => !isBlocked && updateUiState("activeTab", "review")}>
              Next: Review Order →
            </button>
          </>
        )}

        {uiState.activeTab === "review" && (
          <>
            <button style={{ ...styles.button, ...styles.secondaryButton }} onClick={() => updateUiState("activeTab", "accessories")}>
              ← Back to Accessories
            </button>
            <button style={{ ...styles.button, ...styles.secondaryButton }} onClick={resetForm}>
              New Order
            </button>
            <button
              style={{ ...styles.button, ...styles.successButton }}
              onClick={handleSubmit}
              disabled={uiState.loading || isBlocked}
            >
              {uiState.loading ? "..." : "Submit & Generate PDF"}
            </button>
          </>
        )}
      </div>
    );
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <button style={styles.backButton} onClick={handleBack}>
            ← Back
          </button>
          <h1 style={styles.title}>Material Stitching Order</h1>
          <p style={styles.subtitle}>Create and manage material stitching orders efficiently</p>
          
          {/* Tabs */}
          <div style={styles.tabs}>
            {["basic", "accessories", "review"].map((tab) => (
              <div
                key={tab}
                style={{
                  ...styles.tab,
                  ...(uiState.activeTab === tab && styles.activeTab),
                }}
                onClick={() => updateUiState("activeTab", tab)}
              >
                {tab === "basic" && "📋 Basic Info"}
                {tab === "accessories" && "🎁 Accessories"}
                {tab === "review" && "👁️ Review"}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={styles.content}>
          {uiState.activeTab === "basic" && renderBasicInfo()}
          {uiState.activeTab === "accessories" && renderAccessories()}
          {uiState.activeTab === "review" && renderReview()}
          {renderNavigation()}
        </div>
      </div>

      {/* Loading Overlay */}
      {(uiState.loading || uiState.loadingLookup) && renderLoadingOverlay()}

      {/* Dialogs */}
      {uiState.showSubmitDialog && renderSubmitDialog()}
      {uiState.showSuccessDialog && renderSuccessDialog()}
      {uiState.showErrorDialog && renderErrorDialog()}
      {uiState.showDuplicateWarning && renderDuplicateWarningDialog()}
    </div>
  );
}