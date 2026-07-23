import mongoose from 'mongoose';

const bookmarkSchema = new mongoose.Schema({
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
  category: {
    type: String,
    default: 'General',
  },
  note: {
    type: String,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Bookmark = mongoose.model('Bookmark', bookmarkSchema);
export default Bookmark;
