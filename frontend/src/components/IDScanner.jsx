import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { 
  Button, 
  Box, 
  Typography, 
  Paper, 
  Container, 
  CircularProgress, 
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import { styled } from '@mui/material/styles';

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  marginTop: theme.spacing(3),
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  width: '100%',
  maxWidth: '100%',
  [theme.breakpoints.up('sm')]: {
    maxWidth: 640,
  },
}));

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const fetchWithConfig = async (endpoint, options = {}) => {
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    ...options,
  };

  try {
    console.log(`Making request to ${API_URL}${endpoint}`);
    const response = await fetch(`${API_URL}${endpoint}`, defaultOptions);
    console.log(`Response status: ${response.status}`);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Error response:', errorData);
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Response data:', data);
    return data;
  } catch (error) {
    console.error(`Fetch error for ${endpoint}:`, error);
    if (error.message.includes('Failed to fetch') || error.message.includes('ERR_CONNECTION_REFUSED')) {
      throw new Error('Cannot connect to server. Please make sure the backend server is running.');
    }
    throw error;
  }
};

const IDScanner = () => {
  const webcamRef = useRef(null);
  const [scannedData, setScannedData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [facingMode, setFacingMode] = useState('environment');
  const [isServerReady, setIsServerReady] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [storedStudents, setStoredStudents] = useState([]);
  const [isStoringData, setIsStoringData] = useState(false);

  useEffect(() => {
    const checkServerHealth = async () => {
      try {
        console.log('Checking server health...');
        const data = await fetchWithConfig('/health');
        console.log('Server health response:', data);
        setIsServerReady(true);
      } catch (error) {
        console.error('Server health check failed:', error);
        setError('Server connection failed. Please try again later.');
        setTimeout(checkServerHealth, 2000);
      }
    };

    checkServerHealth();
    fetchStoredStudents();
  }, []);

  const fetchStoredStudents = async () => {
    try {
      const data = await fetchWithConfig('/api/students');
      setStoredStudents(data);
    } catch (error) {
      console.error('Error fetching stored students:', error);
      setError('Failed to fetch student list');
    }
  };

  const handleConfirm = async () => {
    setIsStoringData(true);
    try {
      await fetchWithConfig('/api/students', {
        method: 'POST',
        body: JSON.stringify(scannedData),
      });
      await fetchStoredStudents();
      setShowConfirmDialog(false);
      setScannedData(null);
    } catch (error) {
      setError(error.message);
    } finally {
      setIsStoringData(false);
    }
  };

  const toggleCamera = useCallback(() => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  }, []);

  const capture = useCallback(() => {
    if (!isServerReady) {
      setError('Server is not ready yet. Please wait.');
      return;
    }

    if (webcamRef.current) {
      setIsLoading(true);
      setError(null);
      try {
        console.log('Attempting to capture image...');
        const imageSrc = webcamRef.current.getScreenshot();
        console.log('Image capture result:', imageSrc ? 'Success' : 'Failed');
        
        if (imageSrc) {
          console.log('Image data length:', imageSrc.length);
          extractDataFromImage(imageSrc);
        } else {
          setIsLoading(false);
          setError('Failed to capture image. Please try again.');
        }
      } catch (error) {
        console.error('Camera capture error:', error);
        setIsLoading(false);
        setError('Failed to access camera. Please check permissions.');
      }
    } else {
      setError('Camera not initialized. Please refresh the page.');
    }
  }, [isServerReady]);

  const extractDataFromImage = async (imageData) => {
    try {
      console.log('Preparing to send image to server...');
      const requestBody = { image: imageData };
      console.log('Request body size:', JSON.stringify(requestBody).length);
      
      const data = await fetchWithConfig('/api/scan', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      
      console.log('Server response received:', data);
      
      if (!data) {
        throw new Error('No response data received from server');
      }
      
      if (!data.name && !data.branch && !data.studentId) {
        console.log('No valid data found in response:', data);
        throw new Error('No valid data extracted from image. Please try again with better lighting or positioning.');
      }
      
      console.log('Successfully extracted data:', data);
      setScannedData(data);
      setError(null);
    } catch (error) {
      console.error('Error processing image:', error);
      setError(error.message || 'Failed to scan ID card. Please try again.');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 2 }}>
      <StyledPaper elevation={3}>
        <Typography variant="h4" gutterBottom align="center">
          ID Card Scanner
        </Typography>
        
        {!isServerReady && (
          <Alert severity="info" sx={{ mb: 2, width: '100%' }}>
            Initializing scanner... Please wait.
          </Alert>
        )}

        <Box sx={{ width: '100%', mb: 2, position: 'relative' }}>
          <Webcam
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={{
              width: 1280,
              height: 720,
              facingMode,
            }}
            style={{
              width: '100%',
              height: 'auto',
              objectFit: 'cover',
            }}
          />
          <Button
            variant="contained"
            color="secondary"
            onClick={toggleCamera}
            sx={{ position: 'absolute', top: 8, right: 8 }}
          >
            Switch Camera
          </Button>
        </Box>

        <Button 
          variant="contained" 
          color="primary" 
          onClick={capture}
          disabled={isLoading || !isServerReady}
          sx={{ mb: 3, width: '100%', py: 1.5 }}
        >
          {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Scan ID Card'}
        </Button>

        {error && (
          <Alert severity="error" sx={{ mb: 2, width: '100%' }}>
            {error}
          </Alert>
        )}

        {scannedData && (
          <Box sx={{ width: '100%', mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              Scanned Data:
            </Typography>
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography><strong>Name:</strong> {scannedData.name || 'Not found'}</Typography>
              <Typography><strong>Branch:</strong> {scannedData.branch || 'Not found'}</Typography>
              <Typography><strong>Student ID:</strong> {scannedData.studentId || 'Not found'}</Typography>
            </Paper>
            <Button
              variant="contained"
              color="success"
              fullWidth
              onClick={() => setShowConfirmDialog(true)}
            >
              Confirm & Save
            </Button>
          </Box>
        )}

        {storedStudents.length > 0 && (
          <Box sx={{ width: '100%', mt: 4 }}>
            <Typography variant="h6" gutterBottom>
              Recently Scanned:
            </Typography>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Branch</TableCell>
                    <TableCell>ID</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {storedStudents.slice(0, 5).map((student) => (
                    <TableRow key={student._id}>
                      <TableCell>{student.name}</TableCell>
                      <TableCell>{student.branch}</TableCell>
                      <TableCell>{student.studentId}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </StyledPaper>

      <Dialog open={showConfirmDialog} onClose={() => setShowConfirmDialog(false)}>
        <DialogTitle>Confirm Student Data</DialogTitle>
        <DialogContent>
          <Typography>Please confirm that the following information is correct:</Typography>
          <Box sx={{ mt: 2 }}>
            <Typography><strong>Name:</strong> {scannedData?.name}</Typography>
            <Typography><strong>Branch:</strong> {scannedData?.branch}</Typography>
            <Typography><strong>Student ID:</strong> {scannedData?.studentId}</Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowConfirmDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleConfirm} 
            variant="contained" 
            color="primary"
            disabled={isStoringData}
          >
            {isStoringData ? <CircularProgress size={24} /> : 'Confirm & Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default IDScanner; 