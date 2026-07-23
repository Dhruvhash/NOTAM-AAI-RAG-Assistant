import mongoose from 'mongoose';

const uploadLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  filename: {
    type: String,
    required: true,
  },
  chunkCount: {
    type: Number,
    default: 0,
  },
  category: {
    type: String,
    default: 'General',
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
});

const UploadLog = mongoose.model('UploadLog', uploadLogSchema);
export default UploadLog;
