import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/archivo';
import '@fontsource/jetbrains-mono/500.css';
import './index.css';
import { App } from './App';
import { initPwa } from './lib/pwa';

import { IS_ARTIFACT, TARGET } from './lib/platform';
import { startCloudSync } from './data/cloudSync';

if (TARGET === 'web') initPwa();
if (IS_ARTIFACT) void startCloudSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
