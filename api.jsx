// src/Dashboard.jsx (Updated with individual edits always enabled and revert functionality)
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useHistory } from 'react-router-dom'; // For older React Router

// Custom Input Component to handle React reconciliation issues
const CommentInput = ({ value, onChange, placeholder, rowUniqueId, isDisabled }) => {
  const inputRef = useRef(null);
  
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.value = value || '';
    }
  }, [value, rowUniqueId]);

  return (
    <input
      ref={inputRef}
      type="text"
      defaultValue={value || ''}
      onChange={onChange}
      placeholder={placeholder}
      disabled={isDisabled}
      style={{
        width: '100%',
        padding: '4px',
        border: '1px solid #ccc',
        borderRadius: '2px',
        boxSizing: 'border-box',
        backgroundColor: isDisabled ? '#f0f0f0' : 'white',
        cursor: isDisabled ? 'not-allowed' : 'text'
      }}
    />
  );
};

// Custom Dropdown Component for Decision
const DecisionDropdown = ({ value, onChange, rowUniqueId, isDisabled }) => {
  const dropdownRef = useRef(null);
  
  useEffect(() => {
    if (dropdownRef.current) {
      dropdownRef.current.value = value || '';
    }
  }, [value, rowUniqueId]);

  return (
    <select
      ref={dropdownRef}
      defaultValue={value || ''}
      onChange={onChange}
      disabled={isDisabled}
      style={{
        width: '100%',
        padding: '4px',
        border: '1px solid #ccc',
        borderRadius: '2px',
        boxSizing: 'border-box',
        backgroundColor: isDisabled ? '#f0f0f0' : 'white',
        cursor: isDisabled ? 'not-allowed' : 'pointer'
      }}
    >
      <option value="">Select Decision</option>
      <option value="No Change">No Change</option>
      <option value="Increase">Increase</option>
      <option value="Decrease">Decrease</option>
    </select>
  );
};

