'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ClientData {
  id: string;
  name: string;
  gender: string;
  current_phase: number;
  current_week: number;
  current_weight: number;
  goal_weight: number;
  starting_weight: number;
  program_type: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'coach';
  content: string;
  timestamp: Date;
  isMealLog?: boolean;
  isWeightLog?: boolean;
}

interface PendingMealData {
  id: string;
  mealType: string;
  mealDate: string;
  foodDescription: string;
  photoUrl?: string;
  analyzedText?: string;
  portionAdvice?: string;
  onPhase: boolean;
  messedUp?: boolean;
}

interface PendingWeightData {
  id: string;
  weight: number;
  bodyFatPercent?: number;
  pantSize?: string;
  waistSize?: string;
  weighDay?: string;
  previousWeight?: number;
  change?: number;
}

export default function ChatPage() {
  const router = useRouter();
  const [client, setClient] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const msgIdRef = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const userData = localStorage.getItem('client_user');
    const userType = localStorage.getItem('client_user_type');

    if (!userData || userType !== 'client') {
      router.push('/');
      return;
    }

    const user = JSON.parse(userData);
    setClient(user);

    // Load chat history from localStorage (use client-specific key to prevent cross-contamination)
    const chatKey = `chat_history_${user.id}`;
    const history = localStorage.getItem(chatKey);
    if (history) {
      try {
        const parsed = JSON.parse(history);
        setMessages(parsed.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        })));
      } catch (e) {
        // Invalid history, start fresh
      }
    } else {
      // Welcome message
      setMessages([{
        id: 'welcome',
        role: 'coach',
        content: "Hey! I'm your AI nutrition coach! 💪 Ask me anything about your meals, portions, or just chat! LEEETS GOOOO!",
        timestamp: new Date(),
      }]);
    }

    setLoading(false);
  }, [router]);

  // Process pending meal/weight data from sessionStorage
  useEffect(() => {
    if (!client || loading) return;

    const pendingMeal = sessionStorage.getItem('pending_meal_data');
    const pendingWeight = sessionStorage.getItem('pending_weight_data');

    if (pendingMeal) {
      sessionStorage.removeItem('pending_meal_data');
      const mealData: PendingMealData = JSON.parse(pendingMeal);
      processMealData(mealData);
      return;
    }

    if (pendingWeight) {
      sessionStorage.removeItem('pending_weight_data');
      const weightData: PendingWeightData = JSON.parse(pendingWeight);
      processWeightData(weightData);
      return;
    }
  }, [client, loading]);

  async function processMealData(mealData: PendingMealData) {
    setAnalyzing(true);

    // Format the meal description for display
    const dateStr = new Date(mealData.mealDate + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
    const status = mealData.messedUp ? '⚠️ Off Phase' : mealData.onPhase ? '✅ On Phase' : '❓ Review';
    const mealContent = `📸 ${mealData.mealType.toUpperCase()} — ${dateStr}\n${mealData.foodDescription}\n${status}`;

    // Add meal log as user message
    const userMessage: ChatMessage = {
      id: `meal_${mealData.id}_${Date.now()}`,
      role: 'user',
      content: mealContent,
      timestamp: new Date(),
      isMealLog: true,
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    saveHistory(updatedMessages);

    try {
      // If meal has coaching advice from the analyze endpoint (photo meals), use it
      // portionAdvice contains Chat AI's coaching analysis via getCoachPrompt (same as chat!)
      if (mealData.portionAdvice) {
        const coachMessage: ChatMessage = {
          id: `coach_meal_${Date.now()}`,
          role: 'coach',
          content: mealData.portionAdvice,
          timestamp: new Date(),
        };

        const allMessages = [...updatedMessages, coachMessage];
        setMessages(allMessages);
        saveHistory(allMessages);
        setAnalyzing(false);
        return;
      }

      // If no existing coaching (text-only meal from log tab), call chat API with mealData
      // This uses getCoachPrompt in the API (same prompt as chat!)
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': client!.id,
        },
        body: JSON.stringify({ 
          mealData: {
            mealType: mealData.mealType,
            foodDescription: mealData.foodDescription,
            onPhase: mealData.onPhase,
            messedUp: mealData.messedUp,
          }
        }),
      });

      const data = await res.json();

      const coachMessage: ChatMessage = {
        id: `coach_meal_${Date.now()}`,
        role: 'coach',
        content: data.response || "Got your meal! Stay on track! 💪",
        timestamp: new Date(),
      };

      const allMessages = [...updatedMessages, coachMessage];
      setMessages(allMessages);
      saveHistory(allMessages);
    } catch (err) {
      const errorMessage: ChatMessage = {
        id: `coach_error_${Date.now()}`,
        role: 'coach',
        content: "Got your meal logged! Keep crushing it! 💪",
        timestamp: new Date(),
      };
      const allMessages = [...updatedMessages, errorMessage];
      setMessages(allMessages);
      saveHistory(allMessages);
    } finally {
      setAnalyzing(false);
    }
  }

  async function processWeightData(weightData: PendingWeightData) {
    setAnalyzing(true);

    const dateStr = new Date().toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
    const change = weightData.change;
    const changeStr = change !== undefined
      ? change > 0 ? `📉 -${Math.abs(change).toFixed(1)} lbs`
      : change < 0 ? `📈 +${Math.abs(change).toFixed(1)} lbs`
      : '➡️ Same'
      : '';

    const weightContent = `⚖️ WEIGH-IN — ${dateStr}\n${weightData.weight} lbs ${changeStr}`;

    // Add weight log as user message
    const userMessage: ChatMessage = {
      id: `weight_${weightData.id}_${Date.now()}`,
      role: 'user',
      content: weightContent,
      timestamp: new Date(),
      isWeightLog: true,
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    saveHistory(updatedMessages);

    try {
      // Call chat API with weight data for AI commentary
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': client!.id,
        },
        body: JSON.stringify({ weightData }),
      });

      const data = await res.json();

      const coachMessage: ChatMessage = {
        id: `coach_weight_${Date.now()}`,
        role: 'coach',
        content: data.response || "Weight logged! Keep going! 💪",
        timestamp: new Date(),
      };

      const allMessages = [...updatedMessages, coachMessage];
      setMessages(allMessages);
      saveHistory(allMessages);
    } catch (err) {
      const errorMessage: ChatMessage = {
        id: `coach_error_${Date.now()}`,
        role: 'coach',
        content: "Weight recorded! You've got this! 💪",
        timestamp: new Date(),
      };
      const allMessages = [...updatedMessages, errorMessage];
      setMessages(allMessages);
      saveHistory(allMessages);
    } finally {
      setAnalyzing(false);
    }
  }

  function saveHistory(allMessages: ChatMessage[]) {
    if (!client) return;
    const chatKey = `chat_history_${client.id}`;
    localStorage.setItem(chatKey, JSON.stringify(allMessages));
  }

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(quickMessage?: string) {
    const messageContent = quickMessage || input.trim();
    if (!messageContent || sending) return;

    const msgId = ++msgIdRef.current;
    const userMessage: ChatMessage = {
      id: `user_${msgId}`,
      role: 'user',
      content: messageContent,
      timestamp: new Date(),
    };

    // Use functional update to avoid race condition
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setSending(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': client!.id,
        },
        body: JSON.stringify({ message: userMessage.content }),
      });

      const data = await res.json();

      if (data.response) {
        const coachMessage: ChatMessage = {
          id: `coach_${msgId}`,
          role: 'coach',
          content: data.response,
          timestamp: new Date(),
        };

        setMessages(prev => {
          const updated = [...prev, coachMessage];
          saveHistory(updated);
          return updated;
        });
      } else {
        const errorMessage: ChatMessage = {
          id: `coach_err_${msgId}`,
          role: 'coach',
          content: "Hmm, something went wrong. Try again in a sec! 💪",
          timestamp: new Date(),
        };
        setMessages(prev => {
          const updated = [...prev, errorMessage];
          saveHistory(updated);
          return updated;
        });
      }
    } catch (err) {
      const errorMessage: ChatMessage = {
        id: `coach_err_${msgId}`,
        role: 'coach',
        content: "Looks like we're disconnected. Check your internet and try again! 📡",
        timestamp: new Date(),
      };
      setMessages(prev => {
        const updated = [...prev, errorMessage];
        saveHistory(updated);
        return updated;
      });
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function clearChat() {
    if (!client) return;
    const chatKey = `chat_history_${client.id}`;
    setMessages([{
      id: 'welcome',
      role: 'coach',
      content: "Chat cleared! What do you need? Ask me about meals, portions, your progress, or just chat! 💪",
      timestamp: new Date(),
    }]);
    localStorage.removeItem(chatKey);
  }

  if (loading || !client) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-brand-orange text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 pt-[env(safe-area-inset-top)] flex items-center justify-between bg-brand-charcoal/90 backdrop-blur-sm sticky top-0 z-50">
        <Link href="/client" className="text-brand-cream/60 hover:text-brand-cream">
          ← Back
        </Link>
        <div className="text-center">
          <h1 className="text-lg font-semibold text-brand-cream">Coach Chat</h1>
          <p className="text-xs text-brand-cream/50">
            {analyzing ? 'Analyzing...' : 'AI Nutrition Coach'}
          </p>
        </div>
        <button
          onClick={clearChat}
          className="text-brand-cream/40 hover:text-brand-cream/80 text-sm"
        >
          Clear
        </button>
      </header>

      {/* Quick Actions */}
      <div className="px-4 py-2 pr-12 flex gap-2 overflow-x-auto bg-brand-charcoal/60 fixed top-[calc(64px+env(safe-area-inset-top))] left-0 right-0 z-40 scrollbar-hide">
        {['What can I eat?', 'Portion sizes?', 'Tips?', 'Motivate me!'].map((q) => (
          <button
            key={q}
            onClick={() => {
              setInput(q);
              handleSend(q);
            }}
            className="flex-shrink-0 px-3 py-1.5 rounded-full bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream/70 text-xs hover:border-brand-orange/50 transition-colors"
          >
            {q}
          </button>
        ))}
        {/* Gradient fade scroll indicator */}
        <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-brand-charcoal/60 to-transparent pointer-events-none" />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pt-[140px]">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                message.role === 'user'
                  ? message.isMealLog
                    ? 'bg-green-600/80 text-white rounded-br-md'
                    : message.isWeightLog
                    ? 'bg-blue-600/80 text-white rounded-br-md'
                    : 'bg-brand-orange text-white rounded-br-md'
                  : 'bg-brand-charcoal/80 border border-brand-cream/10 text-brand-cream rounded-bl-md'
              }`}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
              <p className={`text-xs mt-1 ${
                message.role === 'user' ? 'text-white/50' : 'text-brand-cream/30'
              }`}>
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        
        {(sending || analyzing) && (
          <div className="flex justify-start">
            <div className="bg-brand-charcoal/80 border border-brand-cream/10 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-brand-orange/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-brand-orange/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-brand-orange/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-brand-charcoal/95 backdrop-blur-sm border-t border-brand-cream/10 p-4 safe-bottom mb-[70px]">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask your coach..."
            className="flex-1 px-4 py-3 rounded-xl bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream placeholder-brand-cream/40 focus:outline-none focus:border-brand-orange resize-none"
            rows={1}
            style={{ maxHeight: '120px' }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || sending}
            className="px-4 py-3 rounded-xl bg-brand-orange text-white font-semibold hover:bg-brand-orange-dark transition-colors disabled:opacity-50 flex-shrink-0"
          >
            <span className="text-lg">💪</span>
          </button>
        </div>
        <p className="text-center text-xs text-brand-cream/30 mt-2">
          Press Enter to send
        </p>
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-brand-charcoal/95 backdrop-blur-sm border-t border-brand-cream/10 safe-bottom">
        <div className="flex justify-around py-3">
          <Link href="/client" className="flex flex-col items-center text-brand-cream/50 hover:text-brand-cream">
            <span className="text-xl">🏠</span>
            <span className="text-xs mt-1">Home</span>
          </Link>
          <Link href="/client/log" className="flex flex-col items-center text-brand-cream/50 hover:text-brand-cream">
            <span className="text-xl">📸</span>
            <span className="text-xs mt-1">Log</span>
          </Link>
          <Link href="/client/chat" className="flex flex-col items-center text-brand-orange">
            <span className="text-xl">💬</span>
            <span className="text-xs mt-1">Chat</span>
          </Link>
          <Link href="/client/weight" className="flex flex-col items-center text-brand-cream/50 hover:text-brand-cream">
            <span className="text-xl">⚖️</span>
            <span className="text-xs mt-1">Weight</span>
          </Link>
          <Link href="/client/profile" className="flex flex-col items-center text-brand-cream/50 hover:text-brand-cream">
            <span className="text-xl">👤</span>
            <span className="text-xs mt-1">Profile</span>
          </Link>
        </div>
      </nav>
    </main>
  );
}
