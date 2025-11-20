// src/SummaryPage.jsx (Updated with header renaming and aligned dropdowns)
import React, { useState, useEffect } from 'react';
import { useHistory, useLocation } from 'react-router-dom'; // For older React Router

const SummaryPage = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [month, setMonth] = useState(''); // Selected month
  const [category, setCategory] = useState('Alerts'); // Default to Alerts
  const [searchFilters, setSearchFilters] = useState({}); // Search filters for all columns
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [statusFilter, setStatusFilter] = useState(''); // Status filter
  const location = useLocation(); // For older React Router
  const history = useHistory(); // For navigation

  // Available months
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Available categories (with Alerts as default)
  const categories = [
    'Alerts', 'User Support', 'Manual Task'
  ];

  // Status options
  const statusOptions = [
    'Reviewed', 'Partially Reviewed', 'Not Reviewed'
  ];

  // Header mappings for display names
  const headerMappings = {
    'Q4Baseline': 'Q4 Baseline',
    'Decrease': 'Scope Creep Decrease',
    'Increase': 'Scope Creep Increase',
    'No Change': 'No Change',
    'Senior Manager': 'Senior Manager',
    'Cluster Lead': 'Cluster Lead',
    'Decision': 'Decision',
    'Cluster': 'Cluster',
    'Pattern': 'Pattern',
    'GroupId': 'Group Id',
    'Status': 'Status',
    'Comment': 'Comment',
    'UpdatedBy': 'Updated By',
    'UpdatedTime': 'Updated Time'
  };

  // Extract month from URL
  const getMonthFromUrl = () => {
    const searchParams = new URLSearchParams(location.search);
    const monthParam = searchParams.get('month');
    return { month: monthParam };
  };

  // Set month from URL parameter
  useEffect(() => {
    const params = getMonthFromUrl();
    if (params.month) {
      setMonth(params.month);
    }
  }, [location.search]);

  useEffect(() => {
    const fetchData = async () => {
      if (!month) return; // Don't fetch if no month is selected
      
      try {
        setLoading(true);
        setError('');
        
        // Build API URL with month and category parameters
        const apiUrl = `http://localhost:8000/summary-data?month=${encodeURIComponent(month)}&category=${encodeURIComponent(category)}`; // Replace with your API endpoint
        
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const jsonData = await response.json();
        
        // Process data to replace empty/null/undefined values with "0"
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

    if (month) {
      fetchData();
    }
  }, [month, category]); // Re-fetch when month or category changes

  // Apply filters (search and status)
  const filteredData = React.useMemo(() => {
    return data.filter(row => {
      // Apply status filter
      if (statusFilter) {
        const statusValue = row['Status'] || row['status'] || row['STATUS'] || '';
        if (statusValue.toString().toLowerCase() !== statusFilter.toLowerCase()) {
          return false;
        }
      }
      
      // Apply search filters
      return Object.keys(searchFilters).every(key => {
        if (!searchFilters[key]) return true;
        const cellValue = row[key] || '0'; // Default to '0' if empty
        return cellValue.toString().toLowerCase().includes(searchFilters[key].toLowerCase());
      });
    });
  }, [data, searchFilters, statusFilter]);

  // Sorting function
  const sortedData = React.useMemo(() => {
    if (!sortConfig.key) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      // Handle empty values (treated as '0')
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

  // Handle category change
  const handleCategoryChange = (e) => {
    const selectedCategory = e.target.value;
    setCategory(selectedCategory);
  };

  // Handle status filter change
  const handleStatusChange = (e) => {
    setStatusFilter(e.target.value);
  };

  // Handle search filter change
  const handleSearchChange = (key, value) => {
    setSearchFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Handle Increase column click - redirect to dashboard with cluster, month, and category parameters
  const handleIncreaseClick = (row) => {
    // Find the cluster value in the row
    const clusterValue = row['Cluster'] || row['cluster'] || row['CLUSTER'] || '';
    if (clusterValue && clusterValue !== '0' && month) {
      // Navigate to dashboard with cluster, month, and category parameters
      const newParams = new URLSearchParams();
      newParams.set('cluster', clusterValue);
      newParams.set('month', month);
      newParams.set('category', category); // Pass category parameter
      
      history.push({
        pathname: '/dashboard',
        search: newParams.toString()
      });
    }
  };

  if (loading && month) return <div>Loading data for {month}...</div>;

  // Get column keys for rendering (before header mapping)
  const columnKeys = Object.keys(data[0] || {});

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <h2>Summary Page</h2>
      
      {/* Month, Category, and Status Dropdowns in a single row */}
      <div style={{ 
        marginBottom: '20px', 
        display: 'flex', 
        gap: '15px', 
        alignItems: 'center', 
        flexWrap: 'wrap',
        backgroundColor: '#f0f0f0',
        padding: '10px',
        borderRadius: '4px'
      }}>
        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
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
            <option value="">Select Month</option>
            {months.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        
        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
          <label style={{ fontWeight: 'bold' }}>
            Category:
          </label>
          <select
            value={category}
            onChange={handleCategoryChange}
            style={{
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        
        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
          <label style={{ fontWeight: 'bold' }}>
            Status:
          </label>
          <select
            value={statusFilter}
            onChange={handleStatusChange}
            style={{
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          >
            <option value="">All Statuses</option>
            {statusOptions.map(option => (
              <option key={option} value={option}>{option}</option>
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
      
      {/* Save Button - Conditional based on select all state */}
      <button 
        onClick={handleBulkSave}
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
        Save All Changes
      </button>
      
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
                    Revision
                  </th>
                  {columnKeys.map((key) => {
                    // Get the display name for the header
                    const displayName = headerMappings[key] || key;
                    
                    return (
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
                            {displayName} {/* Use mapped display name */}
                            <span style={{ marginLeft: '5px' }}>{getSortIndicator(key)}</span>
                          </span>
                          {/* Show search input for Senior Manager, Cluster Lead, and Cluster columns */}
                          {(key.toLowerCase() === 'senior manager' || 
                            key.toLowerCase() === 'cluster lead' || 
                            key.toLowerCase() === 'cluster') && (
                            <input
                              type="text"
                              placeholder={`Search ${displayName}...`}
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
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {sortedData.map((row, rowIndex) => {
                  // Check if this is an "Increase" column
                  const isIncreaseColumn = (key) => {
                    const lowerKey = key.toLowerCase();
                    return lowerKey.includes('increase') || lowerKey.includes('scope creep increase');
                  };
                  
                  return (
                    <tr 
                      key={rowIndex} 
                      style={{ 
                        backgroundColor: rowIndex % 2 === 0 ? 'white' : '#f9f9f9'
                      }}
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
                          backgroundColor: rowIndex % 2 === 0 ? 'white' : '#f9f9f9',
                          width: '80px'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedRows.includes(rowIndex)}
                          onChange={() => handleCheckboxChange(rowIndex)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                      
                      {/* Data Columns */}
                      {columnKeys.map((key, colIndex) => {
                        const cellValue = row[key] || '0'; // Default to '0' if empty
                        const isIncreaseCol = isIncreaseColumn(key);
                        
                        return (
                          <td 
                            key={`data-${rowIndex}-${key}`} 
                            style={{ 
                              padding: '8px', 
                              border: '3px solid #ddd',
                              verticalAlign: 'top',
                              cursor: isIncreaseCol ? 'pointer' : 'default',
                              color: isIncreaseCol ? '#1976D2' : 'inherit', // Blue color for increase column
                              textDecoration: isIncreaseCol ? 'none' : 'none' // Will be underlined on hover
                            }}
                            onClick={isIncreaseCol ? () => handleIncreaseClick(row) : undefined}
                            onMouseEnter={(e) => {
                              if (isIncreaseCol) {
                                e.target.style.textDecoration = 'underline';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (isIncreaseCol) {
                                e.target.style.textDecoration = 'none';
                              }
                            }}
                          >
                            {cellValue}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : month ? (
          <p>No data found for {month} and category {category}.</p>
        ) : (
          <p>Please select a month to view summary data.</p>
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

export default SummaryPage;
