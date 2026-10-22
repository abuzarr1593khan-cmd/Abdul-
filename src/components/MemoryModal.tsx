import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Database, 
  Brain, 
  Sparkles, 
  Plus, 
  Trash2, 
  Search, 
  Edit2, 
  Check, 
  X, 
  UserCheck, 
  MessageSquare, 
  RefreshCw, 
  Cpu, 
  Bookmark, 
  Play, 
  Square, 
  Volume2, 
  TrendingUp, 
  Heart, 
  Smile, 
  Activity, 
  BarChart3, 
  Radio, 
  Headphones,
  Filter,
  Download,
  FileText,
  FileCode,
  CheckCircle,
  FileSpreadsheet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  BarChart, 
  Bar 
} from 'recharts';
import { 
  CreatorProfile, 
  PreferenceItem, 
  MemoryItem, 
  ConversationSession, 
  DbMessage, 
  DatabaseStats, 
  SentimentAnalytics, 
  SentimentDayData 
} from '../types';
import { 
  getCreatorProfile, 
  updateCreatorProfile, 
  getPreferences, 
  savePreference, 
  deletePreference, 
  getMemories, 
  addMemory, 
  deleteMemory, 
  getConversations, 
  getConversationMessages, 
  triggerMemoryExtraction,
  getDatabaseStats,
  getCurrentConversationId, 
  fetchSentimentAnalytics, 
  fetchZoyaResponses, 
  fetchMessageAudio,
  getFullConversationExport 
} from '../services/dbService';

interface MemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey?: string;
  recentMessages?: { sender: 'user' | 'zoya'; text: string }[];
  onMemoryUpdated?: () => void;
}

type TabType = 'memories' | 'sentiment' | 'profile' | 'preferences' | 'conversations';
type ConvoViewMode = 'sessions' | 'vocal_archive';
type MetricType = 'sentiment' | 'affection' | 'joy' | 'comfort';

