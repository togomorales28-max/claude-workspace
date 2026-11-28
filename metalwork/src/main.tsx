import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { requestPersistence } from './data/db';
import { warmDownloads } from './lib/csv';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

void requestPersistence();
if (import.meta.env.VITE_ARTIFACT === '1') warmDownloads();

if ('serviceWorker' in navigator && import.meta.env.PROD && import.meta.env.VITE_ARTIFACT !== '1') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
}
