import express, { Request, Response, RequestHandler } from 'express';
import cors from 'cors';
import { createWorker } from 'tesseract.js';
import multer from 'multer';

const app = express();
const port = 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Configure multer for handling file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Initialize Tesseract worker
let worker: any = null;
async function initializeWorker() {
  worker = await createWorker();
  await worker.loadLanguage('eng');
  await worker.initialize('eng');
}
initializeWorker();

interface ScannedData {
  name: string;
  branch: string;
  studentId: string;
}

// Function to extract data using regex pattern
function extractData(text: string): ScannedData {
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

interface ScanRequest {
  image: string;
}

// Define the scan handler
const scanHandler: RequestHandler = async (req, res): Promise<void> => {
  try {
    const { image } = req.body as ScanRequest;
    
    if (!image) {
      res.status(400).json({ error: 'No image data provided' });
      return;
    }

    // Remove the data:image/jpeg;base64 prefix if present
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    
    // Perform OCR
    const { data: { text } } = await worker.recognize(Buffer.from(base64Data, 'base64'));
    
    // Extract data using regex
    const extractedData = extractData(text);
    
    res.json(extractedData);
  } catch (error) {
    console.error('Error processing image:', error);
    res.status(500).json({ error: 'Error processing image' });
  }
};

// Register the endpoint
app.post('/api/scan', scanHandler);

// Start the server
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${port}`);
}); 