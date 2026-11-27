import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/archivo';
import './widget.css';
import { EstimatorWidget } from './EstimatorWidget';
import { decodeConfig, type WebEstimatorConfig } from '@/domain/webEstimator';

function readConfig(): WebEstimatorConfig | null {
  const m = location.hash.match(/[#&]c=([A-Za-z0-9_-]+)/);
  return m ? decodeConfig(m[1]) : null;
}

function App() {
  const [config, setConfig] = useState(readConfig);
  useEffect(() => {
    const h = () => setConfig(readConfig());
    addEventListener('hashchange', h);
    return () => removeEventListener('hashchange', h);
  }, []);

  // Informar la altura a la página que lo inserta (iframe autoajustable).
  useEffect(() => {
    if (window.parent === window) return;
    const post = () => window.parent.postMessage({ type: 'forge-widget-height', height: document.documentElement.scrollHeight }, '*');
    const ro = new ResizeObserver(post);
    ro.observe(document.body);
    post();
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (config?.shopName) document.title = `Estimador · ${config.shopName}`;
    document.body.style.background = config?.theme === 'dark' ? '#141415' : '#f6f5f3';
  }, [config]);

  if (!config)
    return (
      <div style={{ fontFamily: 'system-ui', padding: 32, textAlign: 'center', color: '#6b6b73' }}>
        Este enlace del estimador no es válido. Genera uno nuevo desde FORGE → Estimador web.
      </div>
    );
  return <EstimatorWidget config={config} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
