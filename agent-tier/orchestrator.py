"""
Orchestrator — routes a request to the right agent by intent.
Keeps one entry point for the web tier; each agent stays independently callable.
Stateless: operates only on payload data.
"""
import logging
from agent_extract import extract_entry
from agent_reflect import reflect
from agent_insight import compute_insights

log = logging.getLogger("agent-tier.orchestrator")

VALID = {"extract", "reflect", "insight"}


def route(intent: str, payload: dict) -> dict:
    """Dispatch by intent. Raises ValueError on unknown intent."""
    intent = (intent or "").strip().lower()
    if intent not in VALID:
        raise ValueError(f"Unknown intent '{intent}'. Valid: {sorted(VALID)}")

    if intent == "extract":
        return extract_entry(payload.get("entryText", ""))

    if intent == "reflect":
        return reflect(
            current_entry=payload.get("currentEntry", ""),
            history=payload.get("history", []),
            past_entries=payload.get("pastEntries", []),
            current_themes=payload.get("currentThemes", []),
        )

    # insight
    return compute_insights(payload.get("entries", []))
