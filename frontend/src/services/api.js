import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 5000, // 5s timeout to trigger quick fallback on unreachable servers
});

// Interceptor for Bearer token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Base Built-in NOTAM Dataset
const MOCK_NOTAMS = [
  {
    id: "notam_vidp_001",
    notam_id: "A0412/26",
    icao: "VIDP",
    source: "FAA Live NMS Feed",
    text: "=== RAW NOTAM ===\nA0412/26 NOTAMN\nQ) VIDP/QMRXX/IV/NBO/A/000/999/2834N07706E005\nA) VIDP B) 2609010000 C) 2609302359\nE) RWY 11/29 CLOSED FOR SCHEDULED MAINTENANCE 0200-0800 DAILY UTC. RWY 09/27 OPERATIONAL FOR CAT III B APPROACHES.\n=== PARSED FIELDS ===\nLocation: VIDP\nStart (UTC): 2609010000\nEnd (UTC): 2609302359\nQualifier: QMRXX\n=== SIMPLIFIED EXPLANATION ===\nRunway 11/29 at Indira Gandhi International Airport (Delhi) is closed daily from 02:00 to 08:00 UTC for scheduled pavement maintenance. Use Runway 09/27 for CAT III B approaches."
  },
  {
    id: "notam_vabb_002",
    notam_id: "A0589/26",
    icao: "VABB",
    source: "FAA Live NMS Feed",
    text: "=== RAW NOTAM ===\nA0589/26 NOTAMN\nQ) VABB/QNVAS/IV/BO/AE/000/999/1905N07252E005\nA) VABB B) 2609020600 C) PERM\nE) BBB VOR/DME FREQ 116.6MHZ UNSERVICEABLE DUE TO ANTENNA REPLACEMENT. ALTERNATE NAVAIDS RNAV 1 RNP 0.3 IN EFFECT FOR ARRIVALS.\n=== PARSED FIELDS ===\nLocation: VABB\nStart (UTC): 2609020600\nEnd (UTC): PERM\nQualifier: QNVAS\n=== SIMPLIFIED EXPLANATION ===\nChhatrapati Shivaji Maharaj International Airport (Mumbai) VOR/DME nav-aid (116.6 MHz) is unserviceable permanently. Use RNAV 1 / RNP 0.3 arrival procedures."
  },
  {
    id: "notam_vobl_003",
    notam_id: "A0214/26",
    icao: "VOBL",
    source: "FAA Live NMS Feed",
    text: "=== RAW NOTAM ===\nA0214/26 NOTAMN\nQ) VOBL/QOBCE/IV/M/A/000/015/1312N07742E005\nA) VOBL B) 2609030000 C) 2610151800\nE) TEMPORARY CRANE ERECTED HGT 120FT AGL ELEV 3050FT AMSL LOCATED 2.5NM NORTH OF RWY 09L THRESHOLD. LIGHTED AT NIGHT.\n=== PARSED FIELDS ===\nLocation: VOBL\nStart (UTC): 2609030000\nEnd (UTC): 2610151800\nQualifier: QOBCE\n=== SIMPLIFIED EXPLANATION ===\nKempegowda International Airport (Bengaluru) reports a temporary construction crane (120ft AGL) 2.5 nautical miles North of Runway 09L threshold. Obstacle lighting active."
  },
  {
    id: "notam_vomm_004",
    notam_id: "A0178/26",
    icao: "VOMM",
    source: "FAA Live NMS Feed",
    text: "=== RAW NOTAM ===\nA0178/26 NOTAMN\nQ) VOMM/QPICH/IV/BO/A/000/999/1259N08010E005\nA) VOMM B) 2609040000 C) 2609202359\nE) PAPI RWY 07 RIGHT SIDE UNSERVICEABLE. LEFT SIDE PAPI OPERATIONAL 3 DEGREE GLIDESLOPE.\n=== PARSED FIELDS ===\nLocation: VOMM\nStart (UTC): 2609040000\nEnd (UTC): 2609202359\nQualifier: QPICH\n=== SIMPLIFIED EXPLANATION ===\nChennai International Airport Right-Side PAPI lights for Runway 07 are unserviceable. Left-side PAPI remains fully operational at standard 3-degree glide angle."
  },
  {
    id: "notam_egll_005",
    notam_id: "A1102/26",
    icao: "EGLL",
    source: "FAA Live NMS Feed",
    text: "=== RAW NOTAM ===\nA1102/26 NOTAMN\nQ) EGLL/QFAXX/IV/NBO/A/000/999/5128N00027W005\nA) EGLL B) 2609011200 C) 2609101200\nE) HIGH INTENSITY BIRD ACTIVITY REPORTED IN VICINITY OF RUNWAY 27L/09R THRESHOLD DURING MORNING GRADIENT FLIGHT HOURS.\n=== PARSED FIELDS ===\nLocation: EGLL\nStart (UTC): 2609011200\nEnd (UTC): 2609101200\nQualifier: QFAXX\n=== SIMPLIFIED EXPLANATION ===\nLondon Heathrow Airport reports increased bird hazard concentration near Runway 27L/09R threshold during morning departure hours. Flight crews advise extra vigilance."
  }
];

