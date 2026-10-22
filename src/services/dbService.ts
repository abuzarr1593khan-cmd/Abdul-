import { CreatorProfile, PreferenceItem, MemoryItem, ConversationSession, DbMessage, DatabaseStats, SentimentAnalytics } from '../types';

let currentSessionId: string = (() => {
  const existing = sessionStorage.getItem('zoya_current_convo_id');
  if (existing) return existing;
  const newId = `session_${Date.now()}`;
  sessionStorage.setItem('zoya_current_convo_id', newId);
  return newId;
})();

export function getCurrentConversationId(): string {
  return currentSessionId;
}

export function startNewConversationSession(): string {
  currentSessionId = `session_${Date.now()}`;
  sessionStorage.setItem('zoya_current_convo_id', currentSessionId);
  return currentSessionId;
}

// --------------------------------------------------------------------
// DATABASE API CALLS WITH OFFLINE SAFE FALLBACKS
// --------------------------------------------------------------------

export async function getCreatorProfile(): Promise<CreatorProfile> {
  try {
    const res = await fetch('/api/profile');
    if (res.ok) {
      const data = await res.json();
      if (data.profile) {
        localStorage.setItem('zoya_profile_cache', JSON.stringify(data.profile));
        return data.profile;
      }
    }
  } catch (e) {
    console.warn('Network error fetching profile, using cache:', e);
  }

  // Fallback cache
  const cached = localStorage.getItem('zoya_profile_cache');
  if (cached) {
    try { return JSON.parse(cached); } catch {}
  }

  return {
    id: 1,
    name: 'Abdul',
    role: 'Creator & Developer',
    bio: 'Abdul is the creator and lead developer of Zoya. Loves AI voice interfaces, smart memory, and coding.',
  };
}

export async function updateCreatorProfile(name: string, role: string, bio: string): Promise<CreatorProfile | null> {
  try {
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, role, bio }),
    });
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('zoya_profile_cache', JSON.stringify(data.profile));
      return data.profile;
    }
  } catch (e) {
    console.error('Failed to update creator profile:', e);
  }
  return null;
}

export async function getPreferences(): Promise<PreferenceItem[]> {
  try {
    const res = await fetch('/api/preferences');
    if (res.ok) {
      const data = await res.json();
      if (data.preferences) {
        localStorage.setItem('zoya_prefs_cache', JSON.stringify(data.preferences));
        return data.preferences;
      }
    }
  } catch (e) {
    console.warn('Error fetching preferences, using cache:', e);
  }
  const cached = localStorage.getItem('zoya_prefs_cache');
  return cached ? JSON.parse(cached) : [];
}

export async function savePreference(category: string, key: string, value: string): Promise<boolean> {
  try {
    const res = await fetch('/api/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, key, value }),
    });
    return res.ok;
  } catch (e) {
    console.error('Error saving preference:', e);
    return false;
  }
}

export async function deletePreference(id: number): Promise<boolean> {
  try {
    const res = await fetch(`/api/preferences/${id}`, { method: 'DELETE' });
    return res.ok;
  } catch (e) {
    console.error('Error deleting preference:', e);
    return false;
  }
}

export async function getMemories(search?: string, category?: string): Promise<MemoryItem[]> {
  try {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (category) params.append('category', category);
    const res = await fetch(`/api/memories?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (data.memories) {
        localStorage.setItem('zoya_memories_cache', JSON.stringify(data.memories));
        return data.memories;
      }
    }
  } catch (e) {
    console.warn('Error fetching memories, using cache:', e);
  }
  const cached = localStorage.getItem('zoya_memories_cache');
  return cached ? JSON.parse(cached) : [];
}

export async function addMemory(fact: string, category: string = 'personal', importance: number = 3): Promise<MemoryItem | null> {
  try {
    const res = await fetch('/api/memories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fact, category, importance, source: 'manual' }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.memory;
    }
  } catch (e) {
    console.error('Error adding memory:', e);
  }
  return null;
}

export async function updateMemory(id: number, fact: string, category: string, importance: number): Promise<boolean> {
  try {
    const res = await fetch(`/api/memories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fact, category, importance }),
    });
    return res.ok;
  } catch (e) {
    console.error('Error updating memory:', e);
    return false;
  }
}

