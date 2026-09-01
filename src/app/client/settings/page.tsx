'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Toast from '@/components/Toast';
import { logout } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

interface ClientData {
  id: string;
  name: string;
  email: string;
  gender: string;
  program_type: string;
  current_phase: number;
  starting_weight: number;
  current_weight: number;
  goal_weight: number;
  created_at: string;
}

export default function ClientSettingsPage() {
  const router = useRouter();
  const [client, setClient] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Password change state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  
  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    const userData = sessionStorage.getItem('client_user');
    const userType = sessionStorage.getItem('client_user_type');

    if (!userData || userType !== 'client') {
      router.push('/');
      return;
    }

    const user = JSON.parse(userData);
    setClient(user);
    setLoading(false);
  }, [router]);

  async function handleLogout() {
    await logout();
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText !== 'DELETE') return;
    
    setDeleting(true);
    setDeleteError('');
    
    try {
      const res = await fetch('/api/client/delete-account', {
        method: 'DELETE',
        headers: {
          'x-client-id': client!.id,
        },
      });

      if (res.ok) {
        // Clear session and redirect to home
        sessionStorage.removeItem('client_user');
        sessionStorage.removeItem('client_user_type');
        router.push('/');
      } else {
        const data = await res.json().catch(() => ({}));
        setDeleteError(data.error || 'Failed to delete account');
        setDeleting(false);
      }
    } catch (err) {
      console.error('Failed to delete account:', err);
      setDeleteError('Network error - please try again');
      setDeleting(false);
    }
  }

  function openDeleteModal() {
    setShowDeleteModal(true);
    setDeleteConfirmText('');
    setDeleteError('');
  }

  function closeDeleteModal() {
    setShowDeleteModal(false);
    setDeleteConfirmText('');
    setDeleteError('');
  }

  function validatePassword(password: string): string {
    if (password.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one number';
    }
    return '';
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    // Validate password strength
    const validationError = validatePassword(newPassword);
    if (validationError) {
      setPasswordError(validationError);
      return;
    }

    // Verify current password by signing in
    setChangingPassword(true);
    try {
      // First verify the current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: client!.email,
        password: currentPassword,
      });

      if (signInError) {
        setPasswordError('Current password is incorrect');
        setChangingPassword(false);
        return;
      }

      // Now update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setPasswordError(updateError.message || 'Failed to update password');
        setChangingPassword(false);
        return;
      }

      // Success!
      setPasswordSuccess('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setShowPasswordChange(false);
        setPasswordSuccess('');
      }, 2000);
    } catch (err) {
      setPasswordError('An unexpected error occurred');
    } finally {
      setChangingPassword(false);
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
    <main className="min-h-screen pb-24 pt-[env(safe-area-inset-top)]">
      {/* Header */}
      <header className="px-6 py-4 pt-[env(safe-area-inset-top)] flex items-center justify-between">
        <Link href="/client/profile" className="text-brand-cream/60 hover:text-brand-cream">
          ← Back
        </Link>
        <h1 className="text-lg font-semibold text-brand-cream">Settings</h1>
        <div className="w-12" />
      </header>

      <div className="px-4 space-y-4">
        {/* Account Section */}
        <div className="p-4 rounded-xl bg-brand-charcoal/80 border border-brand-cream/10">
          <h2 className="text-sm font-semibold text-brand-cream/60 uppercase tracking-wider mb-4">Account</h2>
          
          {/* Email Display */}
          <div className="mb-4">
            <label className="block text-sm text-brand-cream/80 mb-1">Email</label>
            <div className="px-4 py-3 rounded-lg bg-brand-charcoal/40 border border-brand-cream/20 text-brand-cream/50">
              {client.email}
            </div>
            <p className="text-xs text-brand-cream/40 mt-1">Email cannot be changed</p>
          </div>

          {/* Name Display */}
          <div className="mb-4">
            <label className="block text-sm text-brand-cream/80 mb-1">Name</label>
            <div className="px-4 py-3 rounded-lg bg-brand-charcoal/40 border border-brand-cream/20 text-brand-cream">
              {client.name}
            </div>
          </div>
        </div>

        {/* Security Section */}
        <div className="p-4 rounded-xl bg-brand-charcoal/80 border border-brand-cream/10">
          <h2 className="text-sm font-semibold text-brand-cream/60 uppercase tracking-wider mb-4">🔐 Security</h2>
          
          {!showPasswordChange ? (
            <button
              onClick={() => setShowPasswordChange(true)}
              className="w-full py-3 rounded-xl bg-brand-orange text-white font-semibold hover:bg-brand-orange-dark transition-colors"
            >
              Change Password
            </button>
          ) : (
            <form onSubmit={handlePasswordChange} className="space-y-4">
              {passwordError && (
                <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm">
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="p-3 rounded-lg bg-green-500/20 border border-green-500/30 text-green-400 text-sm">
                  {passwordSuccess}
                </div>
              )}
              
              <div>
                <label className="block text-sm text-brand-cream/80 mb-1">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream focus:outline-none focus:border-brand-orange"
                  placeholder="Enter current password"
                  required
                  disabled={changingPassword}
                />
              </div>

              <div>
                <label className="block text-sm text-brand-cream/80 mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream focus:outline-none focus:border-brand-orange"
                  placeholder="Enter new password"
                  required
                  disabled={changingPassword}
                />
                <p className="text-xs text-brand-cream/40 mt-1">
                  Min 8 characters, 1 uppercase, 1 lowercase, 1 number
                </p>
              </div>

              <div>
                <label className="block text-sm text-brand-cream/80 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream focus:outline-none focus:border-brand-orange"
                  placeholder="Confirm new password"
                  required
                  disabled={changingPassword}
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordChange(false);
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setPasswordError('');
                    setPasswordSuccess('');
                  }}
                  className="flex-1 py-3 rounded-xl bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream font-medium hover:bg-brand-charcoal/60 transition-colors"
                  disabled={changingPassword}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-brand-orange text-white font-semibold hover:bg-brand-orange-dark transition-colors disabled:opacity-50"
                  disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
                >
                  {changingPassword ? 'Saving...' : 'Save Password'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* About Section */}
        <div className="p-4 rounded-xl bg-brand-charcoal/80 border border-brand-cream/10">
          <h2 className="text-sm font-semibold text-brand-cream/60 uppercase tracking-wider mb-4">About</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-brand-cream/60 text-sm">App Version</span>
              <span className="text-brand-cream text-sm">1.0.0 (Beta)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-cream/60 text-sm">Program</span>
              <span className="text-brand-orange text-sm">{client.program_type || 'General Health'}</span>
            </div>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 font-medium hover:bg-red-500/20 transition-colors"
        >
          Log Out
        </button>

        {/* Danger Zone */}
        <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20">
          <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-2">⚠️ Danger Zone</h2>
          <p className="text-sm text-brand-cream/60 mb-4">
            Permanently delete your account and all your data including meals, weigh-ins, messages, milestones, and feedback.
          </p>
          <button
            onClick={openDeleteModal}
            className="w-full py-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 font-semibold hover:bg-red-500/30 transition-colors"
          >
            Delete My Account
          </button>
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-brand-charcoal rounded-2xl border border-red-500/30 p-6">
            <h2 className="text-xl font-bold text-red-400 mb-2">Delete Account</h2>
            <p className="text-brand-cream/70 mb-4">
              This action is <strong className="text-red-400">PERMANENT</strong>. All your data will be deleted including:
            </p>
            <ul className="text-sm text-brand-cream/60 mb-4 list-disc list-inside space-y-1">
              <li>All meal logs</li>
              <li>All weigh-ins</li>
              <li>All coach messages</li>
              <li>All milestones</li>
              <li>All feedback</li>
              <li>Your account</li>
            </ul>
            <p className="text-sm text-brand-cream/60 mb-4">
              Type <strong className="text-red-400">DELETE</strong> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
              placeholder="Type DELETE"
              className="w-full px-4 py-3 rounded-lg bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream focus:outline-none focus:border-red-500 mb-4"
              autoFocus
            />
            {deleteError && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 text-sm">
                {deleteError}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={closeDeleteModal}
                disabled={deleting}
                className="flex-1 py-3 rounded-xl bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream font-medium hover:bg-brand-charcoal/60 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== 'DELETE' || deleting}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? 'Deleting...' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

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
          <Link href="/client/chat" className="flex flex-col items-center text-brand-cream/50 hover:text-brand-cream">
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
          <Link href="/client/settings" className="flex flex-col items-center text-brand-orange">
            <span className="text-xl">⚙️</span>
            <span className="text-xs mt-1">Settings</span>
          </Link>
        </div>
      </nav>
    </main>
  );
}
