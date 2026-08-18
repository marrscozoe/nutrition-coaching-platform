// Auth utility functions
import { supabase } from './supabase';

export async function logout(): Promise<void> {
  try {
    // Clear all user session data from sessionStorage (per-tab, prevents cross-tab contamination)
    sessionStorage.removeItem('trainer_user');
    sessionStorage.removeItem('trainer_user_type');
    sessionStorage.removeItem('client_user');
    sessionStorage.removeItem('client_user_type');
    sessionStorage.removeItem('user'); // Legacy key cleanup
    sessionStorage.removeItem('userType'); // Legacy key cleanup
    
    // Clear chat history for the current user type (prevents cross-contamination between sessions)
    const trainerData = sessionStorage.getItem('trainer_user');
    const trainerType = sessionStorage.getItem('trainer_user_type');
    const clientData = sessionStorage.getItem('client_user');
    const clientType = sessionStorage.getItem('client_user_type');

    if (trainerData && trainerType === 'trainer') {
      try {
        const trainer = JSON.parse(trainerData);
        sessionStorage.removeItem(`chat_history_trainer_${trainer.id}`);
      } catch (e) {
        // ignore parse errors
      }
    }
    if (clientData && clientType === 'client') {
      try {
        const client = JSON.parse(clientData);
        sessionStorage.removeItem(`chat_history_${client.id}`);
      } catch (e) {
        // ignore parse errors
      }
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

export function getCurrentUser(): { user: any; userType: string | null } | null {
  try {
    // Check trainer session first
    const trainerData = sessionStorage.getItem('trainer_user');
    const trainerType = sessionStorage.getItem('trainer_user_type');
    if (trainerData && trainerType === 'trainer') {
      return {
        user: JSON.parse(trainerData),
        userType: 'trainer'
      };
    }
    
    // Check client session
    const clientData = sessionStorage.getItem('client_user');
    const clientType = sessionStorage.getItem('client_user_type');
    if (clientData && clientType === 'client') {
      return {
        user: JSON.parse(clientData),
        userType: 'client'
      };
    }
    
    // Legacy support: check old keys
    const userData = sessionStorage.getItem('user');
    const userType = sessionStorage.getItem('userType');
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

export function getTrainerUser(): { user: any } | null {
  try {
    const trainerData = sessionStorage.getItem('trainer_user');
    if (trainerData) {
      return { user: JSON.parse(trainerData) };
    }
    return null;
  } catch {
    return null;
  }
}

export function getClientUser(): { user: any } | null {
  try {
    const clientData = sessionStorage.getItem('client_user');
    if (clientData) {
      return { user: JSON.parse(clientData) };
    }
    return null;
  } catch {
    return null;
  }
}
