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

if (!mongoUri) {
  console.error('MONGODB_URI is not defined in environment variables');
  process.exit(1);
}

// MongoDB connection options
const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

// Connect to MongoDB with retry logic
async function connectToMongoDB() {
  try {
    await mongoose.connect(mongoUri, mongooseOptions);
    console.log('Connected to MongoDB Atlas');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    console.log('Retrying connection in 5 seconds...');
    setTimeout(connectToMongoDB, 5000);
  }
}

// Handle MongoDB connection events
mongoose.connection.on('error', (error) => {
  console.error('MongoDB connection error:', error);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected. Attempting to reconnect...');
  setTimeout(connectToMongoDB, 5000);
});

// Initial connection
connectToMongoDB();

// Middleware
app.use(cors({
  origin: frontendUrl,
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));

// Initialize Tesseract worker
let worker = null;
async function initializeWorker() {
  try {
    worker = await createWorker();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    console.log('Tesseract worker initialized successfully');
  } catch (error) {
    console.error('Error initializing Tesseract worker:', error);
    process.exit(1);
  }
}

initializeWorker();

// Function to validate image data
function validateImageData(imageData) {
  if (!imageData || typeof imageData !== 'string') return false;
  const base64Regex = /^data:image\/[a-z]+;base64,/i;
  return base64Regex.test(imageData) || /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)?$/.test(imageData);
}

// Function to extract data using regex pattern
function extractData(text) {
  if (typeof text !== 'string') throw new Error('Invalid text input');

  const namePattern = /^[A-Z][a-z]+(?:\s[A-Z][a-z]+)*(?:\s[A-Z]+)?/m;
  const branchPattern = /Branch:\s*([A-Za-z\s]+)/i;
  const studentIdPattern = /ID:\s*(\w+)/i;

  const nameMatch = text.match(namePattern);
  const branchMatch = text.match(branchPattern);
  const studentIdMatch = text.match(studentIdPattern);

  return {
    name: nameMatch ? nameMatch[0].trim() : '',
    branch: branchMatch ? branchMatch[1].trim() : '',
    studentId: studentIdMatch ? studentIdMatch[1].trim() : ''
  };
}

// Endpoint for scanning ID cards
app.post('/api/scan', async (req, res) => {
  try {
    const { image } = req.body;
    if (!validateImageData(image)) {
      return res.status(400).json({ error: 'Invalid image data provided' });
    }
    if (!worker) {
      return res.status(503).json({ error: 'OCR service not ready' });
    }

    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    
    try {
      const { data: { text } } = await worker.recognize(Buffer.from(base64Data, 'base64'));
      if (!text) {
        return res.status(422).json({ error: 'Could not extract text from image' });
      }

      const extractedData = extractData(text);
      if (!extractedData.name && !extractedData.branch && !extractedData.studentId) {
        return res.status(422).json({ error: 'Could not identify ID card format' });
      }

      res.json({ ...extractedData, verified: false });
    } catch (ocrError) {
      console.error('OCR Error:', ocrError);
      res.status(422).json({ error: 'Error processing image' });
    }
  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({ error: 'Internal server error' });
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', worker: worker ? 'ready' : 'initializing' });
});

// Start the server
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${port}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  if (worker) {
    worker.terminate();
  }
  process.exit(0);
}); 