import React, { useState, useEffect } from 'react';
import './UpdateCompletionLot.css';

const UpdateCompletionLot = () => {
  const [sheetData, setSheetData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [updateStatus, setUpdateStatus] = useState('');
  const [filterText, setFilterText] = useState('');
  const [filterColumn, setFilterColumn] = useState('all');
  const [supervisors, setSupervisors] = useState([]);
  const [selectedSupervisor, setSelectedSupervisor] = useState('');
  const [loadingSupervisors, setLoadingSupervisors] = useState(false);
  const [showAllSupervisors, setShowAllSupervisors] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Google Sheets API configuration
  const API_KEY = 'AIzaSyAomDFBkOySlIxKWSKGHe6ATv9gvaBr7uk';
  const SPREADSHEET_ID = '17qqixpHOXvG1U3RlRwaHON5JCkugpy4RIu5N9zR9ScM';
  const KARIGAR_SPREADSHEET_ID = '17qqixpHOXvG1U3RlRwaHON5JCkugpy4RIu5N9zR9ScM';
  const KARIGAR_SHEET_NAME = 'KarigarProfiles';
  const RANGE = 'KarigarAssignments!A:N';
  
  // Replace with your new AppScript URL after deployment
  const APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbygeFp8lxPQPsmnb5skkmxGpJbaEi1iU2Go6B2DJmts_GW5WygyENZhYP_37thFyLJP/exec';

  const columns = [
    'Timestamp',
    'Lot Number',
    'Brand',
    'Fabric',
    'Style',
    'Garment Type',
    'Shade',
    'Karigar Name',
    'Karigar ID',
    'Saved By',
    'Supervisor',
    'Saved At',
    'Status'
  ];

  useEffect(() => {
    fetchSheetData();
    fetchSupervisors();
  }, []);

  const fetchSheetData = async () => {
    try {
      setLoading(true);
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?key=${API_KEY}`;
      const response = await fetch(url);
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      
      if (data.values && data.values.length > 0) {
        const headers = data.values[0];
        const rows = data.values.slice(1).map((row, index) => {
          const rowObject = {
            id: index,
            // CRITICAL: rowIndex must be the actual sheet row number (header is row 1, data starts at row 2)
            rowIndex: index + 2,
          };
          
          headers.forEach((header, colIndex) => {
            rowObject[header] = row[colIndex] || '';
          });
          
          // Set completed status based on the Status column
          rowObject.completed = rowObject['Status']?.toLowerCase() === 'completed';
          
          return rowObject;
        });
        setSheetData(rows);
        console.log('Total rows loaded:', rows.length);
        console.log('Sample row:', rows[0]);
      }
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const fetchSupervisors = async () => {
    setLoadingSupervisors(true);
    try {
      const sheetNameEncoded = encodeURIComponent(KARIGAR_SHEET_NAME);
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${KARIGAR_SPREADSHEET_ID}/values/${sheetNameEncoded}?key=${API_KEY}`;
      const response = await fetch(url);
      
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      
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
                type: supervisorType || 'Supervisor',
                initial: normalizedName.charAt(0)
              });
            }
          }
        });
        
        const uniqueSupervisors = Array.from(supervisorMap.values())
          .sort((a, b) => a.name.localeCompare(b.name));
        
        setSupervisors(uniqueSupervisors);
      }
    } catch (err) {
      console.error('Error fetching supervisors:', err);
      setUpdateStatus(`Error fetching supervisors: ${err.message}`);
    } finally {
      setLoadingSupervisors(false);
    }
  };

 
const updateSheetViaAppScript = async (rowsToUpdate) => {
  try {
    console.log('Rows to update:', rowsToUpdate);
    
    // Get current date/time in the format matching your sheet
    const now = new Date();
    const completionDateTime = now.toLocaleString('en-IN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).replace(/\//g, '-'); // Format: DD-MM-YYYY HH:MM:SS

    // Create payload with completion date/time
    let payload;
    
    if (rowsToUpdate.length === 1) {
      // Single row update
      payload = {
        action: 'updateSingleCompletionStatus',
        rowIndex: rowsToUpdate[0].rowIndex,
        status: 'Completed',
        completionDateTime: completionDateTime
      };
    } else {
      // Multiple rows update
      payload = {
        action: 'updateCompletionStatus',
        rows: rowsToUpdate.map(row => ({
          rowIndex: row.rowIndex,
          status: 'Completed',
          completionDateTime: completionDateTime
        }))
      };
    }

    console.log('Sending payload:', payload);

    // Send as JSON
    const response = await fetch(APP_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors', // Keep this if it was working before
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    console.log('Request sent successfully');
    return { success: true };

  } catch (err) {
    console.error('Error updating sheet:', err);
    throw err;
  }
};
  const handleRowSelect = (rowId) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(rowId)) {
      newSelected.delete(rowId);
    } else {
      newSelected.add(rowId);
    }
    setSelectedRows(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedRows.size === filteredData.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredData.map(row => row.id)));
    }
  };

