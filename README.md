# ID Card Scanner

A web application for scanning student ID cards and extracting information using OCR. The application uses React for the frontend and Node.js/Express for the backend, with Tesseract.js for OCR functionality.

## Features

- Real-time ID card scanning using webcam
- Extracts student name, branch, and ID number
- Modern and responsive UI
- Real-time data processing

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

## Project Structure

```
.
├── frontend/         # React frontend application
└── backend/         # Express backend server
```

## Setup and Running

### Frontend

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

The frontend will be available at `http://localhost:5173`

### Backend

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

The backend API will be available at `http://localhost:3001`

## API Endpoints

- `POST /api/scan` - Submit an image for OCR processing
  - Request body: `{ "image": "base64_encoded_image_data" }`
  - Response: `{ "name": "string", "branch": "string", "studentId": "string" }`

## ID Card Format Requirements

The ID card should have the following format for optimal recognition:
- Student name in proper case (e.g., "John Smith")
- Branch information prefixed with "Branch:" (e.g., "Branch: Computer Science")
- Student ID prefixed with "ID:" (e.g., "ID: CS12345") 