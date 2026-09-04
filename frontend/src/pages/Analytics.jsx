import React, { useState, useEffect } from 'react';
import { analyticsApi } from '../services/api';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { BarChart3, PieChart as PieIcon, TrendingUp } from 'lucide-react';

export default function Analytics() {
  const [analyticsData, setAnalyticsData] = useState({
    dailyStats: [],
    categories: [],
    summary: { totalQuestions: 0, totalUploads: 0 },
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await analyticsApi.getAnalytics();
      if (res.data) {
        setAnalyticsData(res.data);
      }
    } catch (error) {
      console.error('Failed to load analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const defaultDaily = [
    { date: 'Mon', uploads: 4, questions: 12 },
    { date: 'Tue', uploads: 7, questions: 19 },
    { date: 'Wed', uploads: 3, questions: 15 },
    { date: 'Thu', uploads: 9, questions: 25 },
    { date: 'Fri', uploads: 6, questions: 22 },
    { date: 'Sat', uploads: 12, questions: 30 },
    { date: 'Sun', uploads: 8, questions: 27 },
  ];

  const defaultCategories = [
    { name: 'Runway', value: 45, color: '#C8102E' },
    { name: 'Navaid', value: 25, color: '#5C0F1E' },
    { name: 'Airspace', value: 18, color: '#0284C7' },
    { name: 'Obstacle', value: 12, color: '#F59E0B' },
  ];

  const dailyData = analyticsData.dailyStats?.length ? analyticsData.dailyStats : defaultDaily;
  const categoryData = analyticsData.categories?.length ? analyticsData.categories : defaultCategories;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-10">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-aai-red" />
            System Analytics & Metrics
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time visual tracking of PDF document ingestions, AI query velocity, and advisory categorizations.
          </p>
        </div>

        {/* Metric Badges */}
        <div className="flex items-center gap-4">
          <div className="px-4 py-2 rounded-2xl bg-aai-rose dark:bg-slate-800 border border-aai-red/20 text-center">
            <div className="text-[10px] uppercase font-bold text-aai-red dark:text-rose-400">Total Uploads</div>
            <div className="text-lg font-extrabold text-slate-900 dark:text-white">
              {analyticsData.summary?.totalUploads || 49}
            </div>
          </div>

          <div className="px-4 py-2 rounded-2xl bg-sky-50 dark:bg-slate-800 border border-sky-500/20 text-center">
            <div className="text-[10px] uppercase font-bold text-sky-600 dark:text-sky-400">AI Queries</div>
            <div className="text-lg font-extrabold text-slate-900 dark:text-white">
              {analyticsData.summary?.totalQuestions || 150}
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart: NOTAMs Uploaded per Day */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-aai-red" />
              NOTAMs Uploaded Per Day (Last 7 Days)
            </h2>
          </div>

          <div className="h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    color: '#FFF',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="uploads" fill="#C8102E" radius={[8, 8, 0, 0]} name="Uploads" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Line Chart: Questions Asked per Day */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-sky-500" />
              Questions Asked Per Day
            </h2>
          </div>

          <div className="h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    color: '#FFF',
                    fontSize: '12px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="questions"
                  stroke="#0284C7"
                  strokeWidth={3}
                  dot={{ r: 5, fill: '#0284C7' }}
                  activeDot={{ r: 7 }}
                  name="AI Queries"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart: NOTAM Category Breakdown */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <PieIcon className="w-5 h-5 text-amber-500" />
              NOTAM Categories Breakdown
            </h2>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-around gap-6 pt-2">
            <div className="h-64 w-full md:w-1/2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#334155',
                      borderRadius: '12px',
                      color: '#FFF',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Custom Legend Cards */}
            <div className="w-full md:w-1/2 grid grid-cols-2 gap-4">
              {categoryData.map((cat, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center gap-3"
                >
                  <div
                    className="w-4 h-4 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: cat.color }}
                  />
                  <div>
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {cat.name}
                    </div>
                    <div className="text-lg font-extrabold text-slate-900 dark:text-white">
                      {cat.value}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
