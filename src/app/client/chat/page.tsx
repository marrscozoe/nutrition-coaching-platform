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
  coachMessage?: {
    id: string;
    content: string;
    message_type: string;
    created_at: string;
  } | null;
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
  const [showWelcome, setShowWelcome] = useState(false);
  const [chatClearedAt, setChatClearedAt] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const msgIdRef = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const userData = sessionStorage.getItem('client_user');
    const userType = sessionStorage.getItem('client_user_type');

    if (!userData || userType !== 'client') {
      router.push('/');
      return;
    }

    const user = JSON.parse(userData);
    setClient(user);

    // Load chat history from sessionStorage (use client-specific key to prevent cross-contamination)
    const chatKey = `chat_history_${user.id}`;
    const history = sessionStorage.getItem(chatKey);
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
      // Show welcome intro at the top, not in messages
      setShowWelcome(true);
    }

    // Fetch past meals from database and add to chat history
    async function loadPastMeals(pendingMealData: PendingMealData | null) {
      try {
        const res = await fetch(`/api/meals?limit=20`, {
          headers: { 'x-client-id': user.id },
        });
        const data = await res.json();
        
        // If we have a pending meal (just logged), add it to chat with proper formatting
        // instead of letting processMealData add it (which causes duplicates)
        if (pendingMealData) {
          const dateStr = new Date(pendingMealData.mealDate + 'T12:00:00').toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
          });
          const status = pendingMealData.messedUp ? '⚠️ Off Phase' : pendingMealData.onPhase ? '✅ On Phase' : '❓ Review';
          const mealContent = `📸 ${pendingMealData.mealType.toUpperCase()} — ${dateStr}\n${pendingMealData.foodDescription}\n${status}`;

          const userMessage: ChatMessage = {
            id: `meal_${pendingMealData.id}_${Date.now()}`,
            role: 'user',
            content: mealContent,
            timestamp: new Date(),
            isMealLog: true,
          };

          // Get coach message content
          let coachContent = pendingMealData.portionAdvice || "Got your meal! Stay on track! 💪";
          // If no portionAdvice, we need to call the AI
          if (!pendingMealData.portionAdvice) {
            try {
              const aiRes = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-client-id': user.id,
                },
                body: JSON.stringify({
                  mealData: {
                    mealType: pendingMealData.mealType,
                    foodDescription: pendingMealData.foodDescription,
                    onPhase: pendingMealData.onPhase,
                    messedUp: pendingMealData.messedUp,
                  }
                }),
              });
              const aiData = await aiRes.json();
              coachContent = aiData.response || "Got your meal! Stay on track! 💪";
            } catch (err) {
              coachContent = "Got your meal logged! Keep crushing it! 💪";
            }
          }

          const coachMessage: ChatMessage = {
            id: `coach_meal_${Date.now()}`,
            role: 'coach',
            content: coachContent,
            timestamp: new Date(new Date().getTime() + 1000),
          };

          const newMessages = [userMessage, coachMessage];

          // Add GENERAL_HEALTH alert if present
          if (pendingMealData.coachMessage) {
            const alertMsg: ChatMessage = {
              id: `coach_alert_${pendingMealData.coachMessage.id || Date.now()}`,
              role: 'coach',
              content: pendingMealData.coachMessage.content,
              timestamp: new Date(new Date(pendingMealData.coachMessage.created_at).getTime() + 2000),
            };
            newMessages.push(alertMsg);
          }

          setMessages(prev => {
            // Append new meal to the END (bottom of chat) for normal chat behavior
            const updated = [...prev, ...newMessages];
            saveHistory(updated);
            return updated;
          });
          // Return early - don't also load from DB (which would cause duplicate)
          return;
        }

        // No pending meal - load from database as usual
        const meals = data.meals || [];
        
        // Convert past meals to chat messages and add to history
        const pastMessages: ChatMessage[] = meals.map((meal: any) => [
          {
            id: `meal-${meal.id}-user`,
            role: 'user' as const,
            content: meal.food_description || 'Logged a meal',
            timestamp: new Date(meal.logged_at),
            isMealLog: true,
          },
          {
            id: `meal-${meal.id}-coach`,
            role: 'coach' as const,
            content: meal.portion_advice || (meal.on_phase ? "Nice! You're on track! 💪" : "Keep pushing! You've got this! 💪"),
            timestamp: new Date(new Date(meal.logged_at).getTime() + 1000),
          }
        ]).flat();
        
        if (pastMessages.length > 0) {
          // Add to beginning of chat history (oldest first)
          setMessages(prev => [...pastMessages, ...prev]);
        }
      } catch (err) {
        console.error('Failed to load past meals:', err);
      }
    }

    // Fetch coach messages from database and add to chat history
    async function loadCoachMessages() {
      try {
        const res = await fetch(`/api/coach-messages`, {
          headers: { 'x-client-id': user.id },
        });
        const data = await res.json();
        const coachMsgs = data.messages || [];

        // Convert coach messages to chat messages
        const coachChatMessages: ChatMessage[] = coachMsgs.map((msg: any) => ({
          id: `coach-msg-${msg.id}`,
          role: 'coach' as const,
          content: msg.content,
          timestamp: new Date(msg.created_at),
        }));

        if (coachChatMessages.length > 0) {
          // Add to beginning of chat history (oldest first)
          setMessages(prev => [...coachChatMessages, ...prev]);
        }
      } catch (err) {
        console.error('Failed to load coach messages:', err);
      }
    }

    // Check if chat was cleared - check both sessionStorage (current session) and DB (persisted)
    const chatClearedSession = sessionStorage.getItem(`chat_cleared_${user.id}`);

    // Also check DB for persisted chat_cleared_at flag
    async function loadChatClearedFlag() {
      try {
        const res = await fetch(`/api/chat-clear`, {
          headers: { 'x-client-id': user.id },
        });
        const data = await res.json();
        return data.clearedAt || null;
      } catch (err) {
        console.error('Failed to load chat cleared flag:', err);
        return null;
      }
    }

    // Load chat cleared flag from DB and then conditionally load past data
    // Use Promise.all to properly await both async functions and avoid race conditions
    // IMPORTANT: Read pending_meal_data BEFORE loadPastMeals runs to avoid duplicate
    const pendingMeal = sessionStorage.getItem('pending_meal_data');
    const pendingMealData = pendingMeal ? JSON.parse(pendingMeal) : null;
    // Clear it early so processMealData won't also add it (we'll add it via loadPastMeals with proper formatting)
    if (pendingMeal) {
      sessionStorage.removeItem('pending_meal_data');
    }

    loadChatClearedFlag().then(async (clearedAt: string | null) => {
      setChatClearedAt(clearedAt);
      // Past meals are historical record - ALWAYS load them regardless of clear status
      // Pass pendingMealData so loadPastMeals can properly format and add the just-logged meal
      await loadPastMeals(pendingMealData);
      // Only load coach messages if chat was NOT cleared (coach messages are conversation, not history)
      if (!chatClearedSession && !clearedAt) {
        await loadCoachMessages();
        // Clear the sessionStorage flag after successful load so future visits WILL load coach messages
        sessionStorage.removeItem(`chat_cleared_${user.id}`);
      } else if (chatClearedSession) {
        // Chat was cleared in this session - clear the sessionStorage flag
        // so future visits WILL load coach messages (unless DB flag is also set)
        sessionStorage.removeItem(`chat_cleared_${user.id}`);
      }
      setLoading(false);
    });
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

    // Helper to add coach messages and optionally the GENERAL_HEALTH alert
    const addCoachMessages = (coachContent: string, isError = false) => {
      let allMessages = [...updatedMessages];
      const coachMsg: ChatMessage = {
        id: isError ? `coach_error_${Date.now()}` : `coach_meal_${Date.now()}`,
        role: 'coach',
        content: coachContent,
        timestamp: new Date(),
      };
      allMessages.push(coachMsg);

      // Add GENERAL_HEALTH alert if present
      if (mealData.coachMessage) {
        const alertMsg: ChatMessage = {
          id: `coach_alert_${mealData.coachMessage.id || Date.now()}`,
          role: 'coach',
          content: mealData.coachMessage.content,
          timestamp: new Date(new Date(mealData.coachMessage.created_at).getTime() + 1000),
        };
        allMessages.push(alertMsg);
      }

      setMessages(allMessages);
      saveHistory(allMessages);
    };

    try {
      // If meal has coaching advice from the analyze endpoint (photo meals), use it
      // portionAdvice contains Chat AI's coaching analysis via getCoachPrompt (same as chat!)
      if (mealData.portionAdvice) {
        addCoachMessages(mealData.portionAdvice);
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
      addCoachMessages(data.response || "Got your meal! Stay on track! 💪");
    } catch (err) {
      addCoachMessages("Got your meal logged! Keep crushing it! 💪", true);
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
      // First, save the weight to the database (same as Weight tab does)
      const weightRes = await fetch('/api/weight', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': client!.id,
        },
        body: JSON.stringify({
          weight: weightData.weight,
          bodyFatPercent: weightData.bodyFatPercent || null,
          pantSize: weightData.pantSize || null,
          waistSize: weightData.waistSize || null,
          weighDay: weightData.weighDay || null,
        }),
      });
      const weightDataRes = await weightRes.json();

      // Then, call chat API with weight data for AI commentary
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': client!.id,
        },
        body: JSON.stringify({ weightData }),
      });

      const data = await res.json();

      let allMessages = [...updatedMessages];

      const coachMessage: ChatMessage = {
        id: `coach_weight_${Date.now()}`,
        role: 'coach',
        content: data.response || "Weight logged! Keep going! 💪",
        timestamp: new Date(),
      };
      allMessages.push(coachMessage);

      // Add GENERAL_HEALTH alert if present
      if (weightDataRes.coachMessage) {
        const alertMsg: ChatMessage = {
          id: `coach_alert_${weightDataRes.coachMessage.id || Date.now()}`,
          role: 'coach',
          content: weightDataRes.coachMessage.content,
          timestamp: new Date(new Date(weightDataRes.coachMessage.created_at).getTime() + 1000),
        };
        allMessages.push(alertMsg);
      }

      setMessages(allMessages);
      saveHistory(allMessages);
    } catch (err) {
      let allMessages = [...updatedMessages];
      const errorMessage: ChatMessage = {
        id: `coach_error_${Date.now()}`,
        role: 'coach',
        content: "Weight recorded! You've got this! 💪",
        timestamp: new Date(),
      };
      allMessages.push(errorMessage);
      setMessages(allMessages);
      saveHistory(allMessages);
    } finally {
      setAnalyzing(false);
    }
  }

  function saveHistory(allMessages: ChatMessage[]) {
    if (!client) return;
    const chatKey = `chat_history_${client.id}`;
    sessionStorage.setItem(chatKey, JSON.stringify(allMessages));
  }

  // Scroll to bottom helper - uses requestAnimationFrame to ensure DOM is updated
  const scrollToBottom = (behavior: ScrollBehavior = 'instant') => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior });
    });
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom('instant');
    }
  }, [messages]);

  // Auto-scroll to bottom when component mounts AND loading is complete
  useEffect(() => {
    if (!loading && messages.length > 0) {
      // Wait for DOM to fully render before scrolling
      requestAnimationFrame(() => {
        scrollToBottom('instant');
      });
    }
  }, [loading, messages.length]);

  // Auto-scroll when tab becomes visible again (user returns to chat)
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Wait for next paint cycle to ensure DOM is updated
        timeoutId = setTimeout(() => {
          scrollToBottom('instant');
        }, 50);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearTimeout(timeoutId);
    };
  }, []);

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

  async function clearChat() {
    if (!client) return;
    
    // Show confirmation dialog
    const confirmed = window.confirm(
      '⚠️ Clear All Data?\n\n' +
      'This will permanently delete:\n' +
      '• All chat messages\n' +
      '• All meal logs\n' +
      '• All weight entries\n' +
      '• All coach messages\n\n' +
      'This cannot be undone!'
    );
    
    if (!confirmed) return;
    
    const chatKey = `chat_history_${client.id}`;
    
    // Call the clear-user-data API to delete everything from the database
    try {
      const res = await fetch(`/api/clear-user-data`, {
        method: 'POST',
        headers: { 'x-client-id': client.id },
      });
      
      if (!res.ok) {
        console.error('Failed to clear user data from API');
        alert('Failed to clear some data. Please try again.');
        return;
      }
    } catch (err) {
      console.error('Failed to clear user data:', err);
      alert('Failed to clear data. Please check your connection and try again.');
      return;
    }
    
    // Clear messages and sessionStorage
    setMessages([]);
    setShowWelcome(false);
    sessionStorage.removeItem(chatKey);
    // Clear session flag
    sessionStorage.removeItem(`chat_cleared_${client.id}`);
    // Update local state to reflect cleared status
    setChatClearedAt(new Date().toISOString());
    
    // Reload page to get fresh state
    window.location.reload();
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
        {/* Welcome intro - pinned at top */}
        {showWelcome && (
          <div className="mb-4 p-4 rounded-xl bg-gradient-to-r from-brand-orange/20 to-brand-orange/10 border border-brand-orange/30">
            <p className="text-sm text-brand-cream font-medium mb-2">👋 Hey! I'm your AI nutrition coach!</p>
            <p className="text-xs text-brand-cream/70">Ask me anything about your meals or portions!</p>
          </div>
        )}
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
