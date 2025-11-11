from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

# MongoDB configuration
MONGODB_URL = "mongodb://username:password@host:port/database_name"
DATABASE_NAME = "your_database"
COLLECTION_NAME = "your_collection"

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
app = FastAPI()

# MongoDB connection
client: AsyncIOMotorClient = None

@app.on_event("startup")
async def startup_db_client():
    global client
    client = AsyncIOMotorClient(MONGODB_URL)
    # Test connection
    await client.admin.command('ping')

@app.on_event("shutdown")
async def shutdown_db_client():
    global client
    client.close()

# GET all items endpoint
@app.get("/items", response_model=List[DocumentModel])
async def get_items():
    collection = client[DATABASE_NAME][COLLECTION_NAME]
    cursor = collection.find({})
    items = []
    async for document in cursor:
        document["id"] = str(document.pop("_id"))
        items.append(DocumentModel(**document))
    return items

# GET single item endpoint
@app.get("/items/{item_id}", response_model=DocumentModel)
async def get_item(item_id: str):
    collection = client[DATABASE_NAME][COLLECTION_NAME]
    item = await collection.find_one({"_id": PyObjectId.validate(item_id)})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    item["id"] = str(item.pop("_id"))
    return DocumentModel(**item)

# UPDATE endpoint
@app.put("/items/{item_id}", response_model=DocumentModel)
async def update_item(item_id: str, update_data: UpdateModel):
    collection = client[DATABASE_NAME][COLLECTION_NAME]
    
    # Convert Pydantic model to dict and remove None values
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    
    if not update_dict:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    result = await collection.update_one(
        {"_id": PyObjectId.validate(item_id)},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Return updated document
    updated_item = await collection.find_one({"_id": PyObjectId.validate(item_id)})
    updated_item["id"] = str(updated_item.pop("_id"))
    return DocumentModel(**updated_item)
