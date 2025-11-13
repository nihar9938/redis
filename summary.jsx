// src/SummaryPage.jsx
import React, { useState, useEffect } from 'react';
import { useHistory, useLocation } from 'react-router-dom'; // For older React Router

const SummaryPage = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [month, setMonth] = useState(''); // Selected month
  const [searchCluster, setSearchCluster] = useState(''); // Cluster search
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const history = useHistory(); // Hook for navigation (older version)
  const location = useLocation(); // For older React Router

  // Available months
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Extract parameters from URL
  const getParamsFromUrl = () => {
    const searchParams = new URLSearchParams(location.search);
    const monthParam = searchParams.get('month');
    return { month: monthParam };
  };

  // Set month from URL parameter
  useEffect(() => {
    const params = getParamsFromUrl();
    if (params.month) {
      setMonth(params.month);
    }
  }, []);

  // Fetch data based on selected month
  useEffect(() => {
    const fetchData = async () => {
      if (!month) return; // Don't fetch if no month is selected
      
      try {
        setLoading(true);
        setError('');
        
        // Fetch data from MongoDB with month query
        const response = await fetch(`http://localhost:8000/summary-data?month=${month}`); // Replace with your API endpoint
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const jsonData = await response.json();
        
        // Replace empty/null/undefined values with "0"
        const processedData = jsonData.map(row => {
          const newRow = {};
          for (const key in row) {
            if (row[key] === null || row[key] === undefined || row[key] === '') {
              newRow[key] = '0';
            } else {
              newRow[key] = row[key];
            }
          }
          return newRow;
        });
        
        setData(processedData);
      } catch (error) {
        setError('Error loading data from MongoDB: ' + error.message);
        console.error('Error loading ', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [month]); // Re-fetch when month changes

  // Apply cluster search filter
  const filteredData = React.useMemo(() => {
    if (!searchCluster) return data;
    
    return data.filter(row => {
      const clusterValue = row['Cluster'] || row['cluster'] || row['CLUSTER'] || '';
      return clusterValue.toString().toLowerCase().includes(searchCluster.toLowerCase());
    });
  }, [data, searchCluster]);

  // Sorting function
  const sortedData = React.useMemo(() => {
    if (!sortConfig.key) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      // Handle empty values
      if (aValue === '0' && bValue === '0') return 0;
      if (aValue === '0') return sortConfig.direction === 'asc' ? 1 : -1;
      if (bValue === '0') return sortConfig.direction === 'asc' ? -1 : 1;

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

  // Handle month change
  const handleMonthChange = (e) => {
    const selectedMonth = e.target.value;
    setMonth(selectedMonth);
    
    // Update URL with month parameter
    const newParams = new URLSearchParams();
    if (selectedMonth) {
      newParams.set('month', selectedMonth);
    }
    
    history.push({
      pathname: location.pathname,
      search: newParams.toString()
    });
  };

  // Handle cluster search change
  const handleClusterSearchChange = (e) => {
    setSearchCluster(e.target.value);
  };

  // Handle Increase column click - redirect to dashboard with cluster and month parameters
  const handleIncreaseClick = (row) => {
    // Find the cluster value in the row
    const clusterValue = row['Cluster'] || row['cluster'] || row['CLUSTER'] || '';
    if (clusterValue && clusterValue !== '0' && month) {
      // Navigate to dashboard with both cluster and month parameters
      const newParams = new URLSearchParams();
      newParams.set('cluster', clusterValue);
      newParams.set('month', month);
      
      history.push({
        pathname: '/dashboard',
        search: newParams.toString()
      });
    }
  };

  if (loading && month) return <div>Loading data for {month}...</div>;

  // Get column keys for rendering (excluding month since it's in the dropdown)
  const columnKeys = Object.keys(data[0] || {}).filter(key => key.toLowerCase() !== 'month');

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <h2>Summary Page</h2>
      
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
          <option value="">Choose a month</option>
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
      
      {/* Scrollable Table Container with Fixed Header */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', marginBottom: '0' }}>
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
                      {/* Only show search input for Cluster column */}
                      {key.toLowerCase() === 'cluster' && (
                        <input
                          type="text"
                          placeholder={`Search ${key}...`}
                          value={searchCluster}
                          onChange={handleClusterSearchChange}
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
              {sortedData.map((row, rowIndex) => (
                <tr 
                  key={rowIndex} 
                  style={{ 
                    backgroundColor: rowIndex % 2 === 0 ? 'white' : '#f9f9f9'
                  }}
                >
                  {columnKeys.map((key, colIndex) => {
                    // Check if this is the "Increase" column
                    const isIncreaseColumn = key.toLowerCase().includes('increase');
                    
                    return (
                      <td 
                        key={`data-${rowIndex}-${key}`} 
                        style={{ 
                          padding: '8px', 
                          border: '3px solid #ddd',
                          verticalAlign: 'top',
                          cursor: isIncreaseColumn ? 'pointer' : 'default'
                        }}
                        onClick={isIncreaseColumn ? () => handleIncreaseClick(row) : undefined}
                      >
                        {row[key] || '0'} {/* Show '0' if value is empty */}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {!month && <p style={{ marginTop: '20px' }}>Please select a month to view summary data.</p>}
    </div>
  );
};

export default SummaryPage;
