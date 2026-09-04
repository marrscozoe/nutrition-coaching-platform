'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SUPPLEMENTS } from '@/lib/nutrition-data';

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
  mealDbId?: string; // Database ID of the meal for editing
}

interface PendingMealData {
  id: string;
  mealType: string;
  mealDate: string;
  foodDescription: string;
  photoUrl?: string;
  analyzedText?: string;
  portionAdvice?: string;
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
  const [showSupplements, setShowSupplements] = useState(false);
  const [chatClearedAt, setChatClearedAt] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const msgIdRef = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Meal edit state
  const [editingMeal, setEditingMeal] = useState<{ messageId: string; mealDbId: string; mealType: string; foodDescription: string } | null>(null);
  const [editMealType, setEditMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('lunch');
  const [editFoodDescription, setEditFoodDescription] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

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
    // Returns the messages to be prepended/appended by the caller (to avoid race conditions)
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
          const mealContent = `📸 ${pendingMealData.mealType.toUpperCase()} — ${dateStr}\n${pendingMealData.foodDescription}`;

          const userMessage: ChatMessage = {
            id: `meal_${pendingMealData.id}_${Date.now()}`,
            role: 'user',
            content: mealContent,
            timestamp: new Date(),
            isMealLog: true,
            mealDbId: pendingMealData.id,
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

          // Return the new messages to be appended by the caller
          return { mode: 'append', messages: newMessages };
        }

        // No pending meal - load from database as usual
        const meals = data.meals || [];
        
        // API returns meals newest-first (ascending: false), but we want oldest first
        // (newest at bottom of chat), so reverse the array
        const reversedMeals = [...meals].reverse();
        
        // Build set of meal IDs already in sessionStorage to avoid duplicates
        const chatKey = `chat_history_${user.id}`;
        const storedHistory = sessionStorage.getItem(chatKey);
        let existingMealIds = new Set<string>();
        if (storedHistory) {
          try {
            const parsed = JSON.parse(storedHistory);
            // Extract meal IDs from sessionStorage messages (format: meal-{id}-user)
            parsed.forEach((m: any) => {
              if (m.isMealLog && m.id && m.id.startsWith('meal-')) {
                // ID format: meal-{id}-user or meal_{id}_{timestamp}
                const parts = m.id.replace('meal-', 'meal_').split('_');
                if (parts.length >= 2) existingMealIds.add(parts[1]);
              }
            });
          } catch (e) { /* ignore */ }
        }
        
        // Convert past meals to chat messages and add to history
        // Skip meals already in sessionStorage to prevent duplicates
        const pastMessages: ChatMessage[] = [];
        reversedMeals.forEach((meal: any) => {
          // Skip if this meal is already in sessionStorage
          if (existingMealIds.has(String(meal.id))) return;
          
          // Format the meal with proper display - use meal_date (user-selected) if available,
          // otherwise fall back to logged_at for backwards compatibility
          let dateStr: string;
          if (meal.meal_date) {
            // meal_date is YYYY-MM-DD from database, parse it to avoid timezone shifts
            dateStr = new Date(meal.meal_date + 'T12:00:00').toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric'
            });
          } else {
            // Fallback to logged_at for backwards compatibility with old meals
            dateStr = new Date(meal.logged_at).toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric'
            });
          }
          // Derive meal type from food description if not available
          const mealType = meal.meal_type || 'MEAL';
          const mealContent = `📸 ${mealType.toUpperCase()} — ${dateStr}\n${meal.food_description || 'Logged a meal'}`;
          
          pastMessages.push({
            id: `meal-${meal.id}-user`,
            role: 'user' as const,
            content: mealContent,
            timestamp: new Date(meal.logged_at),
            isMealLog: true,
            mealDbId: meal.id,
          });
          pastMessages.push({
            id: `meal-${meal.id}-coach`,
            role: 'coach' as const,
            content: meal.portion_advice || (meal.on_phase ? "Nice! You're on track! 💪" : "Keep pushing! You've got this! 💪"),
            timestamp: new Date(new Date(meal.logged_at).getTime() + 1000),
          });
        });
        
        // Return past messages to be prepended by the caller
        return { mode: 'prepend', messages: pastMessages };
      } catch (err) {
        console.error('Failed to load past meals:', err);
        return { mode: 'none', messages: [] };
      }
    }

    // Fetch coach messages from database
    // Returns the messages to be appended by the caller (to avoid race conditions)
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

        // Return coach messages to be appended by the caller
        return coachChatMessages;
      } catch (err) {
        console.error('Failed to load coach messages:', err);
        return [];
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
      
      // Load past meals - returns { mode, messages } to avoid race conditions
      const mealResult = await loadPastMeals(pendingMealData);
      
      // Load coach messages if chat was NOT cleared
      let coachMessages: ChatMessage[] = [];
      if (!chatClearedSession && !clearedAt) {
        coachMessages = await loadCoachMessages();
        // Clear the sessionStorage flag after successful load so future visits WILL load coach messages
        sessionStorage.removeItem(`chat_cleared_${user.id}`);
      } else if (chatClearedSession) {
        // Chat was cleared in this session - clear the sessionStorage flag
        // so future visits WILL load coach messages (unless DB flag is also set)
        sessionStorage.removeItem(`chat_cleared_${user.id}`);
      }
      
      // Build the final message array with a single setMessages call to avoid race conditions
      // Read current messages from sessionStorage (already saved before this useEffect ran)
      const chatKey = `chat_history_${user.id}`;
      const storedHistory = sessionStorage.getItem(chatKey);
      let currentMessages: ChatMessage[] = [];
      if (storedHistory) {
        try {
          currentMessages = JSON.parse(storedHistory).map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp),
          }));
        } catch (e) {
          // Invalid history, start fresh
        }
      }
      
      // Apply meal messages (prepend or append based on mode)
      let allMessages: ChatMessage[];
      if (mealResult.mode === 'prepend' && mealResult.messages.length > 0) {
        allMessages = [...mealResult.messages, ...currentMessages];
      } else if (mealResult.mode === 'append' && mealResult.messages.length > 0) {
        allMessages = [...currentMessages, ...mealResult.messages];
      } else {
        allMessages = currentMessages;
      }
      
      // Append coach messages
      if (coachMessages.length > 0) {
        allMessages = [...allMessages, ...coachMessages];
      }
      
      // Set messages and save to sessionStorage in a single operation
      if (allMessages.length > 0) {
        setMessages(allMessages);
        sessionStorage.setItem(chatKey, JSON.stringify(allMessages));
      }
      
      setLoading(false);
    });
  }, [router]);

  // Process pending weight data from sessionStorage
  // NOTE: pending meal data is handled by loadPastMeals in the first useEffect above
  // to avoid duplicates (loadPastMeals runs in .then() after loadChatClearedFlag)
  useEffect(() => {
    if (!client || loading) return;

    const pendingWeight = sessionStorage.getItem('pending_weight_data');

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
    const mealContent = `📸 ${mealData.mealType.toUpperCase()} — ${dateStr}\n${mealData.foodDescription}`;

    // Add meal log as user message
    const userMessage: ChatMessage = {
      id: `meal_${mealData.id}_${Date.now()}`,
      role: 'user',
      content: mealContent,
      timestamp: new Date(),
      isMealLog: true,
      mealDbId: mealData.id,
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

  // Open edit modal for a meal log
  function openEditMealModal(messageId: string, mealDbId: string, currentContent: string) {
    // Parse the current content to extract meal type and food description
    // Format: "📸 MEAL_TYPE — date\nfood description"
    const lines = currentContent.split('\n');
    const firstLine = lines[0]; // "📸 MEAL_TYPE — date"
    const foodDesc = lines.slice(1).join('\n');
    
    // Extract meal type from first line
    const mealTypeMatch = firstLine.match(/📸\s*(\w+)/i);
    const mealType = (mealTypeMatch ? mealTypeMatch[1].toLowerCase() : 'lunch') as 'breakfast' | 'lunch' | 'dinner' | 'snack';
    
    setEditingMeal({ messageId, mealDbId, mealType, foodDescription: foodDesc });
    setEditMealType(mealType);
    setEditFoodDescription(foodDesc);
  }

  function closeEditMealModal() {
    setEditingMeal(null);
    setEditMealType('lunch');
    setEditFoodDescription('');
  }

  async function saveMealEdit() {
    if (!editingMeal || !client) return;
    
    setSavingEdit(true);
    try {
      const res = await fetch('/api/meals', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': client.id,
        },
        body: JSON.stringify({
          mealId: editingMeal.mealDbId,
          mealType: editMealType,
          foodDescription: editFoodDescription,
        }),
      });
      
      if (res.ok) {
        // Capture the updated messages before calling setMessages to avoid stale closure
        const dateMatch = messages.find(m => m.id === editingMeal.messageId)?.content.match(/—([^\n]+)/);
        const dateStr = dateMatch ? dateMatch[1].trim() : '';
        const newContent = `📸 ${editMealType.toUpperCase()} — ${dateStr}\n${editFoodDescription}`;
        
        const updatedMessages = messages.map(m => 
          m.id === editingMeal.messageId 
            ? { ...m, content: newContent } 
            : m
        );
        
        // Update state and sessionStorage with the captured updated messages
        setMessages(updatedMessages);
        const chatKey = `chat_history_${client.id}`;
        sessionStorage.setItem(chatKey, JSON.stringify(updatedMessages));
        
        closeEditMealModal();
      } else {
        alert('Failed to update meal. Please try again.');
      }
    } catch (err) {
      console.error('Failed to update meal:', err);
      alert('Failed to update meal. Please check your connection.');
    } finally {
      setSavingEdit(false);
    }
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
        {['What can I eat?', 'Portion sizes?', 'Tips?', 'Motivate me!', '💊 Supplements'].map((q) => (
          <button
            key={q}
            onClick={() => {
              if (q === '💊 Supplements') {
                setShowSupplements(true);
              } else {
                setInput(q);
                handleSend(q);
              }
            }}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full bg-brand-charcoal/80 border text-xs hover:border-brand-orange/50 transition-colors ${
              q === '💊 Supplements'
                ? 'border-brand-orange/50 text-brand-orange'
                : 'border-brand-cream/20 text-brand-cream/70'
            }`}
          >
            {q}
          </button>
        ))}
        {/* Gradient fade scroll indicator */}
        <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-brand-charcoal/60 to-transparent pointer-events-none" />
      </div>

      {/* Supplements Modal */}
      {showSupplements && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowSupplements(false)} />
          <div className="relative w-full sm:max-w-md bg-brand-charcoal border border-brand-cream/20 rounded-t-2xl sm:rounded-2xl p-5 pb-8 sm:pb-5 mb-[70px] sm:mb-0 max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-brand-cream">💊 Your Supplements</h2>
              <button
                onClick={() => setShowSupplements(false)}
                className="text-brand-cream/50 hover:text-brand-cream text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <ul className="space-y-3">
              {SUPPLEMENTS.map((supplement, i) => (
                <li key={i} className="flex items-start gap-3 p-3 rounded-lg bg-brand-charcoal/60 border border-brand-cream/10">
                  <span className="text-brand-orange mt-0.5">•</span>
                  <span className="text-sm text-brand-cream/90 leading-relaxed">{supplement}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-brand-cream/40 text-center">Tap outside to close</p>
          </div>
        </div>
      )}

      {/* Edit Meal Modal */}
      {editingMeal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-brand-charcoal rounded-2xl p-6 w-full max-w-md border border-brand-cream/20">
            <h3 className="text-lg font-semibold text-brand-cream mb-4">✏️ Edit Meal</h3>
            
            {/* Meal Type Selector */}
            <div className="mb-4">
              <label className="block text-sm text-brand-cream/60 mb-2">Meal</label>
              <div className="grid grid-cols-4 gap-2">
                {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setEditMealType(type)}
                    className={`py-2 px-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                      editMealType === type
                        ? 'bg-brand-orange text-white'
                        : 'bg-brand-charcoal/80 text-brand-cream/60'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Food Description */}
            <div className="mb-6">
              <label className="block text-sm text-brand-cream/60 mb-2">What did you eat?</label>
              <textarea
                value={editFoodDescription}
                onChange={(e) => setEditFoodDescription(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream placeholder-brand-cream/40 focus:outline-none focus:border-brand-orange resize-none"
                placeholder="Describe your meal..."
                rows={3}
              />
            </div>
            
            <div className="flex gap-3">
              <button
                type="button"
                onClick={closeEditMealModal}
                className="flex-1 py-3 rounded-xl bg-brand-charcoal/80 text-brand-cream font-medium hover:bg-brand-charcoal transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveMealEdit}
                disabled={savingEdit || !editFoodDescription.trim()}
                className="flex-1 py-3 rounded-xl bg-brand-orange text-white font-semibold hover:bg-brand-orange-dark transition-colors disabled:opacity-50"
              >
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

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
              <div className="flex items-center justify-between mt-1">
                <p className={`text-xs ${
                  message.role === 'user' ? 'text-white/50' : 'text-brand-cream/30'
                }`}>
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
                {message.role === 'user' && message.isMealLog && message.mealDbId && (
                  <button
                    onClick={() => openEditMealModal(message.id, message.mealDbId!, message.content)}
                    className="text-xs hover:opacity-80 ml-2"
                    style={{ color: 'rgba(255,255,255,0.6)' }}
                    title="Edit meal"
                  >
                    ✏️
                  </button>
                )}
              </div>
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
          <Link href="/client/grocery" className="flex flex-col items-center text-brand-cream/50 hover:text-brand-cream">
            <span className="text-xl">🛒</span>
            <span className="text-xs mt-1">Grocery</span>
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
