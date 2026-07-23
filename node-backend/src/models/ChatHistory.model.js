import mongoose from 'mongoose';

const chatHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  question: {
    type: String,
    required: true,
  },
  answer: {
    type: String,
    required: true,
  },
  sources: [
    {
      source: String,
      filename: String,
      notam_id: String,
      relevance: Number,
      content: String,
    },
  ],
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const ChatHistory = mongoose.model('ChatHistory', chatHistorySchema);
export default ChatHistory;
