// src/Dashboard.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useHistory } from 'react-router-dom'; // For older React Router

// Custom Input Component to handle React reconciliation issues
const CommentInput = ({ value, onChange, placeholder, rowIndex, actualIndex }) => {
  const inputRef = useRef(null);
  
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.value = value || '';
    }
  }, [value, actualIndex]);

  return (
    <input
      ref={inputRef}
      type="text"
      defaultValue={value || ''}
      onChange={onChange}
      placeholder={placeholder}
      style={{
        width: '100%',
        padding: '4px',
        border: '1px solid #ccc',
        borderRadius: '2px',
        boxSizing: 'border-box'
      }}
    />
  );
};

// Custom Dropdown Component for Decision
const DecisionDropdown = ({ value, onChange, rowIndex, actualIndex }) => {
  const dropdownRef = useRef(null);
  
  useEffect(() => {
    if (dropdownRef.current) {
      dropdownRef.current.value = value || '';
    }
  }, [value, actualIndex]);

  return (
    <select
      ref={dropdownRef}
      defaultValue={value || ''}
      onChange={onChange}
      style={{
        width: '100%',
        padding: '4px',
        border: '1px solid #ccc',
        borderRadius: '2px',
        boxSizing: 'border-box'
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
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' }); // No default sort
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
    return { cluster, month: monthParam };
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
        
        // Get cluster from URL parameter
        const params = getParamsFromUrl();
        const clusterFromUrl = params.cluster;
        
        // Build API URL with month and cluster parameters
        let apiUrl = `http://localhost:8000/excel-data?month=${encodeURIComponent(month)}`; // Replace with your API endpoint
        if (clusterFromUrl) {
          apiUrl += `&cluster=${encodeURIComponent(clusterFromUrl)}`;
        }
        
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const jsonData = await response.json();
        setData(jsonData);
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

  // Apply filters (excluding cluster since it's handled in API)
  const filteredData = React.useMemo(() => {
    return data.filter(row => {
      return Object.keys(searchFilters).every(key => {
        if (!searchFilters[key]) return true;
        return row[key] && row[key].toString().toLowerCase().includes(searchFilters[key].toLowerCase());
      });
    });
  }, [data, searchFilters]);

  // Sorting function
  const sortedData = React.useMemo(() => {
    if (!sortConfig.key) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      // Handle empty values
      if (aValue === '' && bValue === '') return 0;
      if (aValue === '') return sortConfig.direction === 'asc' ? 1 : -1;
      if (bValue === '') return sortConfig.direction === 'asc' ? -1 : 1;

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
    // Get all selectable rows (not greyed out)
    const selectableRows = [];
    
    currentData.forEach((row, index) => {
      const actualIndex = startIndex + index;
      const decisionValue = row['Decision'] || row['decision'] || row['DECISION'] || '';
      
      // Only include rows that are not greyed out
      if (decisionValue.toString().toLowerCase() !== 'decrease' && 
          decisionValue.toString().toLowerCase() !== 'no change') {
        selectableRows.push(actualIndex);
      }
    });
    
    // If all selectable rows are already selected, deselect all
    const allSelected = selectableRows.every(index => selectedRows.includes(index));
    
    if (allSelected) {
      // Deselect all
      setSelectedRows(prev => prev.filter(index => !selectableRows.includes(index)));
    } else {
      // Select all
      setSelectedRows(prev => [...new Set([...prev, ...selectableRows])]);
    }
  };

  // Check if select all checkbox should be checked
  const isSelectAllChecked = () => {
    if (currentData.length === 0) return false;
    
    const selectableRows = [];
    
    currentData.forEach((row, index) => {
      const actualIndex = startIndex + index;
      const decisionValue = row['Decision'] || row['decision'] || row['DECISION'] || '';
      
      // Only include rows that are not greyed out
      if (decisionValue.toString().toLowerCase() !== 'decrease' && 
          decisionValue.toString().toLowerCase() !== 'no change') {
        selectableRows.push(actualIndex);
      }
    });
    
    return selectableRows.length > 0 && selectableRows.every(index => selectedRows.includes(index));
  };

  // Handle comment input change
  const handleCommentChange = (rowIndex, event) => {
    const newValue = event.target.value;
    const actualIndex = startIndex + rowIndex; // Calculate actual index in full array
    
    setData(prevData => {
      const newData = [...prevData];
      newData[actualIndex] = {
        ...newData[actualIndex],
        Comment: newValue
      };
      return newData;
    });
  };

  // Handle decision dropdown change
  const handleDecisionChange = (rowIndex, event) => {
    const newValue = event.target.value;
    const actualIndex = startIndex + rowIndex; // Calculate actual index in full array
    
    setData(prevData => {
      const newData = [...prevData];
      newData[actualIndex] = {
        ...newData[actualIndex],
        Decision: newValue
      };
      return newData;
    });
  };

  // Handle search filter change
  const handleSearchChange = (key, value) => {
    setSearchFilters(prev => ({
      ...prev,
      [key]: value
    }));
    setCurrentPage(1); // Reset to first page when search changes
  };

  // Handle bulk edit button click
  const handleBulkEdit = () => {
    if (selectedRows.length === 0) {
      setError('Please select at least one row to edit.');
      return;
    }
    
    // Reset bulk edit values
    setBulkDecision('');
    setBulkComment('');
    
    // Show bulk edit modal
    setShowBulkEditModal(true);
  };

  // Handle bulk edit save
  const handleBulkEditSave = () => {
    if (!bulkDecision) {
      setError('Please select a decision for all selected rows.');
      return;
    }
    
    // Update selected rows with bulk values
    const updatedData = [...data];
    
    selectedRows.forEach(originalIndex => {
      updatedData[originalIndex] = {
        ...updatedData[originalIndex],
        Decision: bulkDecision,
        Comment: bulkComment,
        UpdatedBy: 'System User', // Default value since no input field
        UpdatedTime: new Date().toISOString()
      };
    });
    
    setData(updatedData);
    setShowBulkEditModal(false);
    setError('');
  };

  // Save all changes to MongoDB using your specific API
  const saveDataToMongoDB = async (updatedData) => {
    try {
      // Prepare updates array for your specific API
      const updates = selectedRows.map(originalIndex => {
        return {
          index: originalIndex,
           {
            Decision: updatedData[originalIndex].Decision,
            Comment: updatedData[originalIndex].Comment,
            UpdatedBy: 'System User', // Default value since no input field
            UpdatedTime: new Date().toISOString()
          }
        };
      });
      
      // Send updates to MongoDB
      const response = await fetch('http://localhost:8000/excel-update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ updates }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Show success modal
      setShowSuccessModal(true);
    } catch (error) {
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
    
    selectedRows.forEach(originalIndex => {
      updatedData[originalIndex] = {
        ...updatedData[originalIndex],
        UpdatedBy: 'System User', // Default value since no input field
        UpdatedTime: new Date().toISOString()
      };
    });
    
    await saveDataToMongoDB(updatedData); // Save changes to MongoDB using your API
    
    // Update the data in browser memory
    setData(updatedData);
    
    // Reset states
    setSelectedRows([]);
  };

  // Close success modal
  const closeSuccessModal = () => {
    setShowSuccessModal(false);
  };

  // Close bulk edit modal
  const closeBulkEditModal = () => {
    setShowBulkEditModal(false);
    setError('');
  };

  if (loading && month) return <div>Loading data for {month}...</div>;

  // Get column keys for rendering
  const columnKeys = Object.keys(data[0] || {});

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
      
      {/* Save Button */}
      <button 
        onClick={handleBulkEdit}
        style={{
          marginBottom: '10px',
          padding: '8px 16px',
          backgroundColor: '#4CAF50',
          color: 'white',
          border: '3px solid #4CAF50',
          borderRadius: '4px',
          cursor: 'pointer',
          alignSelf: 'flex-start'
        }}
      >
        Bulk Edit Selected ({selectedRows.length})
      </button>
      
      {/* Scrollable Table Container */}
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
              <thead>
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
                                  onChange={(e) => handleCommentChange(rowIndex, e)}
                                  placeholder="Enter comment"
                                  rowIndex={rowIndex}
                                  actualIndex={actualIndex}
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
                                  onChange={(e) => handleDecisionChange(rowIndex, e)}
                                  rowIndex={rowIndex}
                                  actualIndex={actualIndex}
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
            <h3 style={{ color: '#4CAF50', marginBottom: '15px' }}>
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
                  backgroundColor: '#4CAF50',
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
    </div>
  );
};

export default Dashboard;