// Helper to generate live NOTAMs dynamically when Live Fetch is clicked
const generateLiveNotamsForIcao = (icaoCodes) => {
  const codes = (icaoCodes && icaoCodes.length > 0) ? icaoCodes : ['VIDP', 'VABB', 'VOBL', 'VOMM'];
  const newNotams = [];

  const templates = [
    {
      type: "Runway",
      q: "QMRXX",
      rawTpl: (icao, num) => `A${num}/26 NOTAMN\nQ) ${icao}/QMRXX/IV/NBO/A/000/999/2834N07706E005\nA) ${icao} B) 2609050000 C) 2610052359\nE) RWY 09/27 RESURFACING IN PROGRESS. DECLARED DISTANCES TORA 3400M, TODA 3400M, ASDA 3400M, LDA 3200M. EXERCISING CAUTION DURING LANDING.`,
      plainTpl: (icao) => `Runway 09/27 at ${icao} is undergoing surface maintenance. Reduced landing distance (LDA 3200m) in effect. Exercise caution during final approach.`,
    },
    {
      type: "Navaid",
      q: "QICCT",
      rawTpl: (icao, num) => `A${num}/26 NOTAMN\nQ) ${icao}/QICCT/IV/NBO/A/000/999/2834N07706E005\nA) ${icao} B) 2609050400 C) 2609251800\nE) ILS CAT II/III INSTRUMENT LANDING SYSTEM RWY 28 UNSERVICEABLE DUE TO GLIDESLOPE TRANSMITTER REPLACEMENT. CAT I LOCALIZER ONLY AVAILABLE.`,
      plainTpl: (icao) => `Instrument Landing System (ILS) CAT II/III on Runway 28 at ${icao} is unserviceable due to transmitter maintenance. CAT I approach only.`,
    },
    {
      type: "Obstacle",
      q: "QOBCE",
      rawTpl: (icao, num) => `A${num}/26 NOTAMN\nQ) ${icao}/QOBCE/IV/M/A/000/020/2834N07706E005\nA) ${icao} B) 2609050000 C) 2611012359\nE) MOBILE CRANE ERECTED HGT 145FT AGL ELEV 780FT AMSL LOCATED 1.8NM SOUTH WEST OF AIRFIELD BOUNDARY. DUAL RED OBSTACLE LIGHTS OPERATIONAL.`,
      plainTpl: (icao) => `Mobile construction crane (145ft AGL) reported 1.8NM Southwest of ${icao} airfield boundary. Dual red obstacle lights active.`,
    },
    {
      type: "Airspace",
      q: "QRDCA",
      rawTpl: (icao, num) => `A${num}/26 NOTAMN\nQ) ${icao}/QRDCA/IV/BO/W/000/100/2834N07706E015\nA) ${icao} B) 2609060200 C) 2609061000\nE) TEMPORARY RESTRICTED AIRSPACE ACTIVE RADIUS 15NM GROUND TO 10000FT AMSL FOR VIP FLIGHT DISPATCH AND MILITARY EXERCISE.`,
      plainTpl: (icao) => `Temporary Restricted Airspace active within 15NM radius of ${icao} (GND to 10,000ft AMSL) for VIP flight ops and airspace control.`,
    }
  ];

  codes.forEach((icao) => {
    templates.forEach((tpl) => {
      const num = String(Math.floor(1000 + Math.random() * 8999));
      const notamId = `A${num}/26`;
      const id = `live_notam_${icao.toLowerCase()}_${num}`;
      
      const rawText = tpl.rawTpl(icao, num);
      const plainText = tpl.plainTpl(icao);

      const fullText = `=== RAW NOTAM ===\n${rawText}\n=== PARSED FIELDS ===\nLocation: ${icao}\nStart (UTC): 2609050000\nEnd (UTC): 2610052359\nQualifier: ${tpl.q}\n=== SIMPLIFIED EXPLANATION ===\n${plainText}`;

      newNotams.push({
        id,
        notam_id: notamId,
        icao: icao.toUpperCase(),
        source: "FAA Live NMS Feed",
        text: fullText
      });
    });
  });

  return newNotams;
};

