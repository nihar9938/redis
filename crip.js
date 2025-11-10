import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

const Dashboard = () => {
  const [tableData, setTableData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch and process the Excel file
    const fetchData = async () => {
      try {
        // Replace 'data.xlsx' with your actual file name
        const response = await fetch('/data.xlsx');
        const arrayBuffer = await response.arrayBuffer();
        
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        
        // Convert to JSON with headers
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        
        if (jsonData.length === 0) {
          setTableData([]);
          setHeaders([]);
          setLoading(false);
          return;
        }

        // First row as headers
        const headers = jsonData[0];
        const rows = jsonData.slice(1).map(row => {
          const obj = {};
          headers.forEach((header, index) => {
            obj[header] = row[index] || '';
          });
          return obj;
        });

        setHeaders(headers);
        setTableData(rows);
      } catch (error) {
        console.error('Error loading Excel file:', error);
        alert('Error loading file: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <div>Loading Excel data...</div>;

  return (
    <div className="dashboard">
      <h1>Excel Data Dashboard</h1>
      
      <table className="data-table">
        <thead>
          <tr>
            {headers.map(header => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tableData.map((row, index) => (
            <tr key={index}>
              {headers.map(header => (
                <td key={header}>{row[header]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Dashboard;
