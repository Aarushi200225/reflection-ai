# Reflection.ai — A Secure, Grounded Second-Brain Journal

A AI-native, production-grade, user-authenticated journaling web app that grounds AI responses in your
**own** past entries, inspired by the second-brain architecture.

Reflection.ai re-architects a starter single-service journal calling Gemini
directly, into a **two-tier, multi-agent system** — a React web tier and a Python
**LangGraph** agent tier with a grounded-RAG reflection, making sure it's served through a defense-in-depth, zero-trust boundary with per-user data isolation and runtime secret management on Cloud Run.

**Live app:** `https://reflection-web-2pyxqsldiq-uc.a.run.app`
**Stack:** Firebase Auth · Cloud Firestore · Gemini · Cloud Run · Secret Manager · Google AI Studio · LangGraph / LangChain

---

## 1. What makes it more than the starter app

| Mandatory requirement | How it's met |
| :--- | :--- |
| Firebase Auth | Google Sign-In only; user `uid` is the only identity key stored |
| Isolated Firestore | Per-user path `/users/{uid}/...`; ABAC rules enforce `request.auth.uid == uid` |
| Gemini (multi-turn) | Server-side only, in the agent tier, with a 4-tier resilient fallback ladder |
| Secret Manager | `GEMINI_API_KEY` read at runtime by the agent tier; never client-side, never hardcoded |
| Original features | Grounded second-brain retrieval · LangGraph multi-agent orchestration · sandbox insight agent · Journal Wrapped · Consistency Mindscape · voice input · geotagging |

---

## 2. Architecture (two Cloud Run services)

**Web tier** — React + TypeScript + Express. UI, Firebase Auth, Firestore reads/writes.
Acts as a thin proxy: forwards the user's Firebase ID token to the agent tier. Holds **no**
Gemini key.

**Agent tier** — Python + FastAPI + **LangGraph** + **LangChain**. All AI. **Stateless**:
never reads Firestore; verifies the Firebase ID token (Admin SDK) on every request, then
operates only on data passed in the request body.

```
User (signed in)
  -> Web tier (proxy; forwards Firebase ID token)
    -> Agent tier /agent/run  (verifies token via Firebase Admin SDK)
      -> LangGraph orchestrator (StateGraph; routes by intent)
        -> extract : entry -> mood / themes / action items
        -> reflect : grounded response using the user's OWN past entries (lexical retrieval)
        -> insight : LangGraph sub-graph (generate_code -> execute -> interpret,
                     with a conditional fallback edge)
      -> LangChain -> Gemini (fallback ladder)
    -> structured JSON -> UI
```

**Defense-in-depth:** identity is verified at the edge (web tier) AND again at the agent
tier. Because the agent tier is stateless with no database authority, it cannot leak
cross-user data — it only ever holds one caller's data for one request.

### The agents
- **Orchestrator** — a LangGraph `StateGraph` routing each request to one agent.
- **Extraction agent** — structured LLM step; entry -> mood / themes / action items.
- **Reflection agent** — grounded RAG; retrieves the user's relevant past entries (keyword +
  theme overlap) and grounds an empathetic, question-first response in them.
- **Insight agent** — a nested LangGraph sub-graph. Preferred path: Gemini writes analysis
  code executed in an isolated Cloud Run sandbox (Track 3 pattern); a conditional edge routes
  to a trusted in-agent computation when the sandbox runtime is unavailable (see note).

### Honest engineering notes
- **Sandbox:** the insight agent implements the Track 3 Cloud Run sandbox pattern
  (model-generated code, isolated execution — no secrets, no egress). The current preview
  sandbox ships a shell but no Python runtime, so the graph's conditional edge routes to a
  trusted, read-only in-agent computation producing the same analytics. The sandbox path is
  retained in code as the documented reactivation target.
