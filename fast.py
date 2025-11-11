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

# MongoDB connection
client: MongoClient = None
db = None

@app.on_event("startup")
def startup_db_client():
    global client, db
    try:
        client = MongoClient(MONGODB_URL)
        # Test connection
        client.admin.command('ping')
        db = client[MONGODB_DB]
        print("✅ Successfully connected to MongoDB")
    except Exception as e:
        print(f"❌ MongoDB connection failed: {e}")
        raise RuntimeError("Failed to connect to MongoDB") from e

@app.on_event("shutdown")
def shutdown_db_client():
    global client
    if client:
        client.close()
        print("🔌 MongoDB connection closed")

# GET all items endpoint
@app.get("/items", response_model=List[DocumentModel])
def get_items():
    collection = db[MONGODB_COLLECTION]
    items = []
    for document in collection.find({}):
        document["id"] = str(document.pop("_id"))
        items.append(DocumentModel(**document))
    return items

# GET single item endpoint
@app.get("/items/{item_id}", response_model=DocumentModel)
def get_item(item_id: str):
    collection = db[MONGODB_COLLECTION]
    item = collection.find_one({"_id": PyObjectId.validate(item_id)})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    item["id"] = str(item.pop("_id"))
    return DocumentModel(**item)

# UPDATE endpoint
@app.put("/items/{item_id}", response_model=DocumentModel)
def update_item(item_id: str, update_data: UpdateModel):
    collection = db[MONGODB_COLLECTION]
    
    # Convert Pydantic model to dict and remove None values
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    
    if not update_dict:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    result = collection.update_one(
        {"_id": PyObjectId.validate(item_id)},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Return updated document
    updated_item = collection.find_one({"_id": PyObjectId.validate(item_id)})
    updated_item["id"] = str(updated_item.pop("_id"))
    return DocumentModel(**updated_item)

# Health check endpoint
@app.get("/health")
def health_check():
    return {"status": "OK", "message": "Application is running"}
