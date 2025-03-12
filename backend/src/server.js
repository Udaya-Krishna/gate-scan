const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { createWorker } = require('tesseract.js');
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
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 600
}));
app.use(express.json({ limit: '50mb' }));

// Health check endpoint
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

// Function to validate image data
function validateImageData(imageData) {
  if (!imageData || typeof imageData !== 'string') {
    console.error('Invalid image data type:', typeof imageData);
    return false;
  }
  const base64Regex = /^data:image\/[a-z]+;base64,/i;
  const isValid = base64Regex.test(imageData) || /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)?$/.test(imageData);
  console.log('Image validation:', isValid ? 'Valid' : 'Invalid');
  return isValid;
}

// Function to extract data using regex pattern
function extractData(text) {
  if (typeof text !== 'string') {
    console.error('Invalid text input type:', typeof text);
    throw new Error('Invalid text input');
  }

  console.log('Extracting data from text:', text.substring(0, 100) + '...');

  const namePattern = /^[A-Z][a-z]+(?:\s[A-Z][a-z]+)*(?:\s[A-Z]+)?/m;
  const branchPattern = /Branch:\s*([A-Za-z\s]+)/i;
  const studentIdPattern = /ID:\s*(\w+)/i;

  const nameMatch = text.match(namePattern);
  const branchMatch = text.match(branchPattern);
  const studentIdMatch = text.match(studentIdPattern);

  const result = {
    name: nameMatch ? nameMatch[0].trim() : '',
    branch: branchMatch ? branchMatch[1].trim() : '',
    studentId: studentIdMatch ? studentIdMatch[1].trim() : ''
  };

  console.log('Extracted data:', result);
  return result;
}

// Endpoint for scanning ID cards with better memory management
app.post('/api/scan', async (req, res) => {
  let worker = null;
  try {
    console.log('Received scan request');
    const { image } = req.body;
    
    if (!validateImageData(image)) {
      console.error('Invalid image data received');
      return res.status(400).json({ error: 'Invalid image data provided' });
    }

    // Initialize worker for this request only
    try {
      console.log('Initializing Tesseract worker...');
      worker = await createWorker();
      console.log('Tesseract worker initialized successfully');
    } catch (initError) {
      console.error('Error initializing Tesseract worker:', initError);
      return res.status(503).json({ error: 'OCR service initialization failed' });
    }

    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    console.log('Processing image data...');
    
    try {
      const { data: { text } } = await worker.recognize(Buffer.from(base64Data, 'base64'));
      console.log('OCR completed, extracted text length:', text.length);
      
      if (!text) {
        console.error('No text extracted from image');
        return res.status(422).json({ error: 'Could not extract text from image' });
      }

      const extractedData = extractData(text);
      if (!extractedData.name && !extractedData.branch && !extractedData.studentId) {
        console.error('No valid data found in extracted text');
        return res.status(422).json({ error: 'Could not identify ID card format' });
      }

      console.log('Successfully processed image');
      res.json({ ...extractedData, verified: false });
    } catch (ocrError) {
      console.error('OCR Error:', ocrError);
      res.status(422).json({ error: 'Error processing image' });
    }
  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    // Always cleanup worker
    if (worker) {
      try {
        await worker.terminate();
        console.log('Tesseract worker terminated');
      } catch (termError) {
        console.error('Error terminating worker:', termError);
      }
    }
  }
});

// Endpoint for confirming and storing scanned data
app.post('/api/students', async (req, res) => {
  try {
    const { name, branch, studentId } = req.body;

    // Check if student already exists
    const existingStudent = await Student.findOne({ studentId });
    if (existingStudent) {
      return res.status(409).json({ error: 'Student ID already exists' });
    }

    // Create new student record
    const student = new Student({
      name,
      branch,
      studentId,
      verified: true
    });

    await student.save();
    res.status(201).json(student);
  } catch (error) {
    console.error('Error storing student data:', error);
    res.status(500).json({ error: 'Failed to store student data' });
  }
});

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

// Start MongoDB connection
connectToMongoDB();

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}); 