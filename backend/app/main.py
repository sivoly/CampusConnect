"""CampusConnect Main Application Entrypoint

FastAPI ASGI backend serving secure APIs and Glass UI frontend.
"""

from pathlib import Path
import json
import time
from datetime import datetime, timezone
from typing import Optional
from fastapi import FastAPI, Request, Response, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from backend.app.core.config import settings

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"
PAGES_DIR = FRONTEND_DIR / "pages"

# Initialize FastAPI App
app = FastAPI(
    title="CampusConnect API",
    description="Secure Digital College Notice Board with RBAC, Session Auth, and Glass UI",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/api/openapi.json",
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


# Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response: Response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    
    # Do not cache sensitive auth/API responses
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        
    return response


# Mount Static Assets & Storage
app.mount("/css", StaticFiles(directory=str(FRONTEND_DIR / "css")), name="css")
app.mount("/js", StaticFiles(directory=str(FRONTEND_DIR / "js")), name="js")
if (FRONTEND_DIR / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIR / "assets")), name="assets")
if (BASE_DIR / "storage").exists():
    app.mount("/storage", StaticFiles(directory=str(BASE_DIR / "storage")), name="storage")


# Frontend Web Routes
@app.get("/", response_class=FileResponse, tags=["Frontend"])
async def serve_home():
    """Serve the public Glass UI notice board portal."""
    return FileResponse(PAGES_DIR / "index.html")


@app.get("/login", response_class=FileResponse, tags=["Frontend"])
async def serve_login():
    """Serve the unified authentication login page."""
    return FileResponse(PAGES_DIR / "login.html")


@app.get("/forgot-password", response_class=FileResponse, tags=["Frontend"])
async def serve_forgot_password():
    """Serve the password recovery page."""
    return FileResponse(PAGES_DIR / "forgot-password.html")


@app.get("/student", response_class=FileResponse, tags=["Frontend"])
async def serve_student():
    """Serve the authenticated student dashboard."""
    return FileResponse(PAGES_DIR / "student" / "index.html")


@app.get("/staff", response_class=FileResponse, tags=["Frontend"])
async def serve_staff():
    """Serve the staff notice authoring and management portal."""
    return FileResponse(PAGES_DIR / "staff" / "index.html")


@app.get("/admin", response_class=FileResponse, tags=["Frontend"])
async def serve_admin():
    """Serve the administrator portal and user management dashboard."""
    return FileResponse(PAGES_DIR / "admin" / "index.html")


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    """Serve the application SVG favicon."""
    fav_path = FRONTEND_DIR / "assets" / "favicon.svg"
    if fav_path.exists():
        return FileResponse(fav_path, media_type="image/svg+xml")
    return Response(status_code=204)


# Core API Health & Data Endpoints
@app.get("/api/health", tags=["Health"])
async def health_check():
    """System health check and version verification."""
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "version": "1.0.0"
    }


@app.get("/api/stats", tags=["Public API"])
async def get_system_stats():
    """Get high-level statistics for notice board counters."""
    return {
        "total_notices": 4,
        "categories": {
            "notice": 1,
            "hall_allocation": 1,
            "event": 1,
            "other": 1
        },
        "attachments_available": 3,
        "roles_supported": ["student", "staff", "admin"]
    }


@app.get("/api/auth/demo-users", tags=["Authentication"])
async def get_demo_users():
    """List one-click credentials for instant sandbox testing."""
    return [
        {
            "role": "student",
            "username": "student",
            "email": "student@campusconnect.edu",
            "password": "student123",
            "description": "Alex Johnson (Student - Information Technology)"
        },
        {
            "role": "staff",
            "username": "staff",
            "email": "staff@campusconnect.edu",
            "password": "staff123",
            "description": "Dr. Robert Vance (Faculty Staff - Computer Science)"
        },
        {
            "role": "admin",
            "username": "admin",
            "email": "admin@campusconnect.edu",
            "password": "admin123",
            "description": "System Administrator (Full Privileges)"
        }
    ]


# =========================================================================
# Persistent Notices & Events Storage Endpoints (Server-Side Storage)
# =========================================================================
NOTICES_FILE = BASE_DIR / "storage" / "notices.json"
REGISTRATIONS_FILE = BASE_DIR / "storage" / "event_registrations.json"