const Dashboard = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: 'Decision', direction: 'asc' }); // Default sort by Decision ascending
  const [selectedRows, setSelectedRows] = useState([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [bulkDecision, setBulkDecision] = useState('');
  const [bulkComment, setBulkComment] = useState('');
  const [error, setError] = useState('');
  const [searchFilters, setSearchFilters] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(200); // 200 records per page
  const [month, setMonth] = useState('October'); // Default to October
  const [changedRows, setChangedRows] = useState(new Set()); // Track changed rows by unique ID
  const [showLoading, setShowLoading] = useState(false); // Loading screen state
  const [selectAllChecked, setSelectAllChecked] = useState(false); // Track select all state
  const [originalData, setOriginalData] = useState([]); // Track original data for revert checks
  const location = useLocation(); // For older React Router
  const history = useHistory(); // For navigation

  // Available months
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Extract parameters from URL
  const getParamsFromUrl = () => {
    const searchParams = new URLSearchParams(location.search);
    const cluster = searchParams.get('cluster');
    const monthParam = searchParams.get('month');
    const category = searchParams.get('category');
    return { cluster, month: monthParam, category };
  };

  // Set month from URL parameter (with October as default)
  useEffect(() => {
    const params = getParamsFromUrl();
    setMonth(params.month || 'October'); // Default to October if no month in URL
  }, [location.search]);

  useEffect(() => {
    const fetchData = async () => {
      if (!month) return; // Don't fetch if no month is selected
      
      try {
        setLoading(true);
        setError('');
        
        // Get cluster and category from URL parameter
        const params = getParamsFromUrl();
        const clusterFromUrl = params.cluster;
        const categoryFromUrl = params.category;
        
        // Build API URL with month, cluster, and category parameters
        let apiUrl = `http://localhost:8000/excel-data?month=${encodeURIComponent(month)}`; // Replace with your API endpoint
        if (clusterFromUrl) {
          apiUrl += `&cluster=${encodeURIComponent(clusterFromUrl)}`;
        }
        if (categoryFromUrl) {
          apiUrl += `&category=${encodeURIComponent(categoryFromUrl)}`;
        }
        
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const jsonData = await response.json();
        
        // Add unique IDs to each row for proper tracking
        const dataWithIds = jsonData.map((row, index) => ({
          ...row,
          __uniqueId__: `${index}_${Date.now()}` // Create unique ID with timestamp
        }));
        
        setData(dataWithIds);
        setOriginalData(dataWithIds); // Store original data for revert checks
      } catch (error) {
        setError('Error loading data from MongoDB: ' + error.message);
        console.error('Error loading ', error);
      } finally {
        setLoading(false);
      }
    };

    if (month) {
      fetchData();
    }
  }, [month, location.search]); // Re-fetch when month or URL search parameters change

  // Apply filters (excluding cluster and category since they're handled in API)
  const filteredData = React.useMemo(() => {
    return data.filter(row => {
      return Object.keys(searchFilters).every(key => {
        if (!searchFilters[key]) return true;
        return row[key] && row[key].toString().toLowerCase().includes(searchFilters[key].toLowerCase());
      });
    });
  }, [data, searchFilters]);

  // Sorting function (with Decision prioritization)
  const sortedData = React.useMemo(() => {
    if (!sortConfig.key) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      // Handle empty values
      if (aValue === '' && bValue === '') return 0;
      if (aValue === '') return sortConfig.direction === 'asc' ? 1 : -1;
      if (bValue === '') return sortConfig.direction === 'asc' ? -1 : 1;

      // Special handling for Decision column to prioritize "Increase"
      if (sortConfig.key.toLowerCase() === 'decision') {
        const aLower = aValue.toString().toLowerCase();
        const bLower = bValue.toString().toLowerCase();
        
        if (sortConfig.direction === 'asc') {
          // For ascending order: Increase first, then No Change, then Decrease
          const order = { 'increase': 1, 'no change': 2, 'decrease': 3 };
          const aOrder = order[aLower] || 4;
          const bOrder = order[bLower] || 4;
          return aOrder - bOrder;
        } else {
          // For descending order: Decrease first, then No Change, then Increase
          const order = { 'decrease': 1, 'no change': 2, 'increase': 3 };
          const aOrder = order[aLower] || 4;
          const bOrder = order[bLower] || 4;
          return aOrder - bOrder;
        }
      }

      // Try to convert to numbers for numeric comparison
      const aNum = Number(aValue);
      const bNum = Number(bValue);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
      }

      // String comparison (case-insensitive)
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      if (aStr < bStr) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aStr > bStr) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortConfig]);

  // Pagination calculations
  const totalItems = sortedData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentData = sortedData.slice(startIndex, endIndex);

  // Check if save button should be enabled
  const isSaveEnabled = React.useMemo(() => {
    if (selectedRows.length === 0) return false;
    
    // Check if any selected row has been modified compared to original data
    return selectedRows.some(rowUniqueId => {
      const currentRow = data.find(row => row.__uniqueId__ === rowUniqueId);
      const originalRow = originalData.find(row => row.__uniqueId__ === rowUniqueId);
      
      if (!currentRow || !originalRow) return false;
      
      // Compare key fields (Decision and Comment)
      return currentRow.Decision !== originalRow.Decision || 
             currentRow.Comment !== originalRow.Comment;
    });
  }, [selectedRows, data, originalData]);

  // Handle page change
  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  // Handle sort request
  const requestSort = (key) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Get sort indicator
  const getSortIndicator = (key) => {
    if (sortConfig.key !== key) return '↕️';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  // Handle month change
  const handleMonthChange = (e) => {
    const selectedMonth = e.target.value;
    setMonth(selectedMonth);
    
    // Update URL with month parameter
    const params = getParamsFromUrl();
    const newParams = new URLSearchParams();
    
    if (params.cluster) {
      newParams.set('cluster', params.cluster);
    }
    if (params.category) {
      newParams.set('category', params.category);
    }
    if (selectedMonth) {
      newParams.set('month', selectedMonth);
    }
    
    history.push({
      pathname: location.pathname,
      search: newParams.toString()
    });
  };

  // Check if Decision column exists and has 'Decrease' or 'No Change' value
  const getRowStyle = (row) => {
    const decisionValue = row['Decision'] || row['decision'] || row['DECISION'] || '';
    const isGreyedOut = decisionValue.toString().toLowerCase() === 'decrease' || 
                       decisionValue.toString().toLowerCase() === 'no change';
    
    return {
      backgroundColor: isGreyedOut ? '#e0e0e0' : 'white',
      opacity: isGreyedOut ? 0.8 : 1
    };
  };

  // Handle individual checkbox selection
  const handleCheckboxChange = (index) => {
    // Calculate the actual index in the full sorted data array
    const actualIndex = startIndex + index;
    
    const rowData = sortedData[actualIndex];
    const decisionValue = rowData['Decision'] || rowData['decision'] || rowData['DECISION'] || '';
    
    // Only allow selection if Decision is not 'Decrease' or 'No Change'
    if (decisionValue.toString().toLowerCase() !== 'decrease' && 
        decisionValue.toString().toLowerCase() !== 'no change') {
      setSelectedRows(prev => {
        if (prev.includes(actualIndex)) {
          return prev.filter(i => i !== actualIndex);
        } else {
          return [...prev, actualIndex];
        }
      });
    }
  };

  // Handle select all checkbox
  const handleSelectAll = () => {
    if (selectAllChecked) {
      // Deselect all
      setSelectedRows([]);
      setSelectAllChecked(false);
      setShowBulkEditModal(false); // Close modal when deselecting
    } else {
      // Select all non-greyed-out rows
      const selectableRows = currentData
        .filter(row => {
          const decisionValue = row['Decision'] || row['decision'] || row['DECISION'] || '';
          return decisionValue.toString().toLowerCase() !== 'decrease' && 
                 decisionValue.toString().toLowerCase() !== 'no change';
        })
        .map(row => row.__uniqueId__); // Use unique ID
      
      setSelectedRows(selectableRows);
      setSelectAllChecked(true);
      
      // Show bulk edit modal when 5+ rows are selected
      if (selectableRows.length >= 5) {
        setBulkDecision('');
        setBulkComment('');
        setShowBulkEditModal(true);
      }
    }
  };

  // Check if select all checkbox should be checked
  const isSelectAllChecked = () => {
    if (currentData.length === 0) return false;
    
    const selectableRows = currentData
      .filter(row => {
        const decisionValue = row['Decision'] || row['decision'] || row['DECISION'] || '';
        return decisionValue.toString().toLowerCase() !== 'decrease' && 
               decisionValue.toString().toLowerCase() !== 'no change';
      })
      .map(row => row.__uniqueId__); // Use unique ID
    
    const allSelected = selectableRows.length > 0 && 
                        selectableRows.every(id => selectedRows.includes(id)) && 
                        selectedRows.length === selectableRows.length;
    
    return allSelected;
  };

  // Handle comment input change
  const handleCommentChange = (rowUniqueId, event) => {
    const newValue = event.target.value;
    
    setData(prevData => {
      return prevData.map(row => {
        if (row.__uniqueId__ === rowUniqueId) {
          return {
            ...row,
            Comment: newValue
          };
        }
        return row;
      });
    });
    
    // Mark row as changed
    setChangedRows(prev => new Set([...prev, rowUniqueId]));
  };

  // Handle decision dropdown change
  const handleDecisionChange = (rowUniqueId, event) => {
    const newValue = event.target.value;
    
    setData(prevData => {
      return prevData.map(row => {
        if (row.__uniqueId__ === rowUniqueId) {
          return {
            ...row,
            Decision: newValue
          };
        }
        return row;
      });
    });
    
    // Mark row as changed
    setChangedRows(prev => new Set([...prev, rowUniqueId]));
  };

  // Handle search filter change
  const handleSearchChange = (key, value) => {
    setSearchFilters(prev => ({
      ...prev,
      [key]: value
    }));
    setCurrentPage(1); // Reset to first page when search changes
  };

  // Handle bulk edit save
  const handleBulkEditSave = () => {
    if (!bulkDecision) {
      setError('Please select a decision for all selected rows.');
      return;
    }
    
    // Update selected rows with bulk values
    const updatedData = [...data];
    
    selectedRows.forEach(rowUniqueId => {
      const rowIndex = updatedData.findIndex(row => row.__uniqueId__ === rowUniqueId);
      if (rowIndex !== -1) {
        updatedData[rowIndex] = {
          ...updatedData[rowIndex],
          Decision: bulkDecision,
          Comment: bulkComment, // Changed from 'Comment' to 'Comments'
          UpdatedBy: 'System User', // Default value since no input field
          UpdatedTime: new Date().toISOString()
        };
      }
    });
    
    setData(updatedData);
    
    // Mark all selected rows as changed
    setChangedRows(prev => new Set([...prev, ...selectedRows]));
    
    // Close modal
    setShowBulkEditModal(false);
    setError('');
  };

  // Close bulk edit modal
  const closeBulkEditModal = () => {
    setShowBulkEditModal(false);
    setError('');
  };

  // Save all changes to MongoDB using your specific API
  const saveDataToMongoDB = async (updatedData) => {
    try {
      // Show loading screen
      setShowLoading(true);
      
      // Prepare updates array for your specific API
      const updates = selectedRows.map(rowUniqueId => {
        // Find the original row by unique ID
        const originalRow = updatedData.find(row => row.__uniqueId__ === rowUniqueId);
        
        // Get the cluster name for this row
        const clusterName = originalRow['Cluster'] || 
                           originalRow['cluster'] || 
                           originalRow['CLUSTER'] || 
                           'Unknown';
        
        return {
          index: rowUniqueId, // Use unique ID as index
           {
            Decision: originalRow.Decision,
            comment: originalRow.Comment, // Changed to lowercase 'c' as in your example
            UpdatedBy: 'System User', // Default value since no input field
            UpdatedTime: new Date().toISOString(),
            Cluster: clusterName // Include cluster in response body
          }
        };
      });
      
      // Build API URL with month query parameter
      const apiUrl = `http://localhost:8000/excel-update?month=${encodeURIComponent(month)}`; // Replace with your API endpoint
      
      // Send updates to MongoDB
      const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ updates }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Hide loading screen
      setShowLoading(false);
      
      // Show success modal
      setShowSuccessModal(true);
    } catch (error) {
      // Hide loading screen
      setShowLoading(false);
      setError('Error saving data to MongoDB: ' + error.message);
      console.error('Error saving ', error);
    }
  };

  // Handle bulk save
  const handleBulkSave = async () => {
    if (selectedRows.length === 0) {
      setError('Please select at least one row to save.');
      return;
    }

    const updatedData = [...data];
    
    selectedRows.forEach(rowUniqueId => {
      const rowIndex = updatedData.findIndex(row => row.__uniqueId__ === rowUniqueId);
      if (rowIndex !== -1) {
        updatedData[rowIndex] = {
          ...updatedData[rowIndex],
          UpdatedBy: 'System User', // Default value since no input field
          UpdatedTime: new Date().toISOString()
        };
      }
    });
    
    await saveDataToMongoDB(updatedData); // Save changes to MongoDB using your API with correct payload structure
    
    // Update the data in browser memory
    setData(updatedData);
    
    // Update original data for future revert checks
    setOriginalData(updatedData);
    
    // Reset states
    setSelectedRows([]);
  };

  // Close success modal
  const closeSuccessModal = () => {
    setShowSuccessModal(false);
  };

  if (loading && month) return <div>Loading data for {month}...</div>;

  // Get column keys for rendering (excluding the unique ID)
  const columnKeys = Object.keys(data[0] || {}).filter(key => key !== '__uniqueId__');

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <h2>Excel Data Dashboard</h2>
      
      {/* Month Dropdown */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <label style={{ fontWeight: 'bold' }}>
          Select Month:
        </label>
        <select
          value={month}
          onChange={handleMonthChange}
          style={{
            padding: '8px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '14px'
          }}
        >
          {months.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>
      
      {/* Error Message */}
      {error && (
        <div style={{ 
          marginBottom: '10px', 
          padding: '8px', 
          backgroundColor: '#ffdddd', 
          border: '1px solid #ff9999', 
          borderRadius: '4px',
          color: '#cc0000'
        }}>
          {error}
        </div>
      )}
      
      {/* Conditional Button - Change All if 5+ rows selected, Save All otherwise */}
      {selectedRows.length >= 5 ? (
        <button 
          onClick={() => setShowBulkEditModal(true)}
          style={{
            marginBottom: '10px',
            padding: '8px 16px',
            backgroundColor: '#2196F3', // Blue color for Change All
            color: 'white',
            border: '3px solid #2196F3',
            borderRadius: '4px',
            cursor: 'pointer',
            alignSelf: 'flex-start'
          }}
        >
          Change All ({selectedRows.length} rows)
        </button>
      ) : (
        <button 
          onClick={handleBulkSave}
          disabled={!isSaveEnabled}
          style={{
            marginBottom: '10px',
            padding: '8px 16px',
            backgroundColor: isSaveEnabled ? '#4CAF50' : '#cccccc', // Green when enabled, grey when disabled
            color: 'white',
            border: '3px solid ' + (isSaveEnabled ? '#4CAF50' : '#cccccc'),
            borderRadius: '4px',
            cursor: isSaveEnabled ? 'pointer' : 'not-allowed',
            alignSelf: 'flex-start'
          }}
        >
          Save All Changes ({selectedRows.length} selected)
        </button>
      )}
      
      {/* Scrollable Table Container with Fixed Header */}
      <div style={{ flex: 1, overflow: 'auto', marginBottom: '20px' }}>
        {month && data.length > 0 ? (
          <div style={{ minWidth: 'max-content' }}>
            <table 
              border="3" 
              cellPadding="5" 
              cellSpacing="0" 
              style={{ 
                borderCollapse: 'collapse', 
                width: '100%', 
                backgroundColor: 'white' 
              }}
            >
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr style={{ backgroundColor: '#f2f2f2' }}>
                  {/* Checkbox Column Header - Fixed */}
                  <th 
                    style={{ 
                      padding: '8px', 
                      textAlign: 'center', 
                      fontWeight: 'bold',
                      border: '3px solid #ddd',
                      position: 'sticky',
                      left: 0,
                      zIndex: 10,
                      backgroundColor: '#f2f2f2',
                      width: '80px'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelectAllChecked()}
                      onChange={handleSelectAll}
                      title="Select All"
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  {columnKeys.map((key) => (
                    <th 
                      key={key} 
                      style={{ 
                        padding: '8px', 
                        textAlign: 'left',
                        fontWeight: 'bold',
                        border: '3px solid #ddd',
                        cursor: 'pointer',
                        userSelect: 'none',
                        position: 'sticky',
                        top: 0,
                        zIndex: 5,
                        backgroundColor: '#f2f2f2'
                      }}
                      onClick={() => requestSort(key)}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ display: 'flex', alignItems: 'center' }}>
                          {key}
                          <span style={{ marginLeft: '5px' }}>{getSortIndicator(key)}</span>
                        </span>
                        {/* Only show search input for GroupId and Cluster columns */}
                        {(key.toLowerCase() === 'groupid' || key.toLowerCase() === 'cluster') && (
                          <input
                            type="text"
                            placeholder={`Search ${key}...`}
                            value={searchFilters[key] || ''}
                            onChange={(e) => handleSearchChange(key, e.target.value)}
                            style={{
                              marginTop: '5px',
                              padding: '4px',
                              border: '1px solid #ccc',
                              borderRadius: '2px',
                              fontSize: '12px',
                              width: '100%'
                            }}
                          />
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currentData.map((row, rowIndex) => {
                  const decisionValue = row['Decision'] || row['decision'] || row['DECISION'] || '';
                  const isGreyedOut = decisionValue.toString().toLowerCase() === 'decrease' || 
                                     decisionValue.toString().toLowerCase() === 'no change';
                  const actualIndex = startIndex + rowIndex; // Calculate actual index in full array
                  const isRowSelected = selectedRows.includes(actualIndex);
                  
                  return (
                    <tr 
                      key={`row-${actualIndex}`} 
                      style={getRowStyle(row)}
                    >
                      {/* Checkbox Column - Fixed */}
                      <td 
                        style={{ 
                          padding: '8px', 
                          border: '3px solid #ddd',
                          textAlign: 'center',
                          verticalAlign: 'middle',
                          position: 'sticky',
                          left: 0,
                          zIndex: 9, // Lower than header but higher than content
                          backgroundColor: isGreyedOut ? '#e0e0e0' : 'white',
                          width: '80px'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isRowSelected}
                          onChange={() => handleCheckboxChange(rowIndex)}
                          disabled={isGreyedOut}
                          style={{ cursor: isGreyedOut ? 'not-allowed' : 'pointer' }}
                        />
                      </td>
                      
                      {/* Data Columns */}
                      {columnKeys.map((key, colIndex) => {
                        if (key.toLowerCase() === 'comment') {
                          // If this is the Comment column, render input if row is selected
                          return (
                            <td 
                              key={`comment-${actualIndex}-${key}`} 
                              style={{ 
                                padding: '8px', 
                                border: '3px solid #ddd',
                                verticalAlign: 'top'
                              }}
                            >
                              {isRowSelected ? (
                                <CommentInput
                                  value={row[key] || ''}
                                  onChange={(e) => handleCommentChange(row.__uniqueId__, e)} // Use unique ID
                                  placeholder="Enter comment"
                                  rowUniqueId={row.__uniqueId__} // Pass unique ID for reconciliation
                                  isDisabled={false} // Never disable individual edits
                                />
                              ) : (
                                row[key] || ''
                              )}
                            </td>
                          );
                        } else if (key.toLowerCase() === 'decision') {
                          // If this is the Decision column, render dropdown if row is selected
                          return (
                            <td 
                              key={`decision-${actualIndex}-${key}`} 
                              style={{ 
                                padding: '8px', 
                                border: '3px solid #ddd',
                                verticalAlign: 'top'
                              }}
                            >
                              {isRowSelected ? (
                                <DecisionDropdown
                                  value={row[key] || ''}
                                  onChange={(e) => handleDecisionChange(row.__uniqueId__, e)} // Use unique ID
                                  rowUniqueId={row.__uniqueId__} // Pass unique ID for reconciliation
                                  isDisabled={false} // Never disable individual edits
                                />
                              ) : (
                                row[key] || ''
                              )}
                            </td>
                          );
                        } else {
                          // For other columns, render the data
                          return (
                            <td 
                              key={`data-${actualIndex}-${key}`} 
                              style={{ 
                                padding: '8px', 
                                border: '3px solid #ddd',
                                verticalAlign: 'top'
                              }}
                            >
                              {row[key] || ''}
                            </td>
                          );
                        }
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : month ? (
          <p>No data found for {month}.</p>
        ) : (
          <p>Please select a month to view data.</p>
        )}
      </div>
      
      {/* Pagination Controls */}
      {month && totalItems > itemsPerPage && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          gap: '10px',
          alignSelf: 'center'
        }}>
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            style={{
              padding: '8px 12px',
              backgroundColor: currentPage === 1 ? '#ccc' : '#2196F3',
              color: 'white',
              border: '3px solid #2196F3',
              borderRadius: '4px',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
            }}
          >
            Previous
          </button>
          
          {/* Page numbers with ellipsis */}
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }
            
            return (
              <button
                key={`page-${pageNum}`}
                onClick={() => handlePageChange(pageNum)}
                style={{
                  padding: '8px 12px',
                  backgroundColor: pageNum === currentPage ? '#4CAF50' : '#f0f0f0',
                  color: pageNum === currentPage ? 'white' : 'black',
                  border: '3px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: pageNum === currentPage ? 'bold' : 'normal'
                }}
              >
                {pageNum}
              </button>
            );
          })}
          
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            style={{
              padding: '8px 12px',
              backgroundColor: currentPage === totalPages ? '#ccc' : '#2196F3',
              color: 'white',
              border: '3px solid #2196F3',
              borderRadius: '4px',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
            }}
          >
            Next
          </button>
          
          <div style={{ marginLeft: '10px', fontSize: '14px' }}>
            Page {currentPage} of {totalItems} ({totalItems} total records)
          </div>
        </div>
      )}
      
      {/* Bulk Edit Modal */}
      {showBulkEditModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1001
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            width: '400px',
            maxWidth: '90%',
            textAlign: 'center'
          }}>
            <h3 style={{ color: '#2196F3', marginBottom: '15px' }}>
              Bulk Edit ({selectedRows.length} rows selected)
            </h3>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Decision:
              </label>
              <select
                value={bulkDecision}
                onChange={(e) => setBulkDecision(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
              >
                <option value="">Select Decision</option>
                <option value="No Change">No Change</option>
                <option value="Increase">Increase</option>
                <option value="Decrease">Decrease</option>
              </select>
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Comment:
              </label>
              <textarea
                value={bulkComment}
                onChange={(e) => setBulkComment(e.target.value)}
                placeholder="Enter comment for all selected rows"
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  minHeight: '60px',
                  resize: 'vertical'
                }}
              />
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
              <button
                onClick={closeBulkEditModal}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#ccc',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  flex: 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleBulkEditSave}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  flex: 1
                }}
              >
                Apply Changes
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Success Modal */}
      {showSuccessModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            width: '400px',
            maxWidth: '90%',
            textAlign: 'center'
          }}>
            <h3 style={{ color: '#4CAF50', marginBottom: '15px' }}>
              Success!
            </h3>
            <p style={{ marginBottom: '20px' }}>
              Data saved successfully to MongoDB!
            </p>
            <button
              onClick={closeSuccessModal}
              style={{
                padding: '8px 16px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: '3px solid #4CAF50',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
      
      {/* Loading Screen */}
      {showLoading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1001
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <div style={{
              width: '50px',
              height: '50px',
              border: '5px solid #f3f3f3',
              borderTop: '5px solid #4CAF50',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 10px'
            }}></div>
            <p style={{ color: '#333', margin: 0 }}>Saving changes...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
