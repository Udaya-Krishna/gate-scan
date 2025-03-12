const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const Student = require('./models/Student');

const app = express();
const port = process.env.PORT || 3001;
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
const mongoUri = process.env.MONGODB_URI;

// Start server first
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${port}`);
});

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? 'https://gate-scan.vercel.app'
    : 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    message: 'Server is running',
    mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnecting'
  });
});

// MongoDB connection with better error handling
async function connectToMongoDB() {
  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('Connected to MongoDB Atlas');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    setTimeout(connectToMongoDB, 5000);
  }
}

// Start MongoDB connection
connectToMongoDB();

// Endpoint to get all students
app.get('/api/students', async (req, res) => {
  try {
    const students = await Student.find().sort({ scannedAt: -1 });
    res.json(students);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}); 