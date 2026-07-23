import React, { useState, useEffect } from 'react';
import { notamApi, faaApi, uploadApi, chatApi } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { useUpload } from '../context/UploadContext';
import {
  Radio,
  Search,
  RefreshCw,
  Filter,
  Plane,
  AlertTriangle,
  Calendar,
  Layers,
  Upload,
  CheckCircle2,
  XCircle,
  Globe,
  Clock,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Trash2,
  AlertCircle,
  FileText,
} from 'lucide-react';

export default function NotamFeed() {
  const navigate = useNavigate();
  const { startFaaFetch, uploading: globalUploading, uploadProgress: globalProgress, uploadStatusMsg: globalMsg, uploadSuccess: globalSuccess, uploadError: globalError } = useUpload();

  const [notams, setNotams] = useState([]);
  const [sourcesList, setSourcesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedAirport, setSelectedAirport] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // FAA fetch states
  const [airportQuery, setAirportQuery] = useState('');
  const [resolvedAirports, setResolvedAirports] = useState([]);
  const [cooldowns, setCooldowns] = useState({ incremental: 0, bulk: 0 });

  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  const uploading = globalUploading;
  const uploadProgress = globalProgress;
  const uploadStatusMsg = globalMsg;
  const uploadSuccess = globalSuccess || actionSuccess;
  const uploadError = globalError || actionError;

  // Expand states for raw NOTAM contents in feed
  const [expandedCards, setExpandedCards] = useState({});

  // Summarize states
  const [summarizing, setSummarizing] = useState(false);
  const [activeSummary, setActiveSummary] = useState(null);
  const [summaryTarget, setSummaryTarget] = useState('faa_nms_live'); // or specific pdf

  useEffect(() => {
    fetchNotamFeed();
    fetchCooldowns();

    const cooldownInterval = setInterval(() => {
      setCooldowns((prev) => ({
        incremental: Math.max(0, prev.incremental - 1),
        bulk: Math.max(0, prev.bulk - 1),
      }));
    }, 1000);

    return () => clearInterval(cooldownInterval);
  }, []);

  // Debounced resolution of input airport query to ICAO codes
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (airportQuery.trim()) {
        try {
          const res = await faaApi.resolveAirports(airportQuery);
          setResolvedAirports(res.data.icao_codes || []);
        } catch (err) {
          console.error('Resolve airports error:', err);
        }
      } else {
        setResolvedAirports([]);
      }
    }, 450);

    return () => clearTimeout(delayDebounce);
  }, [airportQuery]);

  const fetchNotamFeed = async () => {
    try {
      setLoading(true);
      setActionError('');
      
      const [allRes, sourcesRes] = await Promise.all([
        notamApi.getAll(),
        notamApi.getSources()
      ]);
      
      if (allRes.data && allRes.data.notams) {
        setNotams(allRes.data.notams);
      } else {
        setNotams([]);
      }

      if (sourcesRes.data && sourcesRes.data.sources) {
        setSourcesList(sourcesRes.data.sources);
      } else {
        setSourcesList([]);
      }
    } catch (error) {
      console.error('Failed to fetch NOTAM feed:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCooldowns = async () => {
    try {
      const res = await faaApi.getCooldown();
      setCooldowns({
        incremental: Math.round(res.data.incremental_remaining || 0),
        bulk: Math.round(res.data.bulk_remaining || 0),
      });
    } catch (err) {
      console.error('Failed to fetch cooldowns:', err);
    }
  };

  const handleFaaLiveFetch = async (isBulk = false) => {
    if (isBulk) {
      console.warn("Bulk fetch feature is disabled.");
      return;
    }
    if (!isBulk && cooldowns.incremental > 0) return;

    startFaaFetch(isBulk, resolvedAirports, () => {
      fetchCooldowns();
      fetchNotamFeed();
    });
  };

  const handleSummarize = async () => {
    if (summarizing) return;
    const target = summaryTarget || 'faa_nms_live';

    setSummarizing(true);
    setActiveSummary(null);
    try {
      const res = await uploadApi.summarizePdf(target);
      if (res.data && res.data.data) {
        setActiveSummary(res.data.data);
      } else {
        setActiveSummary({ summary: 'No summary could be generated for this source.', total_notams: 0 });
      }
    } catch (err) {
      console.error('Failed to generate summary:', err);
      setActionError('Failed to generate summary. Please check API connectivity.');
    } finally {
      setSummarizing(false);
    }
  };

  const handleClearAll = async () => {
    if (window.confirm('Are you sure you want to clear all stored NOTAMs and reset cooldowns?')) {
      try {
        setLoading(true);
        await chatApi.clearHistory(); // calls clear history on Node / python clear RAG
        setNotams([]);
        setSourcesList([]);
        setActionSuccess('Database successfully cleared & cooldown states reset!');
        fetchCooldowns();
      } catch (err) {
        console.error('Failed to clear database:', err);
        setActionError('Failed to clear database.');
      } finally {
        setLoading(false);
      }
    }
  };

  const toggleCardExpand = (id) => {
    setExpandedCards((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const parseEnrichedNotam = (text) => {
    const result = {
      raw: '',
      fields: {},
      simplified: '',
    };
    
    if (!text) return result;
    
    const rawParts = text.split('=== PARSED FIELDS ===');
    if (rawParts.length > 0) {
      result.raw = rawParts[0].replace('=== RAW NOTAM ===', '').trim();
    }
    
    if (rawParts.length > 1) {
      const fieldsParts = rawParts[1].split('=== SIMPLIFIED EXPLANATION ===');
      if (fieldsParts.length > 0) {
        const fieldLines = fieldsParts[0].trim().split('\n');
        fieldLines.forEach(line => {
          const colonIdx = line.indexOf(':');
          if (colonIdx !== -1) {
            const key = line.substring(0, colonIdx).trim();
            const val = line.substring(colonIdx + 1).trim();
            result.fields[key] = val;
          }
        });
      }
      if (fieldsParts.length > 1) {
        result.simplified = fieldsParts[1].trim();
      }
    } else {
      const simpleParts = text.split('=== SIMPLIFIED EXPLANATION ===');
      if (simpleParts.length > 0) {
        result.raw = simpleParts[0].replace('=== RAW NOTAM ===', '').trim();
      }
      if (simpleParts.length > 1) {
        result.simplified = simpleParts[1].trim();
      }
    }
    
    return result;
  };

  const detectCategory = (rawText, simplifiedText, qLine) => {
    const txt = `${rawText || ''} ${simplifiedText || ''} ${qLine || ''}`.toUpperCase();
    if (txt.includes('RWY') || txt.includes('RUNWAY') || txt.includes('TWY') || txt.includes('TAXIWAY') || txt.includes('TXL') || txt.includes('APRON') || txt.includes('APN') || txt.includes('STAND') || txt.includes('SURFACE')) {
      return 'Runway';
    }
    if (txt.includes('ILS') || txt.includes('VOR') || txt.includes('DME') || txt.includes('FREQ') || txt.includes('GP') || txt.includes('PAPI') || txt.includes('NDB') || txt.includes('PROC') || txt.includes('RNP') || txt.includes('APPROACH') || txt.includes('LOC')) {
      return 'Navaid';
    }
    if (txt.includes('OBST') || txt.includes('OBSTACLE') || txt.includes('CRANE') || txt.includes('TOWER') || txt.includes('MAST') || txt.includes('LIGHT') || txt.includes('BIRD')) {
      return 'Obstacle';
    }
    return 'Airspace';
  };

  const checkStatus = (endUtc) => {
    if (!endUtc) return 'Active';
    if (endUtc.toUpperCase() === 'PERM' || endUtc.toUpperCase().includes('UFN')) return 'Active';
    const match = endUtc.match(/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
    if (match) {
      const year = parseInt('20' + match[1]);
      const month = parseInt(match[2]) - 1;
      const day = parseInt(match[3]);
      const hour = parseInt(match[4]);
      const min = parseInt(match[5]);
      const endDate = new Date(Date.UTC(year, month, day, hour, min));
      return endDate > new Date() ? 'Active' : 'Expired';
    }
    return 'Active';
  };

  const formatDate = (notamDateStr) => {
    if (!notamDateStr) return 'N/A';
    if (notamDateStr.toUpperCase() === 'PERM') return 'Permanent';
    if (notamDateStr.toUpperCase().includes('UFN')) return 'Until Further Notice';
    
    const match = notamDateStr.match(/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
    if (match) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const year = '20' + match[1];
      const month = months[parseInt(match[2]) - 1];
      const day = parseInt(match[3]);
      const hour = match[4];
      const min = match[5];
      return `${day} ${month} ${year}, ${hour}:${min} UTC`;
    }
    return notamDateStr;
  };


  // Map database NOTAMs
  const allNotams = notams.map((n) => {
    const parsed = parseEnrichedNotam(n.text);
    const category = detectCategory(parsed.raw, parsed.simplified, parsed.fields["Qualifier"]);
    const status = checkStatus(parsed.fields["End (UTC)"] || parsed.fields["C"]);
    return {
      id: n.id,
      notam_id: parsed.fields["NOTAM ID"] || n.notam_id || "NOTAM",
      icao: n.icao || parsed.fields["Location"] || "Global",
      source: n.source,
      category,
      status,
      parsed,
      raw: parsed.raw,
      simplified: parsed.simplified,
      validFrom: parsed.fields["Start (UTC)"] || parsed.fields["B"] || '',
      validTo: parsed.fields["End (UTC)"] || parsed.fields["C"] || '',
    };
  });

  // Dynamically compute list of airports for filter dropdown
  const knownAirportsMap = {
    VIDP: 'VIDP - Delhi', VABB: 'VABB - Mumbai', VOBL: 'VOBL - Bengaluru',
    VOMM: 'VOMM - Chennai', VECC: 'VECC - Kolkata', VOHS: 'VOHS - Hyderabad',
    VAAH: 'VAAH - Ahmedabad', VOCI: 'VOCI - Cochin', VAGO: 'VAGO - Goa',
    EGLL: 'EGLL - London Heathrow', KJFK: 'KJFK - New York JFK', OMDB: 'OMDB - Dubai',
    WSSS: 'WSSS - Singapore', VHHH: 'VHHH - Hong Kong', RJTT: 'RJTT - Tokyo Haneda',
    EDDF: 'EDDF - Frankfurt', LFPG: 'LFPG - Paris CDG', YSSY: 'YSSY - Sydney',
  };

  const availableAirports = Array.from(
    new Set([
      'VIDP', 'VABB', 'VOBL', 'VOMM', 'VECC', 'VOHS', 'VAAH', 'VOCI', 'EGLL', 'KJFK', 'OMDB', 'WSSS',
      ...allNotams.map((item) => item.icao).filter((code) => code && code !== 'Global')
    ])
  ).sort();

  // Filtering Logic
  const filteredNotams = allNotams.filter((item) => {
    const matchesKeyword =
      item.notam_id.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      item.icao.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      item.raw.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      item.simplified.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      item.source.toLowerCase().includes(searchKeyword.toLowerCase());

    const matchesAirport = selectedAirport === 'ALL' || item.icao === selectedAirport;
    const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory;
    const matchesStatus = selectedStatus === 'ALL' || item.status === selectedStatus;

    return matchesKeyword && matchesAirport && matchesCategory && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 text-white shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sky-400 font-bold text-xs uppercase tracking-widest">
            <Radio className="w-4 h-4 animate-pulse" />
            Live Flight Notice Dispatch
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Active NOTAM Bulletin Feed
          </h1>
          <p className="text-xs text-slate-300">
            Real-time feed synchronized with vector database embeddings and AAI flight ops directives.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchNotamFeed}
            disabled={loading}
            className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-all flex items-center gap-2 backdrop-blur-md border border-white/10"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Feed</span>
          </button>

          <button
            onClick={() => navigate('/chat')}
            className="px-4 py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-lg shadow-sky-600/30 transition-all flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            <span>Open Chat Assistant</span>
          </button>
        </div>
      </div>

      {/* Main Multi-Column Content */}
      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* Left Column Controls: FAA fetch & summaries */}
        <div className="w-full lg:w-80 shrink-0 space-y-6">
          
          {/* FAA Live Fetch Panel */}
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-500" />
              FAA Live Fetch
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Fetch real-time international NOTAMs directly from the FAA NMS-API.
            </p>

            <div className="space-y-2">
              <input
                type="text"
                value={airportQuery}
                onChange={(e) => setAirportQuery(e.target.value)}
                placeholder="Airport name or ICAO, e.g. Delhi, VABB"
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-sky-500"
              />
              {airportQuery && resolvedAirports.length > 0 && (
                <div className="p-2 rounded-xl bg-sky-500/5 text-sky-600 dark:text-sky-400 text-[10px] font-semibold leading-normal">
                  Recognized: {resolvedAirports.join(', ')}
                </div>
              )}
              {airportQuery && resolvedAirports.length === 0 && (
                <div className="p-2 rounded-xl bg-amber-500/5 text-amber-600 dark:text-amber-400 text-[10px] font-medium leading-normal">
                  No airports matched. Defaults to all (VIDP, VABB, VOBL, VOMM).
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 w-full">
                <button
                  type="button"
                  onClick={() => handleFaaLiveFetch(false)}
                  disabled={uploading || cooldowns.incremental > 0}
                  className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all disabled:opacity-50 flex flex-col items-center justify-center gap-1 shadow-2xs"
                >
                  <span>Live Fetch</span>
                  {cooldowns.incremental > 0 ? (
                    <span className="text-[9px] font-medium opacity-80 flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      {Math.floor(cooldowns.incremental / 60)}m {cooldowns.incremental % 60}s
                    </span>
                  ) : (
                    <span className="text-[8px] font-medium opacity-80">3 min cooldown</span>
                  )}
                </button>

                <button
                  type="button"
                  disabled={true}
                  className="w-full py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-450 dark:text-slate-500 text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 cursor-not-allowed opacity-50 border border-slate-200 dark:border-slate-700"
                >
                  <span>Bulk Fetch</span>
                  <span className="text-[8px] font-medium opacity-80">24 hr limit</span>
                </button>
              </div>

              {uploading && (
                <div className="space-y-2 pt-2 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <span className="flex items-center gap-1.5 truncate">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500 shrink-0" />
                      <span className="truncate">{uploadStatusMsg || 'Processing NOTAMs...'}</span>
                    </span>
                    <span className="shrink-0 ml-1 font-mono">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-300 rounded-full"
                      style={{ width: `${Math.max(uploadProgress, 5)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* AI Summary Panel */}
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-500" />
              Operational Summary
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Generate structured, categorized summary of stored FAA feeds or PDFs.
            </p>

            <div className="space-y-2">
              <select
                value={summaryTarget}
                onChange={(e) => setSummaryTarget(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
              >
                <option value="faa_nms_live">Live FAA NOTAM Feed</option>
                {sourcesList.map((src, idx) => (
                  <option key={idx} value={src}>{src}</option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleSummarize}
                disabled={summarizing || !summaryTarget}
                className="w-full py-2 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-2xs"
              >
                {summarizing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Summarizing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate AI Summary</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* System Control Panel */}
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">
              Data Management
            </h3>
            <button
              onClick={handleClearAll}
              disabled={loading || uploading}
              className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear database & Cooldowns</span>
            </button>
          </div>

          {/* Feedback Alerts */}
          {uploadSuccess && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs flex items-start gap-2.5 font-medium border border-emerald-500/10 shadow-2xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{uploadSuccess}</span>
            </div>
          )}

          {uploadError && (
            <div className="p-3.5 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 text-xs flex items-start gap-2.5 font-medium border border-sky-500/10 shadow-2xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{uploadError}</span>
            </div>
          )}

        </div>

        {/* Right Column: Filters and Card Feed */}
        <div className="flex-1 space-y-6">
          
          {/* Filters Bar */}
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Keyword Search */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder="Search NOTAM code or content..."
                  className="w-full pl-11 pr-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 text-xs focus:outline-none focus:border-sky-500 transition-all"
                />
              </div>

              {/* Airport ICAO Filter */}
              <div className="relative">
                <Plane className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <select
                  value={selectedAirport}
                  onChange={(e) => setSelectedAirport(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-sky-500 transition-all"
                >
                  <option value="ALL">All Airports (ICAO)</option>
                  {availableAirports.map((code) => (
                    <option key={code} value={code}>
                      {knownAirportsMap[code] || `${code} Airport`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category Filter */}
              <div className="relative">
                <Layers className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-sky-500 transition-all"
                >
                  <option value="ALL">All Categories</option>
                  <option value="Runway">Runway Operations</option>
                  <option value="Navaid">Navaid & ILS</option>
                  <option value="Airspace">Airspace Advisory</option>
                  <option value="Obstacle">Obstacle Hazard</option>
                </select>
              </div>

              {/* Status Filter */}
              <div className="relative">
                <Filter className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-sky-500 transition-all"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="Active">Active Only</option>
                  <option value="Expired">Expired</option>
                </select>
              </div>

            </div>
          </div>

          {/* AI Operational Summary Output Panel */}
          {activeSummary && (
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 text-white shadow-md space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                <Sparkles className="w-48 h-48 text-sky-500" />
              </div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-sky-400" />
                  <span className="font-bold text-sm tracking-wide">AI Operational Summary Output</span>
                </div>
                <button
                  onClick={() => setActiveSummary(null)}
                  className="text-slate-400 hover:text-white text-xs font-semibold"
                >
                  Clear Summary
                </button>
              </div>
              
              <div className="prose prose-invert max-w-none text-xs leading-relaxed space-y-3 font-medium text-slate-300">
                {activeSummary.summary.split('\n').map((line, idx) => {
                  if (line.startsWith('# ')) {
                    return <h2 key={idx} className="text-base font-extrabold text-white mt-4">{line.replace('# ', '')}</h2>;
                  } else if (line.startsWith('## ')) {
                    return <h3 key={idx} className="text-sm font-bold text-sky-400 mt-3">{line.replace('## ', '')}</h3>;
                  } else if (line.startsWith('- ') || line.startsWith('* ')) {
                    return <li key={idx} className="ml-4 list-disc">{line.substring(2)}</li>;
                  } else if (line.trim()) {
                    return <p key={idx}>{line}</p>;
                  }
                  return null;
                })}
              </div>

              <div className="pt-3 border-t border-slate-800 text-[10px] text-slate-500 flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" />
                <span>Source: {activeSummary.source || summaryTarget} | Analyzed NOTAM count: {activeSummary.total_notams || 0}</span>
              </div>
            </div>
          )}

          {/* Cards Feed Grid */}
          {filteredNotams.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
              <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                No matching NOTAM notices found
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Try adjusting your search query or trigger a fresh Live Fetch on the left to pull real-time data.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredNotams.map((notam) => {
                const isExpanded = !!expandedCards[notam.id];
                return (
                  <div
                    key={notam.id}
                    className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      {/* Top Row */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-extrabold text-xs font-mono border border-slate-200 dark:border-slate-700">
                            {notam.notam_id}
                          </span>
                          <span className="px-2.5 py-1 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold text-xs">
                            {notam.icao}
                          </span>
                        </div>

                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${
                          notam.status === 'Active'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20'
                        }`}>
                          {notam.status === 'Active' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          {notam.status}
                        </span>
                      </div>

                      {/* Body Info */}
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-aai-red dark:text-rose-400">
                            Category: {notam.category}
                          </span>
                          <span className="text-[10px] text-slate-400 truncate max-w-[150px]">
                            Source: {notam.source}
                          </span>
                        </div>

                        {/* Decoded Simplified Message */}
                        <div className="p-3.5 rounded-2xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/10">
                          <span className="font-semibold text-[10px] text-emerald-600 dark:text-emerald-400 uppercase tracking-wide block mb-1">Decoded Plain Language</span>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-relaxed font-mono">
                            {notam.simplified || "Simplified explanation unavailable."}
                          </p>
                        </div>

                        {/* Collapsible details */}
                        {isExpanded && (
                          <div className="pt-2 space-y-3.5 text-xs">
                            {Object.keys(notam.parsed.fields).length > 0 && (
                              <div>
                                <span className="font-semibold text-slate-400 uppercase tracking-wider text-[8px] block mb-1">Parsed Core Fields</span>
                                <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/80 font-mono text-[10px]">
                                  {Object.entries(notam.parsed.fields).map(([k, v]) => (
                                    <div key={k} className="col-span-2 flex flex-col border-b border-slate-200/40 dark:border-slate-700/40 pb-1 mb-1 last:border-b-0 last:pb-0 last:mb-0">
                                      <span className="font-bold text-[8px] text-slate-400">{k}</span>
                                      <span className="text-slate-700 dark:text-slate-355 break-words">{v}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div>
                              <span className="font-semibold text-slate-400 uppercase tracking-wider text-[8px] block mb-1">Raw Coded NOTAM Code</span>
                              <pre className="font-mono text-[9px] bg-slate-100 dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-200/50 dark:border-slate-800/80 text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-all leading-normal">
                                {notam.raw}
                              </pre>
                            </div>
                          </div>
                        )}

                        {/* Toggle Button */}
                        <button
                          type="button"
                          onClick={() => toggleCardExpand(notam.id)}
                          className="w-full py-1 text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-700 hover:underline flex items-center justify-center gap-1 transition-all"
                        >
                          {isExpanded ? (
                            <>
                              <span>Hide Details</span>
                              <ChevronUp className="w-3.5 h-3.5" />
                            </>
                          ) : (
                            <>
                              <span>Show Details (Coded & Parsed Fields)</span>
                              <ChevronDown className="w-3.5 h-3.5" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Footer Timestamps */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>Valid From: {formatDate(notam.validFrom)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Expires: {formatDate(notam.validTo)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
