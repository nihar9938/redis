// src/Dashboard.jsx
import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';

const Dashboard = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [searchTerm, setSearchTerm] = useState(''); // ← New state for search

  // Normalize and find cluster column name (case-insensitive)
  const findClusterColumn = (headers) => {
    const clusterKey = headers.find(
      key => typeof key === 'string' && key.trim().toLowerCase() === 'cluster'
    );
    return clusterKey || null;
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
          setLoading(false);
          return;
        }
        
        const rawHeaders = jsonData[0];
        const headers = rawHeaders.map(h => (h != null ? String(h) : ''));
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
        setError('Failed to load Excel file. Please check if data.xlsx exists in the public folder.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Find cluster column once data is loaded
  const clusterColumn = useMemo(() => {
    if (data.length > 0) {
      return findClusterColumn(Object.keys(data[0]));
    }
    return null;
  }, [data]);

  // Sorted + Filtered data
  const filteredAndSortedData = useMemo(() => {
    let result = [...data];

    // Apply search filter (only if cluster column exists)
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
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortIndicator = (key) => {
    if (sortConfig.key !== key) return '↕️';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading Excel data...</div>;
  if (error) return <div style={{ color: 'red', padding: '20px' }}>{error}</div>;

  // Safely get columns
  const columns = data.length > 0 ? Object.keys(data[0]) : [];

  if (columns.length === 0) {
    return <p style={{ padding: '20px' }}>No data found in Excel file.</p>;
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h2>Excel Data Dashboard</h2>

      {/* Search Bar - only show if cluster column exists */}
      {clusterColumn ? (
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="cluster-search" style={{ fontWeight: 'bold', marginRight: '8px' }}>
            Search Cluster:
          </label>
          <input
            id="cluster-search"
            type="text"
            placeholder="Type to filter clusters..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: '6px 10px',
              fontSize: '14px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              width: '300px',
              maxWidth: '100%'
            }}
          />
          {searchTerm && (
            <span
              style={{ marginLeft: '10px', fontSize: '12px', color: '#666' }}
            >
              Showing {filteredAndSortedData.length} of {data.length} rows
            </span>
          )}
        </div>
      ) : (
        <p style={{ color: '#d9534f', marginBottom: '15px' }}>
          ⚠️ "cluster" column not found. Search disabled.
        </p>
      )}

      {filteredAndSortedData.length > 0 ? (
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
              {filteredAndSortedData.map((row, index) => (
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
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>No matching data found.</p>
      )}
    </div>
  );
};

export default Dashboard;
