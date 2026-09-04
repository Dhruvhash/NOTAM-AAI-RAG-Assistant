import React, { useState, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { chatApi, uploadApi, bookmarkApi, faaApi, notamApi } from '../services/api';
import { useUpload } from '../context/UploadContext';
import {
  Send,
  Upload,
  FileText,
  Bookmark,
  Trash2,
  Sparkles,
  Bot,
  User,
  HelpCircle,
  Loader2,
  FileUp,
  AlertCircle,
  Copy,
  Check,
  Search,
  Globe,
  Database,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';


export default function ChatAssistant() {
  const { startPdfUpload, startFaaFetch, uploading: globalUploading, uploadProgress: globalProgress, uploadStatusMsg: globalMsg, uploadError: globalError } = useUpload();

  const [messages, setMessages] = useState([]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [bookmarkedMap, setBookmarkedMap] = useState({});
  const [latestFilename, setLatestFilename] = useState('');
  const [summarizing, setSummarizing] = useState(false);

  const uploading = globalUploading;
  const uploadProgress = globalProgress;
  const uploadStatusMsg = globalMsg;
  const uploadError = globalError;

  const chatEndRef = useRef(null);

  // FAA & Vector DB Search States
  const [airportQuery, setAirportQuery] = useState('');
  const [resolvedAirports, setResolvedAirports] = useState([]);
  const [cooldowns, setCooldowns] = useState({ incremental: 0, bulk: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [expandedResults, setExpandedResults] = useState({});

  const [activeSources, setActiveSources] = useState([]);
  const [totalChunks, setTotalChunks] = useState(0);

  const fetchActiveSources = async () => {
    try {
      const res = await notamApi.getSources();
      if (res.data) {
        setActiveSources(res.data.sources || []);
        setTotalChunks(res.data.total_chunks || 0);
      }
    } catch (err) {
      console.error('Failed to fetch active sources:', err);
    }
  };

  useEffect(() => {
    loadChatHistory();
    fetchCooldowns();
    fetchActiveSources();

    // 1-second timer to decrement cooldown states locally
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

    startFaaFetch(isBulk, resolvedAirports, (result) => {
      fetchCooldowns();
      const count = result?.notams_found || 0;
      const chunks = result?.chunks_stored || 0;
      setMessages((prev) => [
        ...prev,
        {
          sender: 'system',
          text: `🔄 FAA Live Fetch Complete: Successfully fetched and decoded ${count} NOTAMs (${chunks} chunks stored in Vector DB).`,
          timestamp: new Date(),
        },
      ]);
    });
  };

  const handleDbSearch = async (e) => {
    e?.preventDefault();
    if (!searchQuery.trim() || searching) return;

    setSearching(true);
    try {
      const res = await notamApi.search(searchQuery);
      setSearchResults(res.data.hits || []);
    } catch (err) {
      console.error('Vector DB search error:', err);
    } finally {
      setSearching(false);
    }
  };

  const toggleResultExpand = (idx) => {
    setExpandedResults((prev) => ({
      ...prev,
      [idx]: !prev[idx],
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

  useEffect(() => {

    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChatHistory = async () => {
    try {
      const res = await chatApi.getHistory();
      if (res.data && res.data.history) {
        const formatted = [];
        res.data.history.forEach((item) => {
          formatted.push({ sender: 'user', text: item.question, timestamp: item.timestamp });
          formatted.push({
            sender: 'assistant',
            text: item.answer,
            sources: item.sources || [],
            timestamp: item.timestamp,
            id: item._id,
          });
        });
        setMessages(formatted);
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  };

  // Dropzone File Upload Handler using Global UploadContext
  const onDrop = async (acceptedFiles) => {
    if (!acceptedFiles || acceptedFiles.length === 0) return;
    const file = acceptedFiles[0];

    startPdfUpload(file, 'Runway', (result) => {
      setLatestFilename(file.name);
      const chunks = result?.chunks_stored || result?.chunks || 0;
      const found = result?.notams_found || 0;
      setMessages((prev) => [
        ...prev,
        {
          sender: 'system',
          text: `📄 NOTAM Document Ingested: "${file.name}". Decoded ${found} NOTAMs and created ${chunks} vector chunks. Ready for vector search!`,
          timestamp: new Date(),
        },
      ]);
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
  });

  const handleSummarize = async () => {
    if (summarizing) return;
    const targetFile = latestFilename || 'faa_nms_live';

    setSummarizing(true);
    setMessages((prev) => [
      ...prev,
      {
        sender: 'user',
        text: `Summarize the operational NOTAM document "${targetFile}".`,
        timestamp: new Date(),
      },
    ]);

    try {
      const res = await uploadApi.summarizePdf(targetFile);
      const data = res.data.data;
      const summaryText = data?.summary || 'No summary could be generated.';

      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: summaryText,
          timestamp: new Date(),
        },
      ]);
    } catch (err) {
      console.error('Failed to summarize:', err);
      setMessages((prev) => [
        ...prev,
        {
          sender: 'system',
          text: '❌ Failed to generate AI summary. Please check API connectivity.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setSummarizing(false);
    }
  };

  // Handle Question Submit
  const handleSend = async (e) => {
    e?.preventDefault();
    const q = inputQuestion.trim();
    if (!q || loading) return;

    // Add user message immediately
    const userMsg = { sender: 'user', text: q, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInputQuestion('');
    setLoading(true);

    try {
      const res = await chatApi.ask(q);
      const chatData = res.data?.chat;
      const ragResp = res.data?.response;

      const answerText = chatData?.answer || ragResp?.answer || res.data?.answer || 'No answer found in ingested NOTAM documents.';
      const sources = chatData?.sources || ragResp?.sources || res.data?.sources || [];

      const assistantMsg = {
        sender: 'assistant',
        text: answerText,
        sources,
        timestamp: new Date(),
        id: chatData?._id || 'msg_' + Date.now(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: 'Sorry, unable to process question with Python RAG backend. Please ensure http://localhost:8000 is online.',
          sources: [],
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleExampleClick = (questionText) => {
    setInputQuestion(questionText);
  };

  const handleClearHistory = async () => {
    if (window.confirm('Are you sure you want to clear all chat history?')) {
      try {
        await chatApi.clearHistory();
        setMessages([]);
      } catch (err) {
        console.error('Clear history error:', err);
      }
    }
  };

  const handleBookmark = async (msg, index) => {
    try {
      await bookmarkApi.addBookmark({
        question: messages[index - 1]?.text || 'NOTAM Inquiry',
        answer: msg.text,
        sources: msg.sources || [],
        category: 'Chat Assistant',
      });
      setBookmarkedMap((prev) => ({ ...prev, [index]: true }));
    } catch (err) {
      console.error('Bookmark error:', err);
    }
  };

  const copyToClipboard = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const exampleQuestions = [
    'Are there any runway closures at Indira Gandhi Intl Airport (VIDP)?',
    'Summarize ILS and Navaid status at Mumbai (VABB).',
    'What are the active airspace restrictions over North India?',
    'Check obstacle advisories for Kolkata (VECC).',
  ];

  return (
    <div className="h-[calc(100vh-6rem)] max-w-7xl mx-auto flex gap-6 pb-2">
      {/* Left Sidebar: PDF Upload & Examples */}
      <div className="w-80 hidden lg:flex flex-col gap-5 shrink-0 overflow-y-auto">
        {/* Upload Dropzone Box */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Upload className="w-4 h-4 text-aai-red" />
            Ingest NOTAM PDF
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Upload PDF containing official NOTAM advisories to index into Python RAG engine.
          </p>

          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all ${
              isDragActive
                ? 'border-aai-red bg-rose-500/10'
                : 'border-slate-300 dark:border-slate-700 hover:border-aai-red dark:hover:border-aai-red bg-slate-50 dark:bg-slate-800/60'
            }`}
          >
            <input {...getInputProps()} />
            {uploading ? (
              <div className="flex flex-col items-center w-full gap-3 text-aai-red">
                <Loader2 className="w-8 h-8 animate-spin text-aai-red" />
                <span className="text-[11px] font-bold text-center leading-normal break-words max-w-[200px]">
                  {uploadStatusMsg}
                </span>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-aai-red to-aai-maroon h-full transition-all duration-300 rounded-full"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  {uploadProgress}% Complete
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-500 dark:text-slate-400">
                <FileUp className="w-8 h-8 text-sky-500" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Drag & Drop PDF file here
                </span>
                <span className="text-[10px] text-slate-400">or click to browse files</span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleSummarize}
            disabled={summarizing}
            className="w-full mt-3 py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
          >
            {summarizing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Generating AI Summary...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>{latestFilename ? `Summarize "${latestFilename}"` : 'Summarize Ingested NOTAMs'}</span>
              </>
            )}
          </button>

          {uploadError && (
            <div className="p-3 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}
        </div>

        {/* NOTAM Search Engine Panel */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Search className="w-4 h-4 text-sky-500" />
            Search Active NOTAMs
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Search stored NOTAM data using keyword semantic similarity.
          </p>

          <form onSubmit={handleDbSearch} className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Runway closures, ILS, etc."
                className="flex-1 px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-aai-red"
              />
              <button
                type="submit"
                disabled={searching || !searchQuery.trim()}
                className="p-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white transition-all disabled:opacity-50 flex items-center justify-center"
              >
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </button>
            </div>
          </form>

          {searchResults.length > 0 && (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold">
                <span>RESULTS ({searchResults.length})</span>
                <button type="button" onClick={() => setSearchResults([])} className="hover:text-rose-500">Clear</button>
              </div>
              
              {searchResults.map((hit, idx) => {
                const parsed = parseEnrichedNotam(hit.text);
                const isExpanded = !!expandedResults[idx];
                return (
                  <div key={idx} className="border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/40 p-2.5 text-left transition-all">
                    <button
                      type="button"
                      onClick={() => toggleResultExpand(idx)}
                      className="w-full flex items-center justify-between font-mono text-[10px] font-bold text-slate-700 dark:text-slate-300"
                    >
                      <span className="truncate max-w-[170px]">{parsed.fields["NOTAM ID"] || hit.source || `NOTAM #${hit.notam_index + 1}`}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-sky-500">{Math.round(hit.relevance * 100)}%</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </div>
                    </button>
                    
                    {parsed.simplified && (
                      <p className="text-[11px] mt-1 text-slate-600 dark:text-slate-350 leading-normal line-clamp-2">
                        {parsed.simplified}
                      </p>
                    )}

                    {isExpanded && (
                      <div className="mt-3.5 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3.5 text-[10px] leading-relaxed">
                        <div>
                          <div className="font-semibold text-slate-400 uppercase tracking-wider text-[8px] mb-1">Decoded Explanation</div>
                          <p className="text-slate-800 dark:text-slate-200 bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-lg font-medium">
                            {parsed.simplified}
                          </p>
                        </div>
                        
                        {Object.keys(parsed.fields).length > 0 && (
                          <div>
                            <div className="font-semibold text-slate-400 uppercase tracking-wider text-[8px] mb-1">Parsed Fields</div>
                            <div className="grid grid-cols-2 gap-x-2 gap-y-1 font-mono text-[9px] bg-slate-100 dark:bg-slate-800/80 p-2 rounded-lg text-slate-600 dark:text-slate-400">
                              {Object.entries(parsed.fields).map(([k, v]) => (
                                <div key={k} className="col-span-2 flex flex-col border-b border-slate-200/50 dark:border-slate-700/50 pb-1 mb-1 last:border-b-0 last:pb-0 last:mb-0">
                                  <span className="font-semibold text-[8px] text-slate-400">{k}</span>
                                  <span className="text-slate-700 dark:text-slate-300 break-words">{v}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div>
                          <div className="font-semibold text-slate-400 uppercase tracking-wider text-[8px] mb-1">Raw NOTAM</div>
                          <pre className="font-mono text-[8px] bg-slate-100 dark:bg-slate-800 p-2 rounded-lg text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-all">
                            {parsed.raw}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Example Questions */}

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-sky-500" />
            Example Queries
          </h3>

          <div className="space-y-2">
            {exampleQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleExampleClick(q)}
                className="w-full text-left p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 hover:bg-aai-rose dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-aai-red text-xs font-medium transition-all border border-slate-200/80 dark:border-slate-700/80 leading-relaxed"
              >
                "{q}"
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Chat Panel */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Chat Header */}
        <div className="h-16 px-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-aai-red to-aai-maroon flex items-center justify-center text-white shadow-md">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-white">
                AAI RAG Assistant
              </h2>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Vector Search Active
              </span>
            </div>
          </div>

          <button
            onClick={handleClearHistory}
            className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all flex items-center gap-1.5 text-xs font-medium"
            title="Clear Chat History"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Clear Chat</span>
          </button>
        </div>

        {/* Active Data Source Indicator Banner */}
        {(() => {
          const hasLiveFeed = activeSources.includes('faa_nms_live');
          const pdfSources = activeSources.filter((s) => s !== 'faa_nms_live');
          const hasPdf = pdfSources.length > 0;

          return (
            <div className="px-6 py-2.5 bg-slate-100/90 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs backdrop-blur-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Active Context:
                </span>

                {hasLiveFeed && hasPdf && (
                  <span className="px-2.5 py-1 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-300 font-bold border border-purple-500/20 flex items-center gap-1.5 shadow-2xs">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span>BOTH Active: Live FAA Feed + PDF ({pdfSources.join(', ')})</span>
                  </span>
                )}

                {hasPdf && !hasLiveFeed && (
                  <span className="px-2.5 py-1 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-300 font-bold border border-sky-500/20 flex items-center gap-1.5 shadow-2xs">
                    <FileText className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span>PDF Uploaded: {pdfSources.join(', ')}</span>
                  </span>
                )}

                {hasLiveFeed && !hasPdf && (
                  <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20 flex items-center gap-1.5 shadow-2xs">
                    <Globe className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Live FAA NOTAM Feed Active</span>
                  </span>
                )}

                {!hasLiveFeed && !hasPdf && (
                  <span className="px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/20 flex items-center gap-1.5 shadow-2xs">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>No Context Loaded (Upload PDF or Fetch Live Feed)</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold text-slate-500 dark:text-slate-400">
                <Database className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                <span>{totalChunks} Chunks Ingested</span>
              </div>
            </div>
          );
        })()}

        {/* Messages Scroll Area */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 text-slate-400">
              <div className="w-16 h-16 rounded-3xl bg-aai-rose dark:bg-slate-800 text-aai-red flex items-center justify-center shadow-inner">
                <Sparkles className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-white">
                  How can I assist your flight operations today?
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  Ask about active NOTAM advisories, runway closures, NAVAID unserviceability, or airport weather alerts.
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-3 max-w-3xl ${
                  msg.sender === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold text-xs shrink-0 shadow-sm ${
                    msg.sender === 'user'
                      ? 'bg-sky-600 text-white'
                      : msg.sender === 'system'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gradient-to-br from-aai-red to-aai-maroon text-white'
                  }`}
                >
                  {msg.sender === 'user' ? (
                    <User className="w-4 h-4" />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                </div>

                {/* Message Bubble */}
                <div className="space-y-2 max-w-2xl">
                  <div
                    className={`p-4 rounded-3xl text-sm leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white rounded-tr-none shadow-md font-medium'
                        : msg.sender === 'system'
                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-semibold'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none border border-slate-200 dark:border-slate-700/80 shadow-sm'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>

                    {/* Assistant Source Citations Badges */}
                    {msg.sender === 'assistant' && msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700/80 space-y-1.5">
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                          Verified Sources:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {msg.sources.map((src, sIdx) => (
                            <span
                              key={sIdx}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-700 dark:text-slate-300 shadow-2xs"
                            >
                              <FileText className="w-3 h-3 text-aai-red" />
                              <span>{src.filename || src.source || `NOTAM-Chunk-${sIdx + 1}`}</span>
                              {src.relevance && (
                                <span className="text-[10px] text-sky-500 font-bold ml-1">
                                  ({Math.round(src.relevance * 100)}%)
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bubble Action Controls */}
                  {msg.sender === 'assistant' && (
                    <div className="flex items-center gap-3 px-2 text-xs text-slate-400">
                      <button
                        onClick={() => copyToClipboard(msg.text, idx)}
                        className="hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1 transition-colors"
                      >
                        {copiedIdx === idx ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-emerald-500">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleBookmark(msg, idx)}
                        className={`flex items-center gap-1 transition-colors ${
                          bookmarkedMap[idx]
                            ? 'text-amber-500 font-semibold'
                            : 'hover:text-amber-500'
                        }`}
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                        <span>{bookmarkedMap[idx] ? 'Bookmarked' : 'Bookmark'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {loading && (
            <div className="flex items-center gap-3 text-slate-400 text-xs font-semibold py-2">
              <div className="w-8 h-8 rounded-2xl bg-aai-red/10 text-aai-red flex items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
              <span>Searching NOTAM vector database & drafting response...</span>
            </div>
          )}

          {uploading && (
            <div className="flex items-center gap-3 text-sky-500 text-xs font-semibold py-2">
              <div className="w-8 h-8 rounded-2xl bg-sky-500/10 text-sky-500 flex items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-sky-500" />
              </div>
              <span>Ingesting NOTAM document: {uploadStatusMsg} ({uploadProgress}%)...</span>
            </div>
          )}

          {summarizing && (
            <div className="flex items-center gap-3 text-sky-500 text-xs font-semibold py-2">
              <div className="w-8 h-8 rounded-2xl bg-sky-500/10 text-sky-500 flex items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-sky-500" />
              </div>
              <span>Summarizing NOTAM PDF advisories...</span>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSend} className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={inputQuestion}
              onChange={(e) => setInputQuestion(e.target.value)}
              placeholder={uploading ? "Ingestion in progress... Please wait." : summarizing ? "Summarizing PDF... Please wait." : "Ask a question about flight advisories or NOTAMs..."}
              className="flex-1 px-5 py-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:border-aai-red focus:ring-2 focus:ring-aai-red/20 transition-all disabled:opacity-60"
              disabled={loading || uploading || summarizing}
            />

            <button
              type="submit"
              disabled={loading || uploading || summarizing || !inputQuestion.trim()}
              className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-aai-red to-aai-maroon hover:from-rose-600 hover:to-aai-red text-white font-bold text-sm shadow-lg shadow-aai-red/25 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <span>Ask</span>
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
