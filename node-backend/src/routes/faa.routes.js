import express from 'express';
import { pythonApi } from '../services/pythonApi.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// POST /api/faa/live
router.post('/live', protect, async (req, res, next) => {
  try {
    const { icaoCodes } = req.body;
    const result = await pythonApi.faaLive(icaoCodes);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    if (error.response && error.response.status === 429) {
      return res.status(429).json(error.response.data);
    }
    next(error);
  }
});

// POST /api/faa/bulk
router.post('/bulk', protect, async (req, res, next) => {
  return res.status(501).json({ success: false, message: 'Bulk fetch feature is disabled.' });
});

// GET /api/faa/cooldown
router.get('/cooldown', protect, async (req, res, next) => {
  try {
    const result = await pythonApi.faaCooldown();
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

// POST /api/faa/resolve
router.post('/resolve', protect, async (req, res, next) => {
  try {
    const { query } = req.body;
    const result = await pythonApi.faaResolve(query);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

export default router;
