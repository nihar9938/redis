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

# GET endpoint to get all data with month and cluster filtering, but only Decision = increase
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
        
        # Apply Decision filter first (only include rows where Decision = increase)
        if 'Decision' not in df.columns:
            raise HTTPException(
                status_code=400, 
                detail="CSV file does not contain a 'Decision' column"
            )
        
        # Filter rows where Decision is 'increase' (case-insensitive)
        df = df[df['Decision'].astype(str).str.lower() == 'increase']
        
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
        
        # Process the updates and extract cluster information with ticket counts
        cluster_ticket_counts = {}
        updated_rows_count = 0
        
        for update_row in update_request.updates:
            group_id = update_row.group_id
            pattern = update_row.pattern
            cluster_name = update_row.cluster  # Get cluster from the main object
            ticket_count = update_row.ticket_count  # Get ticket count from the main object
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
            
            # Check if Decision in the API payload is "No change" to determine if summary should be updated
            decision_in_payload = new_data.get('Decision', '').lower()
            
            if decision_in_payload == 'no change':
                # Count this update for the cluster (using ticket count) only if Decision in payload is "No change"
                cluster_name_lower = cluster_name.lower()
                if cluster_name_lower not in cluster_ticket_counts:
                    cluster_ticket_counts[cluster_name_lower] = 0
                cluster_ticket_counts[cluster_name_lower] += ticket_count
            
            # Update each column in the row (excluding group_id, pattern, and cluster if it was just for counting)
            for col, value in new_data.items():
                if col not in ['group_id', 'pattern', 'cluster', 'ticket_count']:  # Don't update these columns
                    if col in df.columns:
                        # Handle type conversion properly to avoid FutureWarning
                        current_dtype = df[col].dtype
                        
                        # If the column is numeric and we're trying to assign a string, convert appropriately
                        if pd.api.types.is_numeric_dtype(current_dtype) and not pd.isna(value) and not isinstance(value, (int, float)):
                            try:
                                # Try to convert the value to numeric
                                numeric_value = pd.to_numeric(value, errors='coerce')
                                df.at[row_index, col] = numeric_value
                            except:
                                # If conversion fails, set to NaN or keep original
                                df.at[row_index, col] = value
                        else:
                            # For non-numeric columns or when value is already numeric, just assign
                            df.at[row_index, col] = value
                    else:
                        raise HTTPException(
                            status_code=400, 
                            detail=f"Column '{col}' does not exist in the data CSV file"
                        )
            
            updated_rows_count += 1
        
        # Update summary counts based on cluster information with ticket counts (only for "No change" decisions in payload)
        if cluster_ticket_counts:
            summary_df = pd.read_csv(summary_file_path)
            
            # Validate that summary file has required columns
            if 'Cluster' not in summary_df.columns:
                raise HTTPException(
                    status_code=400, 
                    detail="Summary CSV file does not contain a 'Cluster' column"
                )
            
            if 'Increase' not in summary_df.columns or 'Decrease' not in summary_df.columns:
                raise HTTPException(
                    status_code=400, 
                    detail="Summary CSV file must contain 'Increase' and 'Decrease' columns"
                )
            
            # Ensure numeric columns are properly typed
            summary_df['Increase'] = pd.to_numeric(summary_df['Increase'], errors='coerce').fillna(0)
            summary_df['Decrease'] = pd.to_numeric(summary_df['Decrease'], errors='coerce').fillna(0)
            if 'Scope Creep Review' in summary_df.columns:
                summary_df['Scope Creep Review'] = pd.to_numeric(summary_df['Scope Creep Review'], errors='coerce').fillna(0)
            
            # Update counts for each cluster (cluster is unique key in summary)
            for cluster_name, total_ticket_count in cluster_ticket_counts.items():
                # Find the row for this cluster (cluster is the unique key in summary)
                cluster_row_idx = summary_df[summary_df['Cluster'].astype(str).str.lower() == cluster_name.lower()].index
                
                if len(cluster_row_idx) > 0:
                    # Get current values and convert to float
                    current_increase = float(summary_df.at[cluster_row_idx[0], 'Increase'])
                    current_decrease = float(summary_df.at[cluster_row_idx[0], 'Decrease'])
                    current_scope_creeep = 0.0
                    
                    if 'Scope Creep Review' in summary_df.columns:
                        current_scope_creeep = float(summary_df.at[cluster_row_idx[0], 'Scope Creep Review'])
                    
                    # Update the counts
                    new_increase = current_increase - total_ticket_count
                    new_decrease = current_decrease + total_ticket_count
                    
                    summary_df.at[cluster_row_idx[0], 'Increase'] = new_increase
                    summary_df.at[cluster_row_idx[0], 'Decrease'] = new_decrease
                    if 'Scope Creep Review' in summary_df.columns:
                        summary_df.at[cluster_row_idx[0], 'Scope Creep Review'] = total_ticket_count + current_scope_creeep
                    
                    # Set status based on increase count
                    if new_increase > 0:
                        summary_df.at[cluster_row_idx[0], 'Status'] = "Partially Reviewed"
                    else:
                        summary_df.at[cluster_row_idx[0], 'Status'] = "Reviewed"
                else:
                    # If cluster doesn't exist in summary, create a new row
                    new_increase = -total_ticket_count  # Subtract ticket count from increase
                    new_decrease = total_ticket_count   # Add ticket count to decrease
                    
                    new_row = {
                        'Cluster': cluster_name,
                        'Increase': new_increase,
                        'Decrease': new_decrease,
                        'Status': "Reviewed" if new_increase <= 0 else "Partially Reviewed"
                    }
                    
                    # Add Scope Creep Review if it exists in the summary file
                    if 'Scope Creep Review' in summary_df.columns:
                        new_row['Scope Creep Review'] = float(total_ticket_count)
                    
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
            "cluster_ticket_counts": cluster_ticket_counts,
            "data_file_path": data_file_path,
            "summary_file_path": summary_file_path
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating CSV file: {str(e)}")







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
        
        # Process the updates and extract cluster information with ticket counts
        cluster_ticket_counts = {}
        updated_rows_count = 0
        
        for update_row in update_request.updates:
            group_id = update_row.group_id
            pattern = update_row.pattern
            cluster_name = update_row.cluster  # Get cluster from the main object
            ticket_count = update_row.ticket_count  # Get ticket count from the main object
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
            
            # Check if Decision in the API payload is "No change" to determine if summary should be updated
            decision_in_payload = new_data.get('Decision', '').lower()
            
            if decision_in_payload == 'no change':
                # Count this update for the cluster (using ticket count) only if Decision in payload is "No change"
                cluster_name_lower = cluster_name.lower()
                if cluster_name_lower not in cluster_ticket_counts:
                    cluster_ticket_counts[cluster_name_lower] = 0
                cluster_ticket_counts[cluster_name_lower] += ticket_count
            
            # Update each column in the row (excluding group_id, pattern, and cluster if it was just for counting)
            for col, value in new_data.items():
                if col not in ['group_id', 'pattern', 'cluster', 'ticket_count']:  # Don't update these columns
                    if col in df.columns:
                        # Handle type conversion properly to avoid FutureWarning
                        current_dtype = df[col].dtype
                        
                        # If the column is numeric and we're trying to assign a string, convert appropriately
                        if pd.api.types.is_numeric_dtype(current_dtype) and not pd.isna(value) and not isinstance(value, (int, float)):
                            try:
                                # Try to convert the value to numeric
                                numeric_value = pd.to_numeric(value, errors='coerce')
                                df.at[row_index, col] = numeric_value
                            except:
                                # If conversion fails, set to NaN or keep original
                                df.at[row_index, col] = value
                        else:
                            # For non-numeric columns or when value is already numeric, just assign
                            df.at[row_index, col] = value
                    else:
                        raise HTTPException(
                            status_code=400, 
                            detail=f"Column '{col}' does not exist in the data CSV file"
                        )
            
            updated_rows_count += 1
        
        # Update summary counts based on cluster information with ticket counts (only for "No change" decisions in payload)
        if cluster_ticket_counts:
            summary_df = pd.read_csv(summary_file_path)
            
            # Validate that summary file has required columns
            if 'Cluster' not in summary_df.columns:
                raise HTTPException(
                    status_code=400, 
                    detail="Summary CSV file does not contain a 'Cluster' column"
                )
            
            if 'Increase' not in summary_df.columns or 'Decrease' not in summary_df.columns:
                raise HTTPException(
                    status_code=400, 
                    detail="Summary CSV file must contain 'Increase' and 'Decrease' columns"
                )
            
            # Ensure numeric columns are properly typed
            summary_df['Increase'] = pd.to_numeric(summary_df['Increase'], errors='coerce').fillna(0)
            summary_df['Decrease'] = pd.to_numeric(summary_df['Decrease'], errors='coerce').fillna(0)
            if 'Scope Creep Review' in summary_df.columns:
                summary_df['Scope Creep Review'] = pd.to_numeric(summary_df['Scope Creep Review'], errors='coerce').fillna(0)
            
            # Update counts for each cluster (cluster is unique key in summary)
            for cluster_name, total_ticket_count in cluster_ticket_counts.items():
                # Find the row for this cluster (cluster is the unique key in summary)
                cluster_row_idx = summary_df[summary_df['Cluster'].astype(str).str.lower() == cluster_name.lower()].index
                
                if len(cluster_row_idx) > 0:
                    # Get current values and convert to float
                    current_increase = float(summary_df.at[cluster_row_idx[0], 'Increase'])
                    current_decrease = float(summary_df.at[cluster_row_idx[0], 'Decrease'])
                    current_scope_creeep = 0.0
                    
                    if 'Scope Creep Review' in summary_df.columns:
                        current_scope_creeep = float(summary_df.at[cluster_row_idx[0], 'Scope Creep Review'])
                    
                    # Update the counts
                    new_increase = current_increase - total_ticket_count
                    new_decrease = current_decrease + total_ticket_count
                    
                    summary_df.at[cluster_row_idx[0], 'Increase'] = new_increase
                    summary_df.at[cluster_row_idx[0], 'Decrease'] = new_decrease
                    if 'Scope Creep Review' in summary_df.columns:
                        summary_df.at[cluster_row_idx[0], 'Scope Creep Review'] = total_ticket_count + current_scope_creeep
                    
                    # Set status based on increase count
                    if new_increase > 0:
                        summary_df.at[cluster_row_idx[0], 'Status'] = "Partially Reviewed"
                    else:
                        summary_df.at[cluster_row_idx[0], 'Status'] = "Reviewed"
                else:
                    # If cluster doesn't exist in summary, create a new row
                    new_increase = -total_ticket_count  # Subtract ticket count from increase
                    new_decrease = total_ticket_count   # Add ticket count to decrease
                    
                    new_row = {
                        'Cluster': cluster_name,
                        'Increase': new_increase,
                        'Decrease': new_decrease,
                        'Status': "Reviewed" if new_increase <= 0 else "Partially Reviewed"
                    }
                    
                    # Add Scope Creep Review if it exists in the summary file
                    if 'Scope Creep Review' in summary_df.columns:
                        new_row['Scope Creep Review'] = float(total_ticket_count)
                    
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
            "cluster_ticket_counts": cluster_ticket_counts,
            "data_file_path": data_file_path,
            "summary_file_path": summary_file_path
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
