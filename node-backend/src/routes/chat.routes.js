import express from 'express';
import { pythonApi } from '../services/pythonApi.js';
import { protect } from '../middleware/auth.middleware.js';
import ChatHistory from '../models/ChatHistory.model.js';

const router = express.Router();

// POST /api/chat/ask
router.post('/ask', protect, async (req, res, next) => {
  try {
    const { question } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({ message: 'Question cannot be empty' });
    }

    // Proxy request to Python backend RAG
    const ragResponse = await pythonApi.askQuestion(question);

    const answer = ragResponse.answer || ragResponse.result || 'No response returned from assistant.';
    const sources = ragResponse.sources || [];

    // Persist chat turn to MongoDB
    const chatEntry = await ChatHistory.create({
      userId: req.user._id,
      question: question.trim(),
      answer,
      sources,
    });

    res.status(200).json({
      success: true,
      chat: chatEntry,
      response: ragResponse,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/chat/history
router.get('/history', protect, async (req, res, next) => {
  try {
    const history = await ChatHistory.find({ userId: req.user._id })
      .sort({ timestamp: 1 })
      .limit(100);

    res.status(200).json({
      success: true,
      history,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/chat/history
router.delete('/history', protect, async (req, res, next) => {
  try {
    await ChatHistory.deleteMany({ userId: req.user._id });
    
    // Optionally call Python clear endpoint
    try {
      await pythonApi.clearRag();
    } catch (e) {
      console.warn('Python clear failed:', e.message);
    }

    res.status(200).json({
      success: true,
      message: 'Chat history cleared successfully',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
