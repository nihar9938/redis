// src/Dashboard.jsx
import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';

const Dashboard = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [searchTerm, setSearchTerm] = useState('');

  // Find cluster column (case-insensitive)
  const findClusterColumn = (headers) => {
    return headers.find(key => 
      typeof key === 'string' && key.trim().toLowerCase() === 'cluster'
    ) || null;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setError(null);
        const response = await fetch('/data.xlsx');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const buffer = await response.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length === 0 || !jsonData[0]?.length) {
          setData([]);
          return;
        }
        
        const headers = jsonData[0].map(h => (h != null ? String(h) : ''));
        const rows = jsonData.slice(1);
        const formattedData = rows.map(row => {
          const obj = {};
          headers.forEach((header, index) => {
            obj[header] = row[index] != null ? row[index] : '';
          });
          return obj;
        });
        
        setData(formattedData);
      } catch (err) {
        console.error('Error loading Excel file:', err);
        setError('Failed to load Excel file. Please ensure `data.xlsx` exists in the public folder.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const columns = data.length > 0 ? Object.keys(data[0]) : [];
  const clusterColumn = findClusterColumn(columns);

  const filteredAndSortedData = useMemo(() => {
    let result = [...data];

    // Apply cluster search
    if (clusterColumn && searchTerm.trim() !== '') {
      const term = searchTerm.trim().toLowerCase();
      result = result.filter(row =>
        String(row[clusterColumn]).toLowerCase().includes(term)
      );
    }

    // Apply sorting
    if (sortConfig.key) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue === '' && bValue === '') return 0;
        if (aValue === '') return sortConfig.direction === 'asc' ? 1 : -1;
        if (bValue === '') return sortConfig.direction === 'asc' ? -1 : 1;

        const aNum = Number(aValue);
        const bNum = Number(bValue);
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
        }

        const aStr = String(aValue).toLowerCase();
        const bStr = String(bValue).toLowerCase();
        if (aStr < bStr) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aStr > bStr) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [data, sortConfig, searchTerm, clusterColumn]);

  const requestSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortIndicator = (key) => {
    if (sortConfig.key !== key) return '↕️';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading Excel data...</div>;
  if (error) return <div style={{ color: 'red', padding: '20px' }}>{error}</div>;
  if (columns.length === 0) return <p style={{ padding: '20px' }}>No data found.</p>;

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h2>Excel Data Dashboard</h2>

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
              {columns.map((key) => (
                <th 
                  key={key} 
                  style={{ 
                    padding: '8px', 
                    textAlign: 'left',
                    fontWeight: 'bold',
                    border: '1px solid #ddd',
                    cursor: 'pointer',
                    userSelect: 'none',
                    verticalAlign: 'top'
                  }}
                  onClick={() => requestSort(key)}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {/* Header Label */}
                    <span style={{ display: 'flex', alignItems: 'center' }}>
                      {key}
                      <span style={{ marginLeft: '5px' }}>{getSortIndicator(key)}</span>
                    </span>

                    {/* Search Input — only for cluster column */}
                    {key.toLowerCase() === 'cluster' && (
                      <input
                        type="text"
                        placeholder="Search cluster..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onClick={(e) => e.stopPropagation()} // Prevent sort on input click
                        style={{
                          padding: '4px 6px',
                          fontSize: '12px',
                          border: '1px solid #aaa',
                          borderRadius: '3px',
                          width: '100%',
                          boxSizing: 'border-box'
                        }}
                      />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedData.length > 0 ? (
              filteredAndSortedData.map((row, index) => (
                <tr key={index}>
                  {columns.map((col, i) => (
                    <td 
                      key={i} 
                      style={{ 
                        padding: '8px', 
                        border: '1px solid #ddd',
                        verticalAlign: 'top',
                        maxWidth: '200px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                      title={String(row[col])}
                    >
                      {row[col]}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td 
                  colSpan={columns.length} 
                  style={{ padding: '16px', textAlign: 'center', fontStyle: 'italic' }}
                >
                  No matching data found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Dashboard;