- **Retrieval:** grounding uses **lexical retrieval** (keyword + theme overlap over the
  user's own entries), themes weighted above keywords. Semantic/vector retrieval is a
  documented future upgrade.
- **Geotagging:** entries support per-user-isolated location capture (Geolocation API);
  location is displayed as a card with an "Open in Maps" link. An inline interactive map
  tile is a documented post-submission enhancement.

---

## 3. Security model & threat summary

Before building, **Google AI Studio** was configured with Custom Instructions encoding
production security directives (agentic threat modeling with a 5-zone threat-summary table
before any feature; OWASP Web + LLM Top-10 mitigations; Firestore ABAC isolation; Secret
Manager zero-hardcoding; a security-reviewer persona; functional-stability walkthroughs with
the Gemini fallback ladder; a README generator). Every new feature expanded these
instructions first.

| Threat Zone | Attack Vector | Countermeasure |
| :--- | :--- | :--- |
| Input Surfaces | Injection payloads, oversized text | Server-side deserialization, 5MB body limit, input sanitization, undefined-stripping before Firestore writes |
| Planning & Reasoning | Indirect prompt injection via past logs | Past entries passed as reference DATA, never executable instructions (OWASP LLM01) |
| Tool & API Execution | Key exfiltration, SSRF, model exhaustion | Zero client-side keys; server-side Gemini with a 4-tier fallback ladder; sandbox has no secrets/egress |
| Memory & State | Cross-user leaks, unauthorized reads/writes | Per-user ABAC isolation enforced by Firestore rules; stateless agent tier with no DB authority |
| Inter-System Auth | Session tampering, unauthenticated queries | Firebase Google Sign-In (no raw passwords); Firebase ID token verified at BOTH tiers |

### Key management — two key types, two correct patterns
- **Gemini API key** — server-side secret, stored in **Secret Manager**, read only by the
  agent tier's service account. Never in the client, never hardcoded.
- **Maps client key** — public by design (Maps JS ships in the browser), so it is
  **HTTP-referrer restricted** to this app's domain and API-restricted to Maps + Geocoding.

### Firestore security rules (`firestore.rules`)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/interactions/{interactionId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /users/{userId}/entries/{entryId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## 4. Deploy from scratch

### Prerequisites
```bash
gcloud services enable run.googleapis.com firestore.googleapis.com \
  secretmanager.googleapis.com aiplatform.googleapis.com firebase.googleapis.com \
  cloudbuild.googleapis.com artifactregistry.googleapis.com generativelanguage.googleapis.com \
  maps-backend.googleapis.com geocoding-backend.googleapis.com
```
Create a Firestore database in **Native mode**, add Firebase to the project, enable Google
Sign-In, and deploy `firestore.rules`.

### Secret Manager (Gemini key)
```bash
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:agent-tier-sa@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Agent tier (Python)
```bash
cd agent-tier
gcloud beta run deploy agent-tier \
  --source . --region us-central1 \
  --service-account agent-tier-sa@PROJECT_ID.iam.gserviceaccount.com \
  --min-instances 0 --max-instances 1 --allow-unauthenticated --no-cpu-throttling \
  --sandbox-launcher \
  --update-labels dev-tutorial=cloud-run-ai-challenge \
  --set-env-vars GOOGLE_CLOUD_PROJECT=PROJECT_ID,FIREBASE_PROJECT_ID=YOUR_FIREBASE_PROJECT
```

### Web tier (React/TS)
The referrer-restricted Maps key is provided at build time via `.env.production`
(`VITE_MAPS_API_KEY=...`).
```bash
gcloud run deploy reflection-web \
  --source . --region us-central1 \
  --min-instances 0 --max-instances 1 --allow-unauthenticated \
  --update-labels dev-tutorial=cloud-run-ai-challenge \
  --set-env-vars AGENT_SERVICE_URL=<agent-tier-url>,NODE_ENV=production
```
Then authorize the web tier URL in **Firebase Console -> Authentication -> Settings ->
Authorized domains**.

### Required campaign verification label
Both Cloud Run services carry `dev-tutorial=cloud-run-ai-challenge` for automated
verification. To (re)apply:
```bash
gcloud run services update <SERVICE_NAME> \
  --update-labels=dev-tutorial=cloud-run-ai-challenge --region=us-central1
```

---

## 5. Verification & user walkthrough

| Step | User action | Expected behavior |
| :--- | :--- | :--- |
| 1. Auth | Click "Sign in with Google" | Firebase Google Sign-In; enters the Bento dashboard |
| 2. Reflect | Write an entry / pick a starter | Saved to Firestore; agent tier runs the grounded reflection agent |
| 3. Grounding | Ask about a past topic | Response references the user's OWN earlier entry (retrieval), not generic advice |
| 4. Insights | — | Synthesis card + key themes update (extraction/reflection agents) |
| 5. Mindscape | Log consecutive days | Streak increments; code-rendered SVG heatmap lights up |
| 6. Wrapped | Click "Journal Wrapped" | Insight agent computes analytics; Gemini narrates a period report |
| 7. Geotag | Click "Add location" | Captures + stores location per-user; shows a location card |
| 8. Isolation | Sign in as User A vs B | User B cannot see User A's data (Firestore ABAC) |

---

## 6. Cost guard (self-funded — no Ideathon credits)
- Primary model `gemini-3.6-flash` (cost-optimized); ladder descends to
  `gemini-3.1-flash-lite` before escalating.
- Cloud Run `--min-instances=0` (scale to zero) on both services; no idle cost.
- Client-rendered SVG/Canvas visuals (Consistency Mindscape) instead of generative image APIs.

---

## 7. Repository layout
```
/               React + TS web tier (App.tsx, components/, firebase.ts, server.ts, vite.config.ts)
/agent-tier/    Python agent tier
  main.py           FastAPI app + Firebase token verification
  orchestrator.py   LangGraph StateGraph (routes by intent)
  agent_extract.py  extraction agent
  agent_reflect.py  reflection agent (grounded)
  agent_insight.py  insight agent (LangGraph sub-graph + sandbox path)
  retrieval.py      lexical keyword/theme retrieval
  llm.py            LangChain Gemini client + fallback ladder
  secret_store.py   Secret Manager access
/firestore.rules    per-user ABAC isolation
```

## 8. Roadmap
Semantic/vector retrieval · sandbox-enabled insight execution · inline interactive map tile ·
Memory Bridge resurfacing · richer Journal Wrapped UI · outward social sharing.
