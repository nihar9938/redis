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
# GET endpoint to get all data with month and cluster filtering
@app.get("/csv-data-all", response_model=List[dict])
async def get_csv_data_all(
    month: str = Query("january", description="Month name for CSV file (e.g., january, february, etc.)"),
    cluster: str = Query(None, description="Filter data by cluster name")
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
    
    file_path = f"{month.lower()}_data.csv"  # Month-based filename
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"CSV file '{file_path}' not found")
    
    try:
        # Get cached or fresh DataFrame
        df = get_cached_dataframe(file_path)
        
        # Apply cluster filter if provided
        if cluster is not None:
            if 'cluster' not in df.columns:
                raise HTTPException(
                    status_code=400, 
                    detail="CSV file does not contain a 'cluster' column"
                )
            
            # Filter rows where cluster matches
            df = df[df['cluster'].astype(str).str.lower() == cluster.lower()]
        
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





# PUT endpoint to update main CSV file using group_id and pattern as unique key
@app.put("/csv-data", response_model=dict)
async def update_csv_data(update_request: UpdateRequest, month: str = Query("january", description="Month name for CSV file")):
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
    
    data_file_path = f"{month.lower()}_data.csv"  # Month-based data filename
    summary_file_path = f"{month.lower()}_summary.csv"  # Month-based summary filename
    
    if not os.path.exists(data_file_path):
        raise HTTPException(status_code=404, detail=f"Data CSV file '{data_file_path}' not found")
    
    if not os.path.exists(summary_file_path):
        raise HTTPException(status_code=404, detail=f"Summary CSV file '{summary_file_path}' not found")
    
    try:
        # Read the data CSV file
        df = pd.read_csv(data_file_path)
        
        # Validate that data file has required columns
        if 'group_id' not in df.columns or 'pattern' not in df.columns:
            raise HTTPException(
                status_code=400, 
                detail="Data CSV file must contain 'group_id' and 'pattern' columns"
            )
        
        # Process the updates and extract cluster information
        cluster_counts = {}
        updated_rows_count = 0
        
        for update_row in update_request.updates:
            group_id = update_row.group_id
            pattern = update_row.pattern
            cluster_name = update_row.cluster  # Get cluster from the main object
            new_data = update_row.data  # This should now work correctly
            
            # Find the row with matching group_id and pattern in data CSV
            matching_rows = df[(df['group_id'].astype(str).str.lower() == group_id.lower()) & 
                              (df['pattern'].astype(str).str.lower() == pattern.lower())]
            
            if len(matching_rows) == 0:
                raise HTTPException(
                    status_code=404, 
                    detail=f"No row found with group_id '{group_id}' and pattern '{pattern}'"
                )
            elif len(matching_rows) > 1:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Multiple rows found with group_id '{group_id}' and pattern '{pattern}'"
                )
            
            # Get the index of the matching row
            row_index = matching_rows.index[0]
            
            # Count this update for the cluster
            cluster_name_lower = cluster_name.lower()
            if cluster_name_lower not in cluster_counts:
                cluster_counts[cluster_name_lower] = 0
            cluster_counts[cluster_name_lower] += 1
            
            # Update each column in the row (excluding group_id, pattern, and cluster if it was just for counting)
            for col, value in new_data.items():
                if col not in ['group_id', 'pattern', 'cluster']:  # Don't update these columns
                    if col in df.columns:
                        df.at[row_index, col] = value
                    else:
                        raise HTTPException(
                            status_code=400, 
                            detail=f"Column '{col}' does not exist in the data CSV file"
                        )
            
            updated_rows_count += 1
        
        # Update summary counts based on cluster information
        if cluster_counts:
            summary_df = pd.read_csv(summary_file_path)
            
            # Validate that summary file has required columns
            if 'cluster' not in summary_df.columns:
                raise HTTPException(
                    status_code=400, 
                    detail="Summary CSV file does not contain a 'cluster' column"
                )
            
            if 'increase' not in summary_df.columns or 'decrease' not in summary_df.columns:
                raise HTTPException(
                    status_code=400, 
                    detail="Summary CSV file must contain 'increase' and 'decrease' columns"
                )
            
            # Update counts for each cluster (cluster is unique key in summary)
            for cluster_name, count in cluster_counts.items():
                # Find the row for this cluster (cluster is the unique key in summary)
                cluster_row_idx = summary_df[summary_df['cluster'].astype(str).str.lower() == cluster_name].index
                
                if len(cluster_row_idx) > 0:
                    # Update increase and decrease counts
                    # Subtract from increase, add to decrease
                    current_increase = summary_df.at[cluster_row_idx[0], 'increase']
                    current_decrease = summary_df.at[cluster_row_idx[0], 'decrease']
                    
                    # Update the counts
                    summary_df.at[cluster_row_idx[0], 'increase'] = current_increase - count
                    summary_df.at[cluster_row_idx[0], 'decrease'] = current_decrease + count
                else:
                    # If cluster doesn't exist in summary, create a new row
                    # This might be a new cluster, so just add decrease count
                    new_row = {
                        'cluster': cluster_name,
                        'increase': 0,
                        'decrease': count
                    }
                    summary_df = pd.concat([summary_df, pd.DataFrame([new_row])], ignore_index=True)
            
            # Save updated summary file
            summary_df.to_csv(summary_file_path, index=False)
            # Clear cache for summary file
            clear_cache_for_file(summary_file_path)
        
        # Save the updated data DataFrame back to CSV
        df.to_csv(data_file_path, index=False)
        
        # Clear cache for both files since they were updated
        clear_cache_for_file(data_file_path)
        
        return {
            "message": "CSV file updated successfully and summary counts updated",
            "updated_rows": updated_rows_count,
            "cluster_counts": cluster_counts,
            "data_file_path": data_file_path,
            "summary_file_path": summary_file_path
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
