// Auth utility functions
import { supabase } from './supabase';

// Session persistence constants
const SESSION_DAYS = 30;
const SESSION_KEY_PREFIX = 'ncp_session_';
const TRAINER_SESSION_KEY = `${SESSION_KEY_PREFIX}trainer`;
const CLIENT_SESSION_KEY = `${SESSION_KEY_PREFIX}client`;

export interface SessionData {
  user: any;
  userType: 'trainer' | 'client';
  expiresAt: number; // Unix timestamp in ms
}

/**
 * Store a session in localStorage with 30-day expiration
 * Also updates sessionStorage for backwards compatibility with existing code
 */
function storeSession(user: any, userType: 'trainer' | 'client'): void {
  const now = Date.now();
  const expiresAt = now + (SESSION_DAYS * 24 * 60 * 60 * 1000);
  const session: SessionData = { user, userType, expiresAt };
  
  if (userType === 'trainer') {
    localStorage.setItem(TRAINER_SESSION_KEY, JSON.stringify(session));
    localStorage.setItem('trainer_user', JSON.stringify(user));
    localStorage.setItem('trainer_user_type', 'trainer');
    sessionStorage.setItem('trainer_user', JSON.stringify(user));
    sessionStorage.setItem('trainer_user_type', 'trainer');
  } else {
    localStorage.setItem(CLIENT_SESSION_KEY, JSON.stringify(session));
    localStorage.setItem('client_user', JSON.stringify(user));
    localStorage.setItem('client_user_type', 'client');
    sessionStorage.setItem('client_user', JSON.stringify(user));
    sessionStorage.setItem('client_user_type', 'client');
  }
  
}

/**
 * Retrieve a valid session from localStorage (checks expiration)
 * Also syncs to sessionStorage for backwards compatibility with existing code
 */
function getStoredSession(userType: 'trainer' | 'client'): SessionData | null {
  const key = userType === 'trainer' ? TRAINER_SESSION_KEY : CLIENT_SESSION_KEY;
  const stored = localStorage.getItem(key);
  
  if (!stored) return null;
  
  try {
    const session: SessionData = JSON.parse(stored);
    const now = Date.now();
    
    // Check if session has expired
    if (session.expiresAt && now > session.expiresAt) {
      // Session expired - clear it
      localStorage.removeItem(key);
      sessionStorage.removeItem(userType === 'trainer' ? 'trainer_user' : 'client_user');
      sessionStorage.removeItem(userType === 'trainer' ? 'trainer_user_type' : 'client_user_type');
      return null;
    }
    
    // Sync to sessionStorage for backwards compatibility
    if (userType === 'trainer') {
      sessionStorage.setItem('trainer_user', JSON.stringify(session.user));
      sessionStorage.setItem('trainer_user_type', 'trainer');
    } else {
      sessionStorage.setItem('client_user', JSON.stringify(session.user));
      sessionStorage.setItem('client_user_type', 'client');
    }
    
    return session;
  } catch {
    return null;
  }
}

/**
 * Clear a specific session from localStorage
 */
function clearSession(userType: 'trainer' | 'client'): void {
  const key = userType === 'trainer' ? TRAINER_SESSION_KEY : CLIENT_SESSION_KEY;
  localStorage.removeItem(key);
}

/**
 * Clear all sessions (both trainer and client)
 */
function clearAllSessions(): void {
  localStorage.removeItem(TRAINER_SESSION_KEY);
  localStorage.removeItem(CLIENT_SESSION_KEY);
}

/**
 * Extend session expiration by another 30 days (called on activity)
 */
function extendSession(userType: 'trainer' | 'client'): void {
  const session = getStoredSession(userType);
  if (session) {
    storeSession(session.user, userType);
  }
}

