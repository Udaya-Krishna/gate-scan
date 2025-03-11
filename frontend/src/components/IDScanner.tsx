import React, { useState, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Button, Box, Typography, Paper, Container, CircularProgress } from '@mui/material';
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

const StyledWebcam = styled(Webcam)`
  width: 100%;
  height: auto;
  object-fit: cover;
`;

interface ScannedData {
  name: string;
  branch: string;
  studentId: string;
}

const IDScanner: React.FC = () => {
  const webcamRef = useRef<Webcam>(null);
  const [scannedData, setScannedData] = useState<ScannedData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  const videoConstraints = {
    width: 1280,
    height: 720,
    facingMode: facingMode,
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const extractDataFromImage = async (imageData: string) => {
    try {
      const response = await fetch('http://localhost:3001/api/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: imageData }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to scan ID card');
      }
      
      const data = await response.json();
      setScannedData(data);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error scanning ID');
    } finally {
      setIsLoading(false);
    }
  };

  const capture = React.useCallback(() => {
    if (webcamRef.current) {
      setIsLoading(true);
      setError(null);
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        extractDataFromImage(imageSrc);
      } else {
        setIsLoading(false);
        setError('Failed to capture image');
      }
    }
  }, [webcamRef]);

  return (
    <Container maxWidth="sm" sx={{ py: 2 }}>
      <StyledPaper elevation={3}>
        <Typography variant="h4" gutterBottom align="center">
          ID Card Scanner
        </Typography>
        
        <Box sx={{ width: '100%', mb: 2, position: 'relative' }}>
          <Webcam
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={videoConstraints}
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
          disabled={isLoading}
          sx={{ mb: 3, width: '100%', py: 1.5 }}
        >
          {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Scan ID Card'}
        </Button>

        {error && (
          <Typography color="error" gutterBottom>
            {error}
          </Typography>
        )}

        {scannedData && (
          <Box sx={{ width: '100%', mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              Scanned Data:
            </Typography>
            <Typography><strong>Name:</strong> {scannedData.name}</Typography>
            <Typography><strong>Branch:</strong> {scannedData.branch}</Typography>
            <Typography><strong>Student ID:</strong> {scannedData.studentId}</Typography>
          </Box>
        )}
      </StyledPaper>
    </Container>
  );
};

export default IDScanner; 