const handleIndividualComplete = async (rowId) => {
  setIsUpdating(true);
  setUpdateStatus('Updating Google Sheet...');

  try {
    const row = sheetData.find(r => r.id === rowId);
    
    if (!row) {
      throw new Error(`Row with id ${rowId} not found`);
    }
    
    // CRITICAL: Ensure rowIndex is set correctly
    const rowIndex = row.rowIndex || (row.id + 2);
    
    console.log('Individual row to update:', {
      id: row.id,
      rowIndex: rowIndex,
      lotNumber: row['Lot Number']
    });
    
    // Create a clean object with only the data we need
    const updateData = {
      rowIndex: rowIndex,
      status: 'Completed'
    };
    
    const result = await updateSheetViaAppScript([updateData]);
    console.log('Update result:', result);
    
    // Update local state
    const updatedSheetData = sheetData.map(r => {
      if (r.id === rowId) {
        return { ...r, completed: true, Status: 'Completed' };
      }
      return r;
    });
    
    setSheetData(updatedSheetData);
    setUpdateStatus('✅ Successfully marked lot as completed!');
    
    // Refresh data after delay
    setTimeout(() => {
      fetchSheetData();
      setUpdateStatus('');
    }, 2000);
    
  } catch (err) {
    console.error('Individual update error:', err);
    setUpdateStatus(`❌ Error: ${err.message}`);
  } finally {
    setIsUpdating(false);
  }
};

