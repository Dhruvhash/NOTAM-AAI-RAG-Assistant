import express from 'express';
import { pythonApi } from '../services/pythonApi.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// GET /api/notam/health
router.get('/health', protect, async (req, res, next) => {
  try {
    const health = await pythonApi.getHealth();
    res.status(200).json({ success: true, ...health });
  } catch (error) {
    next(error);
  }
});

// GET /api/notam/sources
router.get('/sources', protect, async (req, res, next) => {
  try {
    const sourcesData = await pythonApi.getSources();
    res.status(200).json({ success: true, ...sourcesData });
  } catch (error) {
    next(error);
  }
});

// POST /api/notam/search
router.post('/search', protect, async (req, res, next) => {
  try {
    const { query, topK } = req.body;
    const results = await pythonApi.searchNotams(query, topK);
    res.status(200).json({ success: true, ...results });
  } catch (error) {
    next(error);
  }
});

// GET /api/notam/all
router.get('/all', protect, async (req, res, next) => {
  try {
    const data = await pythonApi.getAllNotams();
    res.status(200).json({ success: true, ...data });
  } catch (error) {
    next(error);
  }
});

export default router;

