import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { initDatabase, memoryDb } from './src/server/db.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize SQLite database
initDatabase();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));

// -------------------------------------------------------------
// REST API ENDPOINTS FOR MEMORY & DATABASE
// -------------------------------------------------------------

// Profile
app.get('/api/profile', (req, res) => {
  try {
    const profile = memoryDb.getProfile();
    res.json({ success: true, profile });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/profile', (req, res) => {
  try {
    const { name, role, bio } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Name is required' });
    const updated = memoryDb.updateProfile(name, role || 'Creator', bio || '');
    res.json({ success: true, profile: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Preferences
app.get('/api/preferences', (req, res) => {
  try {
    const preferences = memoryDb.getPreferences();
    res.json({ success: true, preferences });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/preferences', (req, res) => {
  try {
    const { category, key, value } = req.body;
    if (!key || !value) return res.status(400).json({ success: false, error: 'Key and Value are required' });
    const pref = memoryDb.upsertPreference(category || 'general', key, value);
    res.json({ success: true, preference: pref });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/preferences/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    memoryDb.deletePreference(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Memories
app.get('/api/memories', (req, res) => {
  try {
    const search = req.query.search as string | undefined;
    const category = req.query.category as string | undefined;
    const memories = memoryDb.getMemories(search, category);
    res.json({ success: true, memories });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/memories', (req, res) => {
  try {
    const { fact, category, importance, source } = req.body;
    if (!fact || !fact.trim()) return res.status(400).json({ success: false, error: 'Fact is required' });
    const memory = memoryDb.addMemory(fact, category || 'personal', importance || 3, source || 'manual');
    res.json({ success: true, memory });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/memories/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { fact, category, importance } = req.body;
    const updated = memoryDb.updateMemory(id, fact, category || 'personal', importance || 3);
    res.json({ success: true, memory: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/memories/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    memoryDb.deleteMemory(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Conversations & Messages
app.get('/api/conversations', (req, res) => {
  try {
    const conversations = memoryDb.getConversations();
    res.json({ success: true, conversations });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Full export of conversations with nested messages
app.get('/api/conversations/export', (req, res) => {
  try {
    const fullHistory = memoryDb.getAllConversationsWithMessages();
    const profile = memoryDb.getProfile();
    res.json({
      success: true,
      exportedAt: new Date().toISOString(),
      creator: profile,
      totalConversations: fullHistory.length,
      conversations: fullHistory,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/conversations', (req, res) => {
  try {
    const { id, title, summary, turnCount, endedAt } = req.body;
    if (!id) return res.status(400).json({ success: false, error: 'Conversation id is required' });
    const convo = memoryDb.createOrUpdateConversation(id, title, summary, turnCount, endedAt);
    res.json({ success: true, conversation: convo });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/conversations/:id/messages', (req, res) => {
  try {
    const messages = memoryDb.getMessages(req.params.id);
    res.json({ success: true, messages });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/conversations/:id/messages', (req, res) => {
  try {
    const { id, sender, text, audioData } = req.body;
    if (!id || !sender || !text) {
      return res.status(400).json({ success: false, error: 'id, sender, and text are required' });
    }
    const message = memoryDb.addMessage(id, req.params.id, sender, text);
    if (audioData) {
      memoryDb.saveMessageAudio(id, audioData);
    }
    res.json({ success: true, message });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get all past Zoya responses across conversations
app.get('/api/messages/zoya-responses', (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const responses = memoryDb.getAllZoyaResponses(limit);
    res.json({ success: true, responses });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get or synthesize audio playback for a message
app.get('/api/messages/:id/audio', async (req, res) => {
  try {
    const message = memoryDb.getMessage(req.params.id) as any;
    if (!message) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }

    // If audio is already stored in database, return immediately!
    if (message.audio_data) {
      return res.json({ success: true, audioData: message.audio_data, cached: true });
    }

    // Otherwise, synthesize on demand if API key is provided
    const apiKey = (req.query.apiKey as string) || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.json({ success: false, error: 'No audio cached and no API key available' });
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [{ parts: [{ text: message.text }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
    if (audioData) {
      memoryDb.saveMessageAudio(req.params.id, audioData);
    }

    res.json({ success: true, audioData, cached: false });
  } catch (err: any) {
    console.error('Error in /api/messages/:id/audio:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Cache audio for a message in SQLite
app.post('/api/messages/:id/audio', (req, res) => {
  try {
    const { audioData } = req.body;
    if (!audioData) return res.status(400).json({ success: false, error: 'audioData is required' });
    const updated = memoryDb.saveMessageAudio(req.params.id, audioData);
    res.json({ success: true, message: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Auto-extract memory from conversation turns using Gemini
app.post('/api/memory/extract', async (req, res) => {
  try {
    const { conversationId, messages, apiKey } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.json({ success: true, extractedCount: 0, memories: [] });
    }

    const keyToUse = apiKey || process.env.GEMINI_API_KEY;
    if (!keyToUse) {
      return res.status(400).json({ success: false, error: 'No API key available for extraction' });
    }

    const ai = new GoogleGenAI({ apiKey: keyToUse });
    
    // Build conversation text for extraction
    const transcript = messages
      .slice(-10)
      .map((m: any) => `${m.sender.toUpperCase()}: ${m.text}`)
      .join('\n');

    const prompt = `Analyze this conversation between Abdul (creator/user) and Zoya (his Indian female voice companion).
Identify if Abdul shared any meaningful personal facts, preferences, life updates, interests, or instructions that Zoya should remember permanently.

Transcript:
${transcript}

Output ONLY valid JSON in this exact structure (do not wrap in markdown quotes if possible, or use standard json):
{
  "summary": "1 sentence recap of the conversation topic",
  "memories": [
    {
      "fact": "Clear concise factual statement about Abdul or his preference",
      "category": "personal" | "preference" | "project" | "communication",
      "importance": 1 to 5
    }
  ]
}
If there are no new facts, return {"summary": "...", "memories": []}.`;

    const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
    let text = '{}';
    for (const modelName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        });
        if (response.text && response.text.trim().length > 2) {
          text = response.text;
          break;
        }
      } catch (err: any) {
        console.warn(`Extraction with ${modelName} failed, trying next model:`, err.message);
      }
    }
    let parsed: any = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    }

    const addedMemories: any[] = [];
    if (parsed.memories && Array.isArray(parsed.memories)) {
      for (const m of parsed.memories) {
        if (m.fact && typeof m.fact === 'string' && m.fact.trim().length > 4) {
          const added = memoryDb.addMemory(
            m.fact,
            m.category || 'personal',
            m.importance || 3,
            conversationId ? `session_${conversationId}` : 'conversation_extract'
          );
          addedMemories.push(added);
        }
      }
    }

    // Save summary if conversationId provided
    if (conversationId && parsed.summary) {
      memoryDb.createOrUpdateConversation(conversationId, undefined, parsed.summary);
    }

    res.json({
      success: true,
      summary: parsed.summary || '',
      extractedCount: addedMemories.length,
      memories: addedMemories,
    });
  } catch (err: any) {
    console.error('Error in /api/memory/extract:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Compiled Context for Prompt Injection
app.get('/api/context/system-prompt', (req, res) => {
  try {
    const memoryContext = memoryDb.compileMemoryPromptContext();
    res.json({ success: true, context: memoryContext });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Database & Memory Stats
app.get('/api/stats', (req, res) => {
  try {
    const stats = memoryDb.getStats();
    res.json({ success: true, stats });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 30-Day Sentiment & Tone Analytics
app.get('/api/analytics/sentiment', (req, res) => {
  try {
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
    const analytics = (memoryDb as any).getSentimentTrend(days);
    res.json({ success: true, analytics });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// VITE DEV SERVER OR STATIC PRODUCTION SERVING
// -------------------------------------------------------------
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Zoya Virtual Companion Server running with SQLite database at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
