from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class StatusCheckCreate(BaseModel):
    client_name: str

class WaitlistCreate(BaseModel):
    name: str
    email: EmailStr
    role: str
    source_url: Optional[str] = None
    utm_source: Optional[str] = None
    utm_campaign: Optional[str] = None
    utm_medium: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Waitlist(BaseModel):
    id: Optional[str] = None
    name: str
    email: EmailStr
    role: str
    source_url: Optional[str] = None
    utm_source: Optional[str] = None
    utm_campaign: Optional[str] = None
    utm_medium: Optional[str] = None
    created_at: datetime

class ReferralCreate(BaseModel):
    referrer_name: str
    referrer_email: EmailStr
    referral_type: str  # Shop or Builder
    referral_name: str
    referral_contact: Optional[str] = None  # Instagram/Website (optional)
    notes: Optional[str] = None
    source_url: Optional[str] = None
    utm_source: Optional[str] = None
    utm_campaign: Optional[str] = None
    utm_medium: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Referral(BaseModel):
    id: Optional[str] = None
    referrer_name: str
    referrer_email: EmailStr
    referral_type: str
    referral_name: str
    referral_contact: Optional[str] = None
    notes: Optional[str] = None
    source_url: Optional[str] = None
    utm_source: Optional[str] = None
    utm_campaign: Optional[str] = None
    utm_medium: Optional[str] = None
    created_at: datetime

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    _ = await db.status_checks.insert_one(status_obj.model_dump())
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find().to_list(1000)
    return [StatusCheck(**status_check) for status_check in status_checks]

# Waitlist endpoints
@api_router.post("/waitlist", response_model=Waitlist)
async def create_waitlist(entry: WaitlistCreate):
    data = entry.model_dump()
    # Insert into Mongo and return the object
    res = await db.waitlist.insert_one(data)
    saved = {**data, "id": str(res.inserted_id)}
    return Waitlist(**saved)

# Referrals endpoints
@api_router.post("/referrals", response_model=Referral)
async def create_referral(entry: ReferralCreate):
    # Basic validation for referral_type
    if entry.referral_type not in ["Shop", "Builder"]:
        raise HTTPException(status_code=422, detail="referral_type must be 'Shop' or 'Builder'")
    data = entry.model_dump()
    res = await db.referrals.insert_one(data)
    saved = {**data, "id": str(res.inserted_id)}
    return Referral(**saved)

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()