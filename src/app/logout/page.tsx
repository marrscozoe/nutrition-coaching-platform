'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function LogoutPage() {
  useEffect(() => {
    // Clear ALL session data
    const TRAINER_SESSION_KEY = 'ncp_session_trainer';
    const CLIENT_SESSION_KEY = 'ncp_session_client';

    localStorage.removeItem(TRAINER_SESSION_KEY);
    localStorage.removeItem(CLIENT_SESSION_KEY);
    localStorage.removeItem('trainer_user');
    localStorage.removeItem('trainer_user_type');
    localStorage.removeItem('client_user');
    localStorage.removeItem('client_user_type');
    localStorage.removeItem('user');
    localStorage.removeItem('userType');
    sessionStorage.clear();

    // Sign out from Supabase
    supabase.auth.signOut().catch(() => {});

    // Small delay to ensure cleanup, then hard redirect with cache-busting
    const timer = setTimeout(() => {
      // Use window.location for a TRUE browser navigation that:
      // 1. Clears the back-forward cache entry for this page
      // 2. Forces a network request (not served from bfcache)
      // 3. Adds a timestamp to bust any HTTP caches
      window.location.href = `/?logged_out=1&t=${Date.now()}`;
    }, 50);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-brand-cream/60">Signing out…</div>
    </div>
  );
}
