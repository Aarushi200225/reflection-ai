# Reflection.ai — Grounded AI Journal & Reflection Brain

A production-grade, user-authenticated journaling web application powered by **Gemini 3.6-flash** and **Cloud Firestore**, structured in a modern **Bento Grid** architecture.

---

## 1. System Architecture & Threat Model Summary

| Threat Zone | Identified Attack Vector | Production Countermeasure & Mitigations |
| :--- | :--- | :--- |
| **Input Surfaces** | Malicious injection payloads, oversized journal text | Strict server-side deserialization, payload limit boundaries (5MB body, text slices), input sanitization. |
| **Planning & Reasoning** | Indirect prompt injection via historic user logs | Strict system instructions isolating past journal summaries as reference data rather than executable instructions. |
| **Tool & API Execution** | API key exfiltration, SSRF, model exhaustion | Zero client-side API keys. Server-side Gemini calls with a 4-tier resilient fallback ladder (`gemini-3.6-flash` -> `gemini-3.1-flash-lite` -> `gemini-flash-latest` -> `gemini-3.7-flash`). |
| **Memory & State** | Cross-user data leaks, unauthorized reads/writes | Strict Attribute-Based Access Control (ABAC) per-user document isolation under `/users/{userId}/interactions/{interactionId}` enforced at the database level by Firestore Security Rules. |
| **Inter-System Auth** | Session tampering, unauthenticated queries | Firebase Authentication (Google Sign-In only, no raw passwords stored). |

---

## 2. Cloud Firestore Security Rules

Deploy these rules to guarantee that every user can only read and write their own data:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Isolated interactions and journal reflections per-user
    match /users/{userId}/interactions/{interactionId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // User-isolated entries collection
    match /users/{userId}/entries/{entryId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // User profile and metadata isolation
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## 3. Secret Management (Google Cloud Secret Manager)

To store credentials securely in Google Cloud without hardcoding:

```bash
# 1. Create Secret for Gemini API key
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"

# 2. Add secret payload
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# 3. Grant Secret Accessor role to Cloud Run compute service account
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 4. Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment**:
   Copy `.env.example` to `.env` and set your `GEMINI_API_KEY`:
   ```env
   GEMINI_API_KEY="your_gemini_api_key"
   ```

3. **Run Full-Stack Dev Server**:
   ```bash
   npm run dev
   ```
   The application will start on `http://localhost:3000`.

---

## 5. Production Cloud Run Deployment & Campaign Verification

1. **Build and Deploy to Cloud Run**:
   ```bash
   # Build & deploy container
   gcloud run deploy reflection-ai \
     --source . \
     --region <REGION> \
     --allow-unauthenticated \
     --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest" \
     --min-instances=0 \
     --max-instances=1
   ```

2. **Apply Campaign Verification Label**:
   ```bash
   gcloud run services update reflection-ai \
     --update-labels=dev-tutorial=cloud-run-ai-challenge \
     --region=<REGION>
   ```

---

## 6. Verification & User Walkthrough Checklist

| Step | User Interaction | Expected System Behavior |
| :--- | :--- | :--- |
| **1. Auth Flow** | Click "Sign in with Google" on landing page | Initiates Firebase Google Sign-In popup; redirects authenticated user into the Bento Grid dashboard. |
| **2. Reflection Entry** | Write a reflection or select a prompt starter | Saves the message immediately to Firestore; triggers server-side Gemini 3.6-flash reflection. |
| **3. Grounded Synthesis** | Receive Gemini response | Displays empathetic markdown reflection, extracts key themes, and updates the "Synthesis" Bento card. |
| **4. Consistency Mindscape**| Log consecutive daily reflections | Increments active streak counter and lights up the code-rendered SVG activity heatmap. |
| **5. Journal History** | Create multiple entries & search | Allows switching between past reflections, searching by keyword, or deleting entries. |
| **6. Journal Wrapped** | Click "Journal Wrapped" in navbar | Triggers aggregate AI analysis generating a period report with headline, quotes, and mindset shifts. |
| **7. Cross-User Isolation** | Sign in as User A vs. User B | User B cannot view or modify User A's reflections due to Firestore ABAC security rules. |

---

## 7. Cost Guard & Self-Funded Optimization

- **Model Hierarchy**: Primary model is `gemini-3.6-flash` (cost-optimized), falling down to `gemini-3.1-flash-lite` before escalations.
- **Cloud Run Scale-to-Zero**: Configured with `--min-instances=0` so no server costs accumulate when idle.
- **Client Artifacts**: Visualizations like the Consistency Mindscape are rendered directly with client-side SVG/Canvas rather than costly generative image APIs.
