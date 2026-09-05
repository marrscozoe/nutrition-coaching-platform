'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { logout } from '@/lib/auth';
import Toast from '@/components/Toast';

interface TrainerData {
  id: string;
  name: string;
  email: string;
  business_name?: string;
  brand_color: string;
  created_at?: string;
}

export default function TrainerProfilePage() {
  const router = useRouter();
  const [trainer, setTrainer] = useState<TrainerData | null>(null);
  const [loading, setLoading] = useState(true);

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Security section state
  const [showSecurity, setShowSecurity] = useState(false);
  const [securityTab, setSecurityTab] = useState<'email' | 'password'>('email');
  const [newEmail, setNewEmail] = useState('');
  const [emailCurrentPassword, setEmailCurrentPassword] = useState('');
  const [changingEmail, setChangingEmail] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordCurrentPassword, setPasswordCurrentPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const userData = sessionStorage.getItem('trainer_user');
    const userType = sessionStorage.getItem('trainer_user_type');

    if (!userData || userType !== 'trainer') {
      router.push('/?login=trainer');
      return;
    }

    try {
      const user = JSON.parse(userData);
      setTrainer(user);
    } catch (e) {
      router.push('/?login=trainer');
      return;
    } finally {
      setLoading(false);
    }
  }, [router]);

  async function handleLogout() {
    await logout();
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText !== 'DELETE') return;
    
    setDeleting(true);
    setDeleteError('');
    
    try {
      const res = await fetch('/api/trainer/delete-account', {
        method: 'DELETE',
        headers: {
          'x-trainer-id': trainer!.id,
        },
      });

      if (res.ok) {
        // Clear session and redirect to home
        sessionStorage.removeItem('trainer_user');
        sessionStorage.removeItem('trainer_user_type');
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-brand-orange text-xl">Loading...</div>
      </div>
    );
  }

  if (!trainer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-brand-cream/60">Profile not found</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen pb-20">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between">
        <Link href="/trainer" className="text-brand-cream/60 hover:text-brand-cream">
          ← Back
        </Link>
        <h1 className="text-lg font-semibold text-brand-cream">Profile</h1>
        <div className="w-12" />
      </header>

      <div className="px-4 space-y-4">
        {/* Profile Card */}
        <div className="p-6 rounded-xl bg-brand-charcoal/80 border border-brand-cream/10 text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-brand-orange/20 flex items-center justify-center mb-4">
            <span className="text-3xl">👨‍🏫</span>
          </div>
          <h2 className="text-xl font-bold text-brand-cream">{trainer.name}</h2>
          {trainer.business_name && (
            <p className="text-brand-cream/60 mt-1">{trainer.business_name}</p>
          )}
          <p className="text-brand-cream/50 text-sm mt-2">{trainer.email}</p>
        </div>

        {/* Account Info */}
        <div className="p-4 rounded-xl bg-brand-charcoal/80 border border-brand-cream/10">
          <h3 className="text-sm font-semibold text-brand-cream/60 uppercase tracking-wider mb-4">Account Information</h3>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-brand-cream/10">
              <span className="text-brand-cream/60 text-sm">Name</span>
              <span className="text-brand-cream text-sm">{trainer.name}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-brand-cream/10">
              <span className="text-brand-cream/60 text-sm">Email</span>
              <span className="text-brand-cream text-sm">{trainer.email}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-brand-cream/10">
              <span className="text-brand-cream/60 text-sm">Business</span>
              <span className="text-brand-cream text-sm">{trainer.business_name || 'Not set'}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-brand-cream/60 text-sm">Account Type</span>
              <span className="text-brand-orange text-sm font-medium">Trainer</span>
            </div>
          </div>
        </div>

        {/* Security Section */}
        <div className="p-4 rounded-xl bg-brand-charcoal/80 border border-brand-cream/10">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-brand-cream/60 uppercase tracking-wider">🔐 Login & Security</h3>
            <button
              onClick={() => {
                setShowSecurity(!showSecurity);
                if (!showSecurity) {
                  setNewEmail(trainer.email);
                  setEmailCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                  setPasswordCurrentPassword('');
                }
              }}
              className="text-brand-orange text-sm hover:underline"
            >
              {showSecurity ? 'Cancel' : 'Edit ✏️'}
            </button>
          </div>
          {!showSecurity ? (
            <div className="space-y-2">
              <div className="flex justify-between py-2 border-b border-brand-cream/10">
                <span className="text-brand-cream/60 text-sm">Email</span>
                <span className="text-brand-cream text-sm">{trainer.email}</span>
              </div>
              <p className="text-brand-cream/40 text-xs">Password: ••••••••</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Tab switcher */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setSecurityTab('email')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    securityTab === 'email'
                      ? 'bg-brand-orange text-white'
                      : 'bg-brand-charcoal/60 text-brand-cream/60 hover:text-brand-cream'
                  }`}
                >
                  Change Email
                </button>
                <button
                  onClick={() => setSecurityTab('password')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    securityTab === 'password'
                      ? 'bg-brand-orange text-white'
                      : 'bg-brand-charcoal/60 text-brand-cream/60 hover:text-brand-cream'
                  }`}
                >
                  Change Password
                </button>
              </div>

              {securityTab === 'email' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-brand-cream/60 mb-1">New Email</label>
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream text-sm focus:outline-none focus:border-brand-orange"
                      placeholder="new@email.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-brand-cream/60 mb-1">Current Password</label>
                    <input
                      type="password"
                      value={emailCurrentPassword}
                      onChange={(e) => setEmailCurrentPassword(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream text-sm focus:outline-none focus:border-brand-orange"
                      placeholder="Enter current password"
                    />
                  </div>
                  <button
                    onClick={async () => {
                      if (!newEmail || !emailCurrentPassword) {
                        setToast({ message: 'Please fill in all fields', type: 'error' });
                        return;
                      }
                      setChangingEmail(true);
                      try {
                        const res = await fetch('/api/trainer/change-email', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', 'x-trainer-id': trainer.id },
                          body: JSON.stringify({ newEmail, currentPassword: emailCurrentPassword }),
                        });
                        const data = await res.json();
                        if (res.ok) {
                          const updated = { ...trainer, email: newEmail };
                          setTrainer(updated);
                          sessionStorage.setItem('trainer_user', JSON.stringify(updated));
                          setShowSecurity(false);
                          setToast({ message: 'Email changed successfully!', type: 'success' });
                        } else {
                          setToast({ message: data.error || 'Failed to change email', type: 'error' });
                        }
                      } catch {
                        setToast({ message: 'Failed to change email', type: 'error' });
                      } finally {
                        setChangingEmail(false);
                      }
                    }}
                    disabled={changingEmail || !newEmail || !emailCurrentPassword}
                    className="w-full py-2.5 rounded-lg bg-brand-orange text-white text-sm font-semibold hover:bg-brand-orange-dark transition-colors disabled:opacity-50"
                  >
                    {changingEmail ? 'Changing Email...' : 'Change Email'}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-brand-cream/60 mb-1">Current Password</label>
                    <input
                      type="password"
                      value={passwordCurrentPassword}
                      onChange={(e) => setPasswordCurrentPassword(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream text-sm focus:outline-none focus:border-brand-orange"
                      placeholder="Enter current password"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-brand-cream/60 mb-1">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream text-sm focus:outline-none focus:border-brand-orange"
                      placeholder="Min 8 chars, letter & number"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-brand-cream/60 mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg bg-brand-charcoal/80 border border-brand-cream/20 text-brand-cream text-sm focus:outline-none focus:border-brand-orange"
                      placeholder="Repeat new password"
                    />
                  </div>
                  <button
                    onClick={async () => {
                      if (!passwordCurrentPassword || !newPassword || !confirmPassword) {
                        setToast({ message: 'Please fill in all fields', type: 'error' });
                        return;
                      }
                      if (newPassword !== confirmPassword) {
                        setToast({ message: 'Passwords do not match', type: 'error' });
                        return;
                      }
                      if (newPassword.length < 8) {
                        setToast({ message: 'Password must be at least 8 characters', type: 'error' });
                        return;
                      }
                      if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
                        setToast({ message: 'Password must contain a letter and a number', type: 'error' });
                        return;
                      }
                      setChangingPassword(true);
                      try {
                        const res = await fetch('/api/trainer/change-password', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', 'x-trainer-id': trainer.id },
                          body: JSON.stringify({ currentPassword: passwordCurrentPassword, newPassword }),
                        });
                        const data = await res.json();
                        if (res.ok) {
                          setShowSecurity(false);
                          setNewPassword('');
                          setConfirmPassword('');
                          setPasswordCurrentPassword('');
                          setToast({ message: 'Password changed successfully!', type: 'success' });
                        } else {
                          setToast({ message: data.error || 'Failed to change password', type: 'error' });
                        }
                      } catch {
                        setToast({ message: 'Failed to change password', type: 'error' });
                      } finally {
                        setChangingPassword(false);
                      }
                    }}
                    disabled={changingPassword || !passwordCurrentPassword || !newPassword || !confirmPassword}
                    className="w-full py-2.5 rounded-lg bg-brand-orange text-white text-sm font-semibold hover:bg-brand-orange-dark transition-colors disabled:opacity-50"
                  >
                    {changingPassword ? 'Changing Password...' : 'Change Password'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="p-4 rounded-xl bg-brand-charcoal/80 border border-brand-cream/10">
          <h3 className="text-sm font-semibold text-brand-cream/60 uppercase tracking-wider mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <Link
              href="/trainer/clients"
              className="flex items-center justify-between p-3 rounded-lg bg-brand-charcoal/60 hover:bg-brand-charcoal/40 transition-colors"
            >
              <span className="text-brand-cream">View Clients</span>
              <span className="text-brand-cream/40">→</span>
            </Link>
            <Link
              href="/trainer/settings"
              className="flex items-center justify-between p-3 rounded-lg bg-brand-charcoal/60 hover:bg-brand-charcoal/40 transition-colors"
            >
              <span className="text-brand-cream">Settings</span>
              <span className="text-brand-cream/40">→</span>
            </Link>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full py-3 rounded-xl bg-red-500/20 text-red-400 font-medium hover:bg-red-500/30 transition-colors"
        >
          Log Out
        </button>

        {/* Danger Zone */}
        <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20">
          <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-2">⚠️ Danger Zone</h2>
          <p className="text-sm text-brand-cream/60 mb-4">
            Permanently delete your account, all your clients, and all associated data including meals, weigh-ins, messages, milestones, and feedback.
          </p>
          <button
            onClick={openDeleteModal}
            className="w-full py-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 font-semibold hover:bg-red-500/30 transition-colors"
          >
            Delete My Account
          </button>
        </div>

        {/* Beta Notice */}
        <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
          <p className="text-yellow-400 text-sm font-medium">⚠️ Beta Mode</p>
          <p className="text-brand-cream/60 text-xs mt-1">
            Stripe billing is disabled. All accounts have free access during testing.
          </p>
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
              <li>All your clients</li>
              <li>All meal logs</li>
              <li>All weigh-ins</li>
              <li>All coach messages</li>
              <li>All milestones</li>
              <li>All feedback</li>
              <li>Your trainer account</li>
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
          <Link href="/trainer" className="flex flex-col items-center text-brand-cream/50 hover:text-brand-cream">
            <span className="text-xl">📊</span>
            <span className="text-xs mt-1">Dashboard</span>
          </Link>
          <Link href="/trainer/clients" className="flex flex-col items-center text-brand-cream/50 hover:text-brand-cream">
            <span className="text-xl">👥</span>
            <span className="text-xs mt-1">Clients</span>
          </Link>
          <Link href="/trainer/corrections" className="flex flex-col items-center text-brand-cream/50 hover:text-brand-cream">
            <span className="text-xl">🤖</span>
            <span className="text-xs mt-1">Corrections</span>
          </Link>
          <Link href="/trainer/profile" className="flex flex-col items-center text-brand-orange">
            <span className="text-xl">👤</span>
            <span className="text-xs mt-1">Profile</span>
          </Link>
          <Link href="/trainer/settings" className="flex flex-col items-center text-brand-cream/50 hover:text-brand-cream">
            <span className="text-xl">⚙️</span>
            <span className="text-xs mt-1">Settings</span>
          </Link>
        </div>
      </nav>
    </main>
  );
}
