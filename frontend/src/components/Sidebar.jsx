import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Radio,
  MessageSquare,
  BarChart3,
  Bookmark,
  Settings,
  ChevronLeft,
  ChevronRight,
  User,
  LogOut,
} from 'lucide-react';
import AaiLogo from './AaiLogo';
import { useAuth } from '../context/AuthContext';

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [hoveredNav, setHoveredNav] = useState(null);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'NOTAM Feed', path: '/feed', icon: Radio },
    { name: 'Chat Assistant', path: '/chat', icon: MessageSquare },
    { name: 'Analytics', path: '/analytics', icon: BarChart3 },
    { name: 'Bookmarks', path: '/bookmarks', icon: Bookmark },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/dashboard');
  };

  return (
    <aside
      className={`relative flex flex-col h-screen bg-[#0F172A] text-slate-200 transition-all duration-300 ease-in-out z-40 border-r border-slate-800 select-none ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Top Header & Logo */}
      <div className="flex items-center justify-between h-20 px-4 border-b border-slate-800/60">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-white border border-slate-200 shadow-md shadow-sky-500/10 shrink-0 p-1.5 overflow-hidden">
            <AaiLogo className="w-full h-full text-[#2563EB]" />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-extrabold text-lg text-white tracking-wider leading-tight truncate">
                AAI <span className="text-sky-400">NOTAM</span>
              </span>
              <span className="text-[10px] text-slate-400 font-medium tracking-widest uppercase truncate">
                Smart Assistant
              </span>
            </div>
          )}
        </div>

        {/* Toggle Collapse Button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all shadow-md focus:outline-none border border-slate-700 shrink-0"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Nav Menu */}
      <div className="flex-1 py-6 px-3 space-y-2 overflow-y-auto overflow-x-hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <div
              key={item.name}
              className="relative group"
              onMouseEnter={() => setHoveredNav(item.name)}
              onMouseLeave={() => setHoveredNav(null)}
            >
              <NavLink
                to={item.path}
                className={`flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition-all duration-200 text-sm font-medium ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-xl font-semibold transform scale-[1.02]'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                } ${collapsed ? 'justify-center px-0' : ''}`}
              >
                <Icon
                  className={`w-5 h-5 shrink-0 transition-colors ${
                    isActive ? 'text-slate-900' : 'text-slate-400 group-hover:text-white'
                  }`}
                />
                {!collapsed && (
                  <span className="truncate tracking-wide">{item.name}</span>
                )}
              </NavLink>

              {/* Floating Tooltip when Collapsed */}
              {collapsed && hoveredNav === item.name && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 bg-white text-slate-900 font-semibold text-xs rounded-xl shadow-xl border border-slate-200 whitespace-nowrap z-50 animate-in fade-in zoom-in-95 duration-150">
                  {item.name}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Profile & Logout Section */}
      <div className="p-3 border-t border-slate-800/80 space-y-2">
        {/* User Info / Profile Link */}
        <div
          className="relative group"
          onMouseEnter={() => setHoveredNav('Profile')}
          onMouseLeave={() => setHoveredNav(null)}
        >
          <NavLink
            to="/settings"
            className={`flex items-center gap-3 px-3.5 py-3 rounded-2xl transition-all text-slate-300 hover:bg-slate-800/60 ${
              collapsed ? 'justify-center px-0' : ''
            }`}
          >
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-sky-600 to-blue-600 text-white font-bold text-sm shrink-0 shadow-sm border border-sky-400/30">
              {user?.name ? user.name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0 overflow-hidden">
                <span className="text-sm font-semibold text-white truncate leading-snug">
                  {user?.name || 'User'}
                </span>
                <span className="text-xs text-slate-400 truncate">
                  {user?.role || 'Pilot'}
                </span>
              </div>
            )}
          </NavLink>

          {collapsed && hoveredNav === 'Profile' && (
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 bg-white text-slate-900 font-semibold text-xs rounded-xl shadow-xl border border-slate-200 whitespace-nowrap z-50">
              Profile & Settings
            </div>
          )}
        </div>

        {/* Logout Button */}
        <div
          className="relative group"
          onMouseEnter={() => setHoveredNav('Logout')}
          onMouseLeave={() => setHoveredNav(null)}
        >
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl transition-all text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 text-sm font-medium ${
              collapsed ? 'justify-center px-0' : ''
            }`}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!collapsed && <span className="truncate">Logout</span>}
          </button>

          {collapsed && hoveredNav === 'Logout' && (
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 bg-sky-600 text-white font-semibold text-xs rounded-xl shadow-xl whitespace-nowrap z-50">
              Logout
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