export async function logout(): Promise<void> {
  try {
    // Clear persistent sessions (30-day)
    clearAllSessions();
    
    // Clear all user session data from localStorage (persists across tabs)
    localStorage.removeItem('trainer_user');
    localStorage.removeItem('trainer_user_type');
    localStorage.removeItem('client_user');
    localStorage.removeItem('client_user_type');
    localStorage.removeItem('user'); // Legacy key cleanup
    localStorage.removeItem('userType'); // Legacy key cleanup
    
    // Clear sessionStorage (per-tab session)
    sessionStorage.removeItem('trainer_user');
    sessionStorage.removeItem('trainer_user_type');
    sessionStorage.removeItem('client_user');
    sessionStorage.removeItem('client_user_type');
    sessionStorage.removeItem('user'); // Legacy key cleanup
    sessionStorage.removeItem('userType'); // Legacy key cleanup
    // Clear chat history keys
    sessionStorage.removeItem('pending_meal_data');
    sessionStorage.removeItem('pending_weight_data');
    // Clear chat cleared flags
    const keysToRemove = Object.keys(sessionStorage).filter(k => k.startsWith('chat_cleared_'));
    keysToRemove.forEach(k => sessionStorage.removeItem(k));
    
    // Clear chat history for the current user type
    const trainerData = localStorage.getItem('trainer_user');
    const trainerType = localStorage.getItem('trainer_user_type');
    const clientData = localStorage.getItem('client_user');
    const clientType = localStorage.getItem('client_user_type');

    if (trainerData && trainerType === 'trainer') {
      try {
        const trainer = JSON.parse(trainerData);
        localStorage.removeItem(`chat_history_trainer_${trainer.id}`);
      } catch (e) {
        // ignore parse errors
      }
    }
    if (clientData && clientType === 'client') {
      try {
        const client = JSON.parse(clientData);
        localStorage.removeItem(`chat_history_${client.id}`);
      } catch (e) {
        // ignore parse errors
      }
    }
    
    // Sign out from Supabase (clears any auth session)
    await supabase.auth.signOut();
    
    // Small delay to ensure cleanup completes
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Clear sessionStorage right before redirect (belt-and-suspenders)
    sessionStorage.clear();
    
    // Redirect to home using replace() so back button doesn't return to dashboard
    window.location.replace('/');
  } catch (error) {
    console.error('Logout error:', error);
    // Even if signOut fails, still redirect
    window.location.href = '/';
  }
}

export function getCurrentUser(): { user: any; userType: string | null } | null {
  try {
    // Check for valid persistent session first (30-day)
    const trainerSession = getStoredSession('trainer');
    if (trainerSession) {
      // Extend session on activity
      extendSession('trainer');
      return {
        user: trainerSession.user,
        userType: 'trainer'
      };
    }
    
    const clientSession = getStoredSession('client');
    if (clientSession) {
      // Extend session on activity
      extendSession('client');
      return {
        user: clientSession.user,
        userType: 'client'
      };
    }
    
    // Fallback to legacy localStorage keys
    const trainerData = localStorage.getItem('trainer_user');
    const trainerType = localStorage.getItem('trainer_user_type');
    if (trainerData && trainerType === 'trainer') {
      try {
        // Migrate legacy session to new format
        storeSession(JSON.parse(trainerData), 'trainer');
        return {
          user: JSON.parse(trainerData),
          userType: 'trainer'
        };
      } catch {
        // Legacy data is malformed, clear and continue
        localStorage.removeItem('trainer_user');
        localStorage.removeItem('trainer_user_type');
      }
    }
    
    // Check client session
    const clientData = localStorage.getItem('client_user');
    const clientType = localStorage.getItem('client_user_type');
    if (clientData && clientType === 'client') {
      try {
        // Migrate legacy session to new format
        storeSession(JSON.parse(clientData), 'client');
        return {
          user: JSON.parse(clientData),
          userType: 'client'
        };
      } catch {
        // Legacy data is malformed, clear and continue
        localStorage.removeItem('client_user');
        localStorage.removeItem('client_user_type');
      }
    }
    
    // Legacy support: check old keys
    const userData = localStorage.getItem('user');
    const userType = localStorage.getItem('userType');
    if (userData && userType) {
      try {
        return {
          user: JSON.parse(userData),
          userType
        };
      } catch {
        // Legacy data is malformed, clear and continue
        localStorage.removeItem('user');
        localStorage.removeItem('userType');
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  const currentUser = getCurrentUser();
  return currentUser !== null;
}

export function getTrainerUser(): { user: any } | null {
  try {
    // Check for valid persistent session first
    const session = getStoredSession('trainer');
    if (session) {
      extendSession('trainer');
      return { user: session.user };
    }
    
    // Fallback to legacy localStorage
    const trainerData = localStorage.getItem('trainer_user');
    if (trainerData) {
      const user = JSON.parse(trainerData);
      // Migrate legacy session to new format
      storeSession(user, 'trainer');
      return { user };
    }
    return null;
  } catch {
    return null;
  }
}

export function getClientUser(): { user: any } | null {
  try {
    // Check for valid persistent session first
    const session = getStoredSession('client');
    if (session) {
      extendSession('client');
      return { user: session.user };
    }
    
    // Fallback to legacy localStorage
    const clientData = localStorage.getItem('client_user');
    if (clientData) {
      const user = JSON.parse(clientData);
      // Migrate legacy session to new format
      storeSession(user, 'client');
      return { user };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Save user after successful login - stores with 30-day expiration
 */
export function saveUserSession(user: any, userType: 'trainer' | 'client'): void {
  storeSession(user, userType);
}

/**
 * Get session expiration date for display purposes
 */
export function getSessionExpiration(userType: 'trainer' | 'client'): Date | null {
  const session = getStoredSession(userType);
  return session ? new Date(session.expiresAt) : null;
}

/**
 * Check if a session is valid (not expired)
 */
export function isSessionValid(userType: 'trainer' | 'client'): boolean {
  return getStoredSession(userType) !== null;
}
