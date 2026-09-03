"""
Reflection.ai — Agent Tier (Python + FastAPI + Google ADK)
Build Step 1: skeleton + Firebase ID token verification.

STATELESS by design: this service never reads Firestore. It verifies the caller's
Firebase ID token (authN only), then operates solely on data passed in the request.
Agents (extraction / reflection / insight) are added in later build steps.
"""
import os
import logging
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import firebase_admin
from firebase_admin import auth as fb_auth, credentials

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("agent-tier")

# --- Firebase Admin init -----------------------------------------------------
# On Cloud Run, Application Default Credentials (the service account) are used
# automatically — no key file, no secret needed for token verification.
if not firebase_admin._apps:
    try:
        firebase_admin.initialize_app(credentials.ApplicationDefault())
    except Exception as e:  # noqa: BLE001
        log.warning("ADC init fallback: %s", e)
        firebase_admin.initialize_app()

app = FastAPI(title="Reflection.ai Agent Tier", version="0.1.0")

# CORS: allow the web tier origin only (set WEB_ORIGIN env at deploy time).
_web_origin = os.getenv("WEB_ORIGIN", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[_web_origin] if _web_origin != "*" else ["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["Authorization", "Content-Type"],
)


# --- AuthN dependency: verify Firebase ID token ------------------------------
async def verify_token(request: Request) -> str:
    """Verify the Bearer Firebase ID token. Returns the uid, or raises 401.
    The uid is taken ONLY from the verified token — never from the request body."""
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token.")
    token = header.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Empty token.")
    try:
        decoded = fb_auth.verify_id_token(token)
        return decoded["uid"]
    except Exception as e:  # noqa: BLE001
        log.info("Token verification failed: %s", e)
        raise HTTPException(status_code=401, detail="Invalid or expired token.")


# --- Health (no auth) --------------------------------------------------------
@app.get("/health")
async def health():
    return {"status": "ok", "aiConfigured": bool(os.getenv("GEMINI_API_KEY"))}


# --- Protected probe (proves auth works end-to-end) --------------------------
@app.get("/agent/whoami")
async def whoami(uid: str = Depends(verify_token)):
    # Returns the verified uid only. No DB, no data — just proves the gate works.
    return {"uid": uid, "verified": True}


# Agent endpoints (/agent/extract, /agent/reflect, /agent/insight) land in the
# next build steps, each behind Depends(verify_token).
