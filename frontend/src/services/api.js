import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for attaching JWT Bearer token
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

// Response interceptor for handling 401 unauth
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  signup: (userData) => api.post('/auth/signup', userData),
  login: (credentials) => api.post('/auth/login', credentials),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
  updatePassword: (data) => api.put('/auth/password', data),
};

export const notamApi = {
  getHealth: () => api.get('/notam/health'),
  getSources: () => api.get('/notam/sources'),
  search: (query, topK = 5) => api.post('/notam/search', { query, topK }),
  getAll: () => api.get('/notam/all'),
};

export const chatApi = {
  ask: (question) => api.post('/chat/ask', { question }),
  getHistory: () => api.get('/chat/history'),
  clearHistory: () => api.delete('/chat/history'),
};

export const uploadApi = {
  uploadPdf: (file, category = 'Runway') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    const token = localStorage.getItem('token');
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return axios.post(`${API_BASE_URL}/upload`, formData, {
      withCredentials: true,
      headers,
      timeout: 300000, // 5 minutes timeout for PDF ingestion
    });
  },
  getStatus: (jobId) => api.get(`/upload/status/${jobId}`),
  summarizePdf: (filename) => api.get(`/upload/summarize/${encodeURIComponent(filename)}`),
};

export const analyticsApi = {
  getAnalytics: () => api.get('/analytics'),
};

export const bookmarkApi = {
  getBookmarks: () => api.get('/bookmarks'),
  addBookmark: (bookmarkData) => api.post('/bookmarks', bookmarkData),
  deleteBookmark: (id) => api.delete(`/bookmarks/${id}`),
};

export const faaApi = {
  fetchLive: (icaoCodes) => api.post('/faa/live', { icaoCodes }),
  fetchBulk: (icaoCodes) => api.post('/faa/bulk', { icaoCodes }),
  getCooldown: () => api.get('/faa/cooldown'),
  resolveAirports: (query) => api.post('/faa/resolve', { query }),
};

export default api;

