import axios from 'axios';
import FormData from 'form-data';

const PYTHON_URL = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';

export const pythonApi = {
  getHealth: async () => {
    try {
      const response = await axios.get(`${PYTHON_URL}/health`, { timeout: 30000 });
      return response.data;
    } catch (error) {
      console.warn('Python backend health check failed:', error.message);
      return { status: 'offline', chunks: 0, sources: [] };
    }
  },

  getSources: async () => {
    try {
      const response = await axios.get(`${PYTHON_URL}/sources`, { timeout: 30000 });
      return response.data;
    } catch (error) {
      console.warn('Python backend sources fetch failed:', error.message);
      return { sources: [], total_chunks: 0 };
    }
  },

  uploadPdf: async (fileBuffer, filename) => {
    const formData = new FormData();
    formData.append('file', fileBuffer, {
      filename: filename,
      contentType: 'application/pdf',
    });

    const response = await axios.post(`${PYTHON_URL}/upload`, formData, {
      headers: {
        ...formData.getHeaders(),
      },
      timeout: 300000, // 5 minutes for PDF ingestion & embeddings
    });
    return response.data;
  },

  getStatus: async (jobId) => {
    const response = await axios.get(`${PYTHON_URL}/upload/status/${jobId}`, { timeout: 10000 });
    return response.data;
  },


  askQuestion: async (question) => {
    const response = await axios.post(
      `${PYTHON_URL}/ask`,
      { question },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );
    return response.data;
  },

  clearRag: async () => {
    const response = await axios.delete(`${PYTHON_URL}/clear`, { timeout: 5000 });
    return response.data;
  },

  summarizePdf: async (filename) => {
    const response = await axios.get(`${PYTHON_URL}/summarize/${encodeURIComponent(filename)}`, { timeout: 60000 });
    return response.data;
  },

  faaLive: async (icaoCodes) => {
    const response = await axios.post(`${PYTHON_URL}/faa/live`, { icao_codes: icaoCodes }, { timeout: 15000 });
    return response.data;
  },

  faaBulk: async (icaoCodes) => {
    const response = await axios.post(`${PYTHON_URL}/faa/bulk`, { icao_codes: icaoCodes }, { timeout: 15000 });
    return response.data;
  },

  faaCooldown: async () => {
    const response = await axios.get(`${PYTHON_URL}/faa/cooldown`, { timeout: 5000 });
    return response.data;
  },

  faaResolve: async (query) => {
    const response = await axios.post(`${PYTHON_URL}/faa/resolve`, { query }, { timeout: 5000 });
    return response.data;
  },

  searchNotams: async (query, topK = 5) => {
    const response = await axios.post(`${PYTHON_URL}/search`, { query, top_k: topK }, { timeout: 10000 });
    return response.data;
  },

  getAllNotams: async () => {
    const response = await axios.get(`${PYTHON_URL}/all`, { timeout: 15000 });
    return response.data;
  },
};