const handleUpdateCompletion = async () => {
  if (selectedRows.size === 0) {
    setUpdateStatus('Please select at least one row to update');
    return;
  }

  setIsUpdating(true);
  setUpdateStatus('Updating Google Sheet...');

  try {
    const selectedRowsData = sheetData.filter(row => selectedRows.has(row.id));
    
    // Create clean update objects
    const updateData = selectedRowsData.map(row => ({
      rowIndex: row.rowIndex || (row.id + 2),
      status: 'Completed'
    }));
    
    console.log('Bulk update data:', updateData);
    
    const result = await updateSheetViaAppScript(updateData);
    console.log('Bulk update result:', result);
    
    // Update local state
    const updatedSheetData = sheetData.map(row => {
      if (selectedRows.has(row.id)) {
        return { ...row, completed: true, Status: 'Completed' };
      }
      return row;
    });
    
    setSheetData(updatedSheetData);
    setUpdateStatus(`✅ Successfully marked ${selectedRows.size} lot(s) as completed!`);
    setSelectedRows(new Set());
    
    // Refresh data after delay
    setTimeout(() => {
      fetchSheetData();
      setUpdateStatus('');
    }, 2000);
    
  } catch (err) {
    console.error('Bulk update error:', err);
    setUpdateStatus(`❌ Error: ${err.message}`);
  } finally {
    setIsUpdating(false);
  }
};
  const handleSupervisorSelect = (supervisor) => {
    setSelectedSupervisor(supervisor.name);
    setShowAllSupervisors(false);
    setUpdateStatus(`Filtering by supervisor: ${supervisor.name}`);
  };

  const clearSupervisorFilter = () => {
    setSelectedSupervisor('');
    setUpdateStatus('');
  };

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const filteredData = sheetData.filter(row => {
    if (selectedSupervisor) {
      const rowSupervisor = row['Supervisor'] || '';
      const normalizedRowSupervisor = rowSupervisor
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (normalizedRowSupervisor !== selectedSupervisor) return false;
    }
    
    if (!filterText) return true;
    
    if (filterColumn === 'all') {
      return Object.values(row).some(value => 
        String(value).toLowerCase().includes(filterText.toLowerCase())
      );
    } else {
      return String(row[filterColumn] || '').toLowerCase().includes(filterText.toLowerCase());
    }
  });

  const displayedSupervisors = showAllSupervisors ? supervisors : supervisors.slice(0, 5);

  if (loading) {
    return (
      <div className="ucl-loading-state">
        <div className="ucl-loading-content">
          <div className="ucl-spinner"></div>
          <p>Loading your data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ucl-error-state">
        <div className="ucl-error-content">
          <div className="ucl-error-icon">⚠️</div>
          <h3>Oops! Something went wrong</h3>
          <p>{error}</p>
          <button onClick={fetchSheetData} className="ucl-retry-btn">
            <span>↻</span> Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ucl-update-completion-lot">
      <div className="ucl-main-card">
        {/* Gradient Header */}
        <div className="ucl-gradient-header">
          <div className="ucl-header-content">
            <div className="ucl-title-section">
              <h1>UPDATE COMPLETION LOT AS PER SHADES</h1>
              <p>
                <span>📋</span>
                Track and manage lot completions
              </p>
            </div>
            <div className="ucl-stats-grid">
              <div className="ucl-stat-circle">
                <span className="ucl-stat-icon">📦</span>
                <div className="ucl-stat-info">
                  <h3>Total Lots</h3>
                  <span>{sheetData.length}</span>
                </div>
              </div>
              <div className="ucl-stat-circle">
                <span className="ucl-stat-icon">✅</span>
                <div className="ucl-stat-info">
                  <h3>Selected</h3>
                  <span>{selectedRows.size}</span>
                </div>
              </div>
              <div className="ucl-stat-circle">
                <span className="ucl-stat-icon">✓</span>
                <div className="ucl-stat-info">
                  <h3>Completed</h3>
                  <span>{sheetData.filter(row => row.completed).length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="ucl-search-bar">
          <div className="ucl-search-wrapper">
            <span className="ucl-search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search lots, karigars, brands..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="ucl-search-input"
              disabled={isUpdating}
            />
          </div>
          <select 
            value={filterColumn} 
            onChange={(e) => setFilterColumn(e.target.value)}
            className="ucl-filter-select"
            disabled={isUpdating}
          >
            <option value="all">All Columns</option>
            {columns.map(col => (
              <option key={col} value={col}>{col}</option>
            ))}
          </select>
        </div>

        {/* Supervisor Section */}
        <div className="ucl-supervisor-section">
          <div className="ucl-section-title">
            <h2>👥 Filter by Supervisor</h2>
            <span>{supervisors.length} available</span>
          </div>
          
          <div className="ucl-supervisor-grid">
            {displayedSupervisors.map((supervisor, index) => (
              <div
                key={index}
                className={`ucl-supervisor-card ${selectedSupervisor === supervisor.name ? 'active' : ''} ${isUpdating ? 'disabled' : ''}`}
                onClick={() => !isUpdating && handleSupervisorSelect(supervisor)}
              >
                <div className="ucl-supervisor-avatar">
                  {getInitials(supervisor.name)}
                </div>
                <div className="ucl-supervisor-info">
                  <h3>{supervisor.name}</h3>
                  <p>
                    <span>👤</span>
                    {supervisor.type}
                    <span className="ucl-supervisor-badge">Active</span>
                  </p>
                </div>
              </div>
            ))}
            {!showAllSupervisors && supervisors.length > 5 && (
              <div 
                className={`ucl-supervisor-card ucl-more-card ${isUpdating ? 'disabled' : ''}`} 
                onClick={() => !isUpdating && setShowAllSupervisors(true)}
              >
                <div className="ucl-supervisor-avatar" style={{ background: '#b8d1f0' }}>
                  +{supervisors.length - 5}
                </div>
                <div className="ucl-supervisor-info">
                  <h3>View All</h3>
                  <p>{supervisors.length - 5} more supervisors</p>
                </div>
              </div>
            )}
            {showAllSupervisors && supervisors.length > 5 && (
              <div 
                className={`ucl-supervisor-card ucl-more-card ${isUpdating ? 'disabled' : ''}`} 
                onClick={() => !isUpdating && setShowAllSupervisors(false)}
              >
                <div className="ucl-supervisor-avatar" style={{ background: '#2a5298' }}>
                  ↑
                </div>
                <div className="ucl-supervisor-info">
                  <h3>Show Less</h3>
                  <p>Collapse list</p>
                </div>
              </div>
            )}
          </div>

          {selectedSupervisor && (
            <div className="ucl-active-filter">
              <div className="ucl-filter-tag">
                <span className="ucl-filter-label">Active Filter:</span>
                <span className="ucl-filter-value">
                  <span>👤</span>
                  {selectedSupervisor}
                </span>
                <span className="ucl-filter-count">
                  {filteredData.length} lots found
                </span>
              </div>
              <button onClick={clearSupervisorFilter} className="ucl-clear-filter" disabled={isUpdating}>
                <span>✕</span> Clear Filter
              </button>
            </div>
          )}
        </div>

        {/* Action Bar */}
        <div className="ucl-action-bar">
          <div className="ucl-selected-info">
            <div className="ucl-selected-badge">
              <span>✓</span>
              {selectedRows.size} Selected
            </div>
            <button 
              onClick={handleSelectAll} 
              className="ucl-select-all-btn"
              disabled={isUpdating || filteredData.length === 0}
            >
              {selectedRows.size === filteredData.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          
          <button 
            onClick={handleUpdateCompletion} 
            className="ucl-mark-complete-btn"
            disabled={selectedRows.size === 0 || isUpdating}
          >
            {isUpdating ? (
              <>
                <span className="ucl-spinner-small"></span>
                Updating...
              </>
            ) : (
              <>
                <span>✓</span>
                Mark Selected as Completed
              </>
            )}
          </button>
        </div>

        {/* Status Toast */}
        {updateStatus && (
          <div className={`ucl-status-toast ${updateStatus.includes('❌') ? 'error' : updateStatus.includes('✅') ? 'success' : 'info'}`}>
            <span>{updateStatus}</span>
          </div>
        )}

        {/* Modern Table */}
        <div className="ucl-table-wrapper">
          <table className="ucl-modern-table">
            <thead>
              <tr>
                <th style={{ width: '50px' }}></th>
                {columns.map(column => (
                  <th key={column}>{column}</th>
                ))}
                <th style={{ width: '150px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 2} className="ucl-empty-state">
                    <div className="ucl-empty-content">
                      <span className="ucl-empty-icon">📭</span>
                      <h3>No lots found</h3>
                      <p>
                        {selectedSupervisor 
                          ? `No lots assigned to ${selectedSupervisor}`
                          : 'Try adjusting your search or filter'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredData.map((row) => (
                  <tr 
                    key={row.id} 
                    className={`${selectedRows.has(row.id) ? 'selected' : ''} ${row.completed ? 'completed-row' : ''}`}
                  >
                    <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
                      <div 
                        className={`ucl-custom-checkbox ${selectedRows.has(row.id) ? 'checked' : ''} ${row.completed ? 'disabled' : ''}`}
                        onClick={() => !row.completed && !isUpdating && handleRowSelect(row.id)}
                      >
                        {selectedRows.has(row.id) && <span>✓</span>}
                      </div>
                    </td>
                    {columns.map(column => (
                      <td key={`${row.id}-${column}`}>
                        {column === 'Lot Number' ? (
                          <span className="ucl-lot-badge">#{row[column] || '-'}</span>
                        ) : column === 'Shade' ? (
                          <span className="ucl-shade-pill">{row[column] || '-'}</span>
                        ) : column === 'Supervisor' ? (
                          <span className="ucl-supervisor-badge-cell">
                            {row[column] || '-'}
                          </span>
                        ) : column === 'Karigar Name' ? (
                          <span className="ucl-karigar-name">
                            <span className="ucl-name-icon">👤</span>
                            {row[column] || '-'}
                          </span>
                        ) : column === 'Status' ? (
                          <span className={`ucl-status-indicator ${row[column]?.toLowerCase() === 'completed' ? 'completed' : 'pending'}`}>
                            {row[column] || 'Pending'}
                          </span>
                        ) : (
                          row[column] || '-'
                        )}
                      </td>
                    ))}
                    <td>
                      <button
                        className={`ucl-complete-btn ${row.completed ? 'completed' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleIndividualComplete(row.id);
                        }}
                        disabled={row.completed || isUpdating}
                      >
                        {isUpdating ? (
                          <span className="ucl-spinner-small"></span>
                        ) : row.completed ? (
                          <>✓ Completed</>
                        ) : (
                          <>✓ Complete</>
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="ucl-table-footer">
          <div className="ucl-footer-info">
            Showing {filteredData.length} of {sheetData.length} lots
          </div>
          <div className="ucl-footer-actions">
            <button 
              className="ucl-footer-btn" 
              onClick={fetchSheetData}
              disabled={isUpdating}
            >
              <span>↻</span> Refresh
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpdateCompletionLot;