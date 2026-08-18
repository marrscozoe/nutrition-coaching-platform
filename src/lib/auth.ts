// Auth utility functions
import { supabase } from './supabase';

// ============================================================================
// CLIENT SESSION (namespaced by client_id for session isolation)
// ============================================================================

export function getClientUser(): any | null {
  try {
    const type = localStorage.getItem('client_user_type');
    if (type !== 'client') return null;
    const clientId = localStorage.getItem('current_client_id');
    if (!clientId) return null;
    const data = localStorage.getItem(`client_user_${clientId}`);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function setClientUser(client: any): void {
  // Store using namespaced key based on client_id
  localStorage.setItem(`client_user_${client.id}`, JSON.stringify(client));
  // Set type indicator and current client reference
  localStorage.setItem('client_user_type', 'client');
  localStorage.setItem('current_client_id', client.id);
}

export function clearClientUser(clientId?: string): void {
  // If clientId provided, clear that specific namespaced key
  if (clientId) {
    localStorage.removeItem(`client_user_${clientId}`);
  }
  // If the stored current_client_id matches (or no specific id was given), clear the type indicators
  const storedId = localStorage.getItem('current_client_id');
  if (!clientId || storedId === clientId) {
    localStorage.removeItem('client_user_type');
    localStorage.removeItem('current_client_id');
  }
}

// ============================================================================
// TRAINER SESSION (namespaced by trainer_id for session isolation)
// ============================================================================

export function getTrainerUser(): any | null {
  try {
    const type = localStorage.getItem('trainer_user_type');
    if (type !== 'trainer') return null;
    const trainerId = localStorage.getItem('current_trainer_id');
    if (!trainerId) return null;
    const data = localStorage.getItem(`trainer_user_${trainerId}`);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function setTrainerUser(trainer: any): void {
  // Store using namespaced key based on trainer_id
  localStorage.setItem(`trainer_user_${trainer.id}`, JSON.stringify(trainer));
  // Set type indicator and current trainer reference
  localStorage.setItem('trainer_user_type', 'trainer');
  localStorage.setItem('current_trainer_id', trainer.id);
}

export function clearTrainerUser(trainerId?: string): void {
  // If trainerId provided, clear that specific namespaced key
  if (trainerId) {
    localStorage.removeItem(`trainer_user_${trainerId}`);
  }
  // If the stored current_trainer_id matches (or no specific id was given), clear the type indicators
  const storedId = localStorage.getItem('current_trainer_id');
  if (!trainerId || storedId === trainerId) {
    localStorage.removeItem('trainer_user_type');
    localStorage.removeItem('current_trainer_id');
  }
}

// ============================================================================
// LEGACY HELPERS (for backward compatibility)
// ============================================================================

export function getCurrentUser(): { user: any; userType: string | null } | null {
  try {
    // Check trainer session first
    const trainer = getTrainerUser();
    if (trainer) {
      return { user: trainer, userType: 'trainer' };
    }
    
    // Check client session
    const client = getClientUser();
    if (client) {
      return { user: client, userType: 'client' };
    }
    
    // Legacy support: check old keys
    const userData = localStorage.getItem('user');
    const userType = localStorage.getItem('userType');
    if (userData && userType) {
      return {
        user: JSON.parse(userData),
        userType
      };
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

// ============================================================================
// LOGOUT
// ============================================================================

export async function logout(): Promise<void> {
  try {
    // Get current client and trainer IDs before clearing
    const clientId = localStorage.getItem('current_client_id');
    const trainerId = localStorage.getItem('current_trainer_id');
    
    // Clear client session data
    if (clientId) {
      localStorage.removeItem(`client_user_${clientId}`);
    }
    localStorage.removeItem('client_user_type');
    localStorage.removeItem('current_client_id');
    
    // Clear trainer session data
    if (trainerId) {
      localStorage.removeItem(`trainer_user_${trainerId}`);
    }
    localStorage.removeItem('trainer_user_type');
    localStorage.removeItem('current_trainer_id');
    
    // Legacy key cleanup
    localStorage.removeItem('client_user'); // Old generic key
    localStorage.removeItem('trainer_user'); // Old generic key
    localStorage.removeItem('user');
    localStorage.removeItem('userType');
    
    // Clear chat history for the current user (using stored IDs)
    if (clientId) {
      localStorage.removeItem(`chat_history_${clientId}`);
    }
    if (trainerId) {
      localStorage.removeItem(`chat_history_trainer_${trainerId}`);
    }
    
    // Sign out from Supabase (clears any auth session)
    await supabase.auth.signOut();
    
    // Small delay to ensure cleanup completes
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Redirect to home
    window.location.href = '/';
  } catch (error) {
    console.error('Logout error:', error);
    // Even if signOut fails, still redirect
    window.location.href = '/';
  }
}
