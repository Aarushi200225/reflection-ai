"""Sandbox insight agent — genuinely agentic tool-use.
LLM (via LangChain) writes analysis code -> runs in ISOLATED Cloud Run sandbox
(/usr/local/gcp/bin/sandbox: no secrets, no egress) -> LLM writes narrative.
Fails CLOSED if sandbox binary absent (never unsafe in-process exec). Stateless."""
import json, logging, subprocess, os
from llm import invoke_text, invoke_json

log = logging.getLogger("agent-tier.insight")
SANDBOX_BIN = "/usr/local/gcp/bin/sandbox"

_CODEGEN = """Write a COMPLETE self-contained Python 3 script that reads a JSON array of journal
entries from sys.stdin (each {"date","mood","themes","text"}) and prints ONLY one JSON object to stdout:
{"moodDistribution":{},"topThemes":[["theme",count]],"entryCount":int,"activeStreak":int,
"moodTrend":"improving"|"declining"|"stable"|"mixed"}. Active streak = consecutive days back from latest.
Use ONLY stdlib (json,sys,collections,datetime). Robust to missing fields/empty input. Return ONLY raw code."""

_NARR = """Warm journaling companion. Given analytics JSON, write 2-3 empowering sentences (question-first,
not preachy) on consistency, themes, trend. Return ONLY JSON: {"narrative":"..."}"""

def _clean(t):
    t = (t or "").strip()
    if t.startswith("```"):
        t = t.split("```",2)[1]
        if t.startswith("python"): t = t[6:]
        t = t.strip().rstrip("`").strip()
    return t

def _run(code, stdin, timeout=25):
    if not os.path.exists(SANDBOX_BIN):
        raise RuntimeError("Sandbox binary unavailable (deploy without --sandbox-launcher).")
    import tempfile
    # Write generated code to a temp .py file, execute the FILE (not -c inline),
    # so multi-line/indented scripts run correctly inside the sandbox.
    with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False, dir="/tmp") as f:
        f.write(code)
        script_path = f.name
    try:
        p = subprocess.run(
            [SANDBOX_BIN, "do", "--", "/usr/bin/python3", script_path],
            input=stdin, capture_output=True, text=True, timeout=timeout,
        )
        if p.returncode != 0:
            raise RuntimeError(f"Sandbox failed: {p.stderr[:500]}")
        return p.stdout.strip()
    finally:
        try:
            os.remove(script_path)
        except OSError:
            pass

def compute_insights(entries):
    safe = [{"date":str(e.get("date",""))[:10],"mood":str(e.get("mood",""))[:30],
             "themes":[str(t)[:40] for t in (e.get("themes") or [])][:6],
             "text":str(e.get("text") or e.get("summary") or "")[:500]} for e in (entries or [])[:200]]
    if not safe:
        return {"error":"No entries to analyze.","analytics":None,"narrative":""}
    code = _clean(invoke_text(_CODEGEN, "Generate the analysis script now."))
    out = _run(code, json.dumps(safe))
    try:
        analytics = json.loads(out)
    except Exception as e:
        log.error("bad sandbox json: %s | %s", e, out[:300]); raise RuntimeError("Sandbox produced invalid output.")
    try:
        n = invoke_json(_NARR, json.dumps(analytics)); narrative = str(n.get("narrative","")) if isinstance(n,dict) else ""
    except Exception:
        narrative = ""
    return {"analytics":analytics,"narrative":narrative,"error":None}
