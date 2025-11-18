// src/SummaryPage.jsx (Updated with bullet points instead of dropdown)
import React, { useState, useEffect } from 'react';
import { useHistory, useLocation } from 'react-router-dom'; // For older React Router

const SummaryPage = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('Alerts'); // Default to Alerts
  const [month, setMonth] = useState('October'); // Default to October
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [searchFilters, setSearchFilters] = useState({});

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
    const categoryParam = searchParams.get('category');
    const monthParam = searchParams.get('month');
    return { category: categoryParam, month: monthParam };
  };

  // Set category and month from URL parameters (with Alerts as default)
  useEffect(() => {
    const params = getParamsFromUrl();
    setCategory(params.category || 'Alerts'); // Default to Alerts if no category in URL
    setMonth(params.month || 'October'); // Default to October if no month in URL
  }, [location.search]);

  useEffect(() => {
    const fetchData = async () => {
      if (!category || !month) return; // Don't fetch if no category or month is selected
      
      try {
        setLoading(true);
        setError('');
        
        // Build API URL with category and month parameters
        const apiUrl = `http://localhost:8000/summary-data?category=${encodeURIComponent(category)}&month=${encodeURIComponent(month)}`; // Replace with your API endpoint
        
        const response = await fetch(apiUrl);
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

    if (category && month) {
      fetchData();
    }
  }, [category, month]); // Re-fetch when category or month changes

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

  // Handle category change (click handler for bullet points)
  const handleCategoryChange = (selectedCategory) => {
    setCategory(selectedCategory);
    
    // Update URL with category parameter
    const newParams = new URLSearchParams();
    newParams.set('category', selectedCategory);
    if (month) {
      newParams.set('month', month);
    }
    
    history.push({
      pathname: location.pathname,
      search: newParams.toString()
    });
  };

  // Handle month change
  const handleMonthChange = (e) => {
    const selectedMonth = e.target.value;
    setMonth(selectedMonth);
    
    // Update URL with month parameter
    const newParams = new URLSearchParams();
    if (category) {
      newParams.set('category', category);
    }
    if (selectedMonth) {
      newParams.set('month', selectedMonth);
    }
    
    history.push({
      pathname: location.pathname,
      search: newParams.toString()
    });
  };

  // Handle search filter change
  const handleSearchChange = (key, value) => {
    setSearchFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  if (loading && category && month) return <div>Loading {category} data for {month}...</div>;

  // Get column keys for rendering (excluding category and month since they're in controls)
  const columnKeys = Object.keys(data[0] || {}).filter(key => 
    key.toLowerCase() !== 'category' && key.toLowerCase() !== 'month'
  );

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <h2>Summary Page</h2>
      
      {/* Category Bullets and Month Dropdown */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <span style={{ fontWeight: 'bold' }}>Categories:</span>
          {['Alerts', 'User Support Ticket', 'Manual Task'].map(cat => (
            <div
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              style={{
                padding: '8px 12px',
                border: '2px solid ' + (category === cat ? '#2196F3' : '#ccc'),
                backgroundColor: category === cat ? '#E3F2FD' : 'white',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: category === cat ? 'bold' : 'normal',
                color: category === cat ? '#1976D2' : 'black'
              }}
            >
              • {cat}
            </div>
          ))}
        </div>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <label style={{ fontWeight: 'bold' }}>
            Month:
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
      
      {/* Scrollable Table Container */}
      <div style={{ flex: 1, overflow: 'auto', marginBottom: '20px' }}>
        {category && month && data.length > 0 ? (
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
                {sortedData.map((row, rowIndex) => {
                  return (
                    <tr 
                      key={rowIndex} 
                      style={{ 
                        backgroundColor: rowIndex % 2 === 0 ? 'white' : '#f9f9f9'
                      }}
                    >
                      {columnKeys.map((key, colIndex) => {
                        // Check if this is an "Increase" column
                        const isIncreaseColumn = key.toLowerCase().includes('increase');
                        
                        return (
                          <td 
                            key={`data-${rowIndex}-${key}`} 
                            style={{ 
                              padding: '8px', 
                              border: '3px solid #ddd',
                              verticalAlign: 'top',
                              cursor: isIncreaseColumn ? 'pointer' : 'default',
                              backgroundColor: isIncreaseColumn ? '#e3f2fd' : 'inherit' // Blue highlight for Increase columns
                            }}
                            onClick={isIncreaseColumn ? () => {
                              // Find the cluster value in the row
                              const clusterValue = row['Cluster'] || row['cluster'] || row['CLUSTER'] || '';
                              if (clusterValue && clusterValue !== '0' && month) {
                                // Navigate to dashboard with cluster and month parameters
                                const newParams = new URLSearchParams();
                                newParams.set('cluster', clusterValue);
                                newParams.set('month', month);
                                
                                history.push({
                                  pathname: '/dashboard',
                                  search: newParams.toString()
                                });
                              }
                            } : undefined}
                            onMouseEnter={(e) => {
                              if (isIncreaseColumn) {
                                e.target.style.textDecoration = 'underline';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (isIncreaseColumn) {
                                e.target.style.textDecoration = 'none';
                              }
                            }}
                          >
                            {row[key] || '0'} {/* Show '0' if value is empty */}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : category && month ? (
          <p>No data found for {category} in {month}.</p>
        ) : (
          <p>Please select both a category and a month to view data.</p>
        )}
      </div>
    </div>
  );
};

export default SummaryPage;
