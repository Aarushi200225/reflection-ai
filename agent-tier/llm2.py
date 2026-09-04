"""
LangChain LLM access for the agent tier.
Wraps Gemini as a LangChain ChatGoogleGenerativeAI runnable, with the cost-ordered
fallback ladder from the constitution via .with_fallbacks().
Key is loaded from Secret Manager (secret_store).
"""
import json
import logging
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from secret_store import gemini_api_key

log = logging.getLogger("agent-tier.llm")

MODEL_LADDER = ["gemini-3.6-flash", "gemini-3.1-flash-lite",
                "gemini-flash-latest", "gemini-3.7-flash"]


def _mk(model: str, json_mode: bool):
    kw = {"model": model, "google_api_key": gemini_api_key(), "temperature": 0.7}
    if json_mode:
        kw["model_kwargs"] = {"response_mime_type": "application/json"}
    return ChatGoogleGenerativeAI(**kw)


def _llm(json_mode: bool):
    """Primary model with the rest of the ladder as LangChain fallbacks."""
    primary = _mk(MODEL_LADDER[0], json_mode)
    return primary.with_fallbacks([_mk(m, json_mode) for m in MODEL_LADDER[1:]])


def invoke_json(system: str, user: str) -> dict:
    """Invoke the ladder expecting JSON; parse and return dict."""
    resp = _llm(True).invoke([SystemMessage(content=system), HumanMessage(content=user)])
    text = (resp.content or "").strip()
    if text.startswith("```"):
        text = text.split("```", 2)[1].removeprefix("json").strip()
    return json.loads(text)


def invoke_text(system: str, user: str) -> str:
    """Invoke the ladder expecting plain text (e.g. code generation)."""
    resp = _llm(False).invoke([SystemMessage(content=system), HumanMessage(content=user)])
    return (resp.content or "").strip()
