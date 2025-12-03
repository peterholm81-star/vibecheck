import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

// Register service worker ONLY in production (not in dev)
if (import.meta.env.PROD) {
  registerSW({
    onNeedRefresh() {
      console.log('New content available, will update on next visit.');
    },
    onOfflineReady() {
      console.log('App ready to work offline.');
    },
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
