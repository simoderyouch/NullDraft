"""NullDraft Cloud API.

Invite-only access and sync control plane for the desktop app. This API stores
access records, project manifests, and usage events. Screenshots, reports, and
AI usage remain local unless a future explicit asset upload feature is enabled.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

try:
    from dotenv import load_dotenv
except ModuleNotFoundError:
    def load_dotenv() -> None:
        return None

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from pydantic import BaseModel, Field

try:
    import psycopg
    from psycopg.rows import dict_row
except ModuleNotFoundError as exc:
    raise RuntimeError("Install cloud dependencies with: pip install -r cloud/requirements.txt") from exc

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
ENV = os.getenv("NULLDRAFT_ENV", "development").lower()
ADMIN_EMAILS = {e.strip().lower() for e in os.getenv("NULLDRAFT_ADMIN_EMAILS", "").split(",") if e.strip()}
TOKEN_BYTES = 32
DEFAULT_INVITE_HOURS = 72
BOOTSTRAP_SECRET = os.getenv("NULLDRAFT_BOOTSTRAP_SECRET", "")
ADMIN_CONSOLE_PASSWORD = os.getenv("NULLDRAFT_ADMIN_CONSOLE_PASSWORD", "")
PUBLIC_URL = os.getenv("NULLDRAFT_PUBLIC_URL", "").strip().rstrip("/")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is required. NullDraft Cloud uses PostgreSQL, not SQLite.")

origins_raw = os.getenv("NULLDRAFT_CLOUD_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
ALLOWED_ORIGINS = [origin.strip().rstrip("/") for origin in origins_raw.split(",") if origin.strip()]
if ENV == "production":
    if "*" in ALLOWED_ORIGINS:
        raise RuntimeError("Do not use wildcard CORS in production. Set NULLDRAFT_CLOUD_ORIGINS to your desktop/web origins.")
    if not PUBLIC_URL.startswith("https://"):
        raise RuntimeError("NULLDRAFT_PUBLIC_URL must be the public HTTPS URL in production.")

app = FastAPI(title="NullDraft Cloud API", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


def now() -> datetime:
    return datetime.now(timezone.utc)


def now_iso() -> str:
    return now().isoformat()


def db():
    return psycopg.connect(DATABASE_URL, row_factory=dict_row)


def apply_migrations() -> None:
    migrations_dir = os.path.join(os.path.dirname(__file__), "migrations")
    with db() as conn:
        conn.execute("CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())")
        applied = {row["version"] for row in conn.execute("SELECT version FROM schema_migrations").fetchall()}
        for name in sorted(os.listdir(migrations_dir)):
            if not name.endswith(".sql") or name in applied:
                continue
            with open(os.path.join(migrations_dir, name), "r", encoding="utf-8") as handle:
                conn.execute(handle.read())
            conn.execute("INSERT INTO schema_migrations(version) VALUES (%s)", (name,))


@app.on_event("startup")
def startup() -> None:
    apply_migrations()


def public_user(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "email": row["email"],
        "name": row["name"],
        "role": row["role"],
        "email_verified_at": row.get("email_verified_at"),
        "access_revoked_at": row.get("access_revoked_at"),
        "created_at": row["created_at"],
        "last_seen_at": row.get("last_seen_at"),
    }


async def current_user(request: Request, authorization: str | None = Header(default=None)) -> dict[str, Any]:
    token = ""
    token_source = ""
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        token_source = "desktop"
    elif request.cookies.get("nulldraft_admin_session"):
        token = request.cookies["nulldraft_admin_session"]
        token_source = "admin-console"
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token_hash = hash_token(token)
    with db() as conn:
        if token_source == "admin-console":
            row = conn.execute(
                """SELECT users.* FROM admin_console_sessions
                JOIN users ON users.id = admin_console_sessions.user_id
                WHERE admin_console_sessions.token_hash = %s AND admin_console_sessions.revoked_at IS NULL
                  AND admin_console_sessions.expires_at > now() AND users.access_revoked_at IS NULL""",
                (token_hash,),
            ).fetchone()
        else:
            row = conn.execute(
                """SELECT users.* FROM auth_tokens JOIN users ON users.id = auth_tokens.user_id
                WHERE auth_tokens.token_hash = %s AND auth_tokens.revoked_at IS NULL
                  AND (auth_tokens.expires_at IS NULL OR auth_tokens.expires_at > now())
                  AND users.access_revoked_at IS NULL""",
                (token_hash,),
            ).fetchone()
        if not row:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        if token_source == "desktop":
            conn.execute("UPDATE auth_tokens SET last_used_at = now() WHERE token_hash = %s", (token_hash,))
        conn.execute("UPDATE users SET last_seen_at = now() WHERE id = %s", (row["id"],))
        return row


def require_admin(user: dict[str, Any]) -> None:
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def issue_auth_token(conn, user_id: Any, device_id: str, device_name: str) -> str:
    token = secrets.token_urlsafe(TOKEN_BYTES)
    conn.execute(
        """
        INSERT INTO auth_tokens(user_id, token_hash, device_id, device_name, created_at)
        VALUES (%s, %s, %s, %s, now())
        """,
        (user_id, hash_token(token), device_id, device_name),
    )
    return token


class CreateInvitationRequest(BaseModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    name: str | None = Field(default=None, max_length=120)
    expires_in_hours: int = Field(default=DEFAULT_INVITE_HOURS, ge=1, le=168)


class AcceptInvitationRequest(BaseModel):
    token: str = Field(min_length=32, max_length=512)
    device_id: str = Field(min_length=16, max_length=200)
    device_name: str = Field(min_length=1, max_length=120)


class ProjectSyncRequest(BaseModel):
    local_id: str = Field(min_length=1, max_length=200)
    name: str = Field(min_length=1, max_length=240)
    manifest: dict[str, Any]
    updated_at: str | None = None
    last_known_cloud_updated_at: str | None = None


class EventRequest(BaseModel):
    type: str = Field(min_length=1, max_length=120)
    payload: dict[str, Any] = {}


class ProfileUpdateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class AdminConsoleLoginRequest(BaseModel):
    password: str = Field(min_length=1, max_length=512)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "service": "nulldraft-cloud", "database": "postgresql", "environment": ENV}


@app.get("/admin")
def admin_console() -> FileResponse:
    return FileResponse(os.path.join(os.path.dirname(__file__), "admin.html"), media_type="text/html")


@app.post("/v1/admin/login")
def login_admin_console(req: AdminConsoleLoginRequest) -> JSONResponse:
    """Authenticate the browser-based admin console with a deployment secret."""
    if not ADMIN_CONSOLE_PASSWORD or not hmac.compare_digest(req.password, ADMIN_CONSOLE_PASSWORD):
        raise HTTPException(status_code=401, detail="Invalid admin password")
    with db() as conn:
        admin = conn.execute(
            """SELECT id FROM users
            WHERE email = ANY(%s) AND role = 'admin' AND access_revoked_at IS NULL
            ORDER BY created_at ASC LIMIT 1""",
            (list(ADMIN_EMAILS),),
        ).fetchone()
        if not admin:
            if not ADMIN_EMAILS:
                raise HTTPException(status_code=503, detail="NULLDRAFT_ADMIN_EMAILS must include an administrator email")
            bootstrap_email = sorted(ADMIN_EMAILS)[0]
            existing = conn.execute(
                "SELECT id, access_revoked_at FROM users WHERE email = %s",
                (bootstrap_email,),
            ).fetchone()
            if existing:
                # A revoked account must stay revoked; the shared console
                # password cannot be used to bypass an administrator action.
                raise HTTPException(status_code=403, detail="Configured administrator is not active")
            admin = conn.execute(
                """INSERT INTO users(email, name, role, password_hash, email_verified_at)
                VALUES (%s, %s, 'admin', NULL, now()) RETURNING id""",
                (bootstrap_email, bootstrap_email.split("@", 1)[0]),
            ).fetchone()
        token = secrets.token_urlsafe(TOKEN_BYTES)
        conn.execute(
            "INSERT INTO admin_console_sessions(token_hash, user_id, expires_at) VALUES (%s, %s, %s)",
            (hash_token(token), admin["id"], now() + timedelta(hours=8)),
        )
        conn.execute(
            "INSERT INTO events(user_id, type, payload_json, created_at) VALUES (%s, %s, %s, now())",
            (admin["id"], "admin_console_password_login", "{}"),
        )
    response = JSONResponse({"success": True, "expires_at": (now() + timedelta(hours=8)).isoformat()})
    response.set_cookie("nulldraft_admin_session", token, max_age=8 * 60 * 60, httponly=True, secure=ENV == "production", samesite="strict", path="/")
    return response


@app.get("/admin/session")
def establish_admin_console_session(token: str) -> RedirectResponse:
    token_hash = hash_token(token)
    with db() as conn:
        user = conn.execute(
            """SELECT users.* FROM admin_console_sessions JOIN users ON users.id = admin_console_sessions.user_id
            WHERE admin_console_sessions.token_hash = %s AND admin_console_sessions.revoked_at IS NULL
              AND admin_console_sessions.expires_at > now() AND users.access_revoked_at IS NULL""",
            (token_hash,),
        ).fetchone()
    if not user or user["role"] != "admin":
        raise HTTPException(status_code=401, detail="Invalid or expired admin console session")
    response = RedirectResponse("/admin", status_code=303)
    response.set_cookie("nulldraft_admin_session", token, max_age=8 * 60 * 60, httponly=True, secure=ENV == "production", samesite="strict", path="/")
    return response


def serialize_invitation(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "email": row["email"],
        "name": row.get("name"),
        "created_at": row["created_at"],
        "expires_at": row["expires_at"],
        "used_at": row.get("used_at"),
        "revoked_at": row.get("revoked_at"),
    }


def create_invitation(conn, *, email: str, name: str | None, created_by: Any, expires_in_hours: int) -> tuple[dict[str, Any], str]:
    token = secrets.token_urlsafe(TOKEN_BYTES)
    row = conn.execute(
        """
        INSERT INTO invitations(email, name, token_hash, created_by, expires_at)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING *
        """,
        (email.lower(), name.strip() if name else None, hash_token(token), created_by, now() + timedelta(hours=expires_in_hours)),
    ).fetchone()
    return row, token


@app.post("/v1/auth/accept-invitation")
def accept_invitation(req: AcceptInvitationRequest) -> dict[str, Any]:
    """Consume a single-use invitation and create a 30-day device session."""
    token_hash = hash_token(req.token)
    with db() as conn:
        invitation = conn.execute(
            """
            SELECT * FROM invitations
            WHERE token_hash = %s AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now()
            FOR UPDATE
            """,
            (token_hash,),
        ).fetchone()
        if not invitation:
            raise HTTPException(status_code=400, detail="This invitation is invalid, expired, or has already been used")

        user = conn.execute("SELECT * FROM users WHERE email = %s", (invitation["email"],)).fetchone()
        if user:
            user = conn.execute(
                """
                UPDATE users
                SET access_revoked_at = NULL,
                    name = COALESCE(%s, name),
                    email_verified_at = COALESCE(email_verified_at, now()),
                    last_seen_at = now()
                WHERE id = %s
                RETURNING *
                """,
                (invitation.get("name"), user["id"]),
            ).fetchone()
        else:
            role = "admin" if invitation["email"] in ADMIN_EMAILS else "user"
            user = conn.execute(
                """
                INSERT INTO users(email, name, role, password_hash, email_verified_at, created_at, last_seen_at)
                VALUES (%s, %s, %s, NULL, now(), now(), now())
                RETURNING *
                """,
                (invitation["email"], invitation.get("name") or invitation["email"].split("@", 1)[0], role),
            ).fetchone()

        # A fresh activation deliberately replaces prior sessions for this user.
        conn.execute("UPDATE auth_tokens SET revoked_at = now() WHERE user_id = %s AND revoked_at IS NULL", (user["id"],))
        session_token = issue_auth_token(conn, user["id"], req.device_id, req.device_name.strip())
        conn.execute("UPDATE invitations SET used_at = now() WHERE id = %s", (invitation["id"],))
        conn.execute(
            "INSERT INTO events(user_id, type, payload_json, created_at) VALUES (%s, %s, %s, now())",
            (user["id"], "invitation_accepted", json.dumps({"invitation_id": str(invitation["id"]), "device_name": req.device_name.strip()})),
        )
    return {"token": session_token, "user": public_user(user), "session_expires_at": None}


@app.post("/v1/auth/logout")
def logout(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        with db() as conn:
            conn.execute("UPDATE auth_tokens SET revoked_at = now() WHERE token_hash = %s", (hash_token(token),))
    return {"success": True}


@app.get("/v1/me")
def me(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    return {"user": public_user(user)}


@app.patch("/v1/me")
def update_me(req: ProfileUpdateRequest, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    with db() as conn:
        updated = conn.execute(
            "UPDATE users SET name = %s WHERE id = %s RETURNING *",
            (req.name, user["id"]),
        ).fetchone()
    return {"user": public_user(updated)}


@app.post("/v1/projects/sync")
def sync_project(req: ProjectSyncRequest, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    manifest_json = json.dumps(req.manifest, ensure_ascii=False)
    with db() as conn:
        existing = conn.execute(
            "SELECT * FROM projects WHERE user_id = %s AND local_id = %s",
            (user["id"], req.local_id),
        ).fetchone()
        if existing and req.last_known_cloud_updated_at and str(existing["updated_at"]) != req.last_known_cloud_updated_at:
            return {
                "success": False,
                "conflict": True,
                "project_id": str(existing["id"]),
                "cloud_updated_at": existing["updated_at"],
                "message": "Project changed in the cloud since last sync.",
            }
        if existing:
            row = conn.execute(
                """
                UPDATE projects
                SET name = %s, manifest_json = %s, updated_at = COALESCE(%s::timestamptz, now()), last_synced_at = now()
                WHERE id = %s
                RETURNING *
                """,
                (req.name, manifest_json, req.updated_at, existing["id"]),
            ).fetchone()
        else:
            row = conn.execute(
                """
                INSERT INTO projects(user_id, local_id, name, manifest_json, created_at, updated_at, last_synced_at)
                VALUES (%s, %s, %s, %s, now(), COALESCE(%s::timestamptz, now()), now())
                RETURNING *
                """,
                (user["id"], req.local_id, req.name, manifest_json, req.updated_at),
            ).fetchone()
        conn.execute(
            "INSERT INTO events(user_id, type, payload_json, created_at) VALUES (%s, %s, %s, now())",
            (user["id"], "project_synced", json.dumps({"project_id": str(row["id"]), "local_id": req.local_id})),
        )
    return {"success": True, "project_id": str(row["id"]), "cloud_updated_at": row["updated_at"], "last_synced_at": row["last_synced_at"]}


@app.get("/v1/projects")
def list_projects(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    with db() as conn:
        rows = conn.execute(
            "SELECT id, local_id, name, updated_at, last_synced_at FROM projects WHERE user_id = %s ORDER BY updated_at DESC",
            (user["id"],),
        ).fetchall()
    return {"projects": [{**row, "id": str(row["id"])} for row in rows]}


@app.post("/v1/events")
def track_event(req: EventRequest, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    with db() as conn:
        conn.execute(
            "INSERT INTO events(user_id, type, payload_json, created_at) VALUES (%s, %s, %s, now())",
            (user["id"], req.type, json.dumps(req.payload, ensure_ascii=False)),
        )
    return {"success": True}


def activation_url(token: str) -> str:
    return f"nulldraft://activate?token={token}"


@app.post("/v1/bootstrap/invitation")
def bootstrap_invitation(
    req: CreateInvitationRequest,
    x_bootstrap_secret: str | None = Header(default=None),
) -> dict[str, Any]:
    """Create exactly one first-admin invitation using a deployment secret.

    This is intentionally unavailable once an active admin exists. It avoids a
    public registration endpoint while still giving a new deployment a safe
    way to create its first administrator.
    """
    if not BOOTSTRAP_SECRET or not x_bootstrap_secret or not hmac.compare_digest(x_bootstrap_secret, BOOTSTRAP_SECRET):
        raise HTTPException(status_code=404, detail="Not found")
    email = req.email.lower()
    if email not in ADMIN_EMAILS:
        raise HTTPException(status_code=400, detail="Bootstrap email must be listed in NULLDRAFT_ADMIN_EMAILS")
    with db() as conn:
        existing_admin = conn.execute(
            "SELECT 1 FROM users WHERE role = 'admin' AND access_revoked_at IS NULL LIMIT 1"
        ).fetchone()
        if existing_admin:
            raise HTTPException(status_code=409, detail="An administrator already exists")
        pending_bootstrap = conn.execute(
            """
            SELECT 1 FROM invitations
            WHERE created_by IS NULL AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now()
            LIMIT 1
            """
        ).fetchone()
        if pending_bootstrap:
            raise HTTPException(status_code=409, detail="A first-administrator invitation is already active")
        invitation, token = create_invitation(
            conn,
            email=email,
            name=req.name,
            created_by=None,
            expires_in_hours=req.expires_in_hours,
        )
    return {"invitation": serialize_invitation(invitation), "activation_url": activation_url(token)}


@app.post("/v1/bootstrap/admin-recovery-invitation")
def bootstrap_admin_recovery_invitation(
    req: CreateInvitationRequest,
    x_bootstrap_secret: str | None = Header(default=None),
) -> dict[str, Any]:
    """Issue one break-glass invitation for a configured, existing administrator.

    This endpoint is deliberately limited to a single global use and to an
    email explicitly listed in NULLDRAFT_ADMIN_EMAILS. It is for recovering an
    initial admin session that was accepted but not retained by the desktop app.
    """
    if not BOOTSTRAP_SECRET or not x_bootstrap_secret or not hmac.compare_digest(x_bootstrap_secret, BOOTSTRAP_SECRET):
        raise HTTPException(status_code=404, detail="Not found")
    email = req.email.lower()
    if email not in ADMIN_EMAILS:
        raise HTTPException(status_code=404, detail="Not found")
    with db() as conn:
        if conn.execute("SELECT 1 FROM bootstrap_admin_recovery LIMIT 1").fetchone():
            raise HTTPException(status_code=409, detail="Administrator recovery has already been used")
        admin = conn.execute(
            """SELECT id, email, name FROM users
            WHERE email = %s AND role = 'admin' AND access_revoked_at IS NULL""",
            (email,),
        ).fetchone()
        if not admin:
            raise HTTPException(status_code=404, detail="Not found")
        invitation, token = create_invitation(
            conn,
            email=email,
            name=req.name or admin["name"],
            created_by=admin["id"],
            expires_in_hours=req.expires_in_hours,
        )
        conn.execute(
            """INSERT INTO bootstrap_admin_recovery(email, invitation_id)
            VALUES (%s, %s)""",
            (email, invitation["id"]),
        )
        conn.execute(
            "INSERT INTO events(user_id, type, payload_json, created_at) VALUES (%s, %s, %s, now())",
            (admin["id"], "admin_recovery_invitation_created", json.dumps({"invitation_id": str(invitation["id"])})),
        )
    return {"invitation": serialize_invitation(invitation), "activation_url": activation_url(token)}


@app.post("/v1/admin/invitations")
def create_admin_invitation(req: CreateInvitationRequest, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    require_admin(user)
    with db() as conn:
        invitation, token = create_invitation(
            conn,
            email=req.email,
            name=req.name,
            created_by=user["id"],
            expires_in_hours=req.expires_in_hours,
        )
        conn.execute(
            "INSERT INTO events(user_id, type, payload_json, created_at) VALUES (%s, %s, %s, now())",
            (user["id"], "invitation_created", json.dumps({"invitation_id": str(invitation["id"]), "email": invitation["email"]})),
        )
    return {"invitation": serialize_invitation(invitation), "activation_url": activation_url(token)}


@app.post("/v1/admin/console-session")
def create_admin_console_session(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    require_admin(user)
    if not PUBLIC_URL:
        raise HTTPException(status_code=503, detail="Admin console public URL is not configured")
    token = secrets.token_urlsafe(TOKEN_BYTES)
    with db() as conn:
        conn.execute(
            "INSERT INTO admin_console_sessions(token_hash, user_id, expires_at) VALUES (%s, %s, %s)",
            (hash_token(token), user["id"], now() + timedelta(hours=8)),
        )
        conn.execute(
            "INSERT INTO events(user_id, type, payload_json, created_at) VALUES (%s, %s, %s, now())",
            (user["id"], "admin_console_opened", "{}"),
        )
    return {"admin_url": f"{PUBLIC_URL}/admin/session?token={token}", "expires_at": now() + timedelta(hours=8)}


@app.get("/v1/admin/invitations")
def admin_invitations(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    require_admin(user)
    with db() as conn:
        rows = conn.execute(
            "SELECT * FROM invitations ORDER BY created_at DESC LIMIT 500"
        ).fetchall()
    return {"invitations": [serialize_invitation(row) for row in rows]}


@app.post("/v1/admin/invitations/{invitation_id}/revoke")
def revoke_invitation(invitation_id: str, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    require_admin(user)
    with db() as conn:
        invitation = conn.execute(
            """
            UPDATE invitations SET revoked_at = now()
            WHERE id = %s AND used_at IS NULL AND revoked_at IS NULL
            RETURNING *
            """,
            (invitation_id,),
        ).fetchone()
        if not invitation:
            raise HTTPException(status_code=404, detail="Active invitation not found")
        conn.execute(
            "INSERT INTO events(user_id, type, payload_json, created_at) VALUES (%s, %s, %s, now())",
            (user["id"], "invitation_revoked", json.dumps({"invitation_id": invitation_id, "email": invitation["email"]})),
        )
    return {"success": True, "invitation": serialize_invitation(invitation)}


@app.post("/v1/admin/users/{user_id}/revoke")
def revoke_user_access(user_id: str, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    require_admin(user)
    if str(user["id"]) == user_id:
        raise HTTPException(status_code=400, detail="An administrator cannot revoke their own access")
    with db() as conn:
        revoked = conn.execute(
            "UPDATE users SET access_revoked_at = now() WHERE id = %s RETURNING *",
            (user_id,),
        ).fetchone()
        if not revoked:
            raise HTTPException(status_code=404, detail="User not found")
        conn.execute("UPDATE auth_tokens SET revoked_at = now() WHERE user_id = %s AND revoked_at IS NULL", (user_id,))
        conn.execute(
            "INSERT INTO events(user_id, type, payload_json, created_at) VALUES (%s, %s, %s, now())",
            (user["id"], "user_access_revoked", json.dumps({"user_id": user_id, "email": revoked["email"]})),
        )
    return {"success": True, "user": public_user(revoked)}


@app.get("/v1/admin/users")
def admin_users(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    require_admin(user)
    with db() as conn:
        rows = conn.execute("SELECT id, email, name, role, email_verified_at, access_revoked_at, created_at, last_seen_at FROM users ORDER BY created_at DESC LIMIT 1000").fetchall()
    return {"users": [{**row, "id": str(row["id"])} for row in rows]}


@app.get("/v1/admin/events")
def admin_events(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    require_admin(user)
    with db() as conn:
        rows = conn.execute(
            """
            SELECT events.id, events.type, events.payload_json, events.created_at,
                   users.email, users.name, users.role
            FROM events
            LEFT JOIN users ON users.id = events.user_id
            ORDER BY events.created_at DESC
            LIMIT 500
            """
        ).fetchall()
    return {"events": [{**row, "id": str(row["id"]), "payload": json.loads(row["payload_json"])} for row in rows]}
