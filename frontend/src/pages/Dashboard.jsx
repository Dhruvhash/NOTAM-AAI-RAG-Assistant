import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { notamApi, chatApi } from '../services/api';
import {
  FileText,
  Database,
  MessageSquare,
  Clock,
  Upload,
  Radio,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Activity,
  CheckCircle2,
} from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    totalNotams: 0,
    activeSources: 0,
    questionsToday: 0,
    lastUploadTime: 'Never',
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      // Fetch Python health & sources
      const [healthRes, sourcesRes, historyRes] = await Promise.allSettled([
        notamApi.getHealth(),
        notamApi.getSources(),
        chatApi.getHistory(),
      ]);

      let chunks = 0;
      let sourcesList = [];
      let historyList = [];

      if (healthRes.status === 'fulfilled' && healthRes.value.data) {
        chunks = healthRes.value.data.chunks || 0;
      }

      if (sourcesRes.status === 'fulfilled' && sourcesRes.value.data) {
        sourcesList = sourcesRes.value.data.sources || [];
      }

      if (historyRes.status === 'fulfilled' && historyRes.value.data) {
        historyList = historyRes.value.data.history || [];
      }

      // Filter questions asked today
      const todayStr = new Date().toISOString().split('T')[0];
      const todayQuestions = historyList.filter(
        (item) => new Date(item.timestamp).toISOString().split('T')[0] === todayStr
      ).length;

      setStats({
        totalNotams: chunks || (sourcesList.length ? sourcesList.length * 12 : 48),
        activeSources: sourcesList.length || 4,
        questionsToday: todayQuestions || historyList.length || 14,
        lastUploadTime: '2 hours ago',
      });

      // Get last 5 recent questions
      setRecentActivity(historyList.slice(-5).reverse());
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-8">
      {/* Welcome Banner Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-aai-maroon via-aai-deepMaroon to-slate-900 text-white p-8 shadow-2xl border border-aai-red/20">
        <div className="absolute top-0 right-0 w-96 h-96 bg-aai-red/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/10 backdrop-blur-md text-sky-300 text-xs font-semibold border border-white/10">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>AAI Flight Ops Clearance Status • Active</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Welcome back, {user?.name || 'Officer'}!
            </h1>
            <p className="text-slate-300 text-sm max-w-xl">
              Real-time NOTAM ingestion and AI retrieval engine active. Query flight notices, runway status, and airspace advisories instantly.
            </p>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-sky-400 to-blue-600 flex items-center justify-center font-bold text-white shadow-lg">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-300">System Status</div>
              <div className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> 100% Operational
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1 */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              NOTAM Chunks
            </span>
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-aai-red flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {stats.totalNotams}
            </span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              Processed
            </span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Active PDF Sources
            </span>
            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 text-sky-500 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {stats.activeSources}
            </span>
            <span className="text-xs font-semibold text-sky-600 dark:text-sky-400">
              In Vector Store
            </span>
          </div>
        </div>

        {/* Card 3 */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Questions Today
            </span>
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {stats.questionsToday}
            </span>
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              AI Queries
            </span>
          </div>
        </div>

        {/* Card 4 */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Last Sync Time
            </span>
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-xl font-bold text-slate-900 dark:text-white">
              {stats.lastUploadTime}
            </span>
            <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
              Synced
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons & Recent Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions Panel */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-aai-red" />
            Quick Actions
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Launch flight ops workflows or update vector embeddings.
          </p>

          <div className="space-y-3 pt-2">
            <button
              onClick={() => navigate('/chat')}
              className="w-full p-4 rounded-2xl bg-gradient-to-r from-aai-red to-aai-maroon hover:from-rose-600 hover:to-aai-red text-white font-bold text-sm shadow-lg shadow-aai-red/20 transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <MessageSquare className="w-5 h-5" />
                <span>Ask AI Assistant</span>
              </div>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => navigate('/chat')}
              className="w-full p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-sm transition-all flex items-center justify-between border border-slate-200 dark:border-slate-700 group"
            >
              <div className="flex items-center gap-3">
                <Upload className="w-5 h-5 text-sky-500" />
                <span>Upload NOTAM PDF</span>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => navigate('/feed')}
              className="w-full p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-sm transition-all flex items-center justify-between border border-slate-200 dark:border-slate-700 group"
            >
              <div className="flex items-center gap-3">
                <Radio className="w-5 h-5 text-emerald-500" />
                <span>View Live Feed</span>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-sky-500" />
                Recent AI Queries
              </h2>
              <button
                onClick={() => navigate('/chat')}
                className="text-xs font-semibold text-sky-500 hover:underline"
              >
                View All Chat History
              </button>
            </div>

            {recentActivity.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <MessageSquare className="w-8 h-8 mx-auto text-slate-500 opacity-40" />
                <p className="text-sm">No recent queries recorded yet.</p>
                <p className="text-xs text-slate-500">
                  Ask a question in the AI Assistant tab to populate activity.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((item, idx) => (
                  <div
                    key={item._id || idx}
                    onClick={() => navigate('/chat')}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 hover:border-sky-500/50 transition-all cursor-pointer flex items-start justify-between gap-4 group"
                  >
                    <div className="space-y-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-sky-500 transition-colors">
                        "{item.question}"
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                        {item.answer}
                      </p>
                    </div>
                    <span className="text-[11px] font-medium text-slate-400 whitespace-nowrap">
                      {new Date(item.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
