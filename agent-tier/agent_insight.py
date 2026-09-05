"""Insight agent — a LangGraph sub-graph (the genuinely-agentic one).

Graph:  prepare -> generate_code -> execute --(ok)--> interpret -> END
                                        |
                                        +--(fail)--> trusted_compute -> interpret -> END

The sandbox-vs-fallback choice is a real conditional EDGE, not a hidden try/except:
the agent's control flow — including how it handles execution failure — is modelled in
the graph. Preferred path runs Gemini-generated code in the isolated Cloud Run sandbox
(Track 3 pattern). The preview sandbox lacks a python3 runtime, so today the graph routes
to the trusted in-agent compute node; when the sandbox gains Python, the same graph routes
to `interpret` directly. Post-ideathon rebuild target: paste full Track 3 codelab.

Framework-first: LangGraph StateGraph for control flow, LangChain (via llm.py) for LLM
calls. Security: fallback is pure stdlib over the user's own entries; no eval/exec of model
output in-process; sandbox path is isolated (no secrets, no egress). Stateless.
"""
import json, logging, subprocess, os, base64
from typing import TypedDict, Any, Optional
from collections import Counter
from datetime import datetime
from langgraph.graph import StateGraph, END
from llm import invoke_text, invoke_json

log = logging.getLogger("agent-tier.insight")
SANDBOX_BIN = "/usr/local/gcp/bin/sandbox"

_CODEGEN = """Write a COMPLETE self-contained Python 3 script that reads a JSON array of journal
entries from sys.stdin (each {"date","mood","themes","text"}) and prints ONLY one JSON object:
{"moodDistribution":{},"topThemes":[["theme",count]],"entryCount":int,"activeStreak":int,
"moodTrend":"improving"|"declining"|"stable"|"mixed"}. Use ONLY stdlib. Return ONLY raw code."""

_NARR = """Warm journaling companion. Given analytics JSON, write 2-3 empowering sentences
(question-first, not preachy) on consistency, themes, trend. Return ONLY JSON: {"narrative":"..."}"""


# ---------------- graph state ----------------
class InsightState(TypedDict):
    entries: list
    code: Optional[str]
    analytics: Optional[dict]
    narrative: str
    computed_via: str


# ---------------- helpers ----------------
def _clean(t):
    t = (t or "").strip()
    if t.startswith("```"):
        t = t.split("```", 2)[1]
        if t.startswith("python"): t = t[6:]
        t = t.strip().rstrip("`").strip()
    return t


def _trusted_analytics(entries):
    """Trusted stdlib computation. No model code executed."""
    moods, themes, dates = Counter(), Counter(), []
    for e in entries:
        if e.get("mood"): moods[e["mood"]] += 1
        for t in e.get("themes", []):
            if t: themes[str(t)] += 1
        if e.get("date"): dates.append(e["date"][:10])
    streak = 0
    if dates:
        uniq = sorted(set(dates), reverse=True)
        try:
            prev = datetime.strptime(uniq[0], "%Y-%m-%d"); streak = 1
            for d in uniq[1:]:
                cur = datetime.strptime(d, "%Y-%m-%d")
                if (prev - cur).days == 1: streak += 1; prev = cur
                else: break
        except ValueError:
            streak = len(uniq)
    positive = {"Focused","Grateful","Optimistic","Energetic","Content"}
    negative = {"Stressed","Fatigued","Anxious"}
    seq = [e.get("mood","") for e in sorted(entries, key=lambda x: x.get("date",""))]
    fh, sh = seq[:max(1,len(seq)//2)], seq[len(seq)//2:]
    sc = lambda h: sum(1 for m in h if m in positive) - sum(1 for m in h if m in negative)
    s1, s2 = sc(fh), sc(sh)
    trend = "improving" if s2 > s1 else "declining" if s2 < s1 else "stable"
    if len(set(seq)) > 3 and s1 == s2: trend = "mixed"
    return {"moodDistribution": dict(moods), "topThemes": themes.most_common(5),
            "entryCount": len(entries), "activeStreak": streak, "moodTrend": trend}


# ---------------- graph nodes ----------------
def n_generate_code(s: InsightState) -> InsightState:
    try:
        s["code"] = _clean(invoke_text(_CODEGEN, "Generate the analysis script now."))
    except Exception as e:  # noqa: BLE001
        log.info("codegen failed: %s", str(e)[:120]); s["code"] = None
    return s


def n_execute(s: InsightState) -> InsightState:
    """Try the sandbox. On success set analytics + computed_via='sandbox'."""
    if not s.get("code") or not os.path.exists(SANDBOX_BIN):
        return s
    try:
        code_b64 = base64.b64encode(s["code"].encode()).decode()
        data_b64 = base64.b64encode(json.dumps(s["entries"]).encode()).decode()
        shell_cmd = (f'echo {code_b64} | base64 -d > /tmp/analysis.py; '
                     f'echo {data_b64} | base64 -d | python3 /tmp/analysis.py')
        p = subprocess.run([SANDBOX_BIN, "do", "--", "/bin/sh", "-c", shell_cmd],
                           capture_output=True, text=True, timeout=25)
        if p.returncode == 0:
            s["analytics"] = json.loads(p.stdout.strip())
            s["computed_via"] = "sandbox"
        else:
            log.info("sandbox exec failed: %s", p.stderr[:200])
    except Exception as e:  # noqa: BLE001
        log.info("sandbox path error: %s", str(e)[:120])
    return s


def n_trusted(s: InsightState) -> InsightState:
    s["analytics"] = _trusted_analytics(s["entries"])
    s["computed_via"] = "agent-tier-trusted"
    return s


def n_interpret(s: InsightState) -> InsightState:
    try:
        n = invoke_json(_NARR, json.dumps(s.get("analytics") or {}))
        s["narrative"] = str(n.get("narrative","")) if isinstance(n, dict) else ""
    except Exception:  # noqa: BLE001
        s["narrative"] = ""
    return s


def _after_execute(s: InsightState) -> str:
    # Conditional EDGE: if the sandbox produced analytics, interpret; else fall back.
    return "interpret" if s.get("analytics") is not None else "trusted"


# ---------------- compile the sub-graph ----------------
def _build():
    g = StateGraph(InsightState)
    g.add_node("generate_code", n_generate_code)
    g.add_node("execute", n_execute)
    g.add_node("trusted", n_trusted)
    g.add_node("interpret", n_interpret)
    g.set_entry_point("generate_code")
    g.add_edge("generate_code", "execute")
    g.add_conditional_edges("execute", _after_execute, {"interpret": "interpret", "trusted": "trusted"})
    g.add_edge("trusted", "interpret")
    g.add_edge("interpret", END)
    return g.compile()

_GRAPH = _build()


# ---------------- public entry ----------------
def compute_insights(entries):
    safe = [{"date": str(e.get("date",""))[:10], "mood": str(e.get("mood",""))[:30],
             "themes": [str(t)[:40] for t in (e.get("themes") or [])][:6],
             "text": str(e.get("text") or e.get("summary") or "")[:500]}
            for e in (entries or [])[:200]]
    if not safe:
        return {"error": "No entries to analyze.", "analytics": None, "narrative": ""}
    out = _GRAPH.invoke({"entries": safe, "code": None, "analytics": None,
                         "narrative": "", "computed_via": ""})
    return {"analytics": out.get("analytics"), "narrative": out.get("narrative", ""),
            "error": None, "computedVia": out.get("computed_via", "")}