def read_notices_file() -> list:
    if NOTICES_FILE.exists():
        try:
            with open(NOTICES_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []
    return []


def write_notices_file(notices: list):
    NOTICES_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(NOTICES_FILE, "w", encoding="utf-8") as f:
        json.dump(notices, f, indent=2)


def read_registrations_file() -> list:
    if REGISTRATIONS_FILE.exists():
        try:
            with open(REGISTRATIONS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []
    return []


def write_registrations_file(regs: list):
    REGISTRATIONS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(REGISTRATIONS_FILE, "w", encoding="utf-8") as f:
        json.dump(regs, f, indent=2)


@app.get("/api/notices", tags=["Notices & Events"])
async def get_notices():
    """Retrieve all notices and events persistently stored on the server."""
    return read_notices_file()


@app.post("/api/notices", tags=["Notices & Events"])
async def create_notice(payload: dict):
    """Add a new notice or event created by staff or admin."""
    notices = read_notices_file()
    if not payload.get("id"):
        payload["id"] = f"notice_{int(time.time() * 1000)}"
    if not payload.get("createdAt"):
        payload["createdAt"] = datetime.now(timezone.utc).isoformat()
    if not payload.get("status"):
        payload["status"] = "published"
    notices.insert(0, payload)
    write_notices_file(notices)
    return payload


@app.put("/api/notices/{notice_id}", tags=["Notices & Events"])
async def update_notice(notice_id: str, updates: dict):
    """Update an existing notice or event."""
    notices = read_notices_file()
    for idx, n in enumerate(notices):
        if n.get("id") == notice_id:
            notices[idx].update(updates)
            write_notices_file(notices)
            return notices[idx]
    return JSONResponse(status_code=404, content={"detail": "Notice not found"})


@app.delete("/api/notices/{notice_id}", tags=["Notices & Events"])
async def delete_notice(notice_id: str):
    """Delete a notice or event."""
    notices = read_notices_file()
    notices = [n for n in notices if n.get("id") != notice_id]
    write_notices_file(notices)
    return {"success": True, "deleted": notice_id}


@app.get("/api/events/registrations", tags=["Event Registrations"])
async def get_event_registrations(uid: Optional[str] = None):
    """Get all event registrations or filtered by user UID."""
    regs = read_registrations_file()
    if uid:
        return [r for r in regs if r.get("uid") == uid]
    return regs


@app.post("/api/events/register", tags=["Event Registrations"])
async def register_event(payload: dict):
    """RSVP / register for an event."""
    regs = read_registrations_file()
    uid = payload.get("uid")
    notice_id = payload.get("noticeId")
    if not uid or not notice_id:
        return JSONResponse(status_code=400, content={"detail": "uid and noticeId required"})
    existing = next((r for r in regs if r.get("uid") == uid and r.get("noticeId") == notice_id), None)
    if existing:
        return existing
    if not payload.get("id"):
        payload["id"] = f"reg_{int(time.time() * 1000)}"
    if not payload.get("registeredAt"):
        payload["registeredAt"] = datetime.now(timezone.utc).isoformat()
    regs.insert(0, payload)
    write_registrations_file(regs)
    return payload


@app.delete("/api/events/register/{notice_id}", tags=["Event Registrations"])
async def cancel_event_registration(notice_id: str, uid: Optional[str] = None):
    """Cancel an event registration."""
    regs = read_registrations_file()
    regs = [r for r in regs if not (r.get("noticeId") == notice_id and (uid is None or r.get("uid") == uid))]
    write_registrations_file(regs)
    return {"success": True}


# =========================================================================
# Local File Upload Endpoint (No paid Firebase Storage needed)
# =========================================================================
UPLOAD_DIR = BASE_DIR / "storage" / "uploads"

@app.post("/api/upload", tags=["Storage"])
async def upload_attachment(file: UploadFile = File(...)):
    """Upload PDF or image attachment to local server storage."""
    allowed_types = ["application/pdf", "image/png", "image/jpeg", "image/jpg"]
    if file.content_type not in allowed_types:
        return JSONResponse(status_code=400, content={"detail": "Only PDF, PNG, and JPEG files are allowed."})
    
    # Read and check size (10MB max)
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        return JSONResponse(status_code=400, content={"detail": "File size exceeds 10MB limit."})
    
    # Generate clean filename
    timestamp = int(time.time() * 1000)
    clean_name = "".join(c for c in file.filename if c.isalnum() or c in "._-").strip()
    saved_name = f"{timestamp}_{clean_name}"
    
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    file_path = UPLOAD_DIR / saved_name
    with open(file_path, "wb") as f:
        f.write(content)
        
    return {
        "name": file.filename,
        "url": f"/storage/uploads/{saved_name}",
        "size": len(content),
        "type": file.content_type,
        "uploadedAt": datetime.now(timezone.utc).isoformat()
    }



