"""Gemini client + cost-ordered fallback ladder, shared by all agents.
Mirrors the web tier's resilience protocol (constitution Part A section 6).
"""
import json
import logging
from google import genai
from google.genai import types
from secret_store import gemini_api_key

log = logging.getLogger("agent-tier.gemini")

# Cost-ordered ladder: cheapest capable first, deep-reasoning last (constitution B5).
MODEL_LADDER = [
    "gemini-3.6-flash",
    "gemini-3.1-flash-lite",
    "gemini-flash-latest",
    "gemini-3.7-flash",
]

_client: genai.Client | None = None


def _client_singleton() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=gemini_api_key())
    return _client


def generate_json(system_instruction: str, user_text: str) -> dict:
    """Generate a JSON response, laddering models on transient errors.
    Returns a parsed dict. Raises if the whole ladder is exhausted."""
    client = _client_singleton()
    last_err = None

    for model in MODEL_LADDER:
        try:
            resp = client.models.generate_content(
                model=model,
                contents=user_text,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    response_mime_type="application/json",
                ),
            )
            text = (resp.text or "").strip()
            if text.startswith("```"):
                text = text.split("```", 2)[1]
                if text.startswith("json"):
                    text = text[4:]
                text = text.strip().rstrip("`").strip()
            return json.loads(text)
        except Exception as e:  # noqa: BLE001
            last_err = e
            log.warning("Model %s failed (%s). Laddering down...", model, e)

    raise RuntimeError(f"Gemini ladder exhausted. Last error: {last_err}")
