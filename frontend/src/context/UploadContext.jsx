import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { uploadApi, faaApi } from '../services/api';
import { CheckCircle, AlertTriangle, X, FileText, Globe } from 'lucide-react';

const UploadContext = createContext(null);

export const UploadProvider = ({ children }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusMsg, setUploadStatusMsg] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [activeFileName, setActiveFileName] = useState('');
  const [jobType, setJobType] = useState(null); // 'pdf' | 'faa_live' | 'faa_bulk'

  const pollIntervalRef = useRef(null);
  const pollTimeoutRef = useRef(null);

  const clearTimers = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    pollIntervalRef.current = null;
    pollTimeoutRef.current = null;
  };

  useEffect(() => {
    return () => clearTimers();
  }, []);

  const dismissNotification = () => {
    setUploadSuccess('');
    setUploadError('');
  };

  // Helper to start polling job status
  const startJobPolling = (jobId, successCallback) => {
    clearTimers();

    const MAX_POLL_DURATION_MS = 3 * 60 * 1000; // 3 minutes safety timeout
    const POLL_INTERVAL_MS = 1500;
    let consecutiveErrors = 0;
    const MAX_ERRORS = 5;

    pollTimeoutRef.current = setTimeout(() => {
      clearTimers();
      setUploading(false);
      setUploadError('Operation timed out. Progress was taking longer than expected.');
    }, MAX_POLL_DURATION_MS);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const statusRes = await uploadApi.getStatus(jobId);
        const jobData = statusRes.data?.data;

        if (!jobData || !jobData.status) {
          consecutiveErrors++;
          if (consecutiveErrors >= MAX_ERRORS) {
            clearTimers();
            setUploading(false);
            setUploadError('Unable to track background job progress.');
          }
          return;
        }

        consecutiveErrors = 0;

        if (jobData.status === 'processing') {
          const current = jobData.current || 0;
          const total = jobData.total || 0;
          const pct = total > 0 ? Math.round((current / total) * 100) : 5;
          setUploadProgress(pct);
          setUploadStatusMsg(jobData.message || 'Processing NOTAM data...');
        } else if (jobData.status === 'done') {
          clearTimers();
          setUploading(false);
          setUploadProgress(100);

          const count = jobData.result?.notams_found || 0;
          const chunks = jobData.result?.chunks_stored || jobData.result?.chunks || 0;
          const msg = jobData.result?.filename
            ? `Successfully ingested "${jobData.result.filename}"! (${count} NOTAMs decoded, ${chunks} vector chunks stored)`
            : `Successfully fetched ${count} NOTAMs! (${chunks} chunks stored)`;

          setUploadSuccess(msg);
          if (successCallback) successCallback(jobData.result);
        } else if (jobData.status === 'error') {
          clearTimers();
          setUploading(false);
          setUploadError(jobData.error || 'Job processing failed.');
        }
      } catch (pollErr) {
        consecutiveErrors++;
        if (consecutiveErrors >= MAX_ERRORS) {
          clearTimers();
          setUploading(false);
          setUploadError('Connection lost while tracking background progress.');
        }
      }
    }, POLL_INTERVAL_MS);
  };

  // 1. PDF Upload Action
  const startPdfUpload = async (file, category = 'Runway', onSuccess) => {
    if (!file) return;

    try {
      dismissNotification();
      setUploading(true);
      setUploadProgress(0);
      setUploadStatusMsg(`Uploading "${file.name}"...`);
      setActiveFileName(file.name);
      setJobType('pdf');

      const res = await uploadApi.uploadPdf(file, category);
      const responseData = res.data;

      if (!responseData.success || !responseData.data || !responseData.data.job_id) {
        throw new Error(responseData.message || 'No job ID returned from server.');
      }

      const jobId = responseData.data.job_id;
      setUploadStatusMsg(`File uploaded. Extracting and embedding NOTAMs...`);
      startJobPolling(jobId, onSuccess);
    } catch (err) {
      clearTimers();
      setUploading(false);
      const errMsg = err.response?.data?.message || err.message || 'PDF upload failed.';
      setUploadError(errMsg);
    }
  };

  // 2. FAA Live Fetch Action
  const startFaaFetch = async (isBulk = false, resolvedAirports = [], onSuccess) => {
    if (uploading) return;

    try {
      dismissNotification();
      setUploading(true);
      setUploadProgress(0);
      setUploadStatusMsg(isBulk ? 'Initializing FAA Bulk Fetch...' : 'Initializing FAA Live Fetch...');
      setActiveFileName(isBulk ? 'FAA Bulk Global NOTAMs' : 'FAA Live NOTAM Sync');
      setJobType(isBulk ? 'faa_bulk' : 'faa_live');

      const apiCall = isBulk ? faaApi.fetchBulk(resolvedAirports) : faaApi.fetchLive(resolvedAirports);
      const res = await apiCall;

      const jobId = res.data?.job_id;
      if (!jobId) {
        throw new Error('No job ID received from server.');
      }

      setUploadStatusMsg(isBulk ? 'Loading FAA NOTAM dataset...' : 'Fetching and parsing live FAA NOTAMs...');
      startJobPolling(jobId, onSuccess);
    } catch (err) {
      clearTimers();
      setUploading(false);
      const errMsg = err.response?.data?.detail?.message === 'cooldown_active'
        ? `Cooldown active. Please wait.`
        : (err.response?.data?.message || err.message || 'FAA fetch failed.');
      setUploadError(errMsg);
    }
  };

  return (
    <UploadContext.Provider
      value={{
        uploading,
        uploadProgress,
        uploadStatusMsg,
        uploadSuccess,
        uploadError,
        activeFileName,
        jobType,
        startPdfUpload,
        startFaaFetch,
        dismissNotification,
      }}
    >
      {children}

      {/* Global Floating Upload Progress Widget / Toast Notifications */}
      <div className="fixed bottom-6 right-6 z-50 max-w-md w-full sm:w-96 space-y-3 pointer-events-auto transition-all duration-300">
        {/* Active Upload Card */}
        {uploading && (
          <div className="p-4 rounded-2xl bg-slate-900/95 dark:bg-slate-900/95 border border-sky-500/40 text-white shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-5">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                {jobType === 'pdf' ? (
                  <FileText className="w-5 h-5 text-sky-400 shrink-0" />
                ) : (
                  <Globe className="w-5 h-5 text-emerald-400 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">
                    {activeFileName || 'Processing Document'}
                  </p>
                  <p className="text-[10px] text-slate-300 truncate">
                    {uploadStatusMsg || 'Processing...'}
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-sky-400 shrink-0 bg-sky-950/80 px-2 py-0.5 rounded-lg border border-sky-500/30">
                {uploadProgress}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-700/50">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  jobType === 'pdf' ? 'bg-gradient-to-r from-sky-500 to-indigo-500' : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                }`}
                style={{ width: `${Math.max(uploadProgress, 6)}%` }}
              />
            </div>
            <p className="text-[9px] text-slate-400 mt-2 text-right">
              Background active • Feel free to navigate pages
            </p>
          </div>
        )}

        {/* Success Toast */}
        {uploadSuccess && !uploading && (
          <div className="p-4 rounded-2xl bg-emerald-950/95 border border-emerald-500/50 text-white shadow-2xl backdrop-blur-xl flex items-start gap-3 animate-in fade-in slide-in-from-bottom-5">
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <p className="font-bold text-emerald-300">Upload Complete</p>
              <p className="text-slate-200 mt-0.5 leading-snug">{uploadSuccess}</p>
            </div>
            <button
              onClick={dismissNotification}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Error Toast */}
        {uploadError && !uploading && (
          <div className="p-4 rounded-2xl bg-rose-950/95 border border-rose-500/50 text-white shadow-2xl backdrop-blur-xl flex items-start gap-3 animate-in fade-in slide-in-from-bottom-5">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <p className="font-bold text-rose-300">Upload Failed</p>
              <p className="text-slate-200 mt-0.5 leading-snug">{uploadError}</p>
            </div>
            <button
              onClick={dismissNotification}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </UploadContext.Provider>
  );
};

export const useUpload = () => {
  const context = useContext(UploadContext);
  if (!context) {
    throw new Error('useUpload must be used within an UploadProvider');
  }
  return context;
};
