import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

const Dashboard = () => {
  const [tableData, setTableData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Replace 'data.xlsx' with your actual file name
        const response = await fetch('/data.xlsx');
        if (!response.ok) throw new Error('Failed to load file');
        
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Get data with headers
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1,
          defval: ''  // Default value for empty cells
        });
        
        if (jsonData.length === 0) {
          setError('No data found in Excel file');
          return;
        }

        // First row as headers
        const headers = jsonData[0];
        const rows = jsonData.slice(1).map(row => {
          const obj = {};
          headers.forEach((header, index) => {
            obj[header] = row[index] !== undefined ? row[index] : '';
          });
          return obj;
        });

        setHeaders(headers);
        setTableData(rows);
      } catch (err) {
        console.error('Error processing Excel file:', err);
        setError('Error processing file: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <div>Loading Excel data...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="dashboard">
      <h1>Excel Data Dashboard</h1>
      
      {/* Always render table element if data exists */}
      <div className="table-container">
        {headers.length > 0 && tableData.length > 0 ? (
          <table className="data-table" style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                {headers.map((header, index) => (
                  <th 
                    key={index} 
                    style={{
                      border: '1px solid #ddd',
                      padding: '8px',
                      backgroundColor: '#f2f2f2',
                      textAlign: 'left'
                    }}
                  >
                    {header || `Column ${index + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {headers.map((header, colIndex) => (
                    <td 
                      key={colIndex}
                      style={{
                        border: '1px solid #ddd',
                        padding: '8px',
                        textAlign: 'left'
                      }}
                    >
                      {String(row[header] || '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div>
            <p>No valid data found in the Excel file</p>
            <p>Headers found: {headers.length}</p>
            <p>Data rows found: {tableData.length}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
