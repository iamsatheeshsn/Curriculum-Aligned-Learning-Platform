import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@stemora/auth';
import { FeedbackProvider } from '@stemora/ui';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FeedbackProvider>
      <AuthProvider storageKey="stemora.learner.auth">
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </FeedbackProvider>
  </StrictMode>,
);
