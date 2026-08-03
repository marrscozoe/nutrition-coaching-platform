// Auth utility functions
import { supabase } from './supabase';

export async function logout(): Promise<void> {
  try {
    // Clear localStorage
    localStorage.removeItem('user');
    localStorage.removeItem('userType');
    
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
