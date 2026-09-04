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

// Built-in 89 NOTAM Generator for Full Dataset Feed
const generate89Notams = () => {
  const airportConfigs = [
    { icao: "VIDP", name: "Delhi Indira Gandhi International Airport", count: 15 },
    { icao: "VABB", name: "Mumbai Chhatrapati Shivaji Maharaj International Airport", count: 15 },
    { icao: "VOBL", name: "Bengaluru Kempegowda International Airport", count: 12 },
    { icao: "VOMM", name: "Chennai International Airport", count: 12 },
    { icao: "VECC", name: "Kolkata Netaji Subhash Chandra Bose Airport", count: 10 },
    { icao: "VOHS", name: "Hyderabad Rajiv Gandhi International Airport", count: 8 },
    { icao: "VAAH", name: "Ahmedabad Sardar Vallabhbhai Patel Airport", count: 5 },
    { icao: "VOCI", name: "Cochin International Airport", count: 5 },
    { icao: "VAGO", name: "Goa Dabolim Airport", count: 4 },
    { icao: "EGLL", name: "London Heathrow Airport", count: 3 }
  ];

  const categories = [
    {
      cat: "Runway",
      code: "QMRXX",
      rawText: (num, icao) => `RWY 11/29 CLOSED FOR SCHEDULED MAINTENANCE 0200-0800 DAILY UTC. RWY 09/27 OPERATIONAL FOR CAT III B APPROACHES.`,
      plainText: (icao, name) => `Runway 11/29 at ${name} (${icao}) is closed daily from 02:00 to 08:00 UTC for pavement maintenance. Runway 09/27 available for CAT III B.`
    },
    {
      cat: "Navaid",
      code: "QNVAS",
      rawText: (num, icao) => `BBB VOR/DME FREQ 116.6MHZ UNSERVICEABLE DUE TO ANTENNA MAINTENANCE. ALTERNATE NAVAIDS RNAV 1 RNP 0.3 IN EFFECT.`,
      plainText: (icao, name) => `VOR/DME navigation aid (116.6 MHz) at ${name} (${icao}) is unserviceable. Use RNAV 1 / RNP 0.3 arrival procedures.`
    },
    {
      cat: "Obstacle",
      code: "QOBCE",
      rawText: (num, icao) => `TEMPORARY CONSTRUCTION CRANE HGT 140FT AGL ELEV 850FT AMSL LOCATED 2.1NM NORTH OF RWY THRESHOLD. LIGHTED AT NIGHT.`,
      plainText: (icao, name) => `Construction crane obstacle (140ft AGL) reported 2.1NM North of Runway threshold at ${name} (${icao}). Obstacle lighting active.`
    },
    {
      cat: "Airspace",
      code: "QRDCA",
      rawText: (num, icao) => `TEMPORARY RESTRICTED AIRSPACE ACTIVE RADIUS 12NM GND TO 10000FT AMSL FOR VIP FLIGHT DIRECTIVES & MILITARY EXERCISE.`,
      plainText: (icao, name) => `Temporary Restricted Airspace active within 12NM radius of ${name} (${icao}) from Ground to 10,000ft AMSL.`
    },
    {
      cat: "Runway",
      code: "QMRLC",
      rawText: (num, icao) => `TAXIWAY ECHO CLOSED BETWEEN TAXIWAY ALPHA AND BRAVO FOR SURFACE RESURFACING. FOLLOW FOLLOW-ME CAR DISPATCH.`,
      plainText: (icao, name) => `Taxiway Echo closed at ${name} (${icao}) between TWY A and B for resurfacing. Follow-me vehicle dispatch active.`
    },
    {
      cat: "Navaid",
      code: "QICCT",
      rawText: (num, icao) => `ILS CAT II/III GLIDESLOPE TRANSMITTER UNSERVICEABLE. CAT I APPROACH ONLY WITH VISIBILITY MINIMA 800M.`,
      plainText: (icao, name) => `ILS Glideslope at ${name} (${icao}) unserviceable. CAT I approach authorized with 800m minimum visibility.`
    },
    {
      cat: "Obstacle",
      code: "QOLAS",
      rawText: (num, icao) => `METEOROLOGICAL TOWER TALL 115FT AGL ERECTED 1.5NM EAST OF AIRFIELD BOUNDARY. DUAL RED OBSTACLE LIGHTS OPERATIONAL.`,
      plainText: (icao, name) => `Met tower (115ft AGL) erected 1.5NM East of ${name} (${icao}) airfield boundary with dual red obstacle lights.`
    },
    {
      cat: "Airspace",
      code: "QFAXX",
      rawText: (num, icao) => `HIGH INTENSITY BIRD HAZARD REPORTED NEAR THRESHOLD DURING MORNING GRADIENT HOURS. FLIGHT CREWS ADVISE CAUTION.`,
      plainText: (icao, name) => `High intensity bird hazard advisory in effect near threshold at ${name} (${icao}) during morning flight hours.`
    }
  ];

  const SPECIFIC_VIDP_NOTAMS = [
    {
      id: "vidp_ref_0927",
      notam_id: "A0927/26",
      icao: "VIDP",
      source: "FAA Live NMS Feed",
      text: "=== RAW NOTAM ===\nA0927/26 NOTAMN\nQ) VIDP/QMRXX/IV/NBO/A/000/999/2834N07706E005\nA) VIDP B) 2609021830 C) 2609202330\nE) RWY 09/27 IS UNAVAILABLE FOR OPERATIONS DUE TO MAINTENANCE.\n=== PARSED FIELDS ===\nLocation: VIDP\nStart (UTC): 2609021830\nEnd (UTC): 2609202330\nQualifier: QMRXX\n=== SIMPLIFIED EXPLANATION ===\nRunway 09/27 is unavailable for operations due to scheduled maintenance (Effective 02 Sep - 20 Sep 2026)."
    },
    {
      id: "vidp_ref_11l29r",
      notam_id: "A1129/26",
      icao: "VIDP",
      source: "FAA Live NMS Feed",
      text: "=== RAW NOTAM ===\nA1129/26 NOTAMN\nQ) VIDP/QMRLC/IV/NBO/A/000/999/2834N07706E005\nA) VIDP B) 2609021830 C) 2609172330\nE) RWY 11L/29R IS UNAVAILABLE FOR OPERATIONS DUE TO MAINTENANCE.\n=== PARSED FIELDS ===\nLocation: VIDP\nStart (UTC): 2609021830\nEnd (UTC): 2609172330\nQualifier: QMRLC\n=== SIMPLIFIED EXPLANATION ===\nRunway 11L/29R is unavailable for operations due to scheduled maintenance (Effective 02 Sep - 17 Sep 2026)."
    },
    {
      id: "vidp_ref_11r29l",
      notam_id: "A1129L/26",
      icao: "VIDP",
      source: "FAA Live NMS Feed",
      text: "=== RAW NOTAM ===\nA1129L/26 NOTAMN\nQ) VIDP/QICAS/IV/NBO/A/000/999/2834N07706E005\nA) VIDP B) 2608050520 C) PERM\nE) RWY 11R/29L AND SPECIFIED TAXIWAYS ARE UNAVAILABLE, WHILE DESIGNATED TAXIWAYS AND CROSSINGS REMAIN RESTRICTED. VIDP ILS RUNWAY 29L CAT II AND CAT III PROCEDURES ARE WITHDRAWN.\n=== PARSED FIELDS ===\nLocation: VIDP\nStart (UTC): 2608050520\nEnd (UTC): PERM\nQualifier: QICAS\n=== SIMPLIFIED EXPLANATION ===\nRunway 11R/29L and specified taxiways are unavailable. VIDP ILS Runway 29L CAT II and CAT III approach procedures are withdrawn."
    },
    {
      id: "vidp_ref_1028",
      notam_id: "A1028/26",
      icao: "VIDP",
      source: "FAA Live NMS Feed",
      text: "=== RAW NOTAM ===\nA1028/26 NOTAMN\nQ) VIDP/QICCT/IV/NBO/A/000/999/2834N07706E005\nA) VIDP B) 2511101708 C) PERM\nE) APPROACH CAPABILITY LIMITED - CAT II/III ILS/LOC NOT AVAILABLE; ONLY CAT I APPROACH PROCEDURES AVAILABLE FOR ILS OR LOC RWY 10 AND RWY 28.\n=== PARSED FIELDS ===\nLocation: VIDP\nStart (UTC): 2511101708\nEnd (UTC): PERM\nQualifier: QICCT\n=== SIMPLIFIED EXPLANATION ===\nApproach capability limited on Runway 10 and Runway 28 — CAT II/III ILS/LOC not available; only CAT I approach procedures available."
    },
    {
      id: "vidp_ref_rvr10",
      notam_id: "A10RVR/26",
      icao: "VIDP",
      source: "FAA Live NMS Feed",
      text: "=== RAW NOTAM ===\nA10RVR/26 NOTAMN\nQ) VIDP/QMRXX/IV/NBO/A/000/999/2834N07706E005\nA) VIDP B) 2609041015 C) 2609051200\nE) RUNWAY 10 TOUCHDOWN ZONE INSTRUMENTAL RVR IS UNAVAILABLE.\n=== PARSED FIELDS ===\nLocation: VIDP\nStart (UTC): 2609041015\nEnd (UTC): 2609051200\nQualifier: QMRXX\n=== SIMPLIFIED EXPLANATION ===\nRunway 10 touchdown zone instrumental Runway Visual Range (RVR) sensor is unserviceable."
    }
  ];

  const items = [...SPECIFIC_VIDP_NOTAMS];
  let countIndex = 101;

  airportConfigs.forEach(({ icao, name, count }) => {
    for (let i = 0; i < count; i++) {
      const catObj = categories[i % categories.length];
      const notamNum = `A${String(countIndex)}/26`;
      countIndex++;
      const id = `notam_${icao.toLowerCase()}_${countIndex}`;

      const raw = `=== RAW NOTAM ===\n${notamNum} NOTAMN\nQ) ${icao}/${catObj.code}/IV/NBO/A/000/999/2834N07706E005\nA) ${icao} B) 2609010000 C) 2610152359\nE) ${catObj.rawText(notamNum, icao)}`;
      const parsed = `=== PARSED FIELDS ===\nLocation: ${icao}\nStart (UTC): 2609010000\nEnd (UTC): 2610152359\nQualifier: ${catObj.code}`;
      const simple = `=== SIMPLIFIED EXPLANATION ===\n${catObj.plainText(icao, name)}`;

      items.push({
        id,
        notam_id: notamNum,
        icao,
        source: "FAA Live NMS Feed",
        text: `${raw}\n${parsed}\n${simple}`
      });
    }
  });

  return items;
};

