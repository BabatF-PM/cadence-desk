import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Bot,
  X,
  Send,
  Sparkles,
  Loader2,
  ShieldCheck,
  Trash2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Markdown from "react-markdown";
import { askGroundedAssistant, ActiveMeetingContext } from "../services/aiAssistantService";

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
}

export interface SynchronChatbotProps {
  meetingContext?: ActiveMeetingContext;
}

const INITIAL_WELCOME: ChatMessage = {
  id: "msg-welcome",
  sender: "assistant",
  text: `👋 **Hello! I am Cadence Navigator**, your expert grounded assistant for Cadence Desk.

I can answer your questions about:
- **4-Stage Multi-Agent Pipeline** (Aura, Chronos, Scribe, Outbox)
- **Data Storage & Privacy** (Zero Centralized Cloud Database)
- **Security & Lifecycle Rules** (Reset Workspace vs Log Out)
- **Master Issue Tracker** (Issues #18, #26, #27 resolutions)

How can I help you today?`,
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
};

// Full library of dynamic follow-up suggestions
const ALL_SUGGESTIONS = [
  "Where is my data stored?",
  "Explain the 4-stage agent pipeline",
  "Difference between Reset Workspace & Log Out",
  "How were Issue #18 and #27 resolved?",
  "How long does the agent pipeline take?",
  "What security guarantees does zero-cloud storage offer?",
  "How do I export action items to Outlook or Slack?",
  "Explain the consensus scoring algorithm",
  "Can guest users run the agent pipeline?",
  "Who do I contact for support or inquiries?"
];

