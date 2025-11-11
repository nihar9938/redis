// src/Dashboard.jsx
import React, { useState, useEffect, useRef } from 'react';

// Custom Input Component to handle React reconciliation issues
const CommentInput = ({ value, onChange, placeholder, rowIndex }) => {
  const inputRef = useRef(null);
  
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.value = value || '';
    }
  }, [value, rowIndex]);

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
const DecisionDropdown = ({ value, onChange, rowIndex }) => {
  const dropdownRef = useRef(null);
  
  useEffect(() => {
    if (dropdownRef.current) {
      dropdownRef.current.value = value || '';
    }
  }, [value, rowIndex]);

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
  const [sortConfig, setSortConfig] = useState({ key: 'Decision', direction: 'asc' }); // Default sort by Decision ascending
  const [selectedRows, setSelectedRows] = useState([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [error, setError] = useState('');
  const [searchFilters, setSearchFilters] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(200); // 200 records per page

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');
        
        // Fetch data from MongoDB
        const response = await fetch('http://localhost:8000/excel-data'); // Replace with your API endpoint
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

    fetchData();
  }, []);

  // Apply filters
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

  // Handle checkbox selection
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

  if (loading) return <div>Loading data...</div>;

  // Get column keys for rendering
  const columnKeys = Object.keys(data[0] || {});

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <h2>Excel Data Dashboard</h2>
      
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
        onClick={handleBulkSave}
        style={{
          marginBottom: '10px',
          padding: '8px 16px',
          backgroundColor: '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          alignSelf: 'flex-start'
        }}
      >
        Save All Changes
      </button>
      
      {/* Scrollable Table Container */}
      <div style={{ flex: 1, overflow: 'auto', marginBottom: '20px' }}>
        {data.length > 0 ? (
          <div style={{ minWidth: 'max-content' }}>
            <table 
              border="1" 
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
                  {/* Checkbox Column Header */}
                  <th 
                    style={{ 
                      padding: '8px', 
                      textAlign: 'center', 
                      fontWeight: 'bold',
                      border: '1px solid #ddd',
                      position: 'sticky',
                      left: 0,
                      zIndex: 10,
                      backgroundColor: '#f2f2f2'
                    }}
                  >
                    Revision
                  </th>
                  {columnKeys.map((key) => (
                    <th 
                      key={key} 
                      style={{ 
                        padding: '8px', 
                        textAlign: 'left',
                        fontWeight: 'bold',
                        border: '1px solid #ddd',
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
                      key={actualIndex} 
                      style={getRowStyle(row)}
                    >
                      {/* Checkbox Column */}
                      <td 
                        style={{ 
                          padding: '8px', 
                          border: '1px solid #ddd',
                          textAlign: 'center',
                          verticalAlign: 'middle',
                          position: 'sticky',
                          left: 0,
                          zIndex: 1,
                          backgroundColor: isGreyedOut ? '#e0e0e0' : 'white'
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
                              key={`comment-${actualIndex}-${colIndex}`} 
                              style={{ 
                                padding: '8px', 
                                border: '1px solid #ddd',
                                verticalAlign: 'top'
                              }}
                            >
                              {isRowSelected ? (
                                <CommentInput
                                  value={row[key] || ''}
                                  onChange={(e) => handleCommentChange(rowIndex, e)}
                                  placeholder="Enter comment"
                                  rowIndex={rowIndex}
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
                              key={`decision-${actualIndex}-${colIndex}`} 
                              style={{ 
                                padding: '8px', 
                                border: '1px solid #ddd',
                                verticalAlign: 'top'
                              }}
                            >
                              {isRowSelected ? (
                                <DecisionDropdown
                                  value={row[key] || ''}
                                  onChange={(e) => handleDecisionChange(rowIndex, e)}
                                  rowIndex={rowIndex}
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
                              key={`data-${actualIndex}-${colIndex}`} 
                              style={{ 
                                padding: '8px', 
                                border: '1px solid #ddd',
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
        ) : (
          <p>No data found in MongoDB.</p>
        )}
      </div>
      
      {/* Pagination Controls */}
      {totalItems > itemsPerPage && (
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
              border: 'none',
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
                key={pageNum}
                onClick={() => handlePageChange(pageNum)}
                style={{
                  padding: '8px 12px',
                  backgroundColor: pageNum === currentPage ? '#4CAF50' : '#f0f0f0',
                  color: pageNum === currentPage ? 'white' : 'black',
                  border: '1px solid #ccc',
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
              border: 'none',
              borderRadius: '4px',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
            }}
          >
            Next
          </button>
          
          <div style={{ marginLeft: '10px', fontSize: '14px' }}>
            Page {currentPage} of {totalPages} ({totalItems} total records)
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
                border: 'none',
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
