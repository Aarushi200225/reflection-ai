"""
Reflection.ai — Agent Tier (Python + FastAPI + Google ADK)
Step 2: extraction agent wired behind the token gate.

STATELESS: never reads Firestore. Verifies the caller's Firebase ID token (authN),
then operates only on data passed in the request.
"""
import os
import logging
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import firebase_admin
from firebase_admin import auth as fb_auth, credentials

from agent_extract import extract_entry

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("agent-tier")

# --- Firebase Admin init -----------------------------------------------------
if not firebase_admin._apps:
    try:
        firebase_admin.initialize_app(credentials.ApplicationDefault())
    except Exception as e:  # noqa: BLE001
        log.warning("ADC init fallback: %s", e)
        firebase_admin.initialize_app()

app = FastAPI(title="Reflection.ai Agent Tier", version="0.2.0")

_web_origin = os.getenv("WEB_ORIGIN", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[_web_origin] if _web_origin != "*" else ["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["Authorization", "Content-Type"],
)


# --- AuthN dependency ---------------------------------------------------------
async def verify_token(request: Request) -> str:
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


# --- Schemas -----------------------------------------------------------------
class ExtractRequest(BaseModel):
    entryText: str = Field(default="", max_length=20000)


# --- Routes ------------------------------------------------------------------
@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/agent/whoami")
async def whoami(uid: str = Depends(verify_token)):
    return {"uid": uid, "verified": True}


@app.post("/agent/extract")
async def agent_extract(body: ExtractRequest, uid: str = Depends(verify_token)):
    """Extract structured metadata from one entry. uid is verified but the agent is
    stateless — it only processes the text in the request body."""
    result = extract_entry(body.entryText)
    return {"success": True, "data": result}


# /agent/reflect and /agent/insight arrive in Steps 3 and 4.
