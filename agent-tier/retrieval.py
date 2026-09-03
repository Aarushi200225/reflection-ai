"""
Lightweight retrieval for grounded reflection.

Honest framing: this is keyword/theme-overlap scoring, NOT semantic vector search.
It ranks the user's OWN past entries (passed in by the web tier) by relevance to the
current entry, so the reflection agent can say "this connects to what you wrote before"
instead of dispensing generic advice. Vector/semantic retrieval is the documented
roadmap upgrade.

Stateless: operates only on entries handed in via the request. No DB access.
"""
import re
from collections import Counter

_STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "if", "then", "so", "of", "to", "in",
    "on", "for", "with", "at", "by", "from", "is", "am", "are", "was", "were",
    "be", "been", "being", "it", "this", "that", "these", "those", "i", "me",
    "my", "we", "you", "he", "she", "they", "them", "his", "her", "your", "our",
    "as", "have", "has", "had", "do", "does", "did", "not", "no", "just", "really",
    "very", "can", "will", "would", "should", "could", "about", "up", "out", "down",
}


def _tokens(text: str) -> set[str]:
    words = re.findall(r"[a-zA-Z']+", (text or "").lower())
    return {w for w in words if len(w) > 2 and w not in _STOPWORDS}


def select_relevant(current_entry: str,
                    current_themes: list[str],
                    past_entries: list[dict],
                    top_k: int = 3) -> list[dict]:
    """Score past entries by keyword + theme overlap with the current entry.

    past_entries: [{date, summary|title|preview, themes: [...]}]
    Returns the top_k most relevant, each annotated with a 'relevance' score.
    Falls back to most-recent if nothing overlaps (so grounding never comes back empty
    when history exists).
    """
    if not past_entries:
        return []

    cur_tokens = _tokens(current_entry)
    cur_themes = {t.lower() for t in (current_themes or [])}

    scored = []
    for e in past_entries:
        text = " ".join(str(e.get(k, "")) for k in ("summary", "title", "preview", "text"))
        e_tokens = _tokens(text)
        e_themes = {str(t).lower() for t in (e.get("themes") or [])}

        keyword_overlap = len(cur_tokens & e_tokens)
        theme_overlap = len(cur_themes & e_themes)
        # themes weigh more than raw keywords
        score = theme_overlap * 3 + keyword_overlap
        scored.append((score, e))

    scored.sort(key=lambda x: x[0], reverse=True)

    # If the best score is 0 (no overlap at all), fall back to recency order as given.
    if scored[0][0] == 0:
        chosen = [e for _, e in scored[:top_k]]
        for e in chosen:
            e["relevance"] = 0
        return chosen

    chosen = []
    for score, e in scored[:top_k]:
        if score > 0:
            e = dict(e)
            e["relevance"] = score
            chosen.append(e)
    return chosen