export async function deleteMemory(id: number): Promise<boolean> {
  try {
    const res = await fetch(`/api/memories/${id}`, { method: 'DELETE' });
    return res.ok;
  } catch (e) {
    console.error('Error deleting memory:', e);
    return false;
  }
}

export async function getConversations(): Promise<ConversationSession[]> {
  try {
    const res = await fetch('/api/conversations');
    if (res.ok) {
      const data = await res.json();
      return data.conversations || [];
    }
  } catch (e) {
    console.warn('Error fetching conversations:', e);
  }
  return [];
}

export async function getConversationMessages(convoId: string): Promise<DbMessage[]> {
  try {
    const res = await fetch(`/api/conversations/${convoId}/messages`);
    if (res.ok) {
      const data = await res.json();
      return data.messages || [];
    }
  } catch (e) {
    console.warn('Error fetching conversation messages:', e);
  }
  return [];
}

export async function getFullConversationExport(): Promise<{
  success: boolean;
  exportedAt: string;
  creator: CreatorProfile;
  totalConversations: number;
  conversations: Array<ConversationSession & { messages: DbMessage[] }>;
} | null> {
  try {
    const res = await fetch('/api/conversations/export');
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('Error fetching full conversation export:', e);
  }
  return null;
}

export async function logMessageToDb(convoId: string, messageId: string, sender: 'user' | 'zoya', text: string): Promise<void> {
  try {
    await fetch(`/api/conversations/${convoId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: messageId, sender, text }),
    });
  } catch (e) {
    console.warn('Failed to log message to SQLite:', e);
  }
}

export async function triggerMemoryExtraction(convoId: string, messages: { sender: 'user' | 'zoya'; text: string }[], apiKey?: string): Promise<{ extractedCount: number; memories: any[]; summary: string } | null> {
  try {
    const res = await fetch('/api/memory/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: convoId, messages, apiKey }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('Memory extraction request failed:', e);
  }
  return null;
}

export async function getPromptMemoryContext(): Promise<string> {
  try {
    const res = await fetch('/api/context/system-prompt');
    if (res.ok) {
      const data = await res.json();
      return data.context || '';
    }
  } catch (e) {
    console.warn('Error fetching compiled memory context:', e);
  }

  // Fallback if server is starting
  return `\n\n[CREATOR RECOGNITION]\nRecognized User: Abdul (Creator & Developer).\nAddress Abdul with high respect, warmth, and natural affection ("Ji", "Aap"). Remember you were created by Abdul.`;
}

export async function getDatabaseStats(): Promise<DatabaseStats> {
  try {
    const res = await fetch('/api/stats');
    if (res.ok) {
      const data = await res.json();
      return data.stats;
    }
  } catch (e) {
    console.warn('Error fetching db stats:', e);
  }
  return {
    memories: 0,
    preferences: 0,
    conversations: 0,
    messages: 0,
    dbStatus: 'connecting',
  };
}

export async function fetchSentimentAnalytics(days: number = 30): Promise<SentimentAnalytics | null> {
  try {
    const res = await fetch(`/api/analytics/sentiment?days=${days}`);
    if (res.ok) {
      const data = await res.json();
      return data.analytics;
    }
  } catch (e) {
    console.warn('Error fetching sentiment analytics:', e);
  }
  return null;
}

export async function fetchZoyaResponses(limit: number = 100): Promise<DbMessage[]> {
  try {
    const res = await fetch(`/api/messages/zoya-responses?limit=${limit}`);
    if (res.ok) {
      const data = await res.json();
      return data.responses || [];
    }
  } catch (e) {
    console.warn('Error fetching Zoya past responses:', e);
  }
  return [];
}

export async function fetchMessageAudio(messageId: string, apiKey?: string): Promise<{ audioData: string | null; cached: boolean }> {
  try {
    const params = new URLSearchParams();
    if (apiKey) params.append('apiKey', apiKey);
    const res = await fetch(`/api/messages/${messageId}/audio?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      return { audioData: data.audioData || null, cached: !!data.cached };
    }
  } catch (e) {
    console.warn('Error fetching message audio:', e);
  }
  return { audioData: null, cached: false };
}

export async function cacheMessageAudio(messageId: string, audioData: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/messages/${messageId}/audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioData }),
    });
    return res.ok;
  } catch (e) {
    console.warn('Error caching message audio in SQLite:', e);
    return false;
  }
}
