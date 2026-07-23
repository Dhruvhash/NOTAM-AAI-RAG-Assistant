import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import Bookmark from '../models/Bookmark.model.js';

const router = express.Router();

// GET /api/bookmarks
router.get('/', protect, async (req, res, next) => {
  try {
    const bookmarks = await Bookmark.find({ userId: req.user._id })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      bookmarks,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/bookmarks
router.post('/', protect, async (req, res, next) => {
  try {
    const { question, answer, sources, category, note } = req.body;

    if (!question || !answer) {
      return res.status(400).json({ message: 'Question and answer are required' });
    }

    const newBookmark = await Bookmark.create({
      userId: req.user._id,
      question,
      answer,
      sources: sources || [],
      category: category || 'General',
      note: note || '',
    });

    res.status(201).json({
      success: true,
      bookmark: newBookmark,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/bookmarks/:id
router.delete('/:id', protect, async (req, res, next) => {
  try {
    const bookmark = await Bookmark.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!bookmark) {
      return res.status(404).json({ message: 'Bookmark not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Bookmark deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
