// src/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

const Dashboard = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

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

  if (loading) return <div>Loading Excel data...</div>;

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h2>Excel Data Dashboard</h2>
      
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
                {Object.keys(data[0]).map((key) => (
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
                    <span style={{ display: 'flex', alignItems: 'center' }}>
                      {key}
                      <span style={{ marginLeft: '5px' }}>{getSortIndicator(key)}</span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedData.map((row, index) => (
                <tr 
                  key={index} 
                  style={getRowStyle(row)}
                >
                  {Object.values(row).map((value, i) => (
                    <td 
                      key={i} 
                      style={{ 
                        padding: '8px', 
                        border: '1px solid #ddd',
                        verticalAlign: 'top'
                      }}
                    >
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>No data found in Excel file.</p>
      )}
    </div>
  );
};

export default Dashboard;
