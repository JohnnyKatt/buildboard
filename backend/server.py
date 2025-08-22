import os
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi import APIRouter

from pydantic import BaseModel, EmailStr, Field
from passlib.context import CryptContext
import jwt
from jwt import PyJWTError

from pdfminer.high_level import extract_text

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

# -----------------
# Config & Globals
# -----------------
JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-change")
JWT_ALG = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

MONGO_URL = os.environ.get("MONGO_URL")
USE_INMEMORY = False

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

app = FastAPI(title="Buildboard API", version="0.1.0")
router = APIRouter(prefix="/api")

# CORS - allow frontend origin(s); keeping permissive for MVP
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static uploads dir
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)
app.mount("/api/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

# ---------------
# DB Connections (with in-memory fallback)
# ---------------
if not MONGO_URL:
    USE_INMEMORY = True
    print("===============================")
    print("USING IN-MEMORY DB (non-persistent)")
    print("Add MONGO_URL in backend/.env to use a real MongoDB instance.")
    print("===============================")
    import mongomock

    class AsyncCursorWrapper:
        def __init__(self, docs: List[Dict[str, Any]]):
            self.docs = list(docs)
            self._i = 0
        def sort(self, field: str, direction: int):
            reverse = direction == -1
            def get_field(d: Dict[str, Any]):
                parts = field.split(".")
                v: Any = d
                for p in parts:
                    v = v.get(p) if isinstance(v, dict) else None
                return v
            self.docs.sort(key=get_field, reverse=reverse)
            return self
        def limit(self, n: int):
            self.docs = self.docs[:n]
            return self
        def __aiter__(self):
            self._i = 0
            return self
        async def __anext__(self):
            if self._i >= len(self.docs):
                raise StopAsyncIteration
            v = self.docs[self._i]
            self._i += 1
            return v

    class AsyncCollectionWrapper:
        def __init__(self, col):
            self.col = col
        async def find_one(self, filt: Dict[str, Any]):
            return self.col.find_one(filt)
        def find(self, filt: Dict[str, Any]):
            docs = list(self.col.find(filt))
            return AsyncCursorWrapper(docs)
        async def insert_one(self, doc: Dict[str, Any]):
            self.col.insert_one(doc)
            return {"inserted_id": doc.get("_id")}
        async def update_one(self, filt: Dict[str, Any], update: Dict[str, Any]):
            self.col.update_one(filt, update)
            return {"modified_count": 1}
        async def count_documents(self, filt: Dict[str, Any]):
            return self.col.count_documents(filt)

    class AsyncDBWrapper:
        def __init__(self, db):
            self.db = db
        def __getitem__(self, name: str):
            return AsyncCollectionWrapper(self.db[name])

    sync_client = mongomock.MongoClient()
    db = AsyncDBWrapper(sync_client["buildboard"])
else:
    client: AsyncIOMotorClient = AsyncIOMotorClient(MONGO_URL)
    db: AsyncIOMotorDatabase = client.get_default_database() or client["buildboard"]

# Collections
users = db["users"]
shops = db["shops"]
builds = db["builds"]
parts = db["parts"]
build_parts = db["build_parts"]
leads = db["leads"]
vendors = db["vendors"]
invoices = db["invoices"]
activities = db["activities"]

# ---------------
# Utilities
# ---------------

def gen_id() -> str:
    return str(uuid.uuid4())


def now_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return pwd_context.verify(password, hashed)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALG)


async def email_exists(email: str) -> bool:
    existing = await users.find_one({"email": email.lower()})
    return existing is not None


# ---------------
# Schemas
# ---------------
class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = Field(pattern="^(shop|enthusiast)$")


