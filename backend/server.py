from fastapi import FastAPI, APIRouter, HTTPException, Response, BackgroundTasks, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
import csv
import io
import requests


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

ADMIN_API_KEY = os.environ.get('ADMIN_API_KEY')
SHEETS_WEBHOOK_URL = os.environ.get('SHEETS_WEBHOOK_URL')

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


def _admin_authorized(request: Request, key: Optional[str]) -> bool:
    if not ADMIN_API_KEY:
        return False
    header_key = request.headers.get('x-admin-key')
    return (key and key == ADMIN_API_KEY) or (header_key and header_key == ADMIN_API_KEY)


def _parse_dates(start_date: Optional[str], end_date: Optional[str]):
    start_dt = None
    end_dt = None
    try:
        if start_date:
            start_dt = datetime.strptime(start_date, '%Y-%m-%d')
        if end_date:
            # inclusive end-of-day
            end_dt = datetime.strptime(end_date, '%Y-%m-%d') + timedelta(days=1)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    return start_dt, end_dt


def _to_csv(rows: List[dict], fields: List[str]) -> str:
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=fields)
    writer.writeheader()
    for r in rows:
        filtered = {k: r.get(k, '') for k in fields}
        writer.writerow(filtered)
    return output.getvalue()


def _post_to_sheets(kind: str, payload: dict):
    if not SHEETS_WEBHOOK_URL:
        return
    try:
        data = {
            'type': kind,
            **payload,
        }
        requests.post(SHEETS_WEBHOOK_URL, json=data, timeout=5)
    except Exception:
        # Swallow errors to avoid impacting API response
        pass


# Routes
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
async def create_waitlist(entry: WaitlistCreate, background_tasks: BackgroundTasks):
    data = entry.model_dump()
    res = await db.waitlist.insert_one(data)
    saved = {**data, "id": str(res.inserted_id)}
    # Sheets webhook (optional)
    background_tasks.add_task(_post_to_sheets, 'waitlist', saved)
    return Waitlist(**saved)

# Referrals endpoints
@api_router.post("/referrals", response_model=Referral)
async def create_referral(entry: ReferralCreate, background_tasks: BackgroundTasks):
    if entry.referral_type not in ["Shop", "Builder"]:
        raise HTTPException(status_code=422, detail="referral_type must be 'Shop' or 'Builder'")
    data = entry.model_dump()
    res = await db.referrals.insert_one(data)
    saved = {**data, "id": str(res.inserted_id)}
    # Sheets webhook (optional)
    background_tasks.add_task(_post_to_sheets, 'referral', saved)
    return Referral(**saved)

# Admin CSV export endpoints (protected via ADMIN_API_KEY)
@api_router.get("/admin/export/waitlist")
async def export_waitlist_csv(request: Request, start_date: Optional[str] = None, end_date: Optional[str] = None, key: Optional[str] = None):
    if not _admin_authorized(request, key):
        raise HTTPException(status_code=401, detail="Unauthorized")
    start_dt, end_dt = _parse_dates(start_date, end_date)
    query: dict = {}
    if start_dt and end_dt:
        query['created_at'] = {"$gte": start_dt, "$lt": end_dt}
    elif start_dt:
        query['created_at'] = {"$gte": start_dt}
    elif end_dt:
        query['created_at'] = {"$lt": end_dt}
    rows = await db.waitlist.find(query).to_list(100000)
    # Normalize bson ObjectId not needed, created_at already datetime
    for r in rows:
        # ensure ISO strings for dates
        if isinstance(r.get('created_at'), datetime):
            r['created_at'] = r['created_at'].isoformat()
    fields = ['name', 'email', 'role', 'created_at', 'source_url', 'utm_source', 'utm_campaign', 'utm_medium']
    csv_text = _to_csv(rows, fields)
    filename = f"waitlist_{start_date or 'all'}_{end_date or 'all'}.csv"
    headers = {"Content-Disposition": f"attachment; filename={filename}"}
    return Response(content=csv_text, media_type='text/csv', headers=headers)

@api_router.get("/admin/export/referrals")
async def export_referrals_csv(request: Request, start_date: Optional[str] = None, end_date: Optional[str] = None, key: Optional[str] = None):
    if not _admin_authorized(request, key):
        raise HTTPException(status_code=401, detail="Unauthorized")
    start_dt, end_dt = _parse_dates(start_date, end_date)
    query: dict = {}
    if start_dt and end_dt:
        query['created_at'] = {"$gte": start_dt, "$lt": end_dt}
    elif start_dt:
        query['created_at'] = {"$gte": start_dt}
    elif end_dt:
        query['created_at'] = {"$lt": end_dt}
    rows = await db.referrals.find(query).to_list(100000)
    for r in rows:
        if isinstance(r.get('created_at'), datetime):
            r['created_at'] = r['created_at'].isoformat()
    fields = ['referrer_name', 'referrer_email', 'referral_type', 'referral_name', 'referral_contact', 'notes', 'created_at', 'source_url', 'utm_source', 'utm_campaign', 'utm_medium']
    csv_text = _to_csv(rows, fields)
    filename = f"referrals_{start_date or 'all'}_{end_date or 'all'}.csv"
    headers = {"Content-Disposition": f"attachment; filename={filename}"}
    return Response(content=csv_text, media_type='text/csv', headers=headers)

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