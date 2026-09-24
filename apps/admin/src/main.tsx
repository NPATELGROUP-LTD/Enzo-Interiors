import { IconContext } from '@phosphor-icons/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';

import { App } from './App';
import { ToastProvider } from './components/ui/Toast';
import { AuthProvider } from './lib/auth';
import { ThemeProvider } from './lib/theme';
import './styles/theme.css';

// A data router rather than <BrowserRouter> for one reason: useBlocker, which
// is what stops a menu click from throwing away an unsaved page of edits. The
// app's own <Routes> still do the matching underneath this catch-all.
const router = createBrowserRouter([{ path: '*', element: <App /> }]);

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <IconContext.Provider value={{ weight: 'bold' }}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </IconContext.Provider>
  </StrictMode>,
);
