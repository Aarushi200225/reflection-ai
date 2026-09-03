import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

// Top-level Request Deserialization & Payload Security
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Lazy GoogleGenAI client
let genAI: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY environment variable is not set. Mock responses or error will be handled gracefully.');
    }
    genAI = new GoogleGenAI({ apiKey: apiKey || '' });
  }
  return genAI;
}

// Resilient Model Fallback Ladder
const MODEL_FALLBACK_LADDER = [
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.7-flash',
] as const;

/**
 * Standard Helper: generateContentWithFallback
 * Iterates through model ladder on 503, 429, 404, 500 errors.
 */
async function generateContentWithFallback(params: {
  contents: any;
  systemInstruction?: string;
  responseMimeType?: string;
  responseSchema?: any;
}) {
  const ai = getGenAI();
  let lastError: any = null;

  for (const model of MODEL_FALLBACK_LADDER) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: params.contents,
        config: {
          systemInstruction: params.systemInstruction,
          responseMimeType: params.responseMimeType,
          responseSchema: params.responseSchema,
        },
      });

      if (response && response.text) {
        return {
          text: response.text,
          modelUsed: model,
        };
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[Gemini Fallback] Model ${model} encountered an issue: ${err?.message || err}. Escalating down ladder...`);
    }
  }

  throw new Error(`All Gemini models in fallback ladder exhausted. Last error: ${lastError?.message || 'Unknown error'}`);
}

// API Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    aiConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

// POST /api/gemini/reflect - Multi-turn grounded reflection & synthesis
app.post('/api/gemini/reflect', async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const { messages = [], currentEntry = '', journalContext = [] } = body;

    if (!currentEntry && (!messages || messages.length === 0)) {
      return res.status(400).json({ error: 'Journal content or message history is required.' });
    }

    // Defensive string sanitization
    const sanitizedEntry = typeof currentEntry === 'string' ? currentEntry.slice(0, 15000) : '';
    
    // Structure multi-turn messages
    const formattedHistory = Array.isArray(messages)
      ? messages.slice(-10).map((m: any) => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: String(m.content || m.text || '').slice(0, 5000) }],
        }))
      : [];

    // Add current entry if provided and not already in formattedHistory
    if (sanitizedEntry) {
      formattedHistory.push({
        role: 'user',
        parts: [{ text: `Journal reflection entry:\n${sanitizedEntry}` }],
      });
    }

    // Context from user's own past journal entries for personalized RAG
    const pastContextSummary = Array.isArray(journalContext) && journalContext.length > 0
      ? `\n\n[USER'S PREVIOUS JOURNAL ENTRIES FOR CONTEXT - STRICTLY ISOLATED TO THIS USER]:\n` +
        journalContext
          .slice(0, 5)
          .map((ctx: any, i: number) => `Entry #${i + 1} (${ctx.date || 'Past'}): ${String(ctx.summary || ctx.title || ctx.preview || '').slice(0, 250)}`)
          .join('\n')
      : '';

    const systemInstruction = `You are a supportive, grounded personal reflection companion and second brain.
Your goal is to help the user unpack their thoughts, recognize cognitive patterns, celebrate wins, and ask thoughtful clarifying questions.
Tone: Empathetic, question-first, never judgmental, never preachy or robotic.
Always ground your answers in the user's personal context when available, rather than dispensing generic life advice.

In addition to your main conversational reflection, provide a short synthesis and tags in the following structured JSON format:
\`\`\`json
{
  "reflection": "Your main empathetic, insightful reflection response (use clean markdown with paragraphs, bullet points if helpful)...",
  "synthesis": "A 1-2 sentence core analytical takeaway of the user's current mindset or challenge.",
  "keyThemes": ["Theme1", "Theme2", "Theme3"],
  "mood": "Focused" | "Grateful" | "Reflective" | "Stressed" | "Optimistic" | "Fatigued" | "Energetic",
  "actionablePrompt": "One optional, gentle follow-up question or micro-action to consider."
}
\`\`\`
Return only valid JSON matching this structure.`;

    const result = await generateContentWithFallback({
      contents: formattedHistory.length > 0 ? formattedHistory : [{ role: 'user', parts: [{ text: sanitizedEntry }] }],
      systemInstruction: systemInstruction + pastContextSummary,
      responseMimeType: 'application/json',
    });

    let parsedResponse;
    try {
      // Clean up markdown formatting if wrapped in ```json ... ```
      let cleanedText = result.text.trim();
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      parsedResponse = JSON.parse(cleanedText);
    } catch (parseErr) {
      parsedResponse = {
        reflection: result.text,
        synthesis: "Reflection generated successfully.",
        keyThemes: ["Journaling", "Personal Growth"],
        mood: "Reflective",
        actionablePrompt: "What else is on your mind regarding this today?"
      };
    }

    return res.json({
      success: true,
      modelUsed: result.modelUsed,
      data: parsedResponse,
    });
  } catch (error: any) {
    console.error('Error processing reflection:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to generate reflection. Please try again.',
    });
  }
});

