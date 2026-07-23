import React, { useState, useEffect } from 'react';
import { bookmarkApi } from '../services/api';
import {
  Bookmark as BookmarkIcon,
  Search,
  Trash2,
  Calendar,
  FileText,
  Copy,
  Check,
  AlertCircle,
} from 'lucide-react';

export default function Bookmarks() {
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    fetchBookmarks();
  }, []);

  const fetchBookmarks = async () => {
    try {
      setLoading(true);
      const res = await bookmarkApi.getBookmarks();
      if (res.data && res.data.bookmarks) {
        setBookmarks(res.data.bookmarks);
      } else {
        setBookmarks([]);
      }
    } catch (error) {
      console.error('Failed to load bookmarks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await bookmarkApi.deleteBookmark(id);
      setBookmarks((prev) => prev.filter((b) => b._id !== id));
    } catch (error) {
      console.error('Failed to delete bookmark:', error);
    }
  };

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredBookmarks = bookmarks.filter(
    (b) =>
      b.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Top Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-aai-maroon to-slate-900 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-widest">
            <BookmarkIcon className="w-4 h-4" />
            Saved Knowledge Base
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight mt-1">
            Bookmarked NOTAM Answers
          </h1>
          <p className="text-xs text-slate-300">
            Stored AI response citations for rapid pre-flight reference and dispatch briefings.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search saved bookmarks..."
            className="w-full pl-11 pr-4 py-2.5 rounded-2xl bg-white/10 border border-white/20 text-white placeholder-slate-400 text-xs focus:outline-none focus:bg-white/20 transition-all"
          />
        </div>
      </div>

      {/* Bookmarks List Grid */}
      {filteredBookmarks.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
          <BookmarkIcon className="w-12 h-12 text-slate-400 mx-auto opacity-40" />
          <h3 className="text-base font-bold text-slate-800 dark:text-white">
            No saved bookmarks found
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            You can bookmark any AI assistant answer while chatting to save key advisory snippets here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredBookmarks.map((item) => (
            <div
              key={item._id}
              className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                {/* Question */}
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                    "{item.question}"
                  </h3>
                  <button
                    onClick={() => handleDelete(item._id)}
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors shrink-0"
                    title="Delete Bookmark"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Answer Snippet */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-mono whitespace-pre-wrap">
                  {item.answer}
                </div>

                {/* Source badges */}
                {item.sources && item.sources.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {item.sources.map((src, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300 font-mono"
                      >
                        <FileText className="w-3 h-3 text-aai-red" />
                        <span>{src.filename || src.source || 'Source'}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom timestamp & copy */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>
                    Saved on {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <button
                  onClick={() => handleCopy(item.answer, item._id)}
                  className="flex items-center gap-1 text-sky-500 hover:underline font-semibold"
                >
                  {copiedId === item._id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-500">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Text</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
