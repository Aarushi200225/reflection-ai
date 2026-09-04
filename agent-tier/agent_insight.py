"""
Sandbox insight agent — the genuinely-agentic one.

Loop (Track 3 / Cloud Run sandbox pattern):
  1. Gemini writes a Python script to analyze the user's entries.
  2. The script runs in an ISOLATED Cloud Run sandbox (no secrets, no egress,
     no metadata server) via the sandbox CLI at /usr/local/gcp/bin/sandbox.
  3. stdout (JSON) comes back; Gemini writes a short human narrative over it.

Security: the sandbox cannot see the service's env vars, the GEMINI_API_KEY, or the
GCP metadata server — enforced by the platform, not by us. Generated code is treated as
untrusted and never runs in the app process. The user's entries are passed to the script
over stdin as data.

If the sandbox binary is unavailable (e.g. deployed without --sandbox-launcher, or the
preview isn't enabled), we FAIL CLOSED with a clear error rather than falling back to
unsafe in-process exec.
"""
import json
import logging
import subprocess
import os
from gemini_client import generate_json, get_client_text  # get_client_text added below

log = logging.getLogger("agent-tier.insight")

SANDBOX_BIN = "/usr/local/gcp/bin/sandbox"

_CODEGEN_SYSTEM = """You are a data analysis code generator for a private journaling app.
You will receive a JSON array of the user's journal entries on STDIN, each like:
{"date": "YYYY-MM-DD", "mood": "Focused", "themes": ["..."], "text": "..."}

Write a COMPLETE, SELF-CONTAINED Python 3 script that:
- Reads the JSON array from sys.stdin.
- Computes: mood distribution, most frequent themes (top 5), entry count, active streak
  (consecutive days with >=1 entry, counting back from the latest entry date), and any
  simple mood-over-time trend (e.g. improving/declining/stable based on ordering).
- Prints ONLY a single JSON object to stdout with keys:
  {"moodDistribution": {...}, "topThemes": [["theme", count], ...], "entryCount": int,
   "activeStreak": int, "moodTrend": "improving"|"declining"|"stable"|"mixed"}
- Uses ONLY the Python standard library (json, sys, collections, datetime). No pip, no network.
- Is robust to missing fields and empty input (print valid JSON with zeros/empties).

Return ONLY the raw Python code — no markdown fences, no explanation."""

_NARRATIVE_SYSTEM = """You are a warm, encouraging journaling companion.
Given the computed analytics JSON of a user's journaling, write a short (2-3 sentence)
empowering narrative highlighting consistency, dominant themes, and any positive trend.
Question-first, never preachy. Return ONLY valid JSON: {"narrative": "..."}"""


def _clean_code(text: str) -> str:
    t = (text or "").strip()
    if t.startswith("```"):
        t = t.split("```", 2)[1]
        if t.startswith("python"):
            t = t[6:]
        t = t.strip().rstrip("`").strip()
    return t


def _run_in_sandbox(code: str, stdin_data: str, timeout: int = 25) -> str:
    """Execute generated Python inside the Cloud Run sandbox. Returns stdout.
    Raises RuntimeError if the sandbox binary is missing or execution fails."""
    if not os.path.exists(SANDBOX_BIN):
        raise RuntimeError("Sandbox binary not available (service not deployed with --sandbox-launcher).")

    # sandbox do -- /usr/bin/python3 -c "<code>"
    proc = subprocess.run(
        [SANDBOX_BIN, "do", "--", "/usr/bin/python3", "-c", code],
        input=stdin_data,
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"Sandbox execution failed: {proc.stderr[:500]}")
    return proc.stdout.strip()


def compute_insights(entries: list[dict]) -> dict:
    """Full agentic loop: codegen -> sandbox exec -> narrative."""
    safe_entries = []
    for e in (entries or [])[:200]:  # bound
        safe_entries.append({
            "date": str(e.get("date", ""))[:10],
            "mood": str(e.get("mood", ""))[:30],
            "themes": [str(t)[:40] for t in (e.get("themes") or [])][:6],
            "text": str(e.get("text") or e.get("summary") or "")[:500],
        })

    if not safe_entries:
        return {"error": "No entries to analyze.", "analytics": None, "narrative": ""}

    # 1. Gemini writes the analysis code.
    try:
        code_text = get_client_text(_CODEGEN_SYSTEM, "Generate the analysis script now.")
        code = _clean_code(code_text)
    except Exception as e:  # noqa: BLE001
        log.error("Code generation failed: %s", e)
        raise RuntimeError("Insight code generation failed.")

    # 2. Execute in the sandbox with entries on stdin.
    stdout = _run_in_sandbox(code, json.dumps(safe_entries))
    try:
        analytics = json.loads(stdout)
    except Exception as e:  # noqa: BLE001
        log.error("Sandbox output not valid JSON: %s | out=%s", e, stdout[:300])
        raise RuntimeError("Sandbox produced invalid output.")

    # 3. Gemini writes a narrative over the computed numbers.
    try:
        narr = generate_json(_NARRATIVE_SYSTEM, json.dumps(analytics))
        narrative = str(narr.get("narrative", "")) if isinstance(narr, dict) else ""
    except Exception:  # noqa: BLE001
        narrative = ""

    return {"analytics": analytics, "narrative": narrative, "error": None}