// POST /api/gemini/wrap - Aggregate Journal Wrapped synthesis
app.post('/api/gemini/wrap', async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const { entries = [], periodName = 'Weekly Recap' } = body;

    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'No journal entries available to wrap.' });
    }

    const compiledEntries = entries.slice(0, 15).map((e: any, i: number) => {
      const title = e.title || `Entry ${i + 1}`;
      const date = e.createdAt || e.date || 'Recent';
      const summary = e.summary || e.insights?.synthesis || '';
      const text = e.messages?.[0]?.content || e.content || '';
      return `### [${date}] ${title}\nSynthesis: ${summary}\nExcerpt: ${String(text).slice(0, 300)}`;
    }).join('\n\n');

    const systemInstruction = `You are an insightful personal biographer and habit analyst.
Analyze the user's journal entries from this period (${periodName}) and generate a heartwarming, empowering "Journal Wrapped" report.
Celebrate their consistency, highlight dominant themes, spotlight moments of clarity, and note positive mindset shifts.

Output valid JSON in this schema:
\`\`\`json
{
  "periodTitle": "${periodName}",
  "headline": "Punchy, personalized headline summarizing this period",
  "dominantMood": "Primary emotional vibe",
  "topThemes": ["Theme 1", "Theme 2", "Theme 3", "Theme 4"],
  "deepInsights": [
    "Key insight 1 highlighting habit consistency or breakthroughs",
    "Key insight 2 regarding self-awareness or resilience"
  ],
  "mindsetShift": "Description of how the user's perspective evolved across these entries",
  "goldenQuote": "An inspiring takeaway or memorable thought derived from their writings",
  "nextPeriodFocus": "A gentle, uplifting intention for the upcoming days"
}
\`\`\``;

    const result = await generateContentWithFallback({
      contents: [{
        role: 'user',
        parts: [{ text: `Here are my entries for ${periodName}:\n\n${compiledEntries}` }],
      }],
      systemInstruction,
      responseMimeType: 'application/json',
    });

    let parsedWrapped;
    try {
      let cleaned = result.text.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      parsedWrapped = JSON.parse(cleaned);
    } catch (e) {
      parsedWrapped = {
        periodTitle: periodName,
        headline: "A Period of Deep Reflection and Growth",
        dominantMood: "Reflective",
        topThemes: ["Focus", "Consistency", "Personal Growth"],
        deepInsights: ["Maintained a consistent rhythm of reflection and intentionality."],
        mindsetShift: "Increased self-awareness and focus on high-leverage habits.",
        goldenQuote: "Small reflections each day compound into extraordinary clarity.",
        nextPeriodFocus: "Continue showing up for your daily reflections."
      };
    }

    return res.json({
      success: true,
      modelUsed: result.modelUsed,
      data: parsedWrapped,
    });
  } catch (error: any) {
    console.error('Error generating wrapped:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to generate Journal Wrapped.',
    });
  }
});

// Vite Middleware Setup
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT} with Gemini fallback ladder & Firestore ABAC security`);
  });
}

startServer();
