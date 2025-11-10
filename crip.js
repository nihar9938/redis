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
        const response = await fetch('/data.xlsx');
        if (!response.ok) throw new Error('Failed to load file');
        
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        
        if (jsonData.length === 0) {
          setError('No data found in Excel file');
          return;
        }

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

  if (loading) return <div style={{ padding: '20px' }}>Loading Excel data...</div>;
  if (error) return <div style={{ padding: '20px', color: 'red' }}>Error: {error}</div>;

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Excel Data Dashboard</h1>
      
      <table 
        style={{ 
          borderCollapse: 'collapse', 
          width: '100%', 
          border: '1px solid #ddd' 
        }}
      >
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
    </div>
  );
};

export default Dashboard;
