import type { ScaleMethod } from './types';

/**
 * Estimador público para la página web del taller.
 * Toda la configuración viaja codificada en la URL del widget (no hay servidor),
 * así que solo contiene datos públicos: tarifas, textos y contacto.
 */

export interface WebItem {
  jobType: string;
  label: string;
  enabled: boolean;
  method: ScaleMethod; // linear: $/m lineal · area: $/m² · unit: $/pieza
  rate: number;
  minimum: number;
}

export interface WebEstimatorConfig {
  shopName: string;
  whatsapp: string; // teléfono del taller
  title: string;
  intro: string;
  disclaimer: string;
  rangePct: number; // ± % para mostrar un rango
  roundTo: number;
  accent: string; // color hex
  theme: 'light' | 'dark';
  appUrl: string; // URL de FORGE para importar solicitudes (opcional)
  items: WebItem[];
}

export interface WebRequest {
  jobType: string;
  label: string;
  method: ScaleMethod;
  width: number; // m
  height: number; // m
  length: number; // m
  qty: number;
  low: number;
  high: number;
  name: string;
  phone: string;
  comment: string;
}

// ---------- Codificación base64url de JSON UTF-8 ----------
function toB64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

const METHODS: ScaleMethod[] = ['linear', 'area', 'unit'];

/** Formato compacto para que la URL sea corta. */
export function encodeConfig(c: WebEstimatorConfig): string {
  const compact = {
    v: 1,
    s: c.shopName,
    w: c.whatsapp.replace(/\D/g, ''),
    t: c.title,
    i: c.intro,
    d: c.disclaimer,
    r: c.rangePct,
    ro: c.roundTo,
    a: c.accent,
    th: c.theme === 'dark' ? 1 : 0,
    u: c.appUrl,
    it: c.items.filter((x) => x.enabled && x.rate > 0).map((x) => [x.jobType, x.label, METHODS.indexOf(x.method), x.rate, x.minimum]),
  };
  return toB64Url(JSON.stringify(compact));
}

export function decodeConfig(s: string): WebEstimatorConfig | null {
  try {
    const o = JSON.parse(fromB64Url(s));
    if (o?.v !== 1 || !Array.isArray(o.it)) return null;
    const str = (x: unknown, max = 400) => (typeof x === 'string' ? x.slice(0, max) : '');
    const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : 0);
    const accent = /^#[0-9a-fA-F]{6}$/.test(o.a) ? o.a : '#e8792b';
    return {
      shopName: str(o.s, 80),
      whatsapp: str(o.w, 15).replace(/\D/g, ''),
      title: str(o.t, 120),
      intro: str(o.i),
      disclaimer: str(o.d),
      rangePct: Math.min(50, n(o.r)),
      roundTo: n(o.ro),
      accent,
      theme: o.th === 1 ? 'dark' : 'light',
      appUrl: /^https?:\/\//.test(o.u) ? str(o.u, 300) : '',
      items: o.it
        .filter((x: unknown) => Array.isArray(x) && x.length >= 5)
        .slice(0, 20)
        .map((x: unknown[]) => ({
          jobType: str(x[0], 40),
          label: str(x[1], 60),
          enabled: true,
          method: METHODS[x[2] as number] ?? 'unit',
          rate: n(x[3]),
          minimum: n(x[4]),
        }))
        .filter((x: WebItem) => x.rate > 0 && x.label),
    };
  } catch {
    return null;
  }
}

export const encodeRequest = (r: WebRequest) => toB64Url(JSON.stringify(r));
export function decodeRequest(s: string): WebRequest | null {
  try {
    const o = JSON.parse(fromB64Url(s));
    const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : 0);
    const str = (x: unknown, max = 500) => (typeof x === 'string' ? x.slice(0, max) : '');
    return {
      jobType: str(o.jobType, 40),
      label: str(o.label, 60),
      method: METHODS.includes(o.method) ? o.method : 'unit',
      width: n(o.width),
      height: n(o.height),
      length: n(o.length),
      qty: Math.max(1, Math.floor(n(o.qty))),
      low: n(o.low),
      high: n(o.high),
      name: str(o.name, 100),
      phone: str(o.phone, 20),
      comment: str(o.comment),
    };
  } catch {
    return null;
  }
}

// ---------- Cálculo ----------
export interface WebEstimate {
  valid: boolean;
  error: string | null;
  measure: number; // m, m² o piezas
  base: number;
  price: number;
  low: number;
  high: number;
  appliedMinimum: boolean;
}

const roundStep = (v: number, step: number, dir: 'up' | 'down') => {
  if (!step) return Math.round(v * 100) / 100;
  return (dir === 'up' ? Math.ceil(v / step) : Math.floor(v / step)) * step;
};

/** Medidas en metros. */
export function webEstimate(item: WebItem, dims: { width: number; height: number; length: number; qty: number }, rangePct: number, roundTo: number): WebEstimate {
  const bad = (error: string): WebEstimate => ({ valid: false, error, measure: 0, base: 0, price: 0, low: 0, high: 0, appliedMinimum: false });
  const qty = Math.max(1, Math.floor(dims.qty || 1));
  let measure = qty;
  if (item.method === 'linear') {
    if (!(dims.length > 0)) return bad('Indica el largo.');
    measure = dims.length * qty;
  } else if (item.method === 'area') {
    if (!(dims.width > 0 && dims.height > 0)) return bad('Indica el ancho y el alto.');
    measure = dims.width * dims.height * qty;
  }
  const base = item.rate * measure;
  const price = Math.max(base, item.minimum);
  const r = Math.min(50, Math.max(0, rangePct)) / 100;
  return {
    valid: true,
    error: null,
    measure,
    base,
    price,
    low: roundStep(price * (1 - r), roundTo, 'down'),
    high: roundStep(price * (1 + r), roundTo, 'up'),
    appliedMinimum: item.minimum > base,
  };
}

export const methodUnit = (m: ScaleMethod) => (m === 'linear' ? 'm lineal' : m === 'area' ? 'm²' : 'pieza');
