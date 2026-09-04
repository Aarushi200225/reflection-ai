"""Orchestrator — a LangGraph StateGraph routing intent to one agent node.
Entry -> conditional edge (by intent) -> agent node -> END. State carries payload+result.
Framework-first: genuine StateGraph, not a disguised if/else. Stateless per request."""
import logging
from typing import TypedDict, Any
from langgraph.graph import StateGraph, END
from agent_extract import extract_entry
from agent_reflect import reflect
from agent_insight import compute_insights

log = logging.getLogger("agent-tier.orchestrator")
VALID = {"extract", "reflect", "insight"}

class AgentState(TypedDict):
    intent: str
    payload: dict
    result: Any

def _extract(s: AgentState) -> AgentState:
    s["result"] = extract_entry(s["payload"].get("entryText", "")); return s

def _reflect(s: AgentState) -> AgentState:
    p = s["payload"]
    s["result"] = reflect(p.get("currentEntry",""), p.get("history",[]),
                          p.get("pastEntries",[]), p.get("currentThemes",[])); return s

def _insight(s: AgentState) -> AgentState:
    s["result"] = compute_insights(s["payload"].get("entries", [])); return s

def _pick(s: AgentState) -> str:
    return s["intent"]

def _build():
    g = StateGraph(AgentState)
    g.add_node("extract", _extract)
    g.add_node("reflect", _reflect)
    g.add_node("insight", _insight)
    g.set_conditional_entry_point(_pick, {"extract":"extract","reflect":"reflect","insight":"insight"})
    for n in VALID:
        g.add_edge(n, END)
    return g.compile()

_GRAPH = _build()

def route(intent: str, payload: dict) -> dict:
    intent = (intent or "").strip().lower()
    if intent not in VALID:
        raise ValueError(f"Unknown intent '{intent}'. Valid: {sorted(VALID)}")
    out = _GRAPH.invoke({"intent": intent, "payload": payload or {}, "result": None})
    return out["result"]
