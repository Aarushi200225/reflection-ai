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
from agent_reflect import reflect
from agent_insight import compute_insights
from orchestrator import route as orchestrate

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("agent-tier")

# --- Firebase Admin init -----------------------------------------------------
if not firebase_admin._apps:
    _fb_project = os.getenv("FIREBASE_PROJECT_ID", "gen-lang-client-0057557227")
    try:
        firebase_admin.initialize_app(
            credentials.ApplicationDefault(),
            {"projectId": _fb_project},
        )
    except Exception as e:
        log.warning("ADC init fallback: %s", e)
        firebase_admin.initialize_app(options={"projectId": _fb_project})

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


class Message(BaseModel):
    role: str = "user"
    content: str = ""


class PastEntry(BaseModel):
    date: str = ""
    summary: str = ""
    title: str = ""
    preview: str = ""
    themes: list[str] = Field(default_factory=list)


class ReflectRequest(BaseModel):
    currentEntry: str = Field(default="", max_length=20000)
    history: list[Message] = Field(default_factory=list)
    pastEntries: list[PastEntry] = Field(default_factory=list)
    currentThemes: list[str] = Field(default_factory=list)


class InsightEntry(BaseModel):
    date: str = ""
    mood: str = ""
    themes: list[str] = Field(default_factory=list)
    text: str = ""
    summary: str = ""


class InsightRequest(BaseModel):
    entries: list[InsightEntry] = Field(default_factory=list)


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


@app.post("/agent/reflect")
async def agent_reflect(body: ReflectRequest, uid: str = Depends(verify_token)):
    """Grounded reflection over the user's own past entries (passed in the request).
    uid is verified but the agent is stateless — it grounds only on supplied data."""
    result = reflect(
        current_entry=body.currentEntry,
        history=[m.model_dump() for m in body.history],
        past_entries=[p.model_dump() for p in body.pastEntries],
        current_themes=body.currentThemes,
    )
    return {"success": True, "data": result}


@app.post("/agent/insight")
async def agent_insight(body: InsightRequest, uid: str = Depends(verify_token)):
    """Sandbox insight agent: Gemini writes analysis code, it runs in an isolated
    Cloud Run sandbox, and we return computed trends + a narrative. Stateless; the
    sandbox sees only the entries passed in, never secrets or the DB."""
    try:
        result = compute_insights([e.model_dump() for e in body.entries])
        return {"success": True, "data": result}
    except Exception as e:  # noqa: BLE001
        log.error("Insight agent failed: %s", e)
        raise HTTPException(status_code=503, detail=f"Insight computation unavailable: {e}")


class RunRequest(BaseModel):
    intent: str
    payload: dict = Field(default_factory=dict)


@app.post("/agent/run")
async def agent_run(body: RunRequest, uid: str = Depends(verify_token)):
    """Orchestrator entry point: routes intent (extract|reflect|insight) to the agent."""
    try:
        result = orchestrate(body.intent, body.payload)
        return {"success": True, "intent": body.intent, "data": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:  # noqa: BLE001
        log.error("Orchestration failed: %s", e)
        raise HTTPException(status_code=503, detail=f"Agent unavailable: {e}")