export const SynchronChatbot: React.FC<SynchronChatbotProps> = ({ meetingContext }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_WELCOME]);
  const [input, setInput] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Dynamic Suggestion Chips: Always guarantees at least 3-4 suggestions are returned and visible
  const activeSuggestions = useMemo<string[]>(() => {
    const userQueries = messages
      .filter((m) => m.sender === "user")
      .map((m) => m.text.trim().toLowerCase());

    const result: string[] = [];

    const hasTasks = Boolean(meetingContext?.extractedTasks && meetingContext.extractedTasks.length > 0);
    const hasAttendees = Boolean(meetingContext?.attendees && meetingContext.attendees.length > 0);
    const hasSlots = Boolean(meetingContext?.proposedSlots && meetingContext.proposedSlots.length > 0);
    const hasTranscript = Boolean(meetingContext?.rawTranscript && meetingContext.rawTranscript.trim().length > 0);

    if (hasTasks) {
      result.push("Who has the highest-priority action items?");
      result.push("Summarize all extracted tasks and deadlines");
    }

    if (hasAttendees || hasSlots) {
      result.push("Which timezone slot has the best alignment score?");
      result.push("List all attendees and their locations");
    }

    if (hasTranscript && !hasTasks) {
      result.push("What are the key decisions in the loaded transcript?");
    }

    // Add unasked questions from the master pool
    for (const q of ALL_SUGGESTIONS) {
      if (result.length < 4 && !result.includes(q) && !userQueries.includes(q.toLowerCase())) {
        result.push(q);
      }
    }

    // If all suggestions have been asked, cycle through the master list so buttons NEVER disappear
    if (result.length < 3) {
      for (const q of ALL_SUGGESTIONS) {
        if (result.length < 4 && !result.includes(q)) {
          result.push(q);
        }
      }
    }

    return result.slice(0, 4);
  }, [meetingContext, messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, isLoading]);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev: ChatMessage[]) => [...prev, userMsg]);
    if (!textToSend) setInput("");
    setIsLoading(true);

    try {
      const responseText = await askGroundedAssistant(query, meetingContext);
      const assistantMsg: ChatMessage = {
        id: `ast-${Date.now()}`,
        sender: "assistant",
        text: responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev: ChatMessage[]) => [...prev, assistantMsg]);
    } catch (err) {
      console.error("Chatbot error:", err);
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: "assistant",
        text: "⚠️ I encountered an error retrieving the grounded answer. All active session data lives strictly in client-side RAM.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev: ChatMessage[]) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([INITIAL_WELCOME]);
  };

  return (
    <div id="synchron-chatbot-root" className="fixed bottom-4 right-4 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="mb-4 w-[380px] sm:w-[430px] h-[580px] max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden font-sans text-slate-800"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white p-4 flex items-center justify-between border-b border-indigo-700/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300">
                  <Bot className="w-5 h-5 text-indigo-200" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-semibold text-sm text-white tracking-wide">Cadence Navigator</h3>
                    <span className="px-1.5 py-0.5 text-[10px] font-mono uppercase font-semibold bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30">
                      Grounded AI
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-400 inline" /> Zero-Cloud Privacy Assured
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={clearChat}
                  title="Clear Chat"
                  className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  title="Close Assistant"
                  className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Conversation Messages Scrollable Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 min-h-0">
              {messages.map((msg: ChatMessage) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                >
                  <div className="flex items-center gap-1.5 mb-1 px-1">
                    {msg.sender === "assistant" ? (
                      <span className="text-[10px] font-semibold text-indigo-600 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-indigo-500" /> Cadence Navigator
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-slate-500">You</span>
                    )}
                    <span className="text-[10px] text-slate-400">{msg.timestamp}</span>
                  </div>

                  <div
                    className={`max-w-[90%] p-3.5 rounded-2xl text-xs leading-relaxed ${msg.sender === "user"
                      ? "bg-indigo-600 text-white rounded-br-none shadow-sm"
                      : "bg-white text-slate-800 border border-slate-200/80 rounded-bl-none shadow-xs"
                      }`}
                  >
                    {msg.sender === "user" ? (
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    ) : (
                      <div className="prose prose-xs max-w-none text-slate-800 space-y-2 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:text-indigo-900 [&_h3]:mt-1 [&_ul]:list-disc [&_ul]:pl-4 [&_strong]:font-semibold [&_strong]:text-slate-900 [&_p]:my-1">
                        <Markdown>{msg.text}</Markdown>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex flex-col items-start">
                  <div className="flex items-center gap-1.5 mb-1 px-1">
                    <span className="text-[10px] font-semibold text-indigo-600 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-indigo-500 animate-spin" /> Cadence Navigator
                    </span>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-none p-3 shadow-xs flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                    <span className="text-xs text-slate-500 font-medium">Consulting Grounded Knowledge Base...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Permanent Fixed Footer: Suggestions Tray + Input Form */}
            <div className="shrink-0 bg-white border-t border-slate-200 z-10">
              {/* Dynamic Suggestions Row */}
              <div className="px-3 py-2.5 bg-slate-50 border-b border-slate-200/80">
                <div className="flex items-center justify-between mb-1.5 px-0.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Suggested Questions
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-[96px] overflow-y-auto">
                  {activeSuggestions.map((q: string, idx: number) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSend(q)}
                      disabled={isLoading}
                      className="text-[11px] text-indigo-700 bg-white hover:bg-indigo-50 active:scale-95 border border-indigo-200 px-2.5 py-1 rounded-full text-left transition shadow-2xs font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                    >
                      <span className="text-xs">💡</span>
                      <span>{q}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Form Input Row */}
              <div className="p-3">
                <form
                  onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
                    e.preventDefault();
                    handleSend();
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={input}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about architecture, privacy, or issues..."
                    disabled={isLoading}
                    className="flex-1 text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition placeholder:text-slate-400"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 active:scale-95 disabled:opacity-40 disabled:hover:bg-indigo-600 transition shadow-xs flex items-center justify-center cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
                <div className="mt-1.5 text-center">
                  <span className="text-[10px] text-slate-400 font-mono">
                    Enterprise AI Cadence Desk • Grounded Navigator v1.0
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Action Button */}
      {!isOpen && (
        <motion.button
          onClick={() => setIsOpen(true)}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          id="btn-open-synchron-chatbot"
          className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-700 via-indigo-800 to-slate-900 text-white rounded-full shadow-xl hover:shadow-2xl border border-indigo-500/30 cursor-pointer group"
        >
          <div className="relative">
            <Bot className="w-5 h-5 text-indigo-200 group-hover:rotate-6 transition-transform" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>
          <span className="text-xs font-semibold tracking-wide pr-0.5">Cadence Navigator</span>
          <span className="p-1 bg-white/10 rounded-full text-indigo-200 group-hover:bg-white/20 transition">
            <Sparkles className="w-3.5 h-3.5" />
          </span>
        </motion.button>
      )}
    </div>
  );
};