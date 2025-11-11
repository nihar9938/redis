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
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [selectedRows, setSelectedRows] = useState([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [error, setError] = useState('');
  const [searchFilters, setSearchFilters] = useState({});

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
        console.error('Error loading data:', error);
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
    const rowData = sortedData[index];
    const decisionValue = rowData['Decision'] || rowData['decision'] || rowData['DECISION'] || '';
    
    // Only allow selection if Decision is not 'Decrease' or 'No Change'
    if (decisionValue.toString().toLowerCase() !== 'decrease' && 
        decisionValue.toString().toLowerCase() !== 'no change') {
      setSelectedRows(prev => {
        if (prev.includes(index)) {
          return prev.filter(i => i !== index);
        } else {
          return [...prev, index];
        }
      });
    }
  };

  // Handle comment input change
  const handleCommentChange = (rowIndex, event) => {
    const newValue = event.target.value;
    
    setData(prevData => {
      const newData = [...prevData];
      const originalIndex = sortedData[rowIndex];
      const originalDataIndex = newData.findIndex(row => 
        JSON.stringify(row) === JSON.stringify(originalIndex)
      );
      
      if (originalDataIndex !== -1) {
        newData[originalDataIndex] = {
          ...newData[originalDataIndex],
          Comment: newValue
        };
      }
      return newData;
    });
  };

  // Handle decision dropdown change
  const handleDecisionChange = (rowIndex, event) => {
    const newValue = event.target.value;
    
    setData(prevData => {
      const newData = [...prevData];
      const originalIndex = sortedData[rowIndex];
      const originalDataIndex = newData.findIndex(row => 
        JSON.stringify(row) === JSON.stringify(originalIndex)
      );
      
      if (originalDataIndex !== -1) {
        newData[originalDataIndex] = {
          ...newData[originalDataIndex],
          Decision: newValue
        };
      }
      return newData;
    });
  };

  // Handle search filter change
  const handleSearchChange = (key, value) => {
    setSearchFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Save all changes to MongoDB using your specific API
  const saveDataToMongoDB = async (updatedData) => {
    try {
      // Prepare updates array for your specific API
      const updates = selectedRows.map(rowIndex => {
        const originalIndex = sortedData[rowIndex];
        const originalDataIndex = data.findIndex(row => 
          JSON.stringify(row) === JSON.stringify(originalIndex)
        );
        
        return {
          index: originalDataIndex,
          data: {
            Decision: updatedData[originalDataIndex].Decision,
            Comment: updatedData[originalDataIndex].Comment,
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
      console.error('Error saving data:', error);
    }
  };

  // Handle bulk save
  const handleBulkSave = async () => {
    if (selectedRows.length === 0) {
      setError('Please select at least one row to save.');
      return;
    }

    const updatedData = [...data];
    
    selectedRows.forEach(rowIndex => {
      const originalIndex = sortedData[rowIndex];
      const originalDataIndex = data.findIndex(row => 
        JSON.stringify(row) === JSON.stringify(originalIndex)
      );
      
      if (originalDataIndex !== -1) {
        updatedData[originalDataIndex] = {
          ...updatedData[originalDataIndex],
          UpdatedBy: 'System User', // Default value since no input field
          UpdatedTime: new Date().toISOString()
        };
      }
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
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
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
          cursor: 'pointer'
        }}
      >
        Save All Changes
      </button>
      
      {data.length > 0 ? (
        <div style={{ overflowX: 'auto' }}>
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
                    border: '1px solid #ddd'
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
                      userSelect: 'none'
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
              {sortedData.map((row, rowIndex) => {
                const decisionValue = row['Decision'] || row['decision'] || row['DECISION'] || '';
                const isGreyedOut = decisionValue.toString().toLowerCase() === 'decrease' || 
                                   decisionValue.toString().toLowerCase() === 'no change';
                const isRowSelected = selectedRows.includes(rowIndex);
                
                return (
                  <tr 
                    key={rowIndex} 
                    style={getRowStyle(row)}
                  >
                    {/* Checkbox Column */}
                    <td 
                      style={{ 
                        padding: '8px', 
                        border: '1px solid #ddd',
                        textAlign: 'center',
                        verticalAlign: 'middle'
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
                            key={`comment-${rowIndex}-${colIndex}`} 
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
                            key={`decision-${rowIndex}-${colIndex}`} 
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
                            key={`data-${rowIndex}-${colIndex}`} 
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