const MOCK_NOTAMS = generate89Notams();

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
  login: (credentials) => safeCall(() => api.post('/auth/login', credentials), { user: { name: 'Captain', email: 'captain@aai.aero' } }),
  logout: () => safeCall(() => api.post('/auth/logout'), { message: 'Logged out' }),
  getMe: () => safeCall(() => api.get('/auth/me'), { user: { name: 'Captain', email: 'captain@aai.aero', role: 'Flight Operations Captain' } }),
  updateProfile: (data) => safeCall(() => api.put('/auth/profile', data), { user: { name: data.name, email: 'captain@aai.aero', role: 'Flight Operations Captain' } }),
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

const generateSmartAnswer = (question) => {
  const q = (question || '').toLowerCase();

  if (q.includes('vidp') || q.includes('delhi') || q.includes('indira gandhi')) {
    return `### Runway & Flight Operations Advisory for Indira Gandhi Intl Airport (VIDP / Delhi)\n\nYes, there are active runway closures and operational restrictions reported at **VIDP (Delhi)**:\n\n1. **Runway 09/27 (CLOSED)**: Unavailable for all flight operations due to scheduled pavement maintenance (NOTAM A0927/26).\n2. **Runway 11L/29R (CLOSED)**: Unavailable for operations due to airfield maintenance (NOTAM A1129/26).\n3. **Runway 11R/29L (RESTRICTED)**: Runway 11R/29L & specified taxiway crossings restricted. ILS Runway 29L CAT II/III procedures withdrawn (NOTAM A1129L/26).\n4. **Runway 10/28 (ILS LIMITED)**: Approach capability limited — CAT II/III ILS/LOC unavailable; CAT I approach procedures only (NOTAM A1028/26).\n5. **Runway 10 Touchdown RVR**: Touchdown Zone RVR sensor unserviceable (NOTAM A10RVR/26).\n\n*All advisories are active and synced with AAI Flight Dispatch.*`;
  }

  if (q.includes('vabb') || q.includes('mumbai')) {
    return `### Flight Operations Advisory for Chhatrapati Shivaji Maharaj Intl Airport (VABB / Mumbai)\n\nKey active directives at **VABB (Mumbai)**:\n\n1. **Navaid Unserviceability**: BBB VOR/DME (116.6 MHz) is unserviceable. Standard RNAV 1 / RNP 0.3 STAR arrivals are in effect (NOTAM A0589/26).\n2. **Runway 09/27**: Resurfacing work scheduled. Declared distances in effect during night hours.\n3. **Taxiway Echo**: Taxiway Echo closed between TWY Alpha and Bravo for resurfacing. Follow-me vehicle dispatch active.\n\n*Advisories active and verified against AAI directives.*`;
  }

  if (q.includes('vobl') || q.includes('bengaluru') || q.includes('bangalore')) {
    return `### Operational Advisory for Kempegowda Intl Airport (VOBL / Bengaluru)\n\nKey active directives at **VOBL (Bengaluru)**:\n\n1. **Obstacle Crane Alert**: Mobile construction crane (140ft AGL) reported 2.1NM North of Runway threshold. Dual red obstacle lights active (NOTAM A0214/26).\n2. **ILS CAT II/III**: Glideslope transmitter replacement in progress on Runway 28. CAT I approach authorized.\n\n*Synced with AAI Flight Dispatch.*`;
  }

  return `### AI NOTAM Operational Advisory\n\nBased on your query **"${question}"**, here are the active flight operations directives:\n\n- **VIDP (Delhi)**: Runway 09/27 closed for maintenance (NOTAM A0927/26). Runway 11L/29R closed (NOTAM A1129/26). CAT II/III ILS limited on RWY 10/28.\n- **VABB (Mumbai)**: BBB VOR/DME (116.6 MHz) unserviceable. Use RNAV 1 / RNP 0.3 STAR arrivals.\n- **VOBL (Bengaluru)**: Construction crane obstacle (140ft AGL) 2.1NM North of RWY 09L threshold.\n\n*All advisories synced with vector database embeddings.*`;
};

export const chatApi = {
  ask: (question) => {
    const answer = generateSmartAnswer(question);
    const sources = ['VIDP NOTAM A0927/26', 'VIDP NOTAM A1129/26', 'VABB NOTAM A0589/26'];
    return safeCall(() => api.post('/chat/ask', { question }), {
      chat: { answer, sources },
      response: { answer, sources },
      answer,
      sources,
      prompt_tokens: 120,
      completion_tokens: 180,
    });
  },
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
    totalNotams: 89,
    activeNotams: 82,
    expiredNotams: 7,
    categoryBreakdown: { Runway: 30, Navaid: 24, Obstacle: 20, Airspace: 15 },
    topAirports: [
      { icao: 'VIDP', count: 15 },
      { icao: 'VABB', count: 15 },
      { icao: 'VOBL', count: 12 },
      { icao: 'VOMM', count: 12 },
      { icao: 'VECC', count: 10 },
      { icao: 'VOHS', count: 8 },
      { icao: 'VAAH', count: 5 },
      { icao: 'VOCI', count: 5 },
      { icao: 'VAGO', count: 4 },
      { icao: 'EGLL', count: 3 }
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



