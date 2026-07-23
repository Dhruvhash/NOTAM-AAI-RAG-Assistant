import express from 'express';
import multer from 'multer';
import { pythonApi } from '../services/pythonApi.js';
import { protect } from '../middleware/auth.middleware.js';
import UploadLog from '../models/UploadLog.model.js';

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed!'), false);
    }
  },
});

// POST /api/upload
router.post('/', protect, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded or invalid file format' });
    }

    const result = await pythonApi.uploadPdf(req.file.buffer, req.file.originalname);

    // Save to UploadLog for Analytics
    await UploadLog.create({
      userId: req.user._id,
      filename: req.file.originalname,
      chunkCount: result.chunks || result.chunks_added || 1,
      category: req.body.category || 'Runway',
    });

    res.status(200).json({
      success: true,
      message: 'NOTAM PDF ingested successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/upload/status/:jobId
router.get('/status/:jobId', protect, async (req, res, next) => {
  try {
    const status = await pythonApi.getStatus(req.params.jobId);
    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/upload/summarize/:filename
router.get('/summarize/:filename', protect, async (req, res, next) => {
  try {
    const summary = await pythonApi.summarizePdf(req.params.filename);
    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