class UserOut(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: str
    handle: Optional[str] = None
    bio: Optional[str] = None
    avatarUrl: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ShopIn(BaseModel):
    name: str
    locationCity: Optional[str] = None
    locationState: Optional[str] = None
    locationCountry: Optional[str] = None  # optional for MVP
    website: Optional[str] = None
    socials: Optional[Dict[str, Optional[str]]] = None  # e.g., { ig, yt }
    specialties: Optional[List[str]] = None


class ShopOut(ShopIn):
    id: str
    ownerUserId: str
    ratingAggregate: Optional[float] = 0.0
    isVerified: bool = False


class Vehicle(BaseModel):
    year: int
    make: str
    model: str
    trim: Optional[str] = None


class BuildIn(BaseModel):
    shopId: str
    title: str
    vehicle: Vehicle
    summary: Optional[str] = None
    heroImage: Optional[str] = None
    gallery: List[str] = []
    status: str = Field(pattern="^(in-progress|complete)$")
    visibility: str = Field(pattern="^(public|unlisted)$")
    tags: List[str] = []


class BuildOut(BuildIn):
    id: str


class PartSpecs(BaseModel):
    fitment: Optional[str] = None
    notes: Optional[str] = None


class VendorRef(BaseModel):
    name: Optional[str] = None
    site: Optional[str] = None


class PartIn(BaseModel):
    name: str
    brand: Optional[str] = None
    category: Optional[str] = None
    image: Optional[str] = None
    specs: Optional[PartSpecs] = None
    vendors: List[VendorRef] = []
    canonicalUrl: Optional[str] = None
    affiliateLinks: List[str] = []


class PartOut(PartIn):
    id: str


class BuildPartIn(BaseModel):
    buildId: str
    partId: str
    orderIndex: int = 0
    installedByShopId: Optional[str] = None
    notes: Optional[str] = None
    proofImage: Optional[str] = None


class LeadIn(BaseModel):
    buildId: str
    contactName: str
    email: EmailStr
    phone: Optional[str] = None
    message: Optional[str] = None
    source: str = Field(pattern="^request_this_build$")


class LeadOut(LeadIn):
    id: str
    status: str


class InvoiceLineItem(BaseModel):
    id: str
    raw: str
    detectedPartName: Optional[str] = None
    qty: Optional[float] = None
    price: Optional[float] = None
    vendor: Optional[str] = None
    confidence: float = 0.5


class InvoiceUploadOut(BaseModel):
    id: str
    buildId: str
    fileUrl: str
    parsedAt: Optional[str] = None
    lineItems: List[InvoiceLineItem]
    status: str


# ---------------
# Auth dependency
# ---------------
async def get_current_user(authorization: Optional[str] = None) -> Dict[str, Any]:
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() != "bearer":
            raise HTTPException(status_code=401, detail="Invalid auth scheme")
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await users.find_one({"_id": user_id})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ---------------
# Auth Routes
# ---------------
@router.post("/auth/register", response_model=TokenOut)
async def register(payload: UserCreate):
    if await email_exists(payload.email):
        raise HTTPException(status_code=400, detail="Email already registered")

    user_id = gen_id()
    doc = {
        "_id": user_id,
        "name": payload.name,
        "email": payload.email.lower(),
        "password": hash_password(payload.password),
        "role": payload.role,
        "handle": None,
        "bio": None,
        "avatarUrl": None,
        "createdAt": now_iso(),
    }
    await users.insert_one(doc)
    token = create_access_token({"sub": user_id})
    return TokenOut(access_token=token, user=UserOut(id=user_id, name=doc["name"], email=doc["email"], role=doc["role"]))


@router.post("/auth/login", response_model=TokenOut)
async def login(payload: LoginIn):
    user = await users.find_one({"email": payload.email.lower()})
    if not user or not verify_password(payload.password, user.get("password", "")):
        raise HTTPException(status_code=400, detail="Invalid credentials")
    token = create_access_token({"sub": user["_id"]})
    return TokenOut(access_token=token, user=UserOut(id=user["_id"], name=user.get("name", ""), email=user["email"], role=user.get("role", "enthusiast")))


@router.get("/auth/me", response_model=UserOut)
async def me(current=Depends(get_current_user)):
    return UserOut(id=current["_id"], name=current.get("name", ""), email=current.get("email", ""), role=current.get("role", "enthusiast"), handle=current.get("handle"), bio=current.get("bio"), avatarUrl=current.get("avatarUrl"))


# ---------------
# Shops
# ---------------
@router.post("/shops", response_model=ShopOut, status_code=201)
async def create_shop(payload: ShopIn, current=Depends(get_current_user)):
    if current.get("role") != "shop":
        raise HTTPException(status_code=403, detail="Only shop users can create shops")
    existing = await shops.find_one({"ownerUserId": current["_id"]})
    if existing:
        raise HTTPException(status_code=400, detail="Shop already exists")
    shop_id = gen_id()
    doc = {"_id": shop_id, "ownerUserId": current["_id"], **payload.dict(), "ratingAggregate": 0.0, "isVerified": False, "createdAt": now_iso()}
    await shops.insert_one(doc)
    return ShopOut(id=shop_id, ownerUserId=current["_id"], **payload.dict(), ratingAggregate=0.0, isVerified=False)


@router.get("/shops/mine", response_model=Optional[ShopOut])
async def get_my_shop(current=Depends(get_current_user)):
    doc = await shops.find_one({"ownerUserId": current["_id"]})
    if not doc:
        return None
    return ShopOut(id=doc["_id"], ownerUserId=doc["ownerUserId"], name=doc.get("name"), locationCity=doc.get("locationCity"), locationState=doc.get("locationState"), locationCountry=doc.get("locationCountry"), website=doc.get("website"), socials=doc.get("socials"), specialties=doc.get("specialties"), ratingAggregate=doc.get("ratingAggregate", 0.0), isVerified=doc.get("isVerified", False))


@router.get("/shops/{shop_id}", response_model=ShopOut)
async def get_shop(shop_id: str):
    doc = await shops.find_one({"_id": shop_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Shop not found")
    return ShopOut(id=doc["_id"], ownerUserId=doc["ownerUserId"], name=doc.get("name"), locationCity=doc.get("locationCity"), locationState=doc.get("locationState"), locationCountry=doc.get("locationCountry"), website=doc.get("website"), socials=doc.get("socials"), specialties=doc.get("specialties"), ratingAggregate=doc.get("ratingAggregate", 0.0), isVerified=doc.get("isVerified", False))


# ---------------
# Builds
# ---------------
@router.post("/builds", response_model=BuildOut)
async def create_build(payload: BuildIn, current=Depends(get_current_user)):
    # Ensure current user owns the shop
    shop = await shops.find_one({"_id": payload.shopId})
    if not shop or shop.get("ownerUserId") != current["_id"]:
        raise HTTPException(status_code=403, detail="Not allowed")
    b_id = gen_id()
    doc = {"_id": b_id, **payload.dict(), "createdAt": now_iso()}
    await builds.insert_one(doc)
    await activities.insert_one({"_id": gen_id(), "type": "build_created", "actorUserId": current["_id"], "buildId": b_id, "createdAt": now_iso()})
    return BuildOut(id=b_id, **payload.dict())


@router.get("/builds/{build_id}", response_model=BuildOut)
async def get_build(build_id: str, authorization: Optional[str] = None):
    doc = await builds.find_one({"_id": build_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Build not found")
    # Enforce visibility: if unlisted, allow only owner or admin
    if doc.get("visibility") == "unlisted":
        allowed = False
        if authorization:
            try:
                scheme, _, token = authorization.partition(" ")
                payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
                user = await users.find_one({"_id": payload.get("sub")})
                if user:
                    if user.get("role") == "admin":
                        allowed = True
                    else:
                        shop = await shops.find_one({"_id": doc.get("shopId")})
                        if shop and shop.get("ownerUserId") == user["_id"]:
                            allowed = True
            except Exception:
                allowed = False
        if not allowed:
            raise HTTPException(status_code=403, detail="Build is unlisted")
    return BuildOut(id=doc["_id"], shopId=doc["shopId"], title=doc.get("title"), vehicle=doc.get("vehicle"), summary=doc.get("summary"), heroImage=doc.get("heroImage"), gallery=doc.get("gallery", []), status=doc.get("status"), visibility=doc.get("visibility"), tags=doc.get("tags", []))


@router.get("/builds")
async def list_builds(make: Optional[str] = None, model: Optional[str] = None, tag: Optional[str] = None, shopId: Optional[str] = None, status: Optional[str] = None, q: Optional[str] = None):
    query: Dict[str, Any] = {"visibility": "public"}
    if shopId:
        query["shopId"] = shopId
    if status:
        query["status"] = status
    if make:
        query["vehicle.make"] = {"$regex": make, "$options": "i"}
    if model:
        query["vehicle.model"] = {"$regex": model, "$options": "i"}
    if tag:
        query["tags"] = tag
    if q:
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"summary": {"$regex": q, "$options": "i"}},
            {"vehicle.make": {"$regex": q, "$options": "i"}},
            {"vehicle.model": {"$regex": q, "$options": "i"}},
        ]
    items: List[Dict[str, Any]] = []
    async for doc in builds.find(query).sort("createdAt", -1).limit(60):
        items.append({"id": doc["_id"], **{k: doc.get(k) for k in ["shopId", "title", "vehicle", "summary", "heroImage", "gallery", "status", "visibility", "tags"]}})
    return {"items": items}


@router.put("/builds/{build_id}")
async def update_build(build_id: str, payload: Dict[str, Any], current=Depends(get_current_user)):
    doc = await builds.find_one({"_id": build_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Build not found")
    shop = await shops.find_one({"_id": doc.get("shopId")})
    if not shop or shop.get("ownerUserId") != current["_id"]:
        raise HTTPException(status_code=403, detail="Not allowed")
    await builds.update_one({"_id": build_id}, {"$set": payload})
    return {"ok": True}


# Gallery uploads
@router.post("/builds/{build_id}/gallery/upload")
async def upload_build_image(build_id: str, file: UploadFile = File(...), current=Depends(get_current_user)):
    build = await builds.find_one({"_id": build_id})
    if not build:
        raise HTTPException(status_code=404, detail="Build not found")
    shop = await shops.find_one({"_id": build.get("shopId")})
    if not shop or shop.get("ownerUserId") != current["_id"]:
        raise HTTPException(status_code=403, detail="Not allowed")
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".jpg", ".jpeg", ".png", ".webp"]:
        raise HTTPException(status_code=400, detail="Unsupported file type")
    fname = f"{gen_id()}{ext}"
    path = os.path.join(UPLOADS_DIR, fname)
    with open(path, "wb") as f:
        f.write(await file.read())
    public_url = f"/api/uploads/{fname}"
    gallery = build.get("gallery", []) + [public_url]
    await builds.update_one({"_id": build_id}, {"$set": {"gallery": gallery}})
    return {"url": public_url}


# ---------------
# Parts & BuildParts
# ---------------
@router.get("/parts/search")
async def search_parts(q: Optional[str] = None, brand: Optional[str] = None, category: Optional[str] = None):
    query: Dict[str, Any] = {}
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"brand": {"$regex": q, "$options": "i"}},
        ]
    if brand:
        query["brand"] = {"$regex": brand, "$options": "i"}
    if category:
        query["category"] = category
    items: List[Dict[str, Any]] = []
    async for doc in parts.find(query).limit(50):
        items.append({"id": doc["_id"], **{k: doc.get(k) for k in ["name", "brand", "category", "image", "specs", "vendors", "canonicalUrl", "affiliateLinks"]}})
    return {"items": items}


@router.post("/parts", response_model=PartOut)
async def create_part(payload: PartIn, current=Depends(get_current_user)):
    if current.get("role") not in ["shop", "admin"]:
        raise HTTPException(status_code=403, detail="Not allowed")
    p_id = gen_id()
    doc = {"_id": p_id, **payload.dict(), "createdAt": now_iso()}
    await parts.insert_one(doc)
    return PartOut(id=p_id, **payload.dict())


class LinkByUrlIn(BaseModel):
    buildId: str
    url: str
    name: Optional[str] = None
    brand: Optional[str] = None
    image: Optional[str] = None
    category: Optional[str] = None
    notes: Optional[str] = None


@router.post("/builds/{build_id}/parts/link")
async def link_part(build_id: str, payload: BuildPartIn, current=Depends(get_current_user)):
    build = await builds.find_one({"_id": build_id})
    if not build:
        raise HTTPException(status_code=404, detail="Build not found")
    shop = await shops.find_one({"_id": build.get("shopId")})
    if not shop or shop.get("ownerUserId") != current["_id"]:
        raise HTTPException(status_code=403, detail="Not allowed")
    bp_id = gen_id()
    doc = {"_id": bp_id, **payload.dict()}
    await build_parts.insert_one(doc)
    return {"id": bp_id, **payload.dict()}


@router.post("/builds/{build_id}/parts/link-by-url")
async def link_by_url(build_id: str, payload: LinkByUrlIn, current=Depends(get_current_user)):
    build = await builds.find_one({"_id": build_id})
    if not build:
        raise HTTPException(status_code=404, detail="Build not found")
    shop = await shops.find_one({"_id": build.get("shopId")})
    if not shop or shop.get("ownerUserId") != current["_id"]:
        raise HTTPException(status_code=403, detail="Not allowed")
    # Create part from URL
    p_id = gen_id()
    p_doc = {"_id": p_id, "name": payload.name or payload.url, "brand": payload.brand, "category": payload.category, "image": payload.image, "specs": {}, "vendors": [{"name": None, "site": payload.url}], "canonicalUrl": payload.url, "affiliateLinks": [], "createdAt": now_iso()}
    await parts.insert_one(p_doc)
    bp_id = gen_id()
    await build_parts.insert_one({"_id": bp_id, "buildId": build_id, "partId": p_id, "orderIndex": 0, "installedByShopId": build.get("shopId"), "notes": payload.notes, "proofImage": None})
    return {"buildPartId": bp_id, "partId": p_id}


@router.get("/builds/{build_id}/parts")
async def list_build_parts(build_id: str):
    items: List[Dict[str, Any]] = []
    async for bp in build_parts.find({"buildId": build_id}).sort("orderIndex", 1):
        part_doc = await parts.find_one({"_id": bp.get("partId")})
        if part_doc:
            items.append({
                "buildPartId": bp["_id"],
                "orderIndex": bp.get("orderIndex", 0),
                "notes": bp.get("notes"),
                "proofImage": bp.get("proofImage"),
                "part": {"id": part_doc["_id"], "name": part_doc.get("name"), "brand": part_doc.get("brand"), "image": part_doc.get("image"), "vendors": part_doc.get("vendors", []), "category": part_doc.get("category")},
            })
    return {"items": items}


# ---------------
# Leads (public create)
# ---------------
@router.post("/leads", response_model=LeadOut)
async def create_lead(payload: LeadIn):
    if payload.source != "request_this_build":
        raise HTTPException(status_code=400, detail="Invalid source")
    # Ensure build exists and is public
    b = await builds.find_one({"_id": payload.buildId})
    if not b:
        raise HTTPException(status_code=404, detail="Build not found")
    l_id = gen_id()
    doc = {"_id": l_id, **payload.dict(), "status": "new", "createdAt": now_iso()}
    await leads.insert_one(doc)
    return LeadOut(id=l_id, **payload.dict(), status="new")


@router.get("/admin/leads")
async def admin_list_leads(current=Depends(get_current_user)):
    if current.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admins only")
    items: List[Dict[str, Any]] = []
    async for doc in leads.find({}).sort("createdAt", -1).limit(200):
        items.append({"id": doc["_id"], **{k: doc.get(k) for k in ["buildId", "contactName", "email", "phone", "message", "source", "status"]}})
    return {"items": items}


# ---------------
# Invoice upload & parse (PDF only for MVP)
# ---------------
@router.post("/builds/{build_id}/invoice/upload", response_model=InvoiceUploadOut)
async def upload_invoice(build_id: str, file: UploadFile = File(...), current=Depends(get_current_user)):
    build = await builds.find_one({"_id": build_id})
    if not build:
        raise HTTPException(status_code=404, detail="Build not found")
    shop = await shops.find_one({"_id": build.get("shopId")})
    if not shop or shop.get("ownerUserId") != current["_id"]:
        raise HTTPException(status_code=403, detail="Not allowed")
    ext = os.path.splitext(file.filename)[1].lower()
    if ext != ".pdf":
        raise HTTPException(status_code=400, detail="Only PDF invoices supported in MVP")
    fname = f"invoice-{gen_id()}{ext}"
    path = os.path.join(UPLOADS_DIR, fname)
    with open(path, "wb") as f:
        f.write(await file.read())
    file_url = f"/api/uploads/{fname}"
    # Parse using pdfminer to extract text, then naive line split
    try:
        text = extract_text(path)
    except Exception:
        text = ""
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    line_items: List[InvoiceLineItem] = []
    for ln in lines[:50]:  # cap to 50 lines
        # very naive parsing: look for price like 123.45 and qty like x2 or 2x or 2
        qty = None
        price = None
        vendor = None
        # find last $ amount
        import re
        m = re.findall(r"\$?([0-9]+\.[0-9]{2})", ln)
        if m:
            price = float(m[-1])
        mq = re.findall(r"(?:(?:x|qty)\s*(\d+(?:\.\d+)?))|^(\d+(?:\.\d+)?)\s+", ln, re.IGNORECASE)
        if mq:
            try:
                qty = float([x for x in mq[0] if x][0])
            except Exception:
                qty = None
        # Guess vendor as first word if it looks like brand-ish
        parts_ln = ln.split()
        if parts_ln and parts_ln[0].isalpha():
            vendor = parts_ln[0]
        li = InvoiceLineItem(id=gen_id(), raw=ln, detectedPartName=ln[:80], qty=qty, price=price, vendor=vendor, confidence=0.5)
        line_items.append(li)
    inv_id = gen_id()
    inv_doc = {"_id": inv_id, "buildId": build_id, "fileUrl": file_url, "parsedAt": now_iso(), "lineItems": [li.model_dump() for li in line_items], "status": "parsed"}
    await invoices.insert_one(inv_doc)
    return InvoiceUploadOut(id=inv_id, buildId=build_id, fileUrl=file_url, parsedAt=inv_doc["parsedAt"], lineItems=line_items, status="parsed")


class InvoiceConfirmIn(BaseModel):
    lineItemIds: List[str]


@router.post("/invoices/{invoice_id}/confirm")
async def confirm_invoice(invoice_id: str, payload: InvoiceConfirmIn, current=Depends(get_current_user)):
    inv = await invoices.find_one({"_id": invoice_id})
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    build = await builds.find_one({"_id": inv.get("buildId")})
    if not build:
        raise HTTPException(status_code=404, detail="Build not found")
    shop = await shops.find_one({"_id": build.get("shopId")})
    if not shop or shop.get("ownerUserId") != current["_id"]:
        raise HTTPException(status_code=403, detail="Not allowed")
    selected = [li for li in inv.get("lineItems", []) if li.get("id") in payload.lineItemIds]
    created_parts: List[str] = []
    for li in selected:
        p_id = gen_id()
        p_doc = {"_id": p_id, "name": li.get("detectedPartName") or li.get("raw"), "brand": li.get("vendor"), "category": None, "image": None, "specs": {"notes": li.get("raw")}, "vendors": [], "canonicalUrl": None, "affiliateLinks": [], "createdAt": now_iso()}
        await parts.insert_one(p_doc)
        bp_id = gen_id()
        await build_parts.insert_one({"_id": bp_id, "buildId": build["_id"], "partId": p_id, "orderIndex": 0, "installedByShopId": build.get("shopId"), "notes": None, "proofImage": None})
        created_parts.append(p_id)
    await invoices.update_one({"_id": invoice_id}, {"$set": {"status": "confirmed"}})
    return {"partsCreated": created_parts}


# ---------------
# Seed Data on Startup
# ---------------
async def seed_if_empty():
    user_count = await users.count_documents({})
    if user_count > 0:
        return

    # Admin
    admin_id = gen_id()
    await users.insert_one({"_id": admin_id, "name": "Admin", "email": "admin@buildboard.dev", "password": hash_password("admin123"), "role": "admin", "createdAt": now_iso()})

    # Two shops with owners
    owner1 = gen_id()
    await users.insert_one({"_id": owner1, "name": "Apex Garage", "email": "apex@shop.dev", "password": hash_password("password"), "role": "shop", "createdAt": now_iso()})
    owner2 = gen_id()
    await users.insert_one({"_id": owner2, "name": "Boost Works", "email": "boost@shop.dev", "password": hash_password("password"), "role": "shop", "createdAt": now_iso()})

    shop1 = gen_id()
    await shops.insert_one({"_id": shop1, "ownerUserId": owner1, "name": "Apex Garage", "locationCity": "Austin", "locationState": "TX", "locationCountry": "USA", "website": "https://apex.example.com", "socials": {"ig": "@apex"}, "specialties": ["turbo", "suspension"], "ratingAggregate": 4.8, "isVerified": True, "createdAt": now_iso()})
    shop2 = gen_id()
    await shops.insert_one({"_id": shop2, "ownerUserId": owner2, "name": "Boost Works", "locationCity": "San Diego", "locationState": "CA", "locationCountry": "USA", "website": "https://boost.example.com", "socials": {"ig": "@boost"}, "specialties": ["aero", "engine"], "ratingAggregate": 4.6, "isVerified": True, "createdAt": now_iso()})

    # Vendors
    vnd1 = gen_id()
    await vendors.insert_one({"_id": vnd1, "name": "RallySport", "site": "https://rallysportdirect.com", "logo": None})
    vnd2 = gen_id()
    await vendors.insert_one({"_id": vnd2, "name": "MAP", "site": "https://maperformance.com", "logo": None})

    # Parts (10)
    part_ids = []
    sample_parts = [
        {"name": "Catback Exhaust", "brand": "HKS", "category": "exhaust", "image": None},
        {"name": "Cold Air Intake", "brand": "COBB", "category": "intake", "image": None},
        {"name": "Front Mount Intercooler", "brand": "ETS", "category": "cooling", "image": None},
        {"name": "Coilovers", "brand": "KW", "category": "suspension", "image": None},
        {"name": "Big Brake Kit", "brand": "Brembo", "category": "brakes", "image": None},
        {"name": "Turbo Upgrade", "brand": "Garrett", "category": "turbo", "image": None},
        {"name": "High Flow Downpipe", "brand": "Invidia", "category": "exhaust", "image": None},
        {"name": "ECU Tune", "brand": "EcuTek", "category": "tune", "image": None},
        {"name": "Carbon Lip", "brand": "APR", "category": "aero", "image": None},
        {"name": "Short Shifter", "brand": "Kartboy", "category": "drivetrain", "image": None},
    ]
    for sp in sample_parts:
        pid = gen_id()
        part_ids.append(pid)
        await parts.insert_one({"_id": pid, **sp, "specs": {}, "vendors": [{"name": "RallySport", "site": "https://rallysportdirect.com"}, {"name": "MAP", "site": "https://maperformance.com"}], "canonicalUrl": None, "affiliateLinks": [], "createdAt": now_iso()})

    # Builds (3)
    b1 = gen_id()
    await builds.insert_one({"_id": b1, "shopId": shop1, "title": "Apex WRX Stage 2", "vehicle": {"year": 2018, "make": "Subaru", "model": "WRX", "trim": "Premium"}, "summary": "Balanced daily with bite.", "heroImage": None, "gallery": [], "status": "complete", "visibility": "public", "tags": ["wrx", "stage2"], "createdAt": now_iso()})
    b2 = gen_id()
    await builds.insert_one({"_id": b2, "shopId": shop1, "title": "Apex GR86 Track", "vehicle": {"year": 2023, "make": "Toyota", "model": "GR86", "trim": "Base"}, "summary": "Track setup demo.", "heroImage": None, "gallery": [], "status": "in-progress", "visibility": "public", "tags": ["gr86", "track"], "createdAt": now_iso()})
    b3 = gen_id()
    await builds.insert_one({"_id": b3, "shopId": shop2, "title": "Boost Civic Si", "vehicle": {"year": 2020, "make": "Honda", "model": "Civic", "trim": "Si"}, "summary": "Street build.", "heroImage": None, "gallery": [], "status": "complete", "visibility": "public", "tags": ["civic", "si"], "createdAt": now_iso()})

    # Link some parts to b1
    for i, pid in enumerate(part_ids[:5]):
        await build_parts.insert_one({"_id": gen_id(), "buildId": b1, "partId": pid, "orderIndex": i, "installedByShopId": shop1, "notes": None, "proofImage": None})


@app.on_event("startup")
async def on_startup():
    await seed_if_empty()


app.include_router(router)

# Uvicorn is managed by supervisor; bind must remain 0.0.0.0:8001
# Command (for reference): uvicorn backend.server:app --host 0.0.0.0 --port 8001