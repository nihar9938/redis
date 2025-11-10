// src/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

const Dashboard = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [selectedRows, setSelectedRows] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [decision, setDecision] = useState('');
  const [comment, setComment] = useState('');
  const [updatedBy, setUpdatedBy] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/data.xlsx');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const buffer = await response.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length === 0) {
          setData([]);
          setLoading(false);
          return;
        }
        
        const headers = jsonData[0];
        const rows = jsonData.slice(1);
        const formattedData = rows.map(row => {
          const obj = {};
          headers.forEach((header, index) => {
            obj[header] = row[index] != null ? row[index] : '';
          });
          return obj;
        });
        
        setData(formattedData);
      } catch (error) {
        console.error('Error loading Excel file:', error);
        alert('Failed to load Excel file. Please check if data.xlsx exists in the public folder.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Sorting function
  const sortedData = React.useMemo(() => {
    if (!sortConfig.key) return data;

    return [...data].sort((a, b) => {
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
  }, [data, sortConfig]);

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

  // Check if Decision column exists and has 'Decrease' value
  const getRowStyle = (row) => {
    const decisionValue = row['Decision'] || row['decision'] || row['DECISION'] || '';
    const isDecrease = decisionValue.toString().toLowerCase() === 'decrease';
    
    return {
      backgroundColor: isDecrease ? '#e0e0e0' : 'white',
      opacity: isDecrease ? 0.8 : 1
    };
  };

  // Handle checkbox selection
  const handleCheckboxChange = (index, colIndex) => {
    // Only process if this is the 6th column (index 5)
    if (colIndex !== 5) return;
    
    const rowData = sortedData[index];
    const decisionValue = rowData['Decision'] || rowData['decision'] || rowData['DECISION'] || '';
    
    // Only allow selection if Decision is not 'Decrease'
    if (decisionValue.toString().toLowerCase() !== 'decrease') {
      setSelectedRows(prev => {
        if (prev.includes(index)) {
          return prev.filter(i => i !== index);
        } else {
          return [...prev, index];
        }
      });
    }
  };

  // Handle "Apply Revision" button click
  const handleApplyRevision = () => {
    if (selectedRows.length === 0) {
      alert('Please select at least one row to apply revision.');
      return;
    }
    setShowModal(true);
  };

  // Save data back to Excel file
  const saveDataToExcel = async (updatedData) => {
    try {
      // Create a new workbook
      const wb = XLSX.utils.book_new();
      
      // Get headers from the first row
      const headers = Object.keys(updatedData[0]);
      
      // Convert data to array of arrays (with headers as first row)
      const wsData = [headers, ...updatedData.map(row => headers.map(header => row[header]))];
      
      // Create worksheet
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      
      // Write the workbook to a buffer
      const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
      
      // Create a Blob from the buffer
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'data.xlsx'; // Same name as original file
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      alert('Data saved successfully! The updated file has been downloaded.');
    } catch (error) {
      console.error('Error saving Excel file:', error);
      alert('Failed to save Excel file. Please try again.');
    }
  };

  // Submit revision data
  const handleSubmitRevision = async () => {
    if (!decision || !comment || !updatedBy) {
      alert('Please fill in all fields before submitting.');
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
          Decision: decision,
          Comment: comment,
          UpdatedBy: updatedBy,
          UpdatedTime: new Date().toLocaleString()
        };
      }
    });
    
    setData(updatedData);
    await saveDataToExcel(updatedData); // Save changes to Excel file
    setSelectedRows([]);
    setShowModal(false);
    setDecision('');
    setComment('');
    setUpdatedBy('');
  };

  // Close modal
  const closeModal = () => {
    setShowModal(false);
    setDecision('');
    setComment('');
    setUpdatedBy('');
  };

  if (loading) return <div>Loading Excel data...</div>;

  // Get column keys for rendering
  const columnKeys = Object.keys(data[0] || {});

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h2>Excel Data Dashboard</h2>
      
      {/* Apply Revision Button */}
      <button 
        onClick={handleApplyRevision}
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
        Apply Revision
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
                {columnKeys.map((key, index) => (
                  <th 
                    key={key} 
                    style={{ 
                      padding: '8px', 
                      textAlign: 'left',
                      fontWeight: 'bold',
                      border: '1px solid #ddd',
                      cursor: index !== 5 ? 'pointer' : 'default', // Disable cursor for checkbox column
                      userSelect: index !== 5 ? 'none' : 'text'
                    }}
                    onClick={() => index !== 5 && requestSort(key)}
                  >
                    <span style={{ display: 'flex', alignItems: 'center' }}>
                      {index === 5 ? 'Revision' : key}
                      {index !== 5 && <span style={{ marginLeft: '5px' }}>{getSortIndicator(key)}</span>}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedData.map((row, rowIndex) => {
                const decisionValue = row['Decision'] || row['decision'] || row['DECISION'] || '';
                const isDecrease = decisionValue.toString().toLowerCase() === 'decrease';
                const isRowSelected = selectedRows.includes(rowIndex);
                
                return (
                  <tr 
                    key={rowIndex} 
                    style={getRowStyle(row)}
                  >
                    {columnKeys.map((key, colIndex) => {
                      // If this is the 6th column (index 5), render checkbox
                      if (colIndex === 5) {
                        return (
                          <td 
                            key={colIndex} 
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
                              onChange={() => handleCheckboxChange(rowIndex, colIndex)}
                              disabled={isDecrease}
                              style={{ cursor: isDecrease ? 'not-allowed' : 'pointer' }}
                            />
                          </td>
                        );
                      } else {
                        // For other columns, render the data
                        return (
                          <td 
                            key={colIndex} 
                            style={{ 
                              padding: '8px', 
                              border: '1px solid #ddd',
                              verticalAlign: 'top'
                            }}
                          >
                            {row[key]}
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
        <p>No data found in Excel file.</p>
      )}
      
      {/* Revision Modal */}
      {showModal && (
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
            maxWidth: '90%'
          }}>
            <h3>Apply Revision</h3>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Decision:
              </label>
              <select
                value={decision}
                onChange={(e) => setDecision(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
              >
                <option value="">Select Decision</option>
                <option value="Option 1">Option 1</option>
                <option value="Option 2">Option 2</option>
              </select>
            </div>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Comment:
              </label>
              <select
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
              >
                <option value="">Select Comment</option>
                <option value="Option 1">Option 1</option>
                <option value="Option 2">Option 2</option>
              </select>
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Updated By:
              </label>
              <input
                type="text"
                value={updatedBy}
                onChange={(e) => setUpdatedBy(e.target.value)}
                placeholder="Enter name"
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
              />
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={closeModal}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#ccc',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitRevision}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
