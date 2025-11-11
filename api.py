// src/Dashboard.jsx
import React, { useState, useEffect, useRef } from 'react';

// Custom Input Component to handle React reconciliation issues
const CommentInput = ({ value, onChange, placeholder, rowIndex }) => {
  const inputRef = useRef(null);
  
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.value = value || '';
    }
  }, [value, rowIndex]);

  return (
    <input
      ref={inputRef}
      type="text"
      defaultValue={value || ''}
      onChange={onChange}
      placeholder={placeholder}
      style={{
        width: '100%',
        padding: '4px',
        border: '1px solid #ccc',
        borderRadius: '2px',
        boxSizing: 'border-box'
      }}
    />
  );
};

// Custom Dropdown Component for Decision
const DecisionDropdown = ({ value, onChange, rowIndex }) => {
  const dropdownRef = useRef(null);
  
  useEffect(() => {
    if (dropdownRef.current) {
      dropdownRef.current.value = value || '';
    }
  }, [value, rowIndex]);

  return (
    <select
      ref={dropdownRef}
      defaultValue={value || ''}
      onChange={onChange}
      style={{
        width: '100%',
        padding: '4px',
        border: '1px solid #ccc',
        borderRadius: '2px',
        boxSizing: 'border-box'
      }}
    >
      <option value="">Select Decision</option>
      <option value="No Change">No Change</option>
      <option value="Increase">Increase</option>
      <option value="Decrease">Decrease</option>
    </select>
  );
};

const Dashboard = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] =
