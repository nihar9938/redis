from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any
import pandas as pd
import os
import time
from threading import Lock

# Initialize FastAPI app
app = FastAPI(title="CSV API", description="API to read and update CSV files with pagination and caching")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins - CHANGE THIS IN PRODUCTION
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global cache and lock
csv_cache = {}
cache_lock = Lock()

def get_cached_dataframe(file_path: str):
    """Get cached DataFrame or read from file if not cached"""
    global csv_cache
    
    with cache_lock:
        if file_path not in csv_cache:
            df = pd.read_csv(file_path)
            csv_cache[file_path] = {
                'dataframe': df,
                'last_modified': os.path.getmtime(file_path),
                'timestamp': time.time()
            }
        else:
            # Check if file has been modified since caching
            current_modified = os.path.getmtime(file_path)
            if current_modified > csv_cache[file_path]['last_modified']:
                df = pd.read_csv(file_path)
                csv_cache[file_path] = {
                    'dataframe': df,
                    'last_modified': current_modified,
                    'timestamp': time.time()
                }
    
    return csv_cache[file_path]['dataframe']

def clear_cache_for_file(file_path: str):
    """Clear cache for specific file"""
    global csv_cache
    with cache_lock:
        if file_path in csv_cache:
            del csv_cache[file_path]

# Pydantic model for update request
from pydantic import BaseModel

class UpdateRow(BaseModel):
    index: int  # Row index to update
    data: Dict[str, Any]  # New values for this row

class UpdateRequest(BaseModel):
    updates: List[UpdateRow]  # List of rows to update

# Response model for paginated data
class PaginatedResponse(BaseModel):
     List[dict]
    total: int
    page: int
    size: int
    pages: int

# GET endpoint to read CSV file with pagination and caching
@app.get("/csv-data", response_model=PaginatedResponse)
async def get_csv_data(
    page: int = Query(1, ge=1, description="Page number (starting from 1)"),
    size: int = Query(500, ge=1, le=1000, description="Number of records per page (max 1000)"),
    file_path: str = Query("data.csv", description="CSV file path")
):
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"CSV file '{file_path}' not found")
    
    try:
        # Get cached or fresh DataFrame
        df = get_cached_dataframe(file_path)
        total_records = len(df)
        
        # Calculate pagination
        start_index = (page - 1) * size
        end_index = min(start_index + size, total_records)
        df_page = df.iloc[start_index:end_index]
        
        # Convert DataFrame to list of dictionaries
        data = df_page.to_dict(orient='records')
        
        # Convert any non-serializable values to None
        for row in 
            for key, value in row.items():
                if pd.isna(value):
                    row[key] = None
                elif isinstance(value, pd.Timestamp):
                    row[key] = value.isoformat()
        
        # Calculate total pages
        total_pages = (total_records + size - 1) // size  # Ceiling division
        
        return PaginatedResponse(
            data=data,
            total=total_records,
            page=page,
            size=size,
            pages=total_pages
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading CSV file: {str(e)}")

# GET endpoint to get all data (non-paginated) with caching
@app.get("/csv-data-all", response_model=List[dict])
async def get_csv_data_all(file_path: str = Query("data.csv", description="CSV file path")):
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"CSV file '{file_path}' not found")
    
    try:
        # Get cached or fresh DataFrame
        df = get_cached_dataframe(file_path)
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
        raise HTTPException(status_code=500, detail=f"Error reading CSV file: {str(e)}")

# PUT endpoint to update multiple rows and save back to CSV
@app.put("/csv-data", response_model=dict)
async def update_csv_data(update_request: UpdateRequest, file_path: str = Query("data.csv", description="CSV file path")):
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"CSV file '{file_path}' not found")
    
    try:
        # Read the CSV file
        df = pd.read_csv(file_path)
        
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
            new_data = update_row.data  # This should now work correctly
            
            # Update each column in the row
            for col, value in new_data.items():
                if col in df.columns:
                    df.at[index, col] = value
                else:
                    raise HTTPException(
                        status_code=400, 
                        detail=f"Column '{col}' does not exist in the CSV file"
                    )
        
        # Save the updated DataFrame back to CSV
        df.to_csv(file_path, index=False)
        
        # Clear cache for this file since it was updated
        clear_cache_for_file(file_path)
        
        return {
            "message": "CSV file updated successfully",
            "updated_rows": len(update_request.updates),
            "file_path": file_path
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating CSV file: {str(e)}")

# PUT endpoint to update CSV file with path parameter
@app.put("/csv-data/{file_path:path}", response_model=dict)
async def update_csv_data_with_path(file_path: str, update_request: UpdateRequest):
    # Validate file path
    if not file_path.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV file (.csv)")
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"CSV file '{file_path}' not found")
    
    try:
        # Read the CSV file
        df = pd.read_csv(file_path)
        
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
            new_data = update_row.data  # This should now work correctly
            
            # Update each column in the row
            for col, value in new_data.items():
                if col in df.columns:
                    df.at[index, col] = value
                else:
                    raise HTTPException(
                        status_code=400, 
                        detail=f"Column '{col}' does not exist in the CSV file"
                    )
        
        # Save the updated DataFrame back to CSV
        df.to_csv(file_path, index=False)
        
        # Clear cache for this file since it was updated
        clear_cache_for_file(file_path)
        
        return {
            "message": "CSV file updated successfully",
            "updated_rows": len(update_request.updates),
            "file_path": file_path
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating CSV file: {str(e)}")


# GET endpoint to get monthly summary data (non-paginated) with caching
@app.get("/summary-data-all", response_model=List[dict])
async def get_monthly_summary_data(
    month: str = Query(..., description="Month name for summary file (e.g., january, february, etc.)")
):
    # Validate month parameter
    valid_months = [
        "january", "february", "march", "april", "may", "june",
        "july", "august", "september", "october", "november", "december"
    ]
    
    if month.lower() not in valid_months:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid month. Valid months are: {', '.join(valid_months)}"
        )
    
    file_path = f"{month.lower()}_summary.csv"
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"Monthly summary CSV file '{file_path}' not found")
    
    try:
        # Get cached or fresh DataFrame
        df = get_cached_dataframe(file_path)
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
        raise HTTPException(status_code=500, detail=f"Error reading monthly summary CSV file: {str(e)}")

# Clear cache endpoint
@app.post("/clear-cache")
async def clear_cache(file_path: str = Query("data.csv", description="CSV file path")):
    clear_cache_for_file(file_path)
    return {"message": f"Cache cleared for {file_path}"}

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "OK", "message": "CSV API is running"}

# Cache info endpoint
@app.get("/cache-info")
async def cache_info():
    return {
        "cached_files": list(csv_cache.keys()),
        "cache_size": len(csv_cache)
    }
