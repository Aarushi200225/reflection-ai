import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

// Top-level Request Deserialization & Payload Security (middleware BEFORE routes)
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Agent tier (LangGraph multi-agent orchestrator on Cloud Run)
const AGENT_SERVICE_URL =
  process.env.AGENT_SERVICE_URL || 'https://agent-tier-588215440350.us-central1.run.app';

/**
 * Proxy a request to the agent tier's /agent/run orchestrator.
 * Forwards the caller's Firebase ID token so the agent tier verifies identity
 * (defense-in-depth). This web tier holds no Gemini key — all AI is in the agent tier.
 */
async function callAgent(intent: string, payload: any, authHeader?: string) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const e: any = new Error('Missing authentication token.');
    e.status = 401;
    throw e;
  }
  const resp = await fetch(`${AGENT_SERVICE_URL}/agent/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader },
    body: JSON.stringify({ intent, payload }),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const e: any = new Error(json?.detail || `Agent tier error (${resp.status})`);
    e.status = resp.status;
    throw e;
  }
  return json; // { success, intent, data }
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), agentTier: AGENT_SERVICE_URL });
});

// POST /api/gemini/reflect -> agent tier intent "reflect"
app.post('/api/gemini/reflect', async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const { messages = [], currentEntry = '', journalContext = [], currentThemes = [] } = body;
    if (!currentEntry && (!messages || messages.length === 0)) {
      return res.status(400).json({ success: false, error: 'Journal content or message history is required.' });
    }
    const result = await callAgent(
      'reflect',
      {
        currentEntry: String(currentEntry).slice(0, 15000),
        history: Array.isArray(messages) ? messages.slice(-10) : [],
        pastEntries: Array.isArray(journalContext) ? journalContext.slice(0, 5) : [],
        currentThemes: Array.isArray(currentThemes) ? currentThemes : [],
      },
      req.headers.authorization
    );
    return res.json({ success: true, data: result.data });
  } catch (error: any) {
    console.error('Reflect proxy error:', error?.message);
    return res.status(error?.status || 500).json({ success: false, error: error?.message || 'Reflection failed.' });
  }
});

// POST /api/gemini/wrap -> agent tier intent "insight" (aggregate analytics + narrative)
app.post('/api/gemini/wrap', async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const { entries = [] } = body;
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ success: false, error: 'No journal entries available to wrap.' });
    }
    // Shape entries for the insight agent
    const shaped = entries.slice(0, 30).map((e: any) => ({
      date: (e.createdAt || e.date || '').slice(0, 10),
      mood: e.mood || e.insights?.mood || '',
      themes: e.insights?.keyThemes || e.tags || [],
      text: e.messages?.[0]?.content || e.content || '',
      summary: e.insights?.synthesis || e.summary || '',
    }));
    const result = await callAgent('insight', { entries: shaped }, req.headers.authorization);
    // Map insight-agent output (analytics + narrative) -> Wrapped modal's expected shape.
    const a = result?.data?.analytics || {};
    const topThemes = Array.isArray(a.topThemes) ? a.topThemes.map((t: any) => (Array.isArray(t) ? t[0] : t)).slice(0, 4) : [];
    const moodDist = a.moodDistribution || {};
    const dominantMood = Object.keys(moodDist).sort((x, y) => (moodDist[y] || 0) - (moodDist[x] || 0))[0] || 'Reflective';
    const wrapped = {
      periodTitle: 'Recent Reflections',
      headline: result?.data?.narrative || 'A Period of Reflection and Growth',
      dominantMood,
      topThemes,
      deepInsights: [
        `You've logged ${a.entryCount ?? shaped.length} reflections with a ${a.activeStreak ?? 0}-day active streak.`,
        `Your mood trend across this period reads as "${a.moodTrend || 'steady'}".`,
      ],
      mindsetShift: result?.data?.narrative || '',
      goldenQuote: result?.data?.narrative || '',
      nextPeriodFocus: 'Keep showing up for your reflections — consistency compounds.',
    };
    return res.json({ success: true, data: wrapped });
  } catch (error: any) {
    console.error('Wrap proxy error:', error?.message);
    return res.status(error?.status || 500).json({ success: false, error: error?.message || 'Journal Wrapped failed.' });
  }
});

// POST /api/gemini/insight -> explicit insight endpoint (same intent)
app.post('/api/gemini/insight', async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const { entries = [] } = body;
    const result = await callAgent('insight', { entries: Array.isArray(entries) ? entries.slice(0, 200) : [] }, req.headers.authorization);
    return res.json({ success: true, data: result.data });
  } catch (error: any) {
    console.error('Insight proxy error:', error?.message);
    return res.status(error?.status || 500).json({ success: false, error: error?.message || 'Insight failed.' });
  }
});

// Vite Middleware Setup
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => { res.sendFile(path.join(distPath, 'index.html')); });
  }
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Web tier on ${PORT} -> agent tier at ${AGENT_SERVICE_URL}`);
  });
}
startServer();
