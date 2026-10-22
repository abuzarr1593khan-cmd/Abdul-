export interface AppConfig {
  apiKey: string;
  userName: string;
  assistantName: string;
  systemPrompt: string;
  voiceName?: string;
  activeTopicOrScript?: string;
}

export type AppState = "idle" | "listening" | "processing" | "speaking" | "reconnecting";

export interface CreatorProfile {
  id: number;
  name: string;
  role: string;
  bio: string;
  created_at?: string;
  updated_at?: string;
}

export interface PreferenceItem {
  id: number;
  category: string;
  pref_key: string;
  pref_value: string;
  updated_at?: string;
}

export interface MemoryItem {
  id: number;
  fact: string;
  category: 'identity' | 'personal' | 'preference' | 'communication' | 'project' | 'routine' | string;
  importance: number;
  source: string;
  created_at?: string;
}

export interface ConversationSession {
  id: string;
  title?: string;
  started_at?: string;
  ended_at?: string;
  summary?: string;
  turn_count?: number;
}

export interface DbMessage {
  id: string;
  conversation_id: string;
  sender: 'user' | 'zoya';
  text: string;
  audio_data?: string;
  conversation_title?: string;
  conversation_date?: string;
  timestamp?: string;
}

export interface DatabaseStats {
  memories: number;
  preferences: number;
  conversations: number;
  messages: number;
  dbStatus: string;
  dbPath?: string;
}

export interface SentimentDayData {
  date: string;
  displayDate: string;
  sentiment: number;
  affection: number;
  joy: number;
  comfort: number;
  turns: number;
  tone: string;
  hasActivity: boolean;
}

export interface SentimentAnalytics {
  period: string;
  averageSentiment: number;
  averageAffection: number;
  averageJoy: number;
  averageComfort: number;
  activeDays: number;
  dominantOverallTone: string;
  dailyTrend: SentimentDayData[];
}
