from fastapi import FastAPI, HTTPException
from typing import List
import pandas as pd
import os

# Pydantic model for response
from pydantic import BaseModel

class ExcelRow(BaseModel):
    # This will be dynamically populated based on Excel columns
    pass

# Initialize FastAPI app
app = FastAPI(title="Excel API", description="API to read Excel files")

# GET endpoint to read Excel file
@app.get("/excel-data", response_model=List[dict])
async def get_excel_data():
    # Path to your Excel file
    excel_file_path = "data.xlsx"  # Change this to your file path
    
    # Check if file exists
    if not os.path.exists(excel_file_path):
        raise HTTPException(status_code=404, detail=f"Excel file '{excel_file_path}' not found")
    
    try:
        # Read Excel file using pandas
        df = pd.read_excel(excel_file_path)
        
        # Convert DataFrame to list of dictionaries
        data = df.to_dict(orient='records')
        
        # Convert any non-serializable values (like NaN) to None
        for row in data:
            for key, value in row.items():
                if pd.isna(value):
                    row[key] = None
                elif isinstance(value, pd.Timestamp):
                    row[key] = value.isoformat()
        
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading Excel file: {str(e)}")

# GET endpoint with file path parameter
@app.get("/excel-data/{file_path:path}", response_model=List[dict])
async def get_excel_data_with_path(file_path: str):
    # Validate file path
    if not file_path.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="File must be an Excel file (.xlsx or .xls)")
    
    # Construct full path (add security checks as needed)
    excel_file_path = file_path
    
    # Check if file exists
    if not os.path.exists(excel_file_path):
        raise HTTPException(status_code=404, detail=f"Excel file '{excel_file_path}' not found")
    
    try:
        # Read Excel file using pandas
        df = pd.read_excel(excel_file_path)
        
        # Convert DataFrame to list of dictionaries
        data = df.to_dict(orient='records')
        
        # Convert any non-serializable values (like NaN) to None
        for row in data:
            for key, value in row.items():
                if pd.isna(value):
                    row[key] = None
                elif isinstance(value, pd.Timestamp):
                    row[key] = value.isoformat()
        
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading Excel file: {str(e)}")

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "OK", "message": "Excel API is running"}