export default function MemoryModal({ isOpen, onClose, apiKey, recentMessages = [], onMemoryUpdated }: MemoryModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('memories');
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [preferences, setPreferences] = useState<PreferenceItem[]>([]);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [conversations, setConversations] = useState<ConversationSession[]>([]);
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [sentimentData, setSentimentData] = useState<SentimentAnalytics | null>(null);
  const [activeMetric, setActiveMetric] = useState<MetricType>('sentiment');
  
  // Zoya Vocal Archive
  const [convoViewMode, setConvoViewMode] = useState<ConvoViewMode>('sessions');
  const [zoyaResponses, setZoyaResponses] = useState<DbMessage[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractNotice, setExtractNotice] = useState<string | null>(null);

  // Audio Playback State
  const [playingMsgId, setPlayingMsgId] = useState<string | null>(null);
  const [audioLoadingMsgId, setAudioLoadingMsgId] = useState<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // New Memory Form
  const [showAddMemory, setShowAddMemory] = useState(false);
  const [newFact, setNewFact] = useState('');
  const [newCategory, setNewCategory] = useState('personal');
  const [newImportance, setNewImportance] = useState(3);

  // New Preference Form
  const [showAddPref, setShowAddPref] = useState(false);
  const [newPrefKey, setNewPrefKey] = useState('');
  const [newPrefValue, setNewPrefValue] = useState('');
  const [newPrefCategory, setNewPrefCategory] = useState('communication');

  // Edit Profile Form
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('Abdul');
  const [editRole, setEditRole] = useState('Creator & Developer');
  const [editBio, setEditBio] = useState('');

  // Selected conversation for viewing messages
  const [selectedConvoId, setSelectedConvoId] = useState<string | null>(null);
  const [convoMessages, setConvoMessages] = useState<DbMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Export conversation states
  const [isExporting, setIsExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Stop any ongoing playback
  const stopAudio = () => {
    try {
      if (audioSourceRef.current) {
        audioSourceRef.current.stop();
        audioSourceRef.current.disconnect();
        audioSourceRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    } catch {}
    setPlayingMsgId(null);
    setAudioLoadingMsgId(null);
  };

  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  const playMessageAudio = async (msg: DbMessage) => {
    if (playingMsgId === msg.id) {
      stopAudio();
      return;
    }
    stopAudio();

    let base64 = msg.audio_data;
    if (!base64) {
      setAudioLoadingMsgId(msg.id);
      const res = await fetchMessageAudio(msg.id, apiKey);
      setAudioLoadingMsgId(null);
      if (res.audioData) {
        base64 = res.audioData;
        msg.audio_data = base64;
      } else {
        setExtractNotice("Could not generate audio playback for this message. Verify your Gemini API key.");
        setTimeout(() => setExtractNotice(null), 4000);
        return;
      }
    }

    try {
      setPlayingMsgId(msg.id);
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass({ sampleRate: 24000 });
      audioCtxRef.current = audioCtx;

      const binaryString = atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const buffer = new Int16Array(bytes.buffer);
      const audioBuffer = audioCtx.createBuffer(1, buffer.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < buffer.length; i++) {
        channelData[i] = buffer[i] / 32768.0;
      }

      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      audioSourceRef.current = source;

      source.onended = () => {
        setPlayingMsgId(null);
        try { audioCtx.close(); } catch {}
      };

      source.start();
    } catch (err) {
      console.error("Audio playback error:", err);
      setPlayingMsgId(null);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [prof, prefs, mems, convos, st, sentiment, responses] = await Promise.all([
        getCreatorProfile(),
        getPreferences(),
        getMemories(searchQuery, selectedCategory),
        getConversations(),
        getDatabaseStats(),
        fetchSentimentAnalytics(30),
        fetchZoyaResponses(60),
      ]);
      setProfile(prof);
      setEditName(prof.name);
      setEditRole(prof.role);
      setEditBio(prof.bio);
      setPreferences(prefs);
      setMemories(mems);
      setConversations(convos);
      setStats(st);
      setSentimentData(sentiment);
      setZoyaResponses(responses);
    } catch (err) {
      console.warn('Error loading memory modal data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    } else {
      stopAudio();
    }
  }, [isOpen, selectedCategory]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      getMemories(searchQuery, selectedCategory).then(setMemories);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;
    const updated = await updateCreatorProfile(editName.trim(), editRole.trim(), editBio.trim());
    if (updated) {
      setProfile(updated);
      setIsEditingProfile(false);
      onMemoryUpdated?.();
    }
  };

  const handleAddMemorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFact.trim()) return;
    const added = await addMemory(newFact.trim(), newCategory, newImportance);
    if (added) {
      setMemories(prev => [added, ...prev]);
      setNewFact('');
      setShowAddMemory(false);
      onMemoryUpdated?.();
      getDatabaseStats().then(setStats);
    }
  };

  const handleDeleteMemory = async (id: number) => {
    const success = await deleteMemory(id);
    if (success) {
      setMemories(prev => prev.filter(m => m.id !== id));
      onMemoryUpdated?.();
      getDatabaseStats().then(setStats);
    }
  };

  const handleAddPrefSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPrefKey.trim() || !newPrefValue.trim()) return;
    const success = await savePreference(newPrefCategory, newPrefKey.trim(), newPrefValue.trim());
    if (success) {
      getPreferences().then(setPreferences);
      setNewPrefKey('');
      setNewPrefValue('');
      setShowAddPref(false);
      onMemoryUpdated?.();
      getDatabaseStats().then(setStats);
    }
  };

  const handleDeletePref = async (id: number) => {
    const success = await deletePreference(id);
    if (success) {
      setPreferences(prev => prev.filter(p => p.id !== id));
      onMemoryUpdated?.();
      getDatabaseStats().then(setStats);
    }
  };

  const handleAutoExtract = async () => {
    if (isExtracting) return;
    setIsExtracting(true);
    setExtractNotice('Zoya is analyzing conversation turns to extract memories...');
    try {
      const convoId = getCurrentConversationId();
      const result = await triggerMemoryExtraction(convoId, recentMessages, apiKey);
      if (result) {
        if (result.extractedCount > 0) {
          setExtractNotice(`Success! Extracted ${result.extractedCount} new memory fact(s) about Abdul.`);
          await loadData();
          onMemoryUpdated?.();
        } else {
          setExtractNotice('Analyzed recent turns: no new factual statements or preferences detected.');
        }
      }
    } catch (e: any) {
      setExtractNotice('Failed to extract: ' + (e?.message || 'Check your Gemini API key'));
    } finally {
      setIsExtracting(false);
      setTimeout(() => setExtractNotice(null), 5000);
    }
  };

  const handleSelectConversation = async (convoId: string) => {
    setSelectedConvoId(convoId);
    setLoadingMessages(true);
    stopAudio();
    try {
      const msgs = await getConversationMessages(convoId);
      setConvoMessages(msgs);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Keyword Matching & Filter Logic for Past Messages & Extracted Memories
  const trimmedSearch = searchQuery.trim().toLowerCase();

  const filteredZoyaResponses = useMemo(() => {
    if (!trimmedSearch) return zoyaResponses;
    return zoyaResponses.filter((m) => 
      m.text.toLowerCase().includes(trimmedSearch) ||
      (m.conversation_title && m.conversation_title.toLowerCase().includes(trimmedSearch))
    );
  }, [zoyaResponses, trimmedSearch]);

  const filteredConversations = useMemo(() => {
    if (!trimmedSearch) return conversations;
    return conversations.filter((c) => 
      (c.title && c.title.toLowerCase().includes(trimmedSearch)) ||
      (c.summary && c.summary.toLowerCase().includes(trimmedSearch)) ||
      (c.id && c.id.toLowerCase().includes(trimmedSearch))
    );
  }, [conversations, trimmedSearch]);

  const filteredConvoMessages = useMemo(() => {
    if (!trimmedSearch) return convoMessages;
    return convoMessages.filter((m) => 
      m.text.toLowerCase().includes(trimmedSearch) ||
      m.sender.toLowerCase().includes(trimmedSearch)
    );
  }, [convoMessages, trimmedSearch]);

  // Safe keyword highlight helper for visual clarity in search results
  const highlightMatch = (text: string | null | undefined, query: string) => {
    if (!text) return null;
    if (!query || !query.trim()) return text;
    const q = query.trim();
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
      const regex = new RegExp(`(${escaped})`, 'gi');
      const parts = text.split(regex);
      if (parts.length <= 1) return text;
      return (
        <>
          {parts.map((part, i) =>
            regex.test(part) ? (
              <mark
                key={i}
                className="bg-cyan-500/30 text-cyan-200 px-1 py-0.5 rounded font-semibold border border-cyan-400/40 shadow-sm"
              >
                {part}
              </mark>
            ) : (
              part
            )
          )}
        </>
      );
    } catch {
      return text;
    }
  };

  // Helper to trigger browser file download
  const triggerDownload = (filename: string, content: string, mimeType: string) => {
    try {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e: any) {
      console.error('Download error:', e);
      setExportNotice('Download error: ' + (e?.message || 'Could not save file'));
    }
  };

  // Export full chat conversation across all sessions
  const handleExportFullChat = async (format: 'json' | 'txt') => {
    setIsExporting(true);
    setShowExportMenu(false);
    setExportNotice('Exporting full chat conversation archive...');
    try {
      const data = await getFullConversationExport();
      const creatorName = profile?.name || 'Abdul';
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

      if (!data || !data.conversations || data.conversations.length === 0) {
        setExportNotice('No conversations found in the database to export.');
        return;
      }

      const totalTurns = data.conversations.reduce((sum, c) => sum + (c.messages?.length || 0), 0);

      if (format === 'json') {
        const jsonContent = JSON.stringify(data, null, 2);
        const filename = `zoya-conversations-full-${creatorName.toLowerCase()}-${timestamp}.json`;
        triggerDownload(filename, jsonContent, 'application/json');
        setExportNotice(`Exported ${data.conversations.length} sessions (${totalTurns} messages) as JSON!`);
      } else {
        let txt = `================================================================================\n`;
        txt += `ZOYA AI VOICE COMPANION - FULL CONVERSATION TRANSCRIPT ARCHIVE\n`;
        txt += `Creator & User: ${creatorName} (${profile?.role || 'Creator & Developer'})\n`;
        txt += `Export Date: ${new Date().toLocaleString()}\n`;
        txt += `Total Sessions: ${data.conversations.length}\n`;
        txt += `Total Messages: ${totalTurns}\n`;
        txt += `Database: SQLite with Voice Playback & Memory Preservation\n`;
        txt += `================================================================================\n\n`;

        for (const session of data.conversations) {
          txt += `--------------------------------------------------------------------------------\n`;
          txt += `SESSION ID: ${session.id}\n`;
          txt += `Title: ${session.title || 'Untitled Conversation'}\n`;
          txt += `Started: ${session.started_at ? new Date(session.started_at).toLocaleString() : 'N/A'}\n`;
          if (session.summary) {
            txt += `Summary: ${session.summary}\n`;
          }
          txt += `Turns: ${session.messages?.length || 0}\n`;
          txt += `--------------------------------------------------------------------------------\n\n`;

          if (session.messages && session.messages.length > 0) {
            for (const msg of session.messages) {
              const speaker = msg.sender === 'user' ? creatorName : 'Zoya';
              const timeStr = msg.timestamp ? `[${new Date(msg.timestamp).toLocaleString()}] ` : '';
              txt += `${timeStr}${speaker}:\n${msg.text}\n\n`;
            }
          } else {
            txt += `(No message turns recorded in this session)\n\n`;
          }
          txt += `\n`;
        }

        txt += `================================================================================\n`;
        txt += `End of Transcript Archive - Generated by Zoya AI Companion\n`;
        txt += `================================================================================\n`;

        const filename = `zoya-conversations-full-${creatorName.toLowerCase()}-${timestamp}.txt`;
        triggerDownload(filename, txt, 'text/plain;charset=utf-8');
        setExportNotice(`Exported ${data.conversations.length} sessions (${totalTurns} messages) as TXT!`);
      }
    } catch (err: any) {
      console.error('Export error:', err);
      setExportNotice('Export failed: ' + (err?.message || 'Could not export conversation'));
    } finally {
      setIsExporting(false);
      setTimeout(() => setExportNotice(null), 5000);
    }
  };

  // Export currently selected session
  const handleExportSingleSession = (format: 'json' | 'txt') => {
    if (!selectedConvoId) return;
    setIsExporting(true);
    try {
      const creatorName = profile?.name || 'Abdul';
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const sessionObj = conversations.find(c => c.id === selectedConvoId);
      const sessionTitle = sessionObj?.title || selectedConvoId;
      const msgsToExport = convoMessages;

      if (msgsToExport.length === 0) {
        setExportNotice('This session has no recorded messages to export.');
        return;
      }

      if (format === 'json') {
        const payload = {
          exportType: 'single_session',
          sessionId: selectedConvoId,
          title: sessionTitle,
          summary: sessionObj?.summary || null,
          startedAt: sessionObj?.started_at || null,
          creator: profile,
          exportedAt: new Date().toISOString(),
          messageCount: msgsToExport.length,
          messages: msgsToExport,
        };
        const filename = `zoya-session-${selectedConvoId.slice(-8)}-${timestamp}.json`;
        triggerDownload(filename, JSON.stringify(payload, null, 2), 'application/json');
        setExportNotice(`Session "${sessionTitle}" exported as JSON!`);
      } else {
        let txt = `================================================================================\n`;
        txt += `ZOYA AI VOICE COMPANION - SESSION TRANSCRIPT\n`;
        txt += `Session ID: ${selectedConvoId}\n`;
        txt += `Title: ${sessionTitle}\n`;
        if (sessionObj?.summary) txt += `Summary: ${sessionObj.summary}\n`;
        txt += `User / Creator: ${creatorName}\n`;
        txt += `Started: ${sessionObj?.started_at ? new Date(sessionObj.started_at).toLocaleString() : 'N/A'}\n`;
        txt += `Export Date: ${new Date().toLocaleString()}\n`;
        txt += `Total Messages: ${msgsToExport.length}\n`;
        txt += `================================================================================\n\n`;

        for (const msg of msgsToExport) {
          const speaker = msg.sender === 'user' ? creatorName : 'Zoya';
          const timeStr = msg.timestamp ? `[${new Date(msg.timestamp).toLocaleString()}] ` : '';
          txt += `${timeStr}${speaker}:\n${msg.text}\n\n`;
        }

        txt += `================================================================================\n`;
        txt += `End of Session Transcript - Generated by Zoya AI Companion\n`;
        txt += `================================================================================\n`;

        const filename = `zoya-session-${selectedConvoId.slice(-8)}-${timestamp}.txt`;
        triggerDownload(filename, txt, 'text/plain;charset=utf-8');
        setExportNotice(`Session "${sessionTitle}" exported as TXT!`);
      }
    } catch (err: any) {
      console.error('Session export error:', err);
      setExportNotice('Export failed: ' + (err?.message || 'Error exporting session'));
    } finally {
      setIsExporting(false);
      setTimeout(() => setExportNotice(null), 5000);
    }
  };

  // Custom Chart Tooltip
  const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const item: SentimentDayData = payload[0].payload;
      return (
        <div className="p-3 bg-[#0c121d] border border-cyan-500/30 rounded-xl shadow-2xl text-xs space-y-1.5 font-sans min-w-[190px]">
          <div className="flex items-center justify-between text-white/60 border-b border-white/5 pb-1">
            <span className="font-semibold text-white">{item.displayDate}</span>
            <span className="text-[10px] uppercase font-mono text-cyan-400">{item.tone}</span>
          </div>
          <div className="space-y-1 pt-0.5">
            <div className="flex items-center justify-between">
              <span className="text-cyan-300">Overall Sentiment:</span>
              <span className="font-bold text-white">{item.sentiment}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-rose-400">Affection & Love:</span>
              <span className="font-bold text-white">{item.affection}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-amber-400">Joy & Humor:</span>
              <span className="font-bold text-white">{item.joy}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-purple-400">Comfort & Empathy:</span>
              <span className="font-bold text-white">{item.comfort}%</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-white/40 pt-1 border-t border-white/5">
              <span>Logged Turns:</span>
              <span>{item.turns} exchanges</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 text-white font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 20 }}
        className="w-full sm:max-w-4xl h-[92vh] sm:h-[86vh] bg-[#0c1017] border border-cyan-500/20 sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-gradient-to-r from-[#0e1626] to-[#0c1017]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <Database size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-wider text-white uppercase flex items-center gap-2">
                Long-Term Memory & Vocal Intelligence
              </h2>
              <p className="text-xs text-white/50">
                SQLite Storage · Creator: <span className="text-cyan-300 font-semibold">{profile?.name || 'Abdul'}</span> ({profile?.role || 'Creator'})
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopAudio();
              onClose();
            }}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-6 pt-3 pb-2 border-b border-white/5 bg-[#0a0d14] shrink-0 overflow-x-auto">
          <button
            onClick={() => {
              stopAudio();
              setActiveTab('memories');
            }}
            className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === 'memories'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Brain size={14} />
            Memories ({stats?.memories ?? memories.length})
          </button>

          <button
            onClick={() => {
              stopAudio();
              setActiveTab('sentiment');
            }}
            className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === 'sentiment'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <TrendingUp size={14} />
            30-Day Tone Chart
          </button>

          <button
            onClick={() => {
              stopAudio();
              setActiveTab('conversations');
            }}
            className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === 'conversations'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Headphones size={14} />
            Past Chats & Playback
          </button>

          <button
            onClick={() => {
              stopAudio();
              setActiveTab('profile');
            }}
            className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === 'profile'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <UserCheck size={14} />
            Creator Profile
          </button>

          <button
            onClick={() => {
              stopAudio();
              setActiveTab('preferences');
            }}
            className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === 'preferences'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Bookmark size={14} />
            Preferences ({preferences.length})
          </button>
        </div>

        {/* Notice Banner */}
        {extractNotice && (
          <div className="px-6 py-2 bg-cyan-950/60 border-b border-cyan-500/30 text-xs text-cyan-300 flex items-center justify-between">
            <span>{extractNotice}</span>
            <button onClick={() => setExtractNotice(null)} className="text-white/50 hover:text-white">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Export Notice Banner */}
        {exportNotice && (
          <div className="px-6 py-2 bg-emerald-950/70 border-b border-emerald-500/30 text-xs text-emerald-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle size={14} className="text-emerald-400 shrink-0" />
              <span>{exportNotice}</span>
            </div>
            <button onClick={() => setExportNotice(null)} className="text-white/50 hover:text-white">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Universal Search Bar for Past Messages & Extracted Memories */}
        {(activeTab === 'memories' || activeTab === 'conversations') && (
          <div className="px-6 py-3 bg-[#0d121c] border-b border-white/10 space-y-2.5 shrink-0">
            <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3.5 top-2.5 text-cyan-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search past messages and memories by keyword (e.g. Abdul, chai, code, morning)..."
                  className="w-full pl-10 pr-9 py-2 bg-black/50 border border-white/15 focus:border-cyan-400 rounded-xl text-xs text-white placeholder-white/40 focus:outline-none transition-all shadow-inner"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2 p-1 rounded-md text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                    title="Clear search query"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Live Match Count Badges & Export Trigger */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setActiveTab('memories')}
                  className={`px-3 py-1.5 rounded-xl border text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === 'memories'
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-semibold shadow-sm shadow-cyan-500/10'
                      : 'bg-white/5 hover:bg-white/10 text-white/60 border-white/5'
                  }`}
                  title="View matching extracted memories"
                >
                  <Brain size={13} />
                  <span>{memories.length} memories</span>
                </button>

                <button
                  onClick={() => setActiveTab('conversations')}
                  className={`px-3 py-1.5 rounded-xl border text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === 'conversations'
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-semibold shadow-sm shadow-cyan-500/10'
                      : 'bg-white/5 hover:bg-white/10 text-white/60 border-white/5'
                  }`}
                  title="View matching past conversations and messages"
                >
                  <MessageSquare size={13} />
                  <span>
                    {convoViewMode === 'sessions'
                      ? (selectedConvoId ? `${filteredConvoMessages.length} msgs` : `${filteredConversations.length} sessions`)
                      : `${filteredZoyaResponses.length} vocal turns`}
                  </span>
                </button>

                {activeTab === 'conversations' && (
                  <div className="relative">
                    <button
                      onClick={() => setShowExportMenu(!showExportMenu)}
                      disabled={isExporting}
                      className="px-3 py-1.5 rounded-xl border text-xs flex items-center gap-1.5 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 hover:text-white border-cyan-500/30 transition-all font-semibold cursor-pointer"
                      title="Export conversation history"
                    >
                      <Download size={13} className={isExporting ? 'animate-bounce text-cyan-400' : 'text-cyan-400'} />
                      <span>{isExporting ? 'Exporting...' : 'Export'}</span>
                    </button>

                    {showExportMenu && (
                      <div className="absolute right-0 top-full mt-2 w-64 bg-[#0d131f] border border-cyan-500/40 rounded-2xl shadow-2xl p-2.5 z-50 text-xs space-y-1.5 backdrop-blur-xl animate-fadeIn">
                        <div className="flex items-center justify-between px-2 py-1 border-b border-white/10 text-[10px] uppercase font-bold text-cyan-400">
                          <span>Export Conversations</span>
                          <button onClick={() => setShowExportMenu(false)} className="text-white/40 hover:text-white">
                            <X size={12} />
                          </button>
                        </div>

                        <button
                          onClick={() => handleExportFullChat('json')}
                          className="w-full text-left p-2 rounded-xl bg-white/[0.03] hover:bg-cyan-500/15 border border-white/5 hover:border-cyan-500/30 transition-all flex items-center gap-2.5 text-white/90 group cursor-pointer"
                        >
                          <FileCode size={16} className="text-cyan-400 shrink-0 group-hover:scale-110 transition-transform" />
                          <div className="flex-1">
                            <div className="font-semibold text-xs text-white group-hover:text-cyan-300">Download Full Chat (.JSON)</div>
                            <div className="text-[10px] text-white/40">Complete SQLite archive with messages</div>
                          </div>
                        </button>

                        <button
                          onClick={() => handleExportFullChat('txt')}
                          className="w-full text-left p-2 rounded-xl bg-white/[0.03] hover:bg-cyan-500/15 border border-white/5 hover:border-cyan-500/30 transition-all flex items-center gap-2.5 text-white/90 group cursor-pointer"
                        >
                          <FileText size={16} className="text-cyan-400 shrink-0 group-hover:scale-110 transition-transform" />
                          <div className="flex-1">
                            <div className="font-semibold text-xs text-white group-hover:text-cyan-300">Download Full Chat (.TXT)</div>
                            <div className="text-[10px] text-white/40">Human-readable conversation transcript</div>
                          </div>
                        </button>

                        {selectedConvoId && (
                          <div className="border-t border-white/10 pt-2 space-y-1">
                            <div className="px-2 text-[10px] uppercase font-bold text-amber-400/90">
                              Active Session Only
                            </div>
                            <div className="grid grid-cols-2 gap-1.5 px-1">
                              <button
                                onClick={() => {
                                  setShowExportMenu(false);
                                  handleExportSingleSession('json');
                                }}
                                className="px-2 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 text-[11px] font-medium flex items-center justify-center gap-1 cursor-pointer transition-colors"
                              >
                                <FileCode size={11} />
                                JSON
                              </button>
                              <button
                                onClick={() => {
                                  setShowExportMenu(false);
                                  handleExportSingleSession('txt');
                                }}
                                className="px-2 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 text-[11px] font-medium flex items-center justify-center gap-1 cursor-pointer transition-colors"
                              >
                                <FileText size={11} />
                                TXT
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Keyword Suggestion Chips */}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-white/50">
              <span className="text-white/40 flex items-center gap-1">
                <Sparkles size={11} className="text-cyan-400" />
                Quick filter:
              </span>
              {['Abdul', 'chai', 'voice', 'preference', 'project', 'salam', 'morning'].map((keyword) => (
                <button
                  key={keyword}
                  onClick={() => setSearchQuery(keyword)}
                  className={`px-2 py-0.5 rounded-md border transition-colors ${
                    searchQuery.toLowerCase() === keyword.toLowerCase()
                      ? 'bg-cyan-500/30 text-cyan-200 border-cyan-400/50 font-medium'
                      : 'bg-white/[0.04] hover:bg-white/[0.08] text-white/70 border-white/5'
                  }`}
                >
                  {keyword}
                </button>
              ))}
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-2 py-0.5 text-rose-300 hover:text-rose-200 hover:underline transition-colors ml-auto flex items-center gap-1"
                >
                  <X size={10} /> Clear query
                </button>
              )}
            </div>
          </div>
        )}

        {/* Main Tab Content Area */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
          {/* TAB: 30-DAY SENTIMENT & TONE CHART (RECHARTS) */}
          {activeTab === 'sentiment' && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-cyan-950/20 border border-cyan-500/20 rounded-xl space-y-1">
                  <div className="flex items-center justify-between text-white/50 text-[11px] uppercase tracking-wider">
                    <span>Avg Sentiment</span>
                    <Activity size={14} className="text-cyan-400" />
                  </div>
                  <div className="text-2xl font-bold text-cyan-300">
                    {sentimentData?.averageSentiment || 92}%
                  </div>
                  <div className="text-[10px] text-white/40">Highly positive & engaging</div>
                </div>

                <div className="p-3.5 bg-rose-950/20 border border-rose-500/20 rounded-xl space-y-1">
                  <div className="flex items-center justify-between text-white/50 text-[11px] uppercase tracking-wider">
                    <span>Affection & Warmth</span>
                    <Heart size={14} className="text-rose-400" />
                  </div>
                  <div className="text-2xl font-bold text-rose-300">
                    {sentimentData?.averageAffection || 94}%
                  </div>
                  <div className="text-[10px] text-white/40">Kore voice companion warmth</div>
                </div>

                <div className="p-3.5 bg-amber-950/20 border border-amber-500/20 rounded-xl space-y-1">
                  <div className="flex items-center justify-between text-white/50 text-[11px] uppercase tracking-wider">
                    <span>Joy & Wit</span>
                    <Smile size={14} className="text-amber-400" />
                  </div>
                  <div className="text-2xl font-bold text-amber-300">
                    {sentimentData?.averageJoy || 89}%
                  </div>
                  <div className="text-[10px] text-white/40">Lively & cheerful flow</div>
                </div>

                <div className="p-3.5 bg-purple-950/20 border border-purple-500/20 rounded-xl space-y-1">
                  <div className="flex items-center justify-between text-white/50 text-[11px] uppercase tracking-wider">
                    <span>Empathy & Care</span>
                    <Sparkles size={14} className="text-purple-400" />
                  </div>
                  <div className="text-2xl font-bold text-purple-300">
                    {sentimentData?.averageComfort || 91}%
                  </div>
                  <div className="text-[10px] text-white/40">Emotional support for Abdul</div>
                </div>
              </div>

              {/* Main Visual Trend Chart Container */}
              <div className="p-5 bg-white/[0.02] border border-white/10 rounded-2xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                      <TrendingUp size={15} className="text-cyan-400" />
                      30-Day Emotional Tone & Sentiment Dynamics
                    </h3>
                    <p className="text-xs text-white/50">
                      Tracking conversation sentiment, voice affection, and bonding trends over time.
                    </p>
                  </div>

                  {/* Metric Switcher Controls */}
                  <div className="flex items-center gap-1 p-1 bg-black/40 rounded-xl border border-white/5 self-start">
                    <button
                      onClick={() => setActiveMetric('sentiment')}
                      className={`px-3 py-1 text-[11px] font-semibold rounded-lg transition-colors ${
                        activeMetric === 'sentiment'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                          : 'text-white/50 hover:text-white'
                      }`}
                    >
                      Sentiment
                    </button>
                    <button
                      onClick={() => setActiveMetric('affection')}
                      className={`px-3 py-1 text-[11px] font-semibold rounded-lg transition-colors ${
                        activeMetric === 'affection'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : 'text-white/50 hover:text-white'
                      }`}
                    >
                      Affection
                    </button>
                    <button
                      onClick={() => setActiveMetric('joy')}
                      className={`px-3 py-1 text-[11px] font-semibold rounded-lg transition-colors ${
                        activeMetric === 'joy'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'text-white/50 hover:text-white'
                      }`}
                    >
                      Joy
                    </button>
                    <button
                      onClick={() => setActiveMetric('comfort')}
                      className={`px-3 py-1 text-[11px] font-semibold rounded-lg transition-colors ${
                        activeMetric === 'comfort'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                          : 'text-white/50 hover:text-white'
                      }`}
                    >
                      Empathy
                    </button>
                  </div>
                </div>

                {/* Recharts Area Chart */}
                <div className="h-64 w-full pt-2">
                  {sentimentData?.dailyTrend && (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={sentimentData.dailyTrend}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="colorSentiment" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.45}/>
                            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0}/>
                          </linearGradient>
                          <linearGradient id="colorAffection" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.45}/>
                            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0}/>
                          </linearGradient>
                          <linearGradient id="colorJoy" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#eab308" stopOpacity={0.45}/>
                            <stop offset="95%" stopColor="#eab308" stopOpacity={0.0}/>
                          </linearGradient>
                          <linearGradient id="colorComfort" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#a855f7" stopOpacity={0.45}/>
                            <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis 
                          dataKey="displayDate" 
                          stroke="rgba(255,255,255,0.3)" 
                          fontSize={11}
                          tickLine={false}
                          interval={4}
                        />
                        <YAxis 
                          domain={[60, 100]} 
                          stroke="rgba(255,255,255,0.3)" 
                          fontSize={11}
                          tickLine={false}
                          tickFormatter={(v) => `${v}%`}
                        />
                        <Tooltip content={<CustomChartTooltip />} />
                        
                        {activeMetric === 'sentiment' && (
                          <Area 
                            type="monotone" 
                            dataKey="sentiment" 
                            name="Overall Sentiment"
                            stroke="#06b6d4" 
                            strokeWidth={2.5}
                            fillOpacity={1} 
                            fill="url(#colorSentiment)" 
                          />
                        )}

                        {activeMetric === 'affection' && (
                          <Area 
                            type="monotone" 
                            dataKey="affection" 
                            name="Affection & Warmth"
                            stroke="#f43f5e" 
                            strokeWidth={2.5}
                            fillOpacity={1} 
                            fill="url(#colorAffection)" 
                          />
                        )}

                        {activeMetric === 'joy' && (
                          <Area 
                            type="monotone" 
                            dataKey="joy" 
                            name="Joy & Humor"
                            stroke="#eab308" 
                            strokeWidth={2.5}
                            fillOpacity={1} 
                            fill="url(#colorJoy)" 
                          />
                        )}

                        {activeMetric === 'comfort' && (
                          <Area 
                            type="monotone" 
                            dataKey="comfort" 
                            name="Comfort & Care"
                            stroke="#a855f7" 
                            strokeWidth={2.5}
                            fillOpacity={1} 
                            fill="url(#colorComfort)" 
                          />
                        )}
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between text-[11px] text-white/50 pt-2 border-t border-white/5">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-cyan-400" /> Sentiment
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-400" /> Affection
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400" /> Joy
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-400" /> Empathy
                    </span>
                  </div>
                  <span>Dominant Persona: {sentimentData?.dominantOverallTone}</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB: PAST CHATS & AUDIO PLAYBACK */}
          {activeTab === 'conversations' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                    Past Conversations & Voice Playback
                  </h3>
                  <p className="text-xs text-white/40">
                    Review and listen to historical Zoya spoken responses directly from SQLite.
                  </p>
                </div>

                {/* Sub-view toggle */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 p-1 bg-black/40 rounded-xl border border-white/5">
                    <button
                      onClick={() => {
                        stopAudio();
                        setConvoViewMode('sessions');
                        setSelectedConvoId(null);
                      }}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                        convoViewMode === 'sessions'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                          : 'text-white/60 hover:text-white'
                      }`}
                    >
                      By Session
                    </button>
                    <button
                      onClick={() => {
                        stopAudio();
                        setConvoViewMode('vocal_archive');
                        setSelectedConvoId(null);
                      }}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                        convoViewMode === 'vocal_archive'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                          : 'text-white/60 hover:text-white'
                      }`}
                    >
                      <Volume2 size={13} />
                      Zoya Vocal Archive
                    </button>
                  </div>

                  <button
                    onClick={loadData}
                    className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-colors"
                    title="Refresh conversation logs"
                  >
                    <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>

              {/* Sub-view: ALL ZOYA VOCAL ARCHIVE RESPONSES */}
              {convoViewMode === 'vocal_archive' && (
                <div className="space-y-3">
                  <div className="p-3 bg-cyan-950/30 border border-cyan-500/20 rounded-xl flex items-center justify-between text-xs text-cyan-300">
                    <div className="flex items-center gap-2">
                      <Headphones size={15} />
                      <span>Review and play back any past spoken turn delivered by Zoya</span>
                    </div>
                    {playingMsgId && (
                      <button
                        onClick={stopAudio}
                        className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-medium flex items-center gap-1"
                      >
                        <Square size={11} fill="currentColor" /> Stop Audio
                      </button>
                    )}
                  </div>

                  {filteredZoyaResponses.length === 0 ? (
                    <div className="text-center py-12 text-white/40 text-xs">
                      {searchQuery ? (
                        <span>
                          No Zoya vocal responses matching "<span className="text-cyan-300 font-semibold">{searchQuery}</span>" found.
                        </span>
                      ) : (
                        <span>
                          No Zoya vocal responses recorded yet. As you talk with Zoya, past voice turns will appear here for audio playback!
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[460px] overflow-y-auto scrollbar-hide pr-1">
                      {filteredZoyaResponses.map((msg) => {
                        const isPlaying = playingMsgId === msg.id;
                        const isLoadingAudio = audioLoadingMsgId === msg.id;

                        return (
                          <div
                            key={msg.id}
                            className={`p-3.5 rounded-xl border transition-all flex items-start gap-3 ${
                              isPlaying
                                ? 'bg-cyan-950/40 border-cyan-500/50 shadow-lg shadow-cyan-500/10'
                                : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/5'
                            }`}
                          >
                            <button
                              onClick={() => playMessageAudio(msg)}
                              disabled={isLoadingAudio}
                              className={`p-2.5 rounded-xl transition-all shrink-0 flex items-center justify-center cursor-pointer ${
                                isPlaying
                                  ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/30 animate-pulse'
                                  : 'bg-white/10 hover:bg-white/20 text-cyan-300 hover:text-white'
                              }`}
                              title={isPlaying ? 'Stop Playback' : 'Listen to Zoya'}
                            >
                              {isLoadingAudio ? (
                                <RefreshCw size={15} className="animate-spin text-cyan-400" />
                              ) : isPlaying ? (
                                <Square size={15} fill="currentColor" />
                              ) : (
                                <Play size={15} fill="currentColor" />
                              )}
                            </button>

                            <div className="flex-1 space-y-1">
                              <div className="flex items-center justify-between text-[11px] text-white/50">
                                <span className="text-cyan-400 font-semibold uppercase tracking-wider">
                                  Zoya Response
                                </span>
                                <span>{msg.timestamp ? new Date(msg.timestamp).toLocaleString() : ''}</span>
                              </div>
                              <p className="text-xs text-white/90 leading-relaxed font-normal">
                                "{highlightMatch(msg.text, searchQuery)}"
                              </p>
                              {msg.conversation_title && (
                                <div className="text-[10px] text-white/40 pt-0.5">
                                  Session: {highlightMatch(msg.conversation_title, searchQuery)}
                                </div>
                              )}
                            </div>

                            {isPlaying && (
                              <div className="flex items-center gap-1 self-center shrink-0 pr-2">
                                <span className="w-1 h-3.5 bg-cyan-400 rounded-full animate-bounce" />
                                <span className="w-1 h-5 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.15s]" />
                                <span className="w-1 h-2.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.3s]" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Sub-view: SESSIONS LIST & IN-SESSION PLAYBACK */}
              {convoViewMode === 'sessions' && (
                <>
                  {selectedConvoId ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-cyan-300">
                            Session: {selectedConvoId}
                          </span>
                          {playingMsgId && (
                            <button
                              onClick={stopAudio}
                              className="px-2 py-0.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded text-[10px] flex items-center gap-1"
                            >
                              <Square size={9} fill="currentColor" /> Stop
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 bg-black/30 p-0.5 rounded-lg border border-white/5">
                            <button
                              onClick={() => handleExportSingleSession('json')}
                              disabled={isExporting}
                              className="px-2 py-1 hover:bg-cyan-500/20 text-cyan-300 hover:text-white rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                              title="Download this session as JSON"
                            >
                              <FileCode size={12} /> JSON
                            </button>
                            <button
                              onClick={() => handleExportSingleSession('txt')}
                              disabled={isExporting}
                              className="px-2 py-1 hover:bg-cyan-500/20 text-cyan-300 hover:text-white rounded-md text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                              title="Download this session as Text transcript"
                            >
                              <FileText size={12} /> TXT
                            </button>
                          </div>

                          <button
                            onClick={() => {
                              stopAudio();
                              setSelectedConvoId(null);
                            }}
                            className="px-3 py-1 bg-white/10 hover:bg-white/20 text-xs rounded-lg text-white/80 transition-colors"
                          >
                            ← Back to Sessions
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2.5 max-h-[380px] overflow-y-auto p-3 bg-black/40 rounded-xl border border-white/5 scrollbar-hide">
                        {loadingMessages ? (
                          <div className="text-center py-8 text-xs text-white/40">Loading messages...</div>
                        ) : filteredConvoMessages.length === 0 ? (
                          <div className="text-center py-8 text-xs text-white/40">
                            {searchQuery ? (
                              <span>
                                No messages matching "<span className="text-cyan-300 font-semibold">{searchQuery}</span>" found in this session.
                              </span>
                            ) : (
                              'No messages found for this session.'
                            )}
                          </div>
                        ) : (
                          filteredConvoMessages.map((m) => {
                            const isPlaying = playingMsgId === m.id;
                            const isLoadingAudio = audioLoadingMsgId === m.id;

                            return (
                              <div
                                key={m.id}
                                className={`p-3 rounded-xl text-xs space-y-1.5 transition-all ${
                                  m.sender === 'user'
                                    ? 'bg-cyan-950/30 border border-cyan-500/20 text-white/90 ml-8'
                                    : isPlaying
                                    ? 'bg-[#121c2c] border border-cyan-400 shadow-lg shadow-cyan-500/10 text-white mr-8'
                                    : 'bg-white/5 border border-white/10 text-white mr-8'
                                }`}
                              >
                                <div className="flex items-center justify-between text-[10px] font-semibold text-white/40">
                                  <span>{m.sender === 'user' ? (profile?.name || 'Abdul') : 'Zoya'}</span>
                                  {m.sender === 'zoya' && (
                                    <button
                                      onClick={() => playMessageAudio(m)}
                                      disabled={isLoadingAudio}
                                      className={`px-2 py-1 rounded-md transition-colors flex items-center gap-1 ${
                                        isPlaying
                                          ? 'bg-cyan-500 text-black font-bold'
                                          : 'bg-white/10 hover:bg-white/20 text-cyan-300'
                                      }`}
                                      title="Play audio response"
                                    >
                                      {isLoadingAudio ? (
                                        <RefreshCw size={11} className="animate-spin" />
                                      ) : isPlaying ? (
                                        <>
                                          <Square size={10} fill="currentColor" /> Stop
                                        </>
                                      ) : (
                                        <>
                                          <Play size={10} fill="currentColor" /> Listen
                                        </>
                                      )}
                                    </button>
                                  )}
                                </div>
                                <p className="leading-relaxed">{highlightMatch(m.text, searchQuery)}</p>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredConversations.length === 0 ? (
                        <div className="text-center py-12 text-white/40 text-xs">
                          {searchQuery ? (
                            <span>
                              No conversation sessions match "<span className="text-cyan-300 font-semibold">{searchQuery}</span>".
                            </span>
                          ) : (
                            'No past conversation sessions logged yet. As you talk with Zoya, sessions are automatically archived here!'
                          )}
                        </div>
                      ) : (
                        filteredConversations.map((c) => (
                          <div
                            key={c.id}
                            onClick={() => handleSelectConversation(c.id)}
                            className="p-3.5 bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 rounded-xl cursor-pointer flex items-center justify-between transition-colors group"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-white group-hover:text-cyan-300 transition-colors">
                                  {highlightMatch(c.title || 'Conversation Session', searchQuery)}
                                </span>
                                <span className="text-[10px] text-white/40 font-mono">#{c.id.slice(-8)}</span>
                              </div>
                              {c.summary ? (
                                <p className="text-xs text-white/60 line-clamp-1">{highlightMatch(c.summary, searchQuery)}</p>
                              ) : (
                                <p className="text-xs text-white/30 italic">No summary generated</p>
                              )}
                              <div className="flex items-center gap-2 text-[10px] text-white/40">
                                <span>{c.turn_count || 0} turns</span>
                                <span aria-hidden="true">·</span>
                                <span>{c.started_at ? new Date(c.started_at).toLocaleString() : 'Recent'}</span>
                              </div>
                            </div>

                            <span className="text-xs text-cyan-400 opacity-60 group-hover:opacity-100 transition-opacity">
                              Review & Play →
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* TAB: MEMORIES */}
          {activeTab === 'memories' && (
            <div className="space-y-4">
              {/* Controls bar */}
              <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-3 text-white/40" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search facts remembered about Abdul..."
                    className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-white/30 focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-3 py-2 bg-[#121620] border border-white/10 rounded-xl text-xs text-white/80 focus:outline-none focus:border-cyan-400"
                  >
                    <option value="all">All Categories</option>
                    <option value="identity">Identity</option>
                    <option value="personal">Personal</option>
                    <option value="preference">Preferences</option>
                    <option value="communication">Communication</option>
                    <option value="project">Projects</option>
                  </select>

                  <button
                    onClick={() => setShowAddMemory(!showAddMemory)}
                    className="px-3 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
                  >
                    <Plus size={14} />
                    Add Memory
                  </button>

                  <button
                    onClick={handleAutoExtract}
                    disabled={isExtracting}
                    className="px-3 py-2 bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 border border-violet-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 disabled:opacity-50"
                    title="Run Gemini to extract new memories from recent chat"
                  >
                    <Sparkles size={14} className={isExtracting ? 'animate-spin' : ''} />
                    {isExtracting ? 'Extracting...' : 'Extract from Chat'}
                  </button>
                </div>
              </div>

              {/* Add Memory Form */}
              <AnimatePresence>
                {showAddMemory && (
                  <motion.form
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    onSubmit={handleAddMemorySubmit}
                    className="p-4 bg-white/5 border border-cyan-500/30 rounded-xl space-y-3"
                  >
                    <div className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                      Teach Zoya a New Fact About You
                    </div>
                    <textarea
                      value={newFact}
                      onChange={(e) => setNewFact(e.target.value)}
                      placeholder="e.g., Abdul prefers working late at night and loves drinking chai while coding."
                      rows={2}
                      className="w-full p-2.5 bg-black/40 border border-white/15 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-400"
                      required
                    />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-white/50">Category:</span>
                        <select
                          value={newCategory}
                          onChange={(e) => setNewCategory(e.target.value)}
                          className="px-2 py-1 bg-[#121620] border border-white/10 rounded-md text-xs text-white/80"
                        >
                          <option value="personal">Personal</option>
                          <option value="preference">Preference</option>
                          <option value="communication">Communication</option>
                          <option value="project">Project</option>
                          <option value="routine">Routine</option>
                        </select>

                        <span className="text-[11px] text-white/50 ml-2">Importance:</span>
                        <select
                          value={newImportance}
                          onChange={(e) => setNewImportance(parseInt(e.target.value, 10))}
                          className="px-2 py-1 bg-[#121620] border border-white/10 rounded-md text-xs text-white/80"
                        >
                          <option value={1}>1 - Minor</option>
                          <option value={2}>2 - Casual</option>
                          <option value={3}>3 - Standard</option>
                          <option value={4}>4 - High</option>
                          <option value={5}>5 - Core Identity</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowAddMemory(false)}
                          className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-white/60"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg text-xs transition-colors"
                        >
                          Save Memory
                        </button>
                      </div>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>

              {/* Memory List */}
              <div className="space-y-2">
                {memories.length === 0 ? (
                  <div className="text-center py-12 text-white/40 text-xs">
                    {searchQuery ? (
                      <span>
                        No memories matching "<span className="text-cyan-300 font-semibold">{searchQuery}</span>" found.
                      </span>
                    ) : (
                      'No memories saved yet. Add your first memory above!'
                    )}
                  </div>
                ) : (
                  memories.map((m) => (
                    <div
                      key={m.id}
                      className="p-3.5 bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 rounded-xl flex items-start justify-between gap-3 transition-colors group"
                    >
                      <div className="space-y-1.5 flex-1">
                        <p className="text-xs text-white/90 leading-relaxed font-normal">
                          {highlightMatch(m.fact, searchQuery)}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-white/40">
                          <span className="text-cyan-400/90 font-medium tracking-wide uppercase">{m.category}</span>
                          <span aria-hidden="true">·</span>
                          <span>Importance {m.importance}/5</span>
                          <span aria-hidden="true">·</span>
                          <span>{m.source}</span>
                          {m.created_at && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{new Date(m.created_at).toLocaleDateString()}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteMemory(m.id)}
                        className="opacity-40 group-hover:opacity-100 p-1.5 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-all"
                        title="Delete memory"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB: CREATOR PROFILE */}
          {activeTab === 'profile' && (
            <div className="space-y-5">
              {!isEditingProfile ? (
                <div className="p-5 bg-gradient-to-br from-cyan-950/20 to-violet-950/20 border border-cyan-500/30 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 font-bold text-lg">
                        {profile?.name?.charAt(0) || 'A'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-white tracking-wide">
                            {profile?.name || 'Abdul'}
                          </h3>
                          <span className="text-[10px] tracking-wider uppercase px-2 py-0.5 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded">
                            {profile?.role || 'Creator'}
                          </span>
                        </div>
                        <p className="text-xs text-white/50">Primary Recognized Master User</p>
                      </div>
                    </div>

                    <button
                      onClick={() => setIsEditingProfile(true)}
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-xs font-semibold rounded-lg text-white/80 hover:text-white flex items-center gap-1.5 transition-colors"
                    >
                      <Edit2 size={13} />
                      Edit Profile
                    </button>
                  </div>

                  <div className="pt-2 border-t border-white/5">
                    <div className="text-[11px] uppercase tracking-wider text-white/40 mb-1">Creator Biography & Directives:</div>
                    <p className="text-xs text-white/80 leading-relaxed bg-black/30 p-3 rounded-lg border border-white/5">
                      {profile?.bio || 'Abdul is my creator and the developer who brought me to life.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-white/50 pt-1">
                    <span>Database ID: #{profile?.id}</span>
                    <span aria-hidden="true">·</span>
                    <span>Recognized: Creator & Developer</span>
                    <span aria-hidden="true">·</span>
                    <span>Status: Permanent Memory Active</span>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSaveProfile} className="p-5 bg-white/5 border border-white/10 rounded-2xl space-y-4">
                  <div className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                    Update Creator Profile
                  </div>

                  <div>
                    <label className="block text-[11px] text-white/60 mb-1">Your Name</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full p-2.5 bg-black/40 border border-white/15 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-400"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-white/60 mb-1">Role / Designation</label>
                    <input
                      type="text"
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                      className="w-full p-2.5 bg-black/40 border border-white/15 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-white/60 mb-1">Bio / How Zoya should understand you</label>
                    <textarea
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value)}
                      rows={3}
                      className="w-full p-2.5 bg-black/40 border border-white/15 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingProfile(false)}
                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-white/60"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg text-xs transition-colors"
                    >
                      Save Profile
                    </button>
                  </div>
                </form>
              )}

              {/* Instructions banner */}
              <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl space-y-2">
                <div className="text-xs font-semibold text-white/80">How Zoya Uses Your Profile:</div>
                <p className="text-xs text-white/50 leading-relaxed">
                  Your identity as Abdul is injected directly into Zoya's core system prompt for both voice and text interactions. She addresses you respectfully, remembers your preferences, and never forgets your identity across sessions or server reboots.
                </p>
              </div>
            </div>
          )}

          {/* TAB: PREFERENCES */}
          {activeTab === 'preferences' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">Your Registered Preferences</h3>
                  <p className="text-xs text-white/40">Zoya adapts her tone, language, and behavior to match these.</p>
                </div>

                <button
                  onClick={() => setShowAddPref(!showAddPref)}
                  className="px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Plus size={14} />
                  Add Preference
                </button>
              </div>

              {/* Add Preference Form */}
              <AnimatePresence>
                {showAddPref && (
                  <motion.form
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    onSubmit={handleAddPrefSubmit}
                    className="p-4 bg-white/5 border border-cyan-500/30 rounded-xl space-y-3"
                  >
                    <div className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                      Add New Preference
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-white/50 mb-1">Category</label>
                        <select
                          value={newPrefCategory}
                          onChange={(e) => setNewPrefCategory(e.target.value)}
                          className="w-full p-2 bg-[#121620] border border-white/10 rounded-lg text-xs text-white"
                        >
                          <option value="communication">Communication</option>
                          <option value="tone">Tone & Affection</option>
                          <option value="personality">Personality</option>
                          <option value="interests">Interests & Hobbies</option>
                          <option value="routine">Schedule / Routine</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] text-white/50 mb-1">Key Name</label>
                        <input
                          type="text"
                          value={newPrefKey}
                          onChange={(e) => setNewPrefKey(e.target.value)}
                          placeholder="e.g., preferred_greeting"
                          className="w-full p-2 bg-black/40 border border-white/10 rounded-lg text-xs text-white"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] text-white/50 mb-1">Preference Value</label>
                      <input
                        type="text"
                        value={newPrefValue}
                        onChange={(e) => setNewPrefValue(e.target.value)}
                        placeholder="e.g., Greet Abdul with 'Salam Abdul bhai, kaise hain aap?'"
                        className="w-full p-2 bg-black/40 border border-white/10 rounded-lg text-xs text-white"
                        required
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddPref(false)}
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-white/60"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg text-xs transition-colors"
                      >
                        Save Preference
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>

              {/* Preferences List */}
              <div className="space-y-2">
                {preferences.length === 0 ? (
                  <div className="text-center py-12 text-white/40 text-xs">
                    No preferences stored. Click "Add Preference" above.
                  </div>
                ) : (
                  preferences.map((p) => (
                    <div
                      key={p.id}
                      className="p-3 bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 rounded-xl flex items-center justify-between gap-3 group transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-cyan-300 font-semibold">{p.pref_key}</span>
                          <span className="text-[10px] text-white/40 uppercase tracking-wider">({p.category})</span>
                        </div>
                        <p className="text-xs text-white/80">{p.pref_value}</p>
                      </div>

                      <button
                        onClick={() => handleDeletePref(p.id)}
                        className="opacity-40 group-hover:opacity-100 p-1.5 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-all"
                        title="Delete preference"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Database Status */}
        <div className="px-6 py-3 border-t border-white/10 bg-[#080b10] flex flex-wrap items-center justify-between text-xs text-white/50 shrink-0">
          <div className="flex items-center gap-2 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>SQLite Active</span>
            <span aria-hidden="true">·</span>
            <span>{stats?.memories ?? memories.length} facts</span>
            <span aria-hidden="true">·</span>
            <span>{stats?.conversations ?? conversations.length} sessions</span>
            <span aria-hidden="true">·</span>
            <span className="text-rose-400">{sentimentData?.averageSentiment || 92}% sentiment</span>
          </div>

          <button
            onClick={() => {
              stopAudio();
              onClose();
            }}
            className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
}
