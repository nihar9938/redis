from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from pymongo import MongoClient
from bson import ObjectId
import os

# --- Configuration ---
MONGODB_USERNAME = os.getenv("MONGODB_USERNAME", "your_username")
MONGODB_PASSWORD = os.getenv("MONGODB_PASSWORD", "your_password")
MONGODB_HOST = os.getenv("MONGODB_HOST", "localhost")
MONGODB_PORT = os.getenv("MONGODB_PORT", "27017")
MONGODB_DB = os.getenv("MONGODB_DB", "your_database")
MONGODB_COLLECTION = os.getenv("MONGODB_COLLECTION", "your_collection")

MONGODB_URL = f"mongodb://{MONGODB_USERNAME}:{MONGODB_PASSWORD}@{MONGODB_HOST}:{MONGODB_PORT}/{MONGODB_DB}?authSource=admin&retryWrites=true&w=majority"

# Pydantic models
class DocumentModel(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    value: Optional[int] = None

class UpdateModel(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    value: Optional[int] = None

class UpdateManyModel(BaseModel):
    filter_query: dict  # MongoDB filter criteria
    update_data: UpdateModel  # Fields to update

class UpdateManyResponse(BaseModel):
    matched_count: int
    modified_count: int

# MongoDB helper
class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid objectid")
        return ObjectId(v)

    @classmethod
    def __modify_schema__(cls, field_schema):
        field_schema.update(type="string")

# Initialize FastAPI app
app = FastAPI(title="MongoDB API", description="FastAPI with MongoDB CRUD operations")

def get_db_connection():
    """Create a new MongoDB connection for each API call"""
    client = MongoClient(MONGODB_URL)
    # Test connection
    client.admin.command('ping')
    db = client[MONGODB_DB]
    return db, client

# GET all items endpoint
@app.get("/items", response_model=List[DocumentModel])
def get_items():
    db, client = get_db_connection()
    try:
        collection = db[MONGODB_COLLECTION]
        items = []
        for document in collection.find({}):
            document["id"] = str(document.pop("_id"))
            items.append(DocumentModel(**document))
        return items
    finally:
        client.close()  # Always close connection after use

# GET single item endpoint
@app.get("/items/{item_id}", response_model=DocumentModel)
def get_item(item_id: str):
    db, client = get_db_connection()
    try:
        collection = db[MONGODB_COLLECTION]
        item = collection.find_one({"_id": PyObjectId.validate(item_id)})
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
        item["id"] = str(item.pop("_id"))
        return DocumentModel(**item)
    finally:
        client.close()

# UPDATE single item endpoint
@app.put("/items/{item_id}", response_model=DocumentModel)
def update_item(item_id: str, update_ UpdateModel):
    db, client = get_db_connection()
    try:
        collection = db[MONGODB_COLLECTION]
        
        update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
        
        if not update_dict:
            raise HTTPException(status_code=400, detail="No valid fields to update")
        
        result = collection.update_one(
            {"_id": PyObjectId.validate(item_id)},
            {"$set": update_dict}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Item not found")
        
        updated_item = collection.find_one({"_id": PyObjectId.validate(item_id)})
        updated_item["id"] = str(updated_item.pop("_id"))
        return DocumentModel(**updated_item)
    finally:
        client.close()

# UPDATE multiple items endpoint
@app.put("/items", response_model=UpdateManyResponse)
def update_many_items(update_request: UpdateManyModel):
    db, client = get_db_connection()
    try:
        collection = db[MONGODB_COLLECTION]
        
        update_dict = {k: v for k, v in update_request.update_data.dict().items() if v is not None}
        
        if not update_dict:
            raise HTTPException(status_code=400, detail="No valid fields to update")
        
        result = collection.update_many(
            update_request.filter_query,
            {"$set": update_dict}
        )
        
        return UpdateManyResponse(
            matched_count=result.matched_count,
            modified_count=result.modified_count
        )
    finally:
        client.close()

# Health check endpoint
@app.get("/health")
def health_check():
    try:
        # Test connection
        client = MongoClient(MONGODB_URL)
        client.admin.command('ping')
        client.close()
        return {"status": "OK", "message": "Application is running"}
    except Exception:
        raise HTTPException(status_code=500, detail="Database connection failed")
