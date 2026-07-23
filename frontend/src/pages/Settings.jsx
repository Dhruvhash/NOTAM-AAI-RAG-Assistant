import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { authApi } from '../services/api';
import {
  User,
  Shield,
  KeyRound,
  Moon,
  Sun,
  Bell,
  CheckCircle2,
  AlertCircle,
  Save,
  Mail,
  Calendar,
} from 'lucide-react';

export default function Settings() {
  const { user, updateUser } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  // Profile Form State
  const [name, setName] = useState(user?.name || '');
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdErr, setPwdErr] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);

  // Notification Preferences State (Placeholder UI)
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [notamUrgentAlerts, setNotamUrgentAlerts] = useState(true);
  const [dailyBriefing, setDailyBriefing] = useState(false);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileMsg('');
    setProfileErr('');

    if (!name.trim()) {
      setProfileErr('Name cannot be empty.');
      return;
    }

    try {
      setProfileLoading(true);
      const res = await authApi.updateProfile({ name });
      if (res.data && res.data.user) {
        updateUser(res.data.user);
        setProfileMsg('Profile updated successfully!');
      }
    } catch (err) {
      setProfileErr(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setPwdMsg('');
    setPwdErr('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwdErr('Please fill in all password fields.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwdErr('New password and confirm password do not match.');
      return;
    }

    if (newPassword.length < 6) {
      setPwdErr('New password must be at least 6 characters long.');
      return;
    }

    try {
      setPwdLoading(true);
      await authApi.updatePassword({ currentPassword, newPassword });
      setPwdMsg('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPwdErr(err.response?.data?.message || 'Failed to update password.');
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-10">
      {/* Header */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
            Account & System Settings
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage your personal profile, credentials, operational notifications, and theme preferences.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Account Info Card Sidebar */}
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-gradient-to-b from-slate-900 to-aai-maroon text-white border border-slate-800 shadow-xl text-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-aai-red to-aai-maroon mx-auto flex items-center justify-center font-bold text-2xl text-white shadow-lg border-2 border-white/20">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>

            <div>
              <h2 className="text-lg font-extrabold">{user?.name || 'User'}</h2>
              <span className="px-3 py-1 rounded-full bg-white/10 text-sky-300 text-xs font-semibold uppercase tracking-wider inline-block mt-1">
                {user?.role || 'Pilot'}
              </span>
            </div>

            <div className="pt-4 border-t border-white/10 space-y-2 text-xs text-slate-300 text-left">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-sky-400 shrink-0" />
                <span className="truncate">{user?.email || 'officer@aai.aero'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-rose-400 shrink-0" />
                <span>
                  Member since:{' '}
                  {user?.createdAt
                    ? new Date(user.createdAt).toLocaleDateString()
                    : 'July 2026'}
                </span>
              </div>
            </div>
          </div>

          {/* Theme Switcher Box */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
              {isDark ? <Moon className="w-4 h-4 text-sky-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
              Display Theme Mode
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Toggle dark mode for optimal low-light flight deck visibility.
            </p>

            <button
              onClick={toggleTheme}
              className="w-full py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-xs transition-all flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700"
            >
              {isDark ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span>Switch to Light Theme</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-slate-700" />
                  <span>Switch to Dark Theme</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Forms Main Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Details Form */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <h2 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <User className="w-5 h-5 text-aai-red" />
              Personal Profile
            </h2>

            {profileMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                <span>{profileMsg}</span>
              </div>
            )}

            {profileErr && (
              <div className="p-3 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4" />
                <span>{profileErr}</span>
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-aai-red transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Email Address (Read-only)
                </label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 text-sm cursor-not-allowed"
                />
              </div>

              <button
                type="submit"
                disabled={profileLoading}
                className="px-6 py-3 rounded-2xl bg-aai-red hover:bg-rose-600 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{profileLoading ? 'Saving...' : 'Save Profile'}</span>
              </button>
            </form>
          </div>

          {/* Security / Password Form */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <h2 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <KeyRound className="w-5 h-5 text-sky-500" />
              Security & Password
            </h2>

            {pwdMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                <span>{pwdMsg}</span>
              </div>
            )}

            {pwdErr && (
              <div className="p-3 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4" />
                <span>{pwdErr}</span>
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-sky-500 transition-all"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-sky-500 transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-sky-500 transition-all"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={pwdLoading}
                className="px-6 py-3 rounded-2xl bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <Shield className="w-4 h-4 text-sky-400" />
                <span>{pwdLoading ? 'Updating Password...' : 'Update Password'}</span>
              </button>
            </form>
          </div>

          {/* Notification Preferences (Placeholder Controls) */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Bell className="w-5 h-5 text-emerald-500" />
              Operational Notification Preferences
            </h2>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-white">
                    Email Digest for New PDF Ingestions
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Receive email notifications when new NOTAM bundles are indexed into vector database.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={emailAlerts}
                  onChange={(e) => setEmailAlerts(e.target.checked)}
                  className="w-5 h-5 accent-aai-red rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                <div>
                  <div className="text-xs font-bold text-slate-800 dark:text-white">
                    Urgent Runway Closure Advisories
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    High-priority alerts for runway unserviceability across major ICAO hubs.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={notamUrgentAlerts}
                  onChange={(e) => setNotamUrgentAlerts(e.target.checked)}
                  className="w-5 h-5 accent-aai-red rounded cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
