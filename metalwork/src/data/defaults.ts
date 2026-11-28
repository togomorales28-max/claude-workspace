import type { Settings } from './types';

/** Valores iniciales. No incluyen precios: el taller los captura. */
export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  shop: { name: '', owner: '', address: '', phone: '', email: '', rfc: '', logo: null },
  densities: [
    { id: 'acero', name: 'Acero al carbono', value: 7850 },
    { id: 'inox', name: 'Acero inoxidable', value: 8000 },
    { id: 'aluminio', name: 'Aluminio', value: 2700 },
    { id: 'galvanizado', name: 'Acero galvanizado', value: 7850 },
    { id: 'cobre', name: 'Cobre', value: 8960 },
    { id: 'laton', name: 'Latón', value: 8500 },
  ],
  defaultDensityId: 'acero',
  cut: { kerf: 3, trimStart: 0, minReusable: 300, stockLength: 6100 },
  budget: {
    laborRate: 0,
    profitPct: 30,
    profitMode: 'recargo',
    wastePct: 10,
    ivaEnabled: false,
    ivaPct: 16,
    roundTo: 0,
    validDays: 15,
    terms: 'Precios en pesos mexicanos (MXN). Se requiere 50 % de anticipo para iniciar el trabajo y el resto contra entrega.',
  },
  quotePrefix: 'COT-',
  nextQuoteNumber: 1,
  updatedAt: new Date(0).toISOString(),
};
