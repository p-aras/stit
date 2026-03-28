// src/CreatePayable.js
import React, { useState, useEffect } from 'react';
import './CreatePayable.css'; // Import the CSS file

// Google Sheets configuration
const GOOGLE_SHEETS_CONFIG = {
  API_KEY: "AIzaSyAomDFBkOySlIxKWSKGHe6ATv9gvaBr7uk",
  SPREADSHEET_ID: "17qqixpHOXvG1U3RlRwaHON5JCkugpy4RIu5N9zR9ScM",
  KARIGAR_ASSIGNMENTS_RANGE: "KarigarAssignments!A:Z",
  KARIGAR_PROFILE_RANGE: "KarigarProfiles!A:L",
  PAYABLES_RANGE: "Payables!A:J",
  SUPPLIERS_RANGE: "Suppliers!A:F",
};

// Separate workbook for rate list
const RATE_LIST_CONFIG = {
  API_KEY: "AIzaSyAomDFBkOySlIxKWSKGHe6ATv9gvaBr7uk",
  SPREADSHEET_ID: "18KNc9xYqv-vnFFiIkot2Q1MoLvB0n4RukELnQUz-wtQ",
  RANGE: "Master List!A:J",
};

export default function CreatePayable({ onBack, supervisor, onNavigate }) {
  const [activeModule, setActiveModule] = useState('create');
  const [payableType, setPayableType] = useState('karigar');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [payables, setPayables] = useState([]);
  const [karigarAssignments, setKarigarAssignments] = useState([]);
  const [karigarProfiles, setKarigarProfiles] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [rateList, setRateList] = useState([]);
  
  // State for karigar filtering
  const [selectedSupervisor, setSelectedSupervisor] = useState('');
  const [supervisors, setSupervisors] = useState([]);
  const [filteredKarigars, setFilteredKarigars] = useState([]);
  const [selectedKarigar, setSelectedKarigar] = useState('');
  const [karigarWorkSummary, setKarigarWorkSummary] = useState(null);
  const [shadeWiseLots, setShadeWiseLots] = useState({});
  const [selectedShades, setSelectedShades] = useState([]);
  const [expandedShade, setExpandedShade] = useState(null);
  const [selectedLots, setSelectedLots] = useState({});
  
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState('');
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(1)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [selectedPayable, setSelectedPayable] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');
  const [showPaymentSlipModal, setShowPaymentSlipModal] = useState(false);
  const [paymentSlipData, setPaymentSlipData] = useState(null);

  const [formData, setFormData] = useState({
    payableId: '',
    payableType: 'karigar',
    payeeId: '',
    payeeName: '',
    amount: '',
    dueDate: '',
    paymentDate: '',
    status: 'pending',
    category: '',
    description: '',
    reference: '',
    notes: '',
    createdBy: supervisor?.name || 'Unknown',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  useEffect(() => {
    loadKarigarProfiles();
    loadKarigarAssignments();
    loadSuppliers();
    loadPayables();
    loadRateList();
  }, []);

  // Load karigar profiles from the KarigarProfile sheet
  const loadKarigarProfiles = async () => {
    try {
      setLoading(true);
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_CONFIG.SPREADSHEET_ID}/values/${GOOGLE_SHEETS_CONFIG.KARIGAR_PROFILE_RANGE}?key=${GOOGLE_SHEETS_CONFIG.API_KEY}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        console.warn('KarigarProfile sheet not available');
        setKarigarProfiles([]);
        return;
      }
      
      const data = await response.json();

      if (data.values && data.values.length > 0) {
        const headers = data.values[0];
        const rows = data.values.slice(1);
        
        const profiles = rows.map(row => ({
          timestamp: row[0] || '',
          karigarId: row[1] ? row[1].trim() : '',
          karigarName: row[2] ? row[2].trim() : '',
          dateOfBirth: row[3] || '',
          age: row[4] || '',
          gender: row[5] || '',
          floorArea: row[6] || '',
          skillType: row[7] || '',
          dateOfJoining: row[8] || '',
          supervisorType: row[9] || '',
          supervisorName: row[10] ? row[10].trim() : ''
        })).filter(p => p.karigarId && p.karigarName);
        
        setKarigarProfiles(profiles);
        console.log('Karigar profiles loaded:', profiles.length);
        
        // Extract unique supervisors from the profiles
        const uniqueSupervisors = [...new Set(profiles.map(p => p.supervisorName))].filter(Boolean);
        setSupervisors(uniqueSupervisors);
        console.log('Supervisors found:', uniqueSupervisors);
      }
    } catch (err) {
      console.error('Error loading karigar profiles:', err);
      setKarigarProfiles([]);
    } finally {
      setLoading(false);
    }
  };

  const loadKarigarAssignments = async () => {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_CONFIG.SPREADSHEET_ID}/values/${GOOGLE_SHEETS_CONFIG.KARIGAR_ASSIGNMENTS_RANGE}?key=${GOOGLE_SHEETS_CONFIG.API_KEY}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch karigar assignments');
      const data = await response.json();

      if (data.values && data.values.length > 0) {
        const headers = data.values[0];
        const rows = data.values.slice(1);
        
        const assignments = rows.map((row, index) => {
          const assignment = {
            timestamp: row[0] || '',
            lotNumber: row[1] ? row[1].toString().trim() : '',
            brand: row[2] ? row[2].trim() : '',
            fabric: row[3] ? row[3].trim() : '',
            style: row[4] ? row[4].trim() : '',
            garmentType: row[5] ? row[5].trim() : '',
            shade: row[6] ? row[6].trim() : '',
            karigarName: row[7] ? row[7].trim() : '',
            karigarId: row[8] ? row[8].toString().trim() : '',
            quantity: parseInt(row[9]) || 0,
            savedBy: row[10] ? row[10].trim() : '',
            supervisor: row[11] ? row[11].trim() : '',
            savedAt: row[12] || '',
            status: row[13] ? row[13].trim().toLowerCase() : 'pending',
            rate: 0,
            completedQuantity: 0,
            paymentStatus: 'pending',
            notes: ''
          };
          
          if (assignment.status === 'completed') {
            assignment.completedQuantity = assignment.quantity;
          }
          
          assignment.totalAmount = (assignment.completedQuantity || assignment.quantity || 0) * (assignment.rate || 0);
          
          return assignment;
        }).filter(a => a.karigarName && a.karigarId);
        
        setKarigarAssignments(assignments);
      }
    } catch (err) {
      console.error('Error loading karigar assignments:', err);
      setError('Failed to load karigar assignments');
    }
  };

  // Load rate list from separate workbook
  const loadRateList = async () => {
    try {
      setLoading(true);
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${RATE_LIST_CONFIG.SPREADSHEET_ID}/values/${RATE_LIST_CONFIG.RANGE}?key=${RATE_LIST_CONFIG.API_KEY}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        console.warn('Rate list not available, using fallback rates');
        setRateList([]);
        return;
      }
      
      const data = await response.json();

      if (data.values && data.values.length > 0) {
        const headers = data.values[0];
        const rows = data.values.slice(1);
        
        const rates = rows.map(row => {
          let rate = 0;
          if (row[8]) {
            const rateStr = row[8].toString().replace('₹', '').replace(/,/g, '').trim();
            rate = parseFloat(rateStr) || 0;
          }

          let timestamp = null;
          if (row[1]) {
            const dateParts = row[1].split(' ')[0].split('/');
            if (dateParts.length === 3) {
              const [day, month, year] = dateParts;
              timestamp = `${year}-${month}-${day}`;
            }
          }

          return {
            submissionId: row[0] || '',
            timestamp: timestamp,
            originalTimestamp: row[1] || '',
            submitter: row[2] || '',
            category: row[3] ? row[3].toString().trim() : '',
            displayCategory: row[4] ? row[4].toString().trim() : '',
            subcategory: row[5] ? row[5].toString().trim() : '',
            jacketType: row[6] ? row[6].toString().trim() : '',
            lotNo: row[7] ? row[7].toString().trim() : '',
            rate: rate,
            itemCount: parseInt(row[9]) || 0,
            selectionsSummary: row[10] || ''
          };
        }).filter(r => r.rate > 0);
        
        setRateList(rates);
      }
    } catch (err) {
      console.error('Error loading rate list:', err);
      setRateList([]);
    } finally {
      setLoading(false);
    }
  };

  const loadSuppliers = async () => {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_CONFIG.SPREADSHEET_ID}/values/${GOOGLE_SHEETS_CONFIG.SUPPLIERS_RANGE}?key=${GOOGLE_SHEETS_CONFIG.API_KEY}`;
      const response = await fetch(url);
      if (!response.ok) {
        setSuppliers([]);
        return;
      }
      const data = await response.json();

      if (data.values && data.values.length > 0) {
        const rows = data.values.slice(1);
        const suppliersList = rows.map(row => ({
          id: row[0] || '',
          name: row[1] || '',
          material: row[2] || '',
          paymentTerms: row[3] || '',
          contact: row[4] || '',
          active: row[5] || 'Yes'
        })).filter(s => s.id && s.name);
        
        setSuppliers(suppliersList);
      }
    } catch (err) {
      console.error('Error loading suppliers:', err);
      setSuppliers([]);
    }
  };

  const loadPayables = async () => {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_CONFIG.SPREADSHEET_ID}/values/${GOOGLE_SHEETS_CONFIG.PAYABLES_RANGE}?key=${GOOGLE_SHEETS_CONFIG.API_KEY}`;
      const response = await fetch(url);
      if (!response.ok) {
        setPayables([]);
        return;
      }
      const data = await response.json();

      if (data.values && data.values.length > 0) {
        const rows = data.values.slice(1);
        const payablesList = rows.map(row => ({
          id: row[0] || '',
          payableId: row[1] || '',
          payableType: row[2] || '',
          payeeId: row[3] || '',
          payeeName: row[4] || '',
          amount: parseFloat(row[5]) || 0,
          dueDate: row[6] || '',
          paymentDate: row[7] || '',
          status: row[8] || 'pending',
          category: row[9] || '',
          description: row[10] || '',
          reference: row[11] || '',
          notes: row[12] || '',
          createdBy: row[13] || '',
          createdAt: row[14] || '',
          updatedAt: row[15] || ''
        }));
        
        setPayables(payablesList);
      }
    } catch (err) {
      console.error('Error loading payables:', err);
      setPayables([]);
    }
  };

  // Filter karigars by supervisor using the profile data
  useEffect(() => {
    if (selectedSupervisor && karigarProfiles.length > 0) {
      const karigarsUnderSupervisor = karigarProfiles
        .filter(profile => profile.supervisorName === selectedSupervisor)
        .map(profile => ({
          karigarId: profile.karigarId.trim(),
          karigarName: profile.karigarName.trim(),
          floorArea: profile.floorArea,
          skillType: profile.skillType
        }));

      const enhancedKarigars = karigarsUnderSupervisor.map(karigar => {
        const karigarWork = karigarAssignments.filter(
          a => a.karigarId && a.karigarId.trim() === karigar.karigarId && a.status === 'completed'
        );
        
        return {
          ...karigar,
          totalLots: karigarWork.length,
          totalAmount: karigarWork.reduce((sum, a) => sum + (a.totalAmount || 0), 0),
          totalQuantity: karigarWork.reduce((sum, a) => sum + (a.completedQuantity || a.quantity || 0), 0)
        };
      });

      setFilteredKarigars(enhancedKarigars);
    } else {
      setFilteredKarigars([]);
    }
  }, [selectedSupervisor, karigarProfiles, karigarAssignments]);

  // Function to get rate from rate list based on garment details
  const getRateFromList = (assignment) => {
    if (!rateList || rateList.length === 0) {
      return {
        rate: 0,
        source: 'none',
        matchedFrom: 'No rate list available'
      };
    }

    // Try to match by Lot Number first (most accurate)
    let matchedRate = rateList.find(r => 
      r.lotNo && r.lotNo.toString().trim() === assignment.lotNumber.toString().trim()
    );

    if (matchedRate) {
      return {
        rate: matchedRate.rate,
        source: 'rateList',
        matchedFrom: `Exact lot match: ${matchedRate.lotNo}`,
        rateDetails: matchedRate
      };
    }

    // If no lot match, try to match by Category/Subcategory/Jacket Type combination
    const category = (assignment.garmentType || assignment.category || '').toLowerCase().trim();
    const subcategory = (assignment.fabric || '').toLowerCase().trim();
    const jacketType = (assignment.style || '').toLowerCase().trim();

    const possibleMatches = rateList.filter(r => {
      const rCategory = (r.category || '').toLowerCase().trim();
      const rDisplayCategory = (r.displayCategory || '').toLowerCase().trim();
      const rSubcategory = (r.subcategory || '').toLowerCase().trim();
      const rJacketType = (r.jacketType || '').toLowerCase().trim();

      return (
        (category && (rCategory === category || rDisplayCategory === category)) ||
        (subcategory && rSubcategory === subcategory) ||
        (jacketType && rJacketType === jacketType)
      );
    });

    if (possibleMatches.length > 0) {
      const sortedMatches = possibleMatches.sort((a, b) => {
        if (a.timestamp && b.timestamp) {
          return new Date(b.timestamp) - new Date(a.timestamp);
        }
        return 0;
      });

      matchedRate = sortedMatches[0];
      return {
        rate: matchedRate.rate,
        source: 'rateList',
        matchedFrom: `Matched by details: ${matchedRate.category || matchedRate.displayCategory} / ${matchedRate.subcategory} / ${matchedRate.jacketType}`,
        rateDetails: matchedRate
      };
    }

    return {
      rate: 0,
      source: 'none',
      matchedFrom: `No rate found for lot ${assignment.lotNumber} or similar items`
    };
  };

  // Load shade-wise lots when karigar is selected - ONLY COMPLETED LOTS
  useEffect(() => {
    if (selectedKarigar && karigarAssignments.length > 0) {
      const completedWork = karigarAssignments.filter(
        a => a.karigarId && a.karigarId.trim() === selectedKarigar.trim() && a.status === 'completed'
      );

      // Group by shade and calculate amounts using rate list
      const groupedByShade = completedWork.reduce((acc, assignment) => {
        const shade = assignment.shade || 'Unassigned';
        
        const rateInfo = getRateFromList(assignment);
        const quantity = assignment.completedQuantity || assignment.quantity || 0;
        const totalAmount = quantity * rateInfo.rate;
        
        if (!acc[shade]) {
          acc[shade] = {
            shade: shade,
            lots: [],
            totalQuantity: 0,
            totalAmount: 0,
            lotNumbers: [],
            rateInfo: rateInfo,
            rates: {},
            completedCount: 0
          };
        }
        
        const updatedAssignment = {
          ...assignment,
          rate: rateInfo.rate,
          rateInfo: rateInfo,
          totalAmount: totalAmount,
          isCompleted: true
        };
        
        acc[shade].lots.push(updatedAssignment);
        acc[shade].totalQuantity += quantity;
        acc[shade].totalAmount += totalAmount;
        acc[shade].lotNumbers.push(assignment.lotNumber);
        acc[shade].rates[assignment.lotNumber] = rateInfo;
        acc[shade].completedCount += 1;
        
        return acc;
      }, {});

      setShadeWiseLots(groupedByShade);

      if (completedWork.length > 0) {
        const totalAmount = Object.values(groupedByShade).reduce(
          (sum, shade) => sum + shade.totalAmount, 0
        );
        
        setKarigarWorkSummary({
          name: completedWork[0].karigarName,
          id: completedWork[0].karigarId,
          totalLots: completedWork.length,
          totalAmount: totalAmount,
          totalQuantity: completedWork.reduce((sum, a) => sum + (a.completedQuantity || a.quantity || 0), 0),
          brands: [...new Set(completedWork.map(a => a.brand))].filter(Boolean).join(', '),
          completedShades: Object.keys(groupedByShade).length
        });
      } else {
        setKarigarWorkSummary(null);
      }

      setSelectedShades([]);
      setExpandedShade(null);
      setSelectedLots({});
      
      setDebugInfo(`Selected Karigar: ${selectedKarigar}\nTotal Assignments: ${karigarAssignments.length}\nCompleted for this karigar: ${completedWork.length}`);
    }
  }, [selectedKarigar, karigarAssignments, rateList]);

  const generatePayableId = () => {
    const prefix = 'PAY';
    const year = new Date().getFullYear().toString().slice(-2);
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}${year}${month}${random}`;
  };

  const handleSupervisorChange = (e) => {
    setSelectedSupervisor(e.target.value);
    setSelectedKarigar('');
    setShadeWiseLots({});
    setSelectedShades([]);
    setKarigarWorkSummary(null);
    setExpandedShade(null);
    setSelectedLots({});
    setDebugInfo('');
  };

  const handleKarigarChange = (e) => {
    setSelectedKarigar(e.target.value);
    setSelectedLots({});
  };

  const handleShadeSelection = (shade) => {
    setSelectedShades(prev => {
      if (prev.includes(shade)) {
        // Remove shade and its lots from selection
        const newSelectedLots = { ...selectedLots };
        delete newSelectedLots[shade];
        setSelectedLots(newSelectedLots);
        return prev.filter(s => s !== shade);
      } else {
        // Add shade and select all its lots by default
        const newSelectedLots = { ...selectedLots };
        newSelectedLots[shade] = shadeWiseLots[shade].lots.map(lot => lot.lotNumber);
        setSelectedLots(newSelectedLots);
        return [...prev, shade];
      }
    });
  };

  const handleLotSelection = (shade, lotNumber) => {
    setSelectedLots(prev => {
      const shadeLots = prev[shade] || [];
      const updatedShadeLots = shadeLots.includes(lotNumber)
        ? shadeLots.filter(l => l !== lotNumber)
        : [...shadeLots, lotNumber];
      
      const newSelectedLots = {
        ...prev,
        [shade]: updatedShadeLots
      };

      // Update selected shades based on lot selection
      setSelectedShades(prevShades => {
        if (updatedShadeLots.length === 0) {
          return prevShades.filter(s => s !== shade);
        } else if (!prevShades.includes(shade) && updatedShadeLots.length > 0) {
          return [...prevShades, shade];
        }
        return prevShades;
      });

      return newSelectedLots;
    });
  };

  const handleSelectAllLots = (shade) => {
    const allLots = shadeWiseLots[shade].lots.map(lot => lot.lotNumber);
    setSelectedLots(prev => {
      const currentShadeLots = prev[shade] || [];
      const newSelectedLots = {
        ...prev,
        [shade]: currentShadeLots.length === allLots.length ? [] : allLots
      };

      // Update selected shades
      setSelectedShades(prevShades => {
        if (newSelectedLots[shade].length === 0) {
          return prevShades.filter(s => s !== shade);
        } else if (!prevShades.includes(shade)) {
          return [...prevShades, shade];
        }
        return prevShades;
      });

      return newSelectedLots;
    });
  };

  const handleSelectAllShades = () => {
    const allShades = Object.keys(shadeWiseLots);
    if (selectedShades.length === allShades.length) {
      setSelectedShades([]);
      setSelectedLots({});
    } else {
      setSelectedShades(allShades);
      const allLots = {};
      allShades.forEach(shade => {
        allLots[shade] = shadeWiseLots[shade].lots.map(lot => lot.lotNumber);
      });
      setSelectedLots(allLots);
    }
  };

  const toggleShadeExpand = (shade) => {
    setExpandedShade(expandedShade === shade ? null : shade);
  };

  const calculateTotalAmount = () => {
    let total = 0;
    Object.entries(selectedLots).forEach(([shade, lots]) => {
      const shadeData = shadeWiseLots[shade];
      if (shadeData) {
        lots.forEach(lotNumber => {
          const lot = shadeData.lots.find(l => l.lotNumber === lotNumber);
          if (lot) {
            total += lot.totalAmount;
          }
        });
      }
    });
    return total;
  };

  const calculateTotalQuantity = () => {
    let total = 0;
    Object.entries(selectedLots).forEach(([shade, lots]) => {
      const shadeData = shadeWiseLots[shade];
      if (shadeData) {
        lots.forEach(lotNumber => {
          const lot = shadeData.lots.find(l => l.lotNumber === lotNumber);
          if (lot) {
            total += lot.completedQuantity || lot.quantity || 0;
          }
        });
      }
    });
    return total;
  };

  const getSelectedLotsData = () => {
    const selectedLotsData = [];
    Object.entries(selectedLots).forEach(([shade, lots]) => {
      const shadeData = shadeWiseLots[shade];
      if (shadeData) {
        const shadeLots = shadeData.lots.filter(lot => lots.includes(lot.lotNumber));
        if (shadeLots.length > 0) {
          selectedLotsData.push({
            shade: shade,
            lots: shadeLots,
            totalQuantity: shadeLots.reduce((sum, lot) => sum + (lot.completedQuantity || lot.quantity || 0), 0),
            totalAmount: shadeLots.reduce((sum, lot) => sum + lot.totalAmount, 0),
            lotNumbers: shadeLots.map(lot => lot.lotNumber)
          });
        }
      }
    });
    return selectedLotsData;
  };

  const handleCreatePayment = () => {
    const selectedLotsData = getSelectedLotsData();
    const totalAmount = calculateTotalAmount();
    const lotNumbers = selectedLotsData.flatMap(s => s.lotNumbers).join(', ');
    const shadesList = selectedLotsData.map(s => s.shade).join(', ');
    
    const rateDetails = selectedLotsData.map(shade => {
      const lotsWithRates = shade.lots.map(lot => 
        `${lot.lotNumber}: ${lot.completedQuantity || lot.quantity} pcs @ ₹${lot.rate?.toFixed(2)} (${lot.rateInfo?.matchedFrom || 'rate list'})`
      ).join('; ');
      return `${shade.shade}: ${lotsWithRates}`;
    }).join('\n');
    
    setFormData({
      ...formData,
      payeeId: selectedKarigar,
      payeeName: karigarWorkSummary?.name || '',
      amount: totalAmount,
      category: 'Wages',
      description: `Payment for completed lots:\nLots: ${lotNumbers}\nShades: ${shadesList}\n\nRate Details:\n${rateDetails}`,
      // Add supervisor to form data
      supervisor: selectedSupervisor || supervisor?.name || 'Supervisor'
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  // Enhanced generatePaymentSlipHTML function with black header design
  const generatePaymentSlipHTML = (payableData, selectedLotsData) => {
    const currentDate = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
    
    const payableId = payableData.payableId || generatePayableId();
    const amountInWords = numberToWords(payableData.amount);
    const supervisorName = payableData.supervisor || selectedSupervisor || payableData.createdBy || 'Supervisor';
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payment Slip - ${payableId}</title>
        <style>
          body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 15px;
            background: #f5f5f5;
          }
          .payment-slip {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border: 2px solid #000;
            padding: 20px;
            position: relative;
            font-size: 12px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #000;
            padding-bottom: 12px;
            margin-bottom: 15px;
            position: relative;
          }
          .header h1 {
            margin: 0;
            color: #000;
            font-size: 24px;
            text-transform: uppercase;
            font-weight: 800;
            letter-spacing: 1px;
          }
          .slip-title {
            text-align: center;
            margin: 15px 0;
          }
          .slip-title h3 {
            display: inline-block;
            border: 2px solid #000;
            padding: 6px 30px;
            margin: 0;
            font-size: 16px;
            text-transform: uppercase;
            background: #f0f0f0;
            color: #000;
            font-weight: 700;
            letter-spacing: 1px;
          }
          .voucher-section {
            position: absolute;
            top: 15px;
            right: 15px;
            text-align: right;
          }
          .voucher-label {
            font-size: 10px;
            color: #666;
            text-transform: uppercase;
          }
          .voucher-number {
            font-size: 14px;
            font-weight: 700;
            color: #000;
            font-family: monospace;
            letter-spacing: 1px;
          }
          .info-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
            margin: 15px 0;
            padding: 12px;
            border: 1px solid #000;
            background: #fafafa;
          }
          .info-item {
            display: flex;
            align-items: baseline;
          }
          .info-label {
            width: 90px;
            font-weight: 600;
            color: #000;
            font-size: 11px;
            text-transform: uppercase;
          }
          .info-value {
            flex: 1;
            color: #000;
            font-weight: 500;
            font-size: 12px;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
            font-size: 11px;
            border: 1px solid #000;
          }
          .items-table th {
            background: #000;
            color: white;
            padding: 8px 4px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            border-right: 1px solid #333;
          }
          .items-table th:last-child {
            border-right: none;
          }
          .items-table td {
            padding: 6px 4px;
            border: 1px solid #000;
            color: #000;
          }
          .items-table tr:nth-child(even) {
            background: #f5f5f5;
          }
          .amount-in-words {
            margin: 15px 0;
            padding: 12px;
            background: #f0f0f0;
            border-left: 4px solid #000;
            font-style: italic;
            font-size: 12px;
            color: #000;
            font-weight: 500;
          }
          .total-section {
            text-align: right;
            font-size: 16px;
            font-weight: 800;
            margin: 15px 0;
            padding: 12px 15px;
            background: #e8f4f8;
            border: 2px solid #000;
            color: #000;
          }
          .total-section .total-label {
            margin-right: 15px;
            text-transform: uppercase;
          }
          .total-section .total-amount {
            font-size: 18px;
          }
          .footer {
            margin-top: 30px;
            display: flex;
            justify-content: space-between;
            position: relative;
          }
          .signature {
            text-align: center;
            width: 200px;
          }
          .signature-line {
            border-top: 2px solid #000;
            margin-top: 35px;
            padding-top: 6px;
            font-size: 11px;
            color: #000;
            font-weight: 500;
          }
          .supervisor-signature {
            text-align: center;
            width: 200px;
            margin-top: 20px;
          }
          .supervisor-name {
            font-weight: 700;
            color: #000;
            font-size: 12px;
            text-transform: uppercase;
            margin-bottom: 5px;
          }
          .supervisor-line {
            border-top: 2px solid #000;
            margin-top: 25px;
            padding-top: 6px;
            font-size: 11px;
            color: #000;
            font-weight: 500;
          }
          .watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 60px;
            color: rgba(0, 0, 0, 0.03);
            white-space: nowrap;
            pointer-events: none;
            z-index: 0;
            font-weight: 800;
            text-transform: uppercase;
          }
          .footer-note {
            margin-top: 10px;
            font-size: 9px;
            text-align: center;
            color: #666;
            border-top: 1px dashed #000;
            padding-top: 8px;
          }
          .payment-type-badge {
            display: inline-block;
            padding: 3px 10px;
            background: #000;
            color: white;
            font-size: 10px;
            font-weight: 600;
            border-radius: 15px;
            margin-left: 10px;
          }
          .text-right {
            text-align: right;
          }
          .text-center {
            text-align: center;
          }
          .font-bold {
            font-weight: 700;
          }
          @media print {
            body { background: white; }
            .payment-slip { 
              border: 2px solid #000;
              box-shadow: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="payment-slip">
          <div class="watermark">${payableData.status.toUpperCase()}</div>
          
          <div class="voucher-section">
            <div class="voucher-label">VOUCHER NUMBER</div>
            <div class="voucher-number">${payableId}</div>
          </div>
          
          <div class="header">
            <h1>PAYMENT VOUCHER</h1>
            <div class="payment-type-badge" style="margin-top: 5px;">${payableData.payableType?.toUpperCase() || 'PAYMENT'}</div>
          </div>

          <div class="slip-title">
            <h3>KARIGAR PAYMENT SLIP</h3>
          </div>

          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Date:</span>
              <span class="info-value">${currentDate}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Due Date:</span>
              <span class="info-value">${new Date(payableData.dueDate).toLocaleDateString('en-IN')}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Payee:</span>
              <span class="info-value">${payableData.payeeName}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Payee ID:</span>
              <span class="info-value">${payableData.payeeId}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Category:</span>
              <span class="info-value">${payableData.category}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Status:</span>
              <span class="info-value" style="font-weight: 700; text-transform: uppercase;">${payableData.status}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Ref No:</span>
              <span class="info-value">${payableData.reference || 'N/A'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Supervisor:</span>
              <span class="info-value" style="font-weight: 700;">${supervisorName}</span>
            </div>
          </div>

          ${selectedLotsData && selectedLotsData.length > 0 ? `
            <table class="items-table">
              <thead>
                <tr>
                  <th>Lot No</th>
                  <th>Shade</th>
                  <th>Brand/Style</th>
                  <th>Fabric</th>
                  <th>Qty</th>
                  <th>Rate (₹)</th>
                  <th>Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                ${selectedLotsData.flatMap(shade => 
                  shade.lots.map(lot => `
                    <tr>
                      <td class="font-bold">${lot.lotNumber}</td>
                      <td>${lot.shade}</td>
                      <td>${lot.brand || ''} / ${lot.style || ''}</td>
                      <td>${lot.fabric || ''}</td>
                      <td class="text-right">${lot.completedQuantity || lot.quantity}</td>
                      <td class="text-right">${lot.rate.toFixed(2)}</td>
                      <td class="text-right">${lot.totalAmount.toFixed(2)}</td>
                    </tr>
                  `)
                ).join('')}
                <tr style="background: #000; color: white; font-weight: 700;">
                  <td colspan="4" style="text-align: right; border-right: 1px solid #333;">TOTAL:</td>
                  <td style="text-align: right; border-right: 1px solid #333;">${selectedLotsData.reduce((sum, s) => sum + s.totalQuantity, 0)}</td>
                  <td style="text-align: right; border-right: 1px solid #333;">—</td>
                  <td style="text-align: right;">₹${selectedLotsData.reduce((sum, s) => sum + s.totalAmount, 0).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          ` : ''}

          <div class="amount-in-words">
            <strong>Amount in words:</strong> ${amountInWords} Rupees Only
          </div>

          <div class="total-section">
            <span class="total-label">Total Payable Amount:</span>
            <span class="total-amount">₹ ${parseFloat(payableData.amount).toFixed(2)}</span>
          </div>

          <div class="footer">
            <div class="signature">
              <div class="signature-line">Receiver's Signature</div>
            </div>
            <div class="supervisor-signature">
              <div class="supervisor-name">${supervisorName}</div>
              <div class="supervisor-line">Supervisor/Thekedar</div>
            </div>
          </div>

          <div class="footer-note">
            This is a computer generated payment voucher • Valid only with authorized signature
          </div>
        </div>
      </body>
      </html>
    `;
  };
  
  // Helper function to convert number to words
  const numberToWords = (num) => {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
      'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    
    const numToWords = (n) => {
      if (n < 20) return ones[n];
      if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? ' ' + ones[n%10] : '');
      if (n < 1000) return ones[Math.floor(n/100)] + ' Hundred' + (n%100 ? ' ' + numToWords(n%100) : '');
      if (n < 100000) return numToWords(Math.floor(n/1000)) + ' Thousand' + (n%1000 ? ' ' + numToWords(n%1000) : '');
      if (n < 10000000) return numToWords(Math.floor(n/100000)) + ' Lakh' + (n%100000 ? ' ' + numToWords(n%100000) : '');
      return numToWords(Math.floor(n/10000000)) + ' Crore' + (n%10000000 ? ' ' + numToWords(n%10000000) : '');
    };
    
    const whole = Math.floor(num);
    const decimal = Math.round((num - whole) * 100);
    
    let words = numToWords(whole);
    if (decimal > 0) {
      words += ' and ' + numToWords(decimal) + ' Paise';
    }
    
    return words;
  };

  // Function to download payment slip as HTML file
  const downloadPaymentSlip = (payableData, selectedLotsData) => {
    const slipHTML = generatePaymentSlipHTML(payableData, selectedLotsData);
    const blob = new Blob([slipHTML], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Payment_Slip_${payableData.payableId || generatePayableId()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Function to download payment slip as PDF (requires browser print)
  const downloadPaymentSlipAsPDF = (payableData, selectedLotsData) => {
    const slipHTML = generatePaymentSlipHTML(payableData, selectedLotsData);
    const printWindow = window.open('', '_blank');
    printWindow.document.write(slipHTML);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  // Modified submitPayable function
  const submitPayable = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      if (!formData.payeeName || !formData.amount || !formData.dueDate) {
        throw new Error('Please fill all required fields');
      }

      const payableId = generatePayableId();

      const newPayable = [
        Date.now().toString(),
        payableId,
        payableType,
        formData.payeeId,
        formData.payeeName,
        formData.amount,
        formData.dueDate,
        formData.paymentDate || '',
        formData.status,
        formData.category,
        formData.description,
        formData.reference,
        formData.notes,
        supervisor?.name || 'Unknown',
        new Date().toISOString(),
        new Date().toISOString()
      ];

      // Prepare payment slip data first (so we have it even if save fails)
      const selectedLotsData = getSelectedLotsData();
      const paymentData = {
        ...formData,
        payableId: payableId,
        payableType: payableType,
        // Make sure supervisor is included
        supervisor: selectedSupervisor || supervisor?.name || 'Supervisor'
      };

      let saveSuccess = false;
      
      // Try to save to Google Sheets
      try {
        const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_CONFIG.SPREADSHEET_ID}/values/${GOOGLE_SHEETS_CONFIG.PAYABLES_RANGE}:append?valueInputOption=USER_ENTERED&key=${GOOGLE_SHEETS_CONFIG.API_KEY}`;
        
        const response = await fetch(appendUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: [newPayable]
          })
        });

        if (!response.ok) throw new Error('Failed to save payable');
        saveSuccess = true;
        
      } catch (saveError) {
        console.error('Error saving to Google Sheets:', saveError);
        // Don't throw error here - we still want to show the payment slip
      }

      // Always show payment slip modal (whether save succeeded or failed)
      setPaymentSlipData({
        payable: paymentData,
        lots: selectedLotsData,
        totalAmount: calculateTotalAmount(),
        totalQuantity: calculateTotalQuantity(),
        saveSuccess: saveSuccess,
        // Add supervisor here as well
        supervisor: selectedSupervisor || supervisor?.name || 'Supervisor'
      });
      setShowPaymentSlipModal(true);
      
      if (saveSuccess) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
        loadPayables();
        loadKarigarAssignments();
      } else {
        // Show warning but still allow download
        setError('Payment created but failed to save to database. You can still download the slip.');
      }

      resetForm();

    } catch (err) {
      console.error('Error in payment process:', err);
      setError(err.message || 'Failed to process payment');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      payableId: '',
      payableType: 'karigar',
      payeeId: '',
      payeeName: '',
      amount: '',
      dueDate: '',
      paymentDate: '',
      status: 'pending',
      category: '',
      description: '',
      reference: '',
      notes: '',
      createdBy: supervisor?.name || 'Unknown',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    setSelectedSupervisor('');
    setSelectedKarigar('');
    setShadeWiseLots({});
    setSelectedShades([]);
    setSelectedLots({});
    setKarigarWorkSummary(null);
    setExpandedShade(null);
    setDebugInfo('');
  };

  const filteredPayables = payables.filter(payable => {
    const matchesStatus = filterStatus === 'all' || payable.status === filterStatus;
    const matchesSearch = (payable.payeeName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (payable.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (payable.reference || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDateRange = (!dateRange.start || payable.dueDate >= dateRange.start) &&
                            (!dateRange.end || payable.dueDate <= dateRange.end);
    
    return matchesStatus && matchesSearch && matchesDateRange;
  });

  const getStatusColor = (status) => {
    switch(status) {
      case 'paid': return { bg: '#ECFDF3', text: '#027A48', dot: '#12B76A' };
      case 'pending': return { bg: '#FFFAEB', text: '#B54708', dot: '#F79009' };
      case 'overdue': return { bg: '#FEF3F2', text: '#B42318', dot: '#F04438' };
      default: return { bg: '#F2F4F7', text: '#344054', dot: '#667085' };
    }
  };

  const getTypeIcon = (type) => {
    switch(type) {
      case 'karigar': return '👤';
      case 'supplier': return '🏭';
      case 'operational': return '⚡';
      default: return '📄';
    }
  };

  const totals = {
    total: filteredPayables.reduce((sum, p) => sum + (p.amount || 0), 0),
    pending: filteredPayables.filter(p => p.status === 'pending').reduce((sum, p) => sum + (p.amount || 0), 0),
    paid: filteredPayables.filter(p => p.status === 'paid').reduce((sum, p) => sum + (p.amount || 0), 0),
    overdue: filteredPayables.filter(p => p.status === 'overdue').reduce((sum, p) => sum + (p.amount || 0), 0)
  };

  const modules = [
    { id: 'create', label: 'Create Payable', icon: '➕' },
    { id: 'view', label: 'View Payables', icon: '👁️' }
  ];

  // UPDATED: Added navigateTo property to supplier card
  const payableTypes = [
    { id: 'karigar', label: 'Karigar Wages', icon: '👤', desc: 'Process worker payments' },
    { 
      id: 'supplier', 
      label: 'Supervisor/Thekedar Payment', 
      icon: '🏭', 
      desc: 'Pay material Supervisor/Thekedar',
      navigateTo: 'supervisorPayment' // Add navigation identifier
    },
    { id: 'operational', label: 'Operational Expense', icon: '⚡', desc: 'Other business expenses' }
  ];

  return (
    <div className="create-payable-container">
      {/* Header */}
      <div className="create-payable-header">
        <div className="create-payable-header-left">
          <button onClick={onBack} className="create-payable-back-button">
            ← Back
          </button>
          <div>
            <h1 className="create-payable-title">Payables Management</h1>
            <p className="create-payable-subtitle">Manage and track all your payment obligations</p>
          </div>
        </div>
        <div className="create-payable-header-right">
          <div className="create-payable-supervisor-badge">
            <span className="create-payable-supervisor-avatar">
              {supervisor?.name?.charAt(0) || 'U'}
            </span>
            <div className="create-payable-supervisor-info">
              <span className="create-payable-supervisor-label">Supervisor</span>
              <span className="create-payable-supervisor-name">{supervisor?.name || 'Unknown'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Status Indicators */}
      {rateList.length === 0 && (
        <div className="create-payable-warning-alert">
          <span className="create-payable-alert-icon">⚠️</span>
          <span>Rate list not loaded. Using default rates from assignments.</span>
        </div>
      )}

      {rateList.length > 0 && (
        <div className="create-payable-success-alert">
          <span className="create-payable-alert-icon">✓</span>
          <span>Rate list loaded: {rateList.length} rates available</span>
        </div>
      )}

      {karigarProfiles.length === 0 && (
        <div className="create-payable-warning-alert">
          <span className="create-payable-alert-icon">⚠️</span>
          <span>Karigar profiles not loaded. Supervisor filtering may not work properly.</span>
        </div>
      )}

      {/* Debug Info - Remove in production */}
      {debugInfo && (
        <div className="create-payable-debug-info">
          <pre>{debugInfo}</pre>
        </div>
      )}

      {/* Alerts */}
      {showSuccess && (
        <div className="create-payable-success-alert">
          <span className="create-payable-alert-icon">✓</span>
          <span>Payable created successfully!</span>
        </div>
      )}
      {error && (
        <div className="create-payable-error-alert">
          <span className="create-payable-alert-icon">⚠</span>
          <span>{error}</span>
        </div>
      )}

      {/* Module Navigation */}
      <div className="create-payable-module-nav">
        {modules.map(module => (
          <button
            key={module.id}
            className={`create-payable-module-button ${activeModule === module.id ? 'active' : ''}`}
            onClick={() => setActiveModule(module.id)}
          >
            <span className="create-payable-module-icon">{module.icon}</span>
            <span>{module.label}</span>
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="create-payable-content">
        {activeModule === 'create' ? (
          <div className="create-payable-module-content">
            {/* Payable Type Selection */}
            <div className="create-payable-type-section">
              <h2 className="create-payable-section-title">Select Payable Type</h2>
              <div className="create-payable-type-grid">
                {payableTypes.map(type => (
                  <button
                    key={type.id}
                    className={`create-payable-type-card ${payableType === type.id ? 'active' : ''}`}
                    onClick={() => {
                      // UPDATED: Check if this card has navigation
                      if (type.navigateTo) {
                        // Navigate to supervisor payment component using the onNavigate prop
                        if (onNavigate) {
                          onNavigate(type.navigateTo);
                        } else {
                          console.warn('onNavigate prop is not provided');
                          // Fallback to normal behavior if navigation not available
                          setPayableType(type.id);
                          resetForm();
                        }
                      } else {
                        // Normal behavior for other types
                        setPayableType(type.id);
                        resetForm();
                      }
                    }}
                  >
                    <span className="create-payable-type-icon">{type.icon}</span>
                    <div className="create-payable-type-info">
                      <h3 className="create-payable-type-label">{type.label}</h3>
                      <p className="create-payable-type-desc">{type.desc}</p>
                      {/* UPDATED: Add indicator for navigation card */}
                      {type.navigateTo && (
                        <span className="create-payable-navigation-indicator" style={{
                          fontSize: '11px',
                          color: '#2563eb',
                          marginTop: '4px',
                          display: 'inline-block'
                        }}>
                          Click to navigate →
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Main Form Area - Two Column Layout */}
            <div className="create-payable-form-container">
              {/* Left Column - Selection Area */}
              <div className="create-payable-left-column">
                {payableType === 'karigar' ? (
                  <>
                    {/* Selection Cards */}
                    <div className="create-payable-card">
                      <h3 className="create-payable-card-title">Step 1: Select Supervisor</h3>
                      <div className="create-payable-field">
                        <label className="create-payable-label">
                          Supervisor/Thekedar <span className="create-payable-required">*</span>
                        </label>
                        <select
                          className="create-payable-select"
                          value={selectedSupervisor}
                          onChange={handleSupervisorChange}
                          required
                        >
                          <option value="">Choose Supervisor</option>
                          {supervisors.map(sup => (
                            <option key={sup} value={sup}>
                              {sup}
                            </option>
                          ))}
                        </select>
                        {supervisors.length === 0 && (
                          <p className="create-payable-helper-text">
                            No supervisors found in KarigarProfile sheet
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="create-payable-card">
                      <h3 className="create-payable-card-title">Step 2: Select Karigar</h3>
                      <div className="create-payable-field">
                        <label className="create-payable-label">
                          Karigar <span className="create-payable-required">*</span>
                        </label>
                        <select
                          className="create-payable-select"
                          value={selectedKarigar}
                          onChange={handleKarigarChange}
                          disabled={!selectedSupervisor}
                          required
                        >
                          <option value="">Choose Karigar</option>
                          {filteredKarigars.map(k => (
                            <option key={k.karigarId} value={k.karigarId}>
                              {k.karigarId} ({k.karigarName})
                              {k.skillType ? ` - ${k.skillType}` : ''}
                              {k.floorArea ? ` [${k.floorArea}]` : ''}
                              {k.totalLots > 0 ? ` - ${k.totalLots} completed lots (₹${k.totalAmount.toLocaleString()})` : ' - No completed work'}
                            </option>
                          ))}
                        </select>
                        {selectedSupervisor && filteredKarigars.length === 0 && (
                          <p className="create-payable-helper-text">
                            No karigars found under this supervisor
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Karigar Summary */}
                    {karigarWorkSummary && (
                      <div className="create-payable-summary-card">
                        <h3 className="create-payable-card-title">Karigar Completed Work Summary</h3>
                        <div className="create-payable-summary-grid">
                          <div className="create-payable-summary-item">
                            <span className="create-payable-summary-label">Name</span>
                            <span className="create-payable-summary-value">{karigarWorkSummary.name}</span>
                          </div>
                          <div className="create-payable-summary-item">
                            <span className="create-payable-summary-label">Karigar ID</span>
                            <span className="create-payable-summary-value">{karigarWorkSummary.id}</span>
                          </div>
                          <div className="create-payable-summary-item">
                            <span className="create-payable-summary-label">Completed Lots</span>
                            <span className="create-payable-summary-value">{karigarWorkSummary.totalLots}</span>
                          </div>
                          <div className="create-payable-summary-item">
                            <span className="create-payable-summary-label">Completed Shades</span>
                            <span className="create-payable-summary-value">{karigarWorkSummary.completedShades || 0}</span>
                          </div>
                          <div className="create-payable-summary-item">
                            <span className="create-payable-summary-label">Total Quantity</span>
                            <span className="create-payable-summary-value">{karigarWorkSummary.totalQuantity}</span>
                          </div>
                          <div className="create-payable-summary-item">
                            <span className="create-payable-summary-label">Total Amount</span>
                            <span className="create-payable-summary-amount">₹{karigarWorkSummary.totalAmount.toLocaleString()}</span>
                          </div>
                        </div>
                        {rateList.length > 0 && (
                          <div className="create-payable-rate-list-info">
                            {/* <span className="create-payable-rate-list-badge">✓ Rates from Master List</span> */}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : payableType === 'supplier' ? (
                  <div className="create-payable-card">
                    <h3 className="create-payable-card-title">Supplier Information</h3>
                    <div className="create-payable-field">
                      <label className="create-payable-label">
                        Select Supplier <span className="create-payable-required">*</span>
                      </label>
                      <select
                        className="create-payable-select"
                        value={formData.payeeId}
                        onChange={(e) => {
                          const supplier = suppliers.find(s => s.id === e.target.value);
                          setFormData({
                            ...formData,
                            payeeId: e.target.value,
                            payeeName: supplier?.name || '',
                            category: 'Raw Material',
                            description: supplier ? `Payment for ${supplier.material}` : ''
                          });
                        }}
                        required
                      >
                        <option value="">Choose Supplier</option>
                        {suppliers.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name} - {s.material}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="create-payable-card">
                    <h3 className="create-payable-card-title">Payee Information</h3>
                    <div className="create-payable-field">
                      <label className="create-payable-label">
                        Payee Name <span className="create-payable-required">*</span>
                      </label>
                      <input
                        type="text"
                        name="payeeName"
                        className="create-payable-input"
                        value={formData.payeeName}
                        onChange={handleInputChange}
                        placeholder="Enter payee name"
                        required
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column - Shade Selection Area with Lot Numbers */}
              <div className="create-payable-right-column">
                {payableType === 'karigar' && (
                  <>
                    {Object.keys(shadeWiseLots).length > 0 ? (
                      <>
                        {/* Completed Work Summary */}
                        <div className="create-payable-completed-summary">
                          <span className="create-payable-completed-summary-icon">✅</span>
                          <span className="create-payable-completed-summary-text">
                            Showing {Object.keys(shadeWiseLots).length} shade(s) with completed work
                          </span>
                          <span className="create-payable-completed-lots-count">
                            Total {Object.values(shadeWiseLots).reduce((sum, s) => sum + s.lots.length, 0)} completed lots
                          </span>
                        </div>

                        <div className="create-payable-card">
                          <div className="create-payable-card-header">
                            <h3 className="create-payable-card-title">Completed Work by Shade</h3>
                            <button
                              type="button"
                              onClick={handleSelectAllShades}
                              className="create-payable-select-all-button"
                            >
                              {selectedShades.length === Object.keys(shadeWiseLots).length 
                                ? 'Deselect All' 
                                : 'Select All'
                              }
                            </button>
                          </div>

                          <div className="create-payable-shade-list">
                            {Object.entries(shadeWiseLots).map(([shade, data]) => (
                              <div key={shade} className="create-payable-shade-item-wrapper">
                                <div
                                  className={`create-payable-shade-item ${
                                    selectedShades.includes(shade) ? 'selected' : ''
                                  } ${expandedShade === shade ? 'expanded' : ''}`}
                                >
                                  <div className="create-payable-shade-item-header" onClick={() => toggleShadeExpand(shade)}>
                                    <input
                                      type="checkbox"
                                      checked={selectedShades.includes(shade)}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        handleShadeSelection(shade);
                                      }}
                                      className="create-payable-shade-checkbox"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    <span className="create-payable-shade-name">{shade}</span>
                                    <span className="create-payable-completed-badge">✓ {data.lots.length} Lots</span>
                                    <span className="create-payable-lot-numbers-preview">
                                      {data.lotNumbers.slice(0, 2).join(', ')}
                                      {data.lotNumbers.length > 2 && ` +${data.lotNumbers.length - 2} more`}
                                    </span>
                                    <span className="create-payable-expand-icon">
                                      {expandedShade === shade ? '▼' : '▶'}
                                    </span>
                                  </div>
                                  
                                  <div className="create-payable-shade-details">
                                    <span>Total Lots: {data.lotNumbers.join(', ')}</span>
                                  </div>

                                  {/* Lot Selection Section */}
                                  {expandedShade === shade && (
                                    <div className="create-payable-lot-selection-section">
                                      <div className="create-payable-lot-selection-header">
                                        <span className="create-payable-lot-selection-title">Select Lots:</span>
                                        <button
                                          type="button"
                                          onClick={() => handleSelectAllLots(shade)}
                                          className="create-payable-select-all-lots-button"
                                        >
                                          {selectedLots[shade]?.length === data.lots.length 
                                            ? 'Deselect All' 
                                            : 'Select All'
                                          }
                                        </button>
                                      </div>
                                      <div className="create-payable-lot-checkbox-list">
                                        {data.lots.map((lot) => (
                                          <label key={lot.lotNumber} className="create-payable-lot-checkbox-item">
                                            <input
                                              type="checkbox"
                                              checked={selectedLots[shade]?.includes(lot.lotNumber) || false}
                                              onChange={() => handleLotSelection(shade, lot.lotNumber)}
                                              className="create-payable-lot-checkbox"
                                            />
                                            <span className="create-payable-lot-checkbox-label">
                                              <strong>Lot {lot.lotNumber}</strong> - 
                                              Qty: {lot.completedQuantity || lot.quantity} pcs @ 
                                              ₹{lot.rate.toFixed(2)} = ₹{lot.totalAmount.toFixed(2)}
                                              <span className="create-payable-lot-checkbox-details">
                                                <br/>
                                                <small>
                                                  {lot.brand} | {lot.fabric} | {lot.style}
                                                </small>
                                              </span>
                                            </span>
                                          </label>
                                        ))}
                                      </div>

                                      {/* Rate Information Summary */}
                                      <div className="create-payable-rate-info">
                                        <span className="create-payable-rate-label">Rate from list: </span>
                                        <span className="create-payable-rate-value">₹{data.rateInfo?.rate?.toFixed(2) || '0.00'}/pc</span>
                                        {data.rateInfo?.source === 'assignment' && (
                                          <span className="create-payable-rate-source">(using default rate)</span>
                                        )}
                                        {data.rateInfo?.source === 'rateList' && (
                                          <span className="create-payable-rate-source-success">(from master list)</span>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Selected Summary */}
                          {Object.keys(selectedLots).length > 0 && (
                            <div className="create-payable-selected-summary">
                              <div className="create-payable-selected-summary-row">
                                <span>Selected Lots: {
                                  Object.values(selectedLots).reduce((sum, lots) => sum + lots.length, 0)
                                }</span>
                                <span>Total Qty: {calculateTotalQuantity()}</span>
                                <span className="create-payable-selected-total">
                                  ₹{calculateTotalAmount().toLocaleString()}
                                </span>
                              </div>
                              
                              <button
                                type="button"
                                onClick={handleCreatePayment}
                                className="create-payable-create-payment-button"
                              >
                                Create Payment for Selected Lots
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    ) : selectedKarigar && (
                      <div className="create-payable-no-completed-work">
                        <span className="create-payable-no-work-icon">📭</span>
                        <h3 className="create-payable-no-work-title">No Completed Work Found</h3>
                        <p className="create-payable-no-work-text">
                          No completed lots found for this karigar. 
                          This could be because:
                        </p>
                        <ul className="create-payable-no-work-list">
                          <li>The lots are not marked as "Completed" in the status column</li>
                          <li>The karigar ID doesn't match exactly</li>
                          <li>There are no assignments for this karigar</li>
                        </ul>
                        <div className="create-payable-status-example">
                          <span className="create-payable-status-example-title">Required status:</span>
                          <span className="create-payable-status-badge-example">status = "completed"</span>
                        </div>
                        <button 
                          className="create-payable-refresh-button"
                          onClick={() => {
                            loadKarigarAssignments();
                            loadKarigarProfiles();
                          }}
                        >
                          🔄 Refresh Data
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Payment Details Section */}
            {(formData.payeeName || Object.keys(selectedLots).length > 0) && (
              <form onSubmit={submitPayable} className="create-payable-payment-section">
                <h2 className="create-payable-section-title">Payment Details</h2>
                
                <div className="create-payable-payment-grid">
                  {/* Left Column - Basic Details */}
                  <div className="create-payable-payment-column">
                    <div className="create-payable-field-row">
                      <div className="create-payable-field">
                        <label className="create-payable-label">Amount (₹) <span className="create-payable-required">*</span></label>
                        <input
                          type="number"
                          name="amount"
                          className="create-payable-input"
                          value={formData.amount}
                          onChange={handleInputChange}
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          required
                        />
                      </div>
                      <div className="create-payable-field">
                        <label className="create-payable-label">Due Date <span className="create-payable-required">*</span></label>
                        <input
                          type="date"
                          name="dueDate"
                          className="create-payable-input"
                          value={formData.dueDate}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                    </div>

                    <div className="create-payable-field-row">
                      <div className="create-payable-field">
                        <label className="create-payable-label">Category</label>
                        <select
                          name="category"
                          className="create-payable-select"
                          value={formData.category}
                          onChange={handleInputChange}
                        >
                          <option value="">Select category</option>
                          {payableType === 'karigar' && (
                            <>
                              <option value="Wages">Wages</option>
                              <option value="Advance">Advance</option>
                            </>
                          )}
                          {payableType === 'supplier' && (
                            <>
                              <option value="Raw Material">Raw Material</option>
                              <option value="Accessories">Accessories</option>
                              <option value="Packaging">Packaging</option>
                            </>
                          )}
                          {payableType === 'operational' && (
                            <>
                              <option value="Utilities">Utilities</option>
                              <option value="Rent">Rent</option>
                              <option value="Transport">Transport</option>
                            </>
                          )}
                        </select>
                      </div>
                      <div className="create-payable-field">
                        <label className="create-payable-label">Reference No.</label>
                        <input
                          type="text"
                          name="reference"
                          className="create-payable-input"
                          value={formData.reference}
                          onChange={handleInputChange}
                          placeholder="INV-001"
                        />
                      </div>
                    </div>

                    <div className="create-payable-field-row">
                      <div className="create-payable-field">
                        <label className="create-payable-label">Status</label>
                        <select
                          name="status"
                          className="create-payable-select"
                          value={formData.status}
                          onChange={handleInputChange}
                        >
                          <option value="pending">Pending</option>
                          <option value="paid">Paid</option>
                        </select>
                      </div>
                      {formData.status === 'paid' && (
                        <div className="create-payable-field">
                          <label className="create-payable-label">Payment Date</label>
                          <input
                            type="date"
                            name="paymentDate"
                            className="create-payable-input"
                            value={formData.paymentDate}
                            onChange={handleInputChange}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column - Description */}
                  <div className="create-payable-payment-column">
                    <div className="create-payable-field">
                      <label className="create-payable-label">Description</label>
                      <textarea
                        name="description"
                        className="create-payable-textarea"
                        value={formData.description}
                        onChange={handleInputChange}
                        placeholder="Enter payment description..."
                        rows="4"
                      />
                    </div>
                    
                    <div className="create-payable-field">
                      <label className="create-payable-label">Notes</label>
                      <textarea
                        name="notes"
                        className="create-payable-textarea"
                        value={formData.notes}
                        onChange={handleInputChange}
                        placeholder="Additional notes..."
                        rows="4"
                      />
                    </div>
                  </div>
                </div>

                {/* Form Actions */}
                <div className="create-payable-form-actions">
                  <button type="button" className="create-payable-cancel-button" onClick={resetForm}>
                    Clear Form
                  </button>
                  <button type="submit" className="create-payable-submit-button" disabled={submitting}>
                    {submitting ? (
                      <>
                        <span className="create-payable-spinner"></span>
                        Creating...
                      </>
                    ) : (
                      <>
                        <span>✓</span>
                        Create & Generate Slip
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          /* View Module - Keep existing view module code */
          <div className="create-payable-module-content">
            {/* Filters */}
            <div className="create-payable-filters-bar">
              <div className="create-payable-search-box">
                <span className="create-payable-search-icon">🔍</span>
                <input
                  type="text"
                  className="create-payable-search-input"
                  placeholder="Search payables..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <select
                className="create-payable-filter-select"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>

              <div className="create-payable-date-range">
                <input
                  type="date"
                  className="create-payable-date-input"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                />
                <span className="create-payable-date-separator">→</span>
                <input
                  type="date"
                  className="create-payable-date-input"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                />
              </div>
            </div>

            {/* Stats Cards */}
            <div className="create-payable-stats-grid">
              <div className="create-payable-stat-card">
                <div className="create-payable-stat-icon">💰</div>
                <div className="create-payable-stat-info">
                  <span className="create-payable-stat-label">Total Payables</span>
                  <span className="create-payable-stat-value">₹{totals.total.toLocaleString()}</span>
                </div>
              </div>
              <div className="create-payable-stat-card">
                <div className="create-payable-stat-icon">⏳</div>
                <div className="create-payable-stat-info">
                  <span className="create-payable-stat-label">Pending</span>
                  <span className="create-payable-stat-value">₹{totals.pending.toLocaleString()}</span>
                </div>
              </div>
              <div className="create-payable-stat-card">
                <div className="create-payable-stat-icon">✅</div>
                <div className="create-payable-stat-info">
                  <span className="create-payable-stat-label">Paid</span>
                  <span className="create-payable-stat-value">₹{totals.paid.toLocaleString()}</span>
                </div>
              </div>
              <div className="create-payable-stat-card">
                <div className="create-payable-stat-icon">⚠️</div>
                <div className="create-payable-stat-info">
                  <span className="create-payable-stat-label">Overdue</span>
                  <span className="create-payable-stat-value">₹{totals.overdue.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Table */}
            {loading ? (
              <div className="create-payable-loading-state">
                <div className="create-payable-spinner"></div>
                <p>Loading payables...</p>
              </div>
            ) : (
              <div className="create-payable-table-container">
                <table className="create-payable-table">
                  <thead>
                    <tr>
                      <th className="create-payable-th">ID</th>
                      <th className="create-payable-th">Type</th>
                      <th className="create-payable-th">Payee</th>
                      <th className="create-payable-th">Amount</th>
                      <th className="create-payable-th">Due Date</th>
                      <th className="create-payable-th">Status</th>
                      <th className="create-payable-th">Category</th>
                      <th className="create-payable-th">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayables.length > 0 ? (
                      filteredPayables.map(payable => {
                        const statusColor = getStatusColor(payable.status);
                        return (
                          <tr key={payable.id} className="create-payable-tr">
                            <td className="create-payable-td">
                              <span className="create-payable-payable-id">{payable.payableId}</span>
                            </td>
                            <td className="create-payable-td">
                              <span className="create-payable-type-cell">{getTypeIcon(payable.payableType)}</span>
                            </td>
                            <td className="create-payable-td">
                              <span className="create-payable-payee-name">{payable.payeeName}</span>
                            </td>
                            <td className="create-payable-td">
                              <span className="create-payable-amount">₹{payable.amount?.toLocaleString()}</span>
                            </td>
                            <td className="create-payable-td">
                              <span className="create-payable-date">
                                {new Date(payable.dueDate).toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                              </span>
                            </td>
                            <td className="create-payable-td">
                              <span className="create-payable-status-badge" style={{backgroundColor: statusColor.bg, color: statusColor.text}}>
                                <span className="create-payable-status-dot" style={{backgroundColor: statusColor.dot}}></span>
                                {payable.status}
                              </span>
                            </td>
                            <td className="create-payable-td">
                              <span className="create-payable-category">{payable.category || '—'}</span>
                            </td>
                            <td className="create-payable-td">
                              <button
                                className="create-payable-view-button"
                                onClick={() => {
                                  setSelectedPayable(payable);
                                  setShowDetailsModal(true);
                                }}
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="8" className="create-payable-empty-state">
                          <span className="create-payable-empty-icon">📭</span>
                          <p className="create-payable-empty-text">No payables found</p>
                          <span className="create-payable-empty-subtext">Try adjusting your filters</span>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Payment Slip Modal */}
      {showPaymentSlipModal && paymentSlipData && (
        <div className="create-payable-modal-overlay" onClick={() => setShowPaymentSlipModal(false)}>
          <div className="create-payable-modal create-payable-payment-slip-modal" onClick={e => e.stopPropagation()}>
            <div className="create-payable-modal-header">
              <h3 className="create-payable-modal-title">Download Payment Slip</h3>
              <button className="create-payable-modal-close" onClick={() => setShowPaymentSlipModal(false)}>✕</button>
            </div>
            <div className="create-payable-modal-content">
              {!paymentSlipData.saveSuccess && (
                <div className="create-payable-payment-slip-warning">
                  ⚠️ Payment was not saved to database. You can still download the slip.
                </div>
              )}
              
              <p style={{marginBottom: '20px', color: '#4B5563'}}>
                Payment slip has been generated successfully. Choose download option:
              </p>
              
              <div className="create-payable-payment-slip-buttons">
                <button
                  className="create-payable-submit-button create-payable-payment-slip-button"
                  onClick={() => {
                    downloadPaymentSlip(paymentSlipData.payable, paymentSlipData.lots);
                    setShowPaymentSlipModal(false);
                  }}
                >
                  📄 Download as HTML
                </button>
                
                <button
                  className="create-payable-submit-button create-payable-payment-slip-button create-payable-payment-slip-button-pdf"
                  onClick={() => {
                    downloadPaymentSlipAsPDF(paymentSlipData.payable, paymentSlipData.lots);
                    setShowPaymentSlipModal(false);
                  }}
                >
                  📑 Download as PDF (Print)
                </button>
                
                <button
                  className="create-payable-cancel-button"
                  onClick={() => setShowPaymentSlipModal(false)}
                >
                  Close
                </button>
              </div>

              <div className="create-payable-payment-slip-summary">
                <strong>Payment Summary:</strong><br/>
                Payee: {paymentSlipData.payable.payeeName}<br/>
                Amount: ₹{paymentSlipData.totalAmount.toLocaleString()}<br/>
                Selected Lots: {paymentSlipData.lots.reduce((sum, shade) => sum + shade.lots.length, 0)}<br/>
                Total Qty: {paymentSlipData.totalQuantity}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedPayable && (
        <div className="create-payable-modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="create-payable-modal" onClick={e => e.stopPropagation()}>
            <div className="create-payable-modal-header">
              <h3 className="create-payable-modal-title">Payable Details</h3>
              <button className="create-payable-modal-close" onClick={() => setShowDetailsModal(false)}>✕</button>
            </div>
            <div className="create-payable-modal-content">
              <div className="create-payable-detail-row">
                <span className="create-payable-detail-label">Payable ID</span>
                <span className="create-payable-detail-value">{selectedPayable.payableId}</span>
              </div>
              <div className="create-payable-detail-row">
                <span className="create-payable-detail-label">Type</span>
                <span className="create-payable-detail-value">{selectedPayable.payableType}</span>
              </div>
              <div className="create-payable-detail-row">
                <span className="create-payable-detail-label">Payee</span>
                <span className="create-payable-detail-value">{selectedPayable.payeeName}</span>
              </div>
              <div className="create-payable-detail-row">
                <span className="create-payable-detail-label">Amount</span>
                <span className="create-payable-detail-value" style={{fontWeight: '700', color: '#059669'}}>
                  ₹{selectedPayable.amount?.toLocaleString()}
                </span>
              </div>
              <div className="create-payable-detail-row">
                <span className="create-payable-detail-label">Due Date</span>
                <span className="create-payable-detail-value">{new Date(selectedPayable.dueDate).toLocaleDateString()}</span>
              </div>
              <div className="create-payable-detail-row">
                <span className="create-payable-detail-label">Status</span>
                <span className="create-payable-status-badge" style={{
                  backgroundColor: getStatusColor(selectedPayable.status).bg,
                  color: getStatusColor(selectedPayable.status).text
                }}>
                  <span className="create-payable-status-dot" style={{ backgroundColor: getStatusColor(selectedPayable.status).dot }}></span>
                  {selectedPayable.status}
                </span>
              </div>
              <div className="create-payable-detail-row">
                <span className="create-payable-detail-label">Category</span>
                <span className="create-payable-detail-value">{selectedPayable.category || '—'}</span>
              </div>
              {selectedPayable.description && (
                <div className="create-payable-detail-row">
                  <span className="create-payable-detail-label">Description</span>
                  <span className="create-payable-detail-value">{selectedPayable.description}</span>
                </div>
              )}
              {selectedPayable.reference && (
                <div className="create-payable-detail-row">
                  <span className="create-payable-detail-label">Reference</span>
                  <span className="create-payable-detail-value">{selectedPayable.reference}</span>
                </div>
              )}
              <div className="create-payable-detail-row">
                <span className="create-payable-detail-label">Created By</span>
                <span className="create-payable-detail-value">{selectedPayable.createdBy}</span>
              </div>
              <div className="create-payable-detail-row">
                <span className="create-payable-detail-label">Created At</span>
                <span className="create-payable-detail-value">{new Date(selectedPayable.createdAt).toLocaleString()}</span>
              </div>
            </div>
            <div className="create-payable-modal-footer">
              <button className="create-payable-modal-button" onClick={() => setShowDetailsModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}