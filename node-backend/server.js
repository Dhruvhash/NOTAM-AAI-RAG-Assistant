import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { MongoMemoryServer } from 'mongodb-memory-server';

import authRoutes from './src/routes/auth.routes.js';
import notamRoutes from './src/routes/notam.routes.js';
import uploadRoutes from './src/routes/upload.routes.js';
import chatRoutes from './src/routes/chat.routes.js';
import analyticsRoutes from './src/routes/analytics.routes.js';
import bookmarkRoutes from './src/routes/bookmark.routes.js';
import faaRoutes from './src/routes/faa.routes.js';
import { errorHandler } from './src/middleware/errorHandler.js';

import User from './src/models/User.model.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS setup
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, true); // Allow requests during local dev
      }
    },
    credentials: true,
  })
);

// Express Middleware
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(cookieParser());

// Database Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/notam_db';

const seedDemoUser = async () => {
  try {
    const existing = await User.findOne({ email: 'pilot.demo@aai.aero' });
    if (!existing) {
      await User.create({
        name: 'Captain Rakesh (Demo)',
        email: 'pilot.demo@aai.aero',
        password: 'Password123',
        role: 'Pilot',
      });
      console.log('Demo user created: pilot.demo@aai.aero');
    }
  } catch (err) {
    console.warn('Demo user seed skipped:', err.message);
  }
};

const connectDB = async () => {
  try {
    console.log('Connecting to MongoDB at:', MONGODB_URI);
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 2000,
    });
    console.log('MongoDB Connected successfully to:', MONGODB_URI);
    await seedDemoUser();
  } catch (error) {
    console.warn('Local MongoDB connection failed. Starting in-memory MongoDB server...');
    try {
      const mongoServer = await MongoMemoryServer.create({
        instance: {
          port: 27017,
          dbName: 'notam_db',
        }
      });
      const uri = mongoServer.getUri();
      console.log('In-memory MongoDB Server started at:', uri);
      await mongoose.connect(uri);
      console.log('MongoDB (In-Memory) Connected successfully.');
      await seedDemoUser();
    } catch (memError) {
      console.error('Failed to start in-memory MongoDB Server:', memError.message);
      console.warn('Running in degraded mode without database.');
    }
  }
};

connectDB();

// Root route
app.get('/api', (req, res) => {
  res.json({ message: 'AAI NOTAM Node.js Backend API is running' });
});

// Register Routes
app.use('/api/auth', authRoutes);
app.use('/api/notam', notamRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/bookmarks', bookmarkRoutes);
app.use('/api/faa', faaRoutes);

// Global Error Handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Node backend running on http://localhost:${PORT}`);
});