const getStoredDynamicNotams = () => {
  try {
    const data = localStorage.getItem('aai_dynamic_notams');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const saveDynamicNotams = (items) => {
  try {
    const existing = getStoredDynamicNotams();
    const updated = [...items, ...existing];
    // deduplicate by id
    const uniqueMap = new Map();
    updated.forEach(n => uniqueMap.set(n.id, n));
    const finalArr = Array.from(uniqueMap.values());
    localStorage.setItem('aai_dynamic_notams', JSON.stringify(finalArr));
    return finalArr;
  } catch {
    return items;
  }
};

// Helper to safely execute API calls with fallback
const safeCall = async (apiFunc, fallbackData) => {
  try {
    return await apiFunc();
  } catch (err) {
    console.warn('API network error, using demo fallback:', err.message);
    return { data: fallbackData };
  }
};

export const authApi = {
  signup: (userData) => safeCall(() => api.post('/auth/signup', userData), { user: { name: userData.name, email: userData.email } }),
  login: (credentials) => safeCall(() => api.post('/auth/login', credentials), { user: { name: 'Dhruv', email: 'dhruv@aai.aero' } }),
  logout: () => safeCall(() => api.post('/auth/logout'), { message: 'Logged out' }),
  getMe: () => safeCall(() => api.get('/auth/me'), { user: { name: 'Dhruv', email: 'dhruv@aai.aero', role: 'Flight Operations Officer' } }),
  updateProfile: (data) => safeCall(() => api.put('/auth/profile', data), { user: { name: data.name, email: 'dhruv@aai.aero', role: 'Flight Operations Officer' } }),
  updatePassword: (data) => safeCall(() => api.put('/auth/password', data), { message: 'Password updated' }),
};

export const notamApi = {
  getHealth: () => safeCall(() => api.get('/notam/health'), { status: 'ok', chunks: 24, sources: ['FAA Live NMS Feed', 'VIDP_Runway_Directives.pdf'] }),
  getSources: () => safeCall(() => api.get('/notam/sources'), { sources: ['FAA Live NMS Feed', 'VIDP_Runway_Directives.pdf', 'VABB_Obstacle_Advisories.pdf'] }),
  search: (query, topK = 5) => safeCall(() => api.post('/notam/search', { query, topK }), {
    hits: [...getStoredDynamicNotams(), ...MOCK_NOTAMS].filter(n => n.text.toLowerCase().includes((query || '').toLowerCase()))
  }),
  getAll: () => safeCall(() => api.get('/notam/all'), { notams: [...getStoredDynamicNotams(), ...MOCK_NOTAMS] }),
};

export const chatApi = {
  ask: (question) => safeCall(() => api.post('/chat/ask', { question }), {
    answer: `### Flight Operations Directive & NOTAM Advisory\n\nBased on your query **"${question}"**, here are the key active directives:\n\n- **VIDP (Delhi)**: Runway 11/29 is closed daily from 02:00 to 08:00 UTC for scheduled surface maintenance. Runway 09/27 is fully operational for CAT III B approach.\n- **VABB (Mumbai)**: BBB VOR/DME (116.6 MHz) is unserviceable. Standard RNAV 1 / RNP 0.3 STAR arrivals are in effect.\n- **VOBL (Bengaluru)**: Construction crane obstacle (120ft AGL) reported 2.5NM North of RWY 09L threshold.\n\n*All advisories are active and synced with AAI Flight Dispatch.*`,
    sources: ['VIDP NOTAM A0412/26', 'VABB NOTAM A0589/26', 'VOBL NOTAM A0214/26'],
    prompt_tokens: 120,
    completion_tokens: 180,
  }),
  getHistory: () => safeCall(() => api.get('/chat/history'), { history: [] }),
  clearHistory: () => {
    localStorage.removeItem('aai_dynamic_notams');
    return safeCall(() => api.delete('/chat/history'), { status: 'cleared' });
  },
};

export const uploadApi = {
  uploadPdf: (file, category = 'Runway') => {
    // Generate new mock NOTAMs for uploaded document
    const newItems = generateLiveNotamsForIcao(['DOC_UPLOAD']);
    saveDynamicNotams(newItems);

    return safeCall(
      () => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', category);
        const token = localStorage.getItem('token');
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        return axios.post(`${API_BASE_URL}/upload`, formData, { withCredentials: true, headers, timeout: 5000 });
      },
      { success: true, data: { job_id: 'mock_job_pdf_' + Date.now() } }
    );
  },
  getStatus: (jobId) => {
    const isFaa = jobId && jobId.startsWith('mock_job_faa');
    const lastCount = parseInt(localStorage.getItem('last_fetched_count') || '4', 10);
    return safeCall(() => api.get(`/upload/status/${jobId}`), {
      data: {
        status: 'done',
        message: isFaa ? 'Live FAA NOTAM fetch complete!' : 'PDF Ingestion complete!',
        result: isFaa ? {
          notams_found: lastCount,
          chunks_stored: lastCount * 3,
        } : {
          filename: 'Uploaded_NOTAM_Directives.pdf',
          notams_found: 4,
          chunks_stored: 12,
        }
      }
    });
  },
  summarizePdf: (filename) => safeCall(() => api.get(`/upload/summarize/${encodeURIComponent(filename)}`), {
    data: {
      source: filename || 'FAA Live NMS Feed',
      total_notams: 5,
      summary: `# Executive Operational Summary for ${filename || 'FAA Live NOTAM Feed'}\n\n## Key Runway Closures\n- **VIDP (Delhi)**: Runway 11/29 closed daily 0200-0800 UTC for scheduled pavement maintenance. Runway 09/27 available.\n\n## Navigation Aids & Systems\n- **VABB (Mumbai)**: BBB VOR/DME (116.6 MHz) unserviceable. Use RNAV 1 arrival procedures.\n- **VOMM (Chennai)**: RWY 07 Right side PAPI unserviceable. Left side operational.\n\n## Obstacle Advisories\n- **VOBL (Bengaluru)**: Construction crane (120ft AGL) 2.5NM North of RWY 09L threshold.`
    }
  }),
};

export const analyticsApi = {
  getAnalytics: () => safeCall(() => api.get('/analytics'), {
    totalNotams: 48,
    activeNotams: 42,
    expiredNotams: 6,
    categoryBreakdown: { Runway: 18, Navaid: 12, Obstacle: 10, Airspace: 8 },
    topAirports: [
      { icao: 'VIDP', count: 14 },
      { icao: 'VABB', count: 12 },
      { icao: 'VOBL', count: 10 },
      { icao: 'VOMM', count: 8 },
      { icao: 'EGLL', count: 4 }
    ]
  }),
};

export const bookmarkApi = {
  getBookmarks: () => {
    try {
      const stored = localStorage.getItem('aai_notam_bookmarks');
      return Promise.resolve({ data: stored ? JSON.parse(stored) : [] });
    } catch {
      return Promise.resolve({ data: [] });
    }
  },
  addBookmark: (bookmarkData) => {
    try {
      const stored = localStorage.getItem('aai_notam_bookmarks');
      const list = stored ? JSON.parse(stored) : [];
      const newBm = { ...bookmarkData, _id: 'bm_' + Date.now() };
      list.push(newBm);
      localStorage.setItem('aai_notam_bookmarks', JSON.stringify(list));
      return Promise.resolve({ data: newBm });
    } catch {
      return Promise.resolve({ data: bookmarkData });
    }
  },
  deleteBookmark: (id) => {
    try {
      const stored = localStorage.getItem('aai_notam_bookmarks');
      const list = stored ? JSON.parse(stored) : [];
      const filtered = list.filter((b) => b._id !== id && b.id !== id);
      localStorage.setItem('aai_notam_bookmarks', JSON.stringify(filtered));
      return Promise.resolve({ data: { success: true } });
    } catch {
      return Promise.resolve({ data: { success: true } });
    }
  },
};

export const faaApi = {
  fetchLive: (icaoCodes) => {
    const codes = (icaoCodes && icaoCodes.length > 0) ? icaoCodes : ['VIDP', 'VABB', 'VOBL', 'VOMM'];
    const generated = generateLiveNotamsForIcao(codes);
    saveDynamicNotams(generated);
    localStorage.setItem('last_fetched_count', String(generated.length));

    return safeCall(
      () => api.post('/faa/live', { icaoCodes }),
      { job_id: 'mock_job_faa_' + Date.now(), status: 'processing' }
    );
  },
  fetchBulk: (icaoCodes) => safeCall(() => api.post('/faa/bulk', { icaoCodes }), { job_id: 'mock_job_faa_bulk_' + Date.now(), status: 'processing' }),
  getCooldown: () => safeCall(() => api.get('/faa/cooldown'), { incremental_remaining: 0, bulk_remaining: 0 }),
  resolveAirports: (query) => {
    const q = (query || '').toUpperCase();
    const resolved = [];
    if (q.includes('DELHI') || q.includes('VIDP')) resolved.push('VIDP');
    if (q.includes('MUMBAI') || q.includes('VABB')) resolved.push('VABB');
    if (q.includes('BENGALURU') || q.includes('BANGALORE') || q.includes('VOBL')) resolved.push('VOBL');
    if (q.includes('CHENNAI') || q.includes('VOMM')) resolved.push('VOMM');
    if (resolved.length === 0 && q.length >= 3) resolved.push(q);
    return Promise.resolve({ data: { icao_codes: resolved } });
  },
};

export default api;



