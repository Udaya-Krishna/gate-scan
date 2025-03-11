import React from 'react';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import IDScanner from './components/IDScanner';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <IDScanner />
    </ThemeProvider>
  );
}

export default App; 