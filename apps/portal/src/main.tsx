import { IconContext } from '@phosphor-icons/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { App } from './App';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { ToastProvider } from './components/ui/Toast';
import { AuthProvider } from './lib/auth';
import { ThemeProvider } from './lib/theme';
import './styles/theme.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <IconContext.Provider value={{ weight: 'bold' }}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <BrowserRouter>
              <ErrorBoundary screen><App /></ErrorBoundary>
            </BrowserRouter>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </IconContext.Provider>
  </StrictMode>,
);
