from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any
import pandas as pd
import os

# Initialize FastAPI app
app = FastAPI(title="Excel API", description="API to read and update Excel files")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins - CHANGE THIS IN PRODUCTION
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic model for update request
from pydantic import BaseModel

class UpdateRow(BaseModel):
    index: int  # Row index to update
     Dict[str, Any]  # New values for this row

class UpdateRequest(BaseModel):
    updates: List[UpdateRow]  # List of rows to update

# GET endpoint to read Excel file
@app.get("/excel-data", response_model=List[dict])
async def get_excel_data():
    excel_file_path = "data.xlsx"  # Change this to your file path
    
    if not os.path.exists(excel_file_path):
        raise HTTPException(status_code=404, detail=f"Excel file '{excel_file_path}' not found")
    
    try:
        df = pd.read_excel(excel_file_path)
        data = df.to_dict(orient='records')
        
        # Convert any non-serializable values to None
        for row in 
            for key, value in row.items():
                if pd.isna(value):
                    row[key] = None
                elif isinstance(value, pd.Timestamp):
                    row[key] = value.isoformat()
        
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading Excel file: {str(e)}")

# PUT endpoint to update multiple rows and save back to Excel
@app.put("/excel-data", response_model=dict)
async def update_excel_data(update_request: UpdateRequest):
    excel_file_path = "data.xlsx"  # Change this to your file path
    
    if not os.path.exists(excel_file_path):
        raise HTTPException(status_code=404, detail=f"Excel file '{excel_file_path}' not found")
    
    try:
        # Read the Excel file
        df = pd.read_excel(excel_file_path)
        
        # Validate indices are within range
        max_index = len(df) - 1
        for update_row in update_request.updates:
            if update_row.index < 0 or update_row.index > max_index:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Index {update_row.index} is out of range (0-{max_index})"
                )
        
        # Apply updates
        for update_row in update_request.updates:
            index = update_row.index
            new_data = update_row.data
            
            # Update each column in the row
            for col, value in new_data.items():
                if col in df.columns:
                    df.at[index, col] = value
                else:
                    raise HTTPException(
                        status_code=400, 
                        detail=f"Column '{col}' does not exist in the Excel file"
                    )
        
        # Save the updated DataFrame back to Excel
        df.to_excel(excel_file_path, index=False)
        
        return {
            "message": "Excel file updated successfully",
            "updated_rows": len(update_request.updates),
            "file_path": excel_file_path
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating Excel file: {str(e)}")

# PUT endpoint to update Excel file with path parameter
@app.put("/excel-data/{file_path:path}", response_model=dict)
async def update_excel_data_with_path(file_path: str, update_request: UpdateRequest):
    # Validate file path
    if not file_path.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="File must be an Excel file (.xlsx or .xls)")
    
    excel_file_path = file_path
    
    if not os.path.exists(excel_file_path):
        raise HTTPException(status_code=404, detail=f"Excel file '{excel_file_path}' not found")
    
    try:
        # Read the Excel file
        df = pd.read_excel(excel_file_path)
        
        # Validate indices are within range
        max_index = len(df) - 1
        for update_row in update_request.updates:
            if update_row.index < 0 or update_row.index > max_index:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Index {update_row.index} is out of range (0-{max_index})"
                )
        
        # Apply updates
        for update_row in update_request.updates:
            index = update_row.index
            new_data = update_row.data
            
            # Update each column in the row
            for col, value in new_data.items():
                if col in df.columns:
                    df.at[index, col] = value
                else:
                    raise HTTPException(
                        status_code=400, 
                        detail=f"Column '{col}' does not exist in the Excel file"
                    )
        
        # Save the updated DataFrame back to Excel
        df.to_excel(excel_file_path, index=False)
        
        return {
            "message": "Excel file updated successfully",
            "updated_rows": len(update_request.updates),
            "file_path": excel_file_path
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating Excel file: {str(e)}")

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "OK", "message": "Excel API is running"}
