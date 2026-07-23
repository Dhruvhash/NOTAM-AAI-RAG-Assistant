import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import { useAuth } from '../context/AuthContext';
import { notamApi } from '../services/api';
import { ShieldCheck, Server, User } from 'lucide-react';

export default function Navbar() {
  const location = useLocation();
  const { user } = useAuth();
  const [pythonOnline, setPythonOnline] = useState(false);

  useEffect(() => {
    checkBackendStatus();
    const interval = setInterval(checkBackendStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const checkBackendStatus = async () => {
    try {
      const res = await notamApi.getHealth();
      setPythonOnline(res.data?.status === 'ok' || res.data?.status === 'healthy');
    } catch {
      setPythonOnline(false);
    }
  };

  const getPageTitle = (pathname) => {
    switch (pathname) {
      case '/dashboard':
        return 'Dashboard Overview';
      case '/feed':
        return 'Live NOTAM Feed';
      case '/chat':
        return 'AI NOTAM Assistant';
      case '/analytics':
        return 'System Analytics';
      case '/bookmarks':
        return 'Saved Bookmarks';
      case '/settings':
        return 'Account & Settings';
      default:
        return 'AAI NOTAM Portal';
    }
  };

  return (
    <header className="h-20 px-6 flex items-center justify-between bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 transition-colors duration-200">
      {/* Title & Path */}
      <div className="flex flex-col">
        <h1 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">
          {getPageTitle(location.pathname)}
        </h1>
        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          Airports Authority of India • Flight Operations Division
        </span>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* Python RAG Service Status */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-medium border border-slate-200 dark:border-slate-700">
          <Server className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
          <span className="text-slate-600 dark:text-slate-300">RAG Engine:</span>
          {pythonOnline ? (
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Port 8000 Ready
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              Standby
            </span>
          )}
        </div>

        {/* User Role Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-50 dark:bg-slate-800 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-900/40 text-xs font-semibold">
          <ShieldCheck className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
          <span>{user?.role || 'Pilot'}</span>
        </div>

        {/* Theme Toggle Button */}
        <ThemeToggle />

        {/* User Avatar */}
        <div className="flex items-center gap-3 pl-2 border-l border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-sky-600 to-blue-600 text-white font-bold text-sm shadow-md">
            {user?.name ? user.name.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
          </div>
        </div>
      </div>
    </header>
  );
}
