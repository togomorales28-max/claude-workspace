const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const money = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? '—' : mxn.format(n));

export const num = (n: number | null | undefined, dec = 2) =>
  n == null || !Number.isFinite(n) ? '—' : new Intl.NumberFormat('es-MX', { maximumFractionDigits: dec, minimumFractionDigits: 0 }).format(n);

export const fixed = (n: number | null | undefined, dec = 2) =>
  n == null || !Number.isFinite(n) ? '—' : new Intl.NumberFormat('es-MX', { maximumFractionDigits: dec, minimumFractionDigits: dec }).format(n);

export const mm = (n: number | null | undefined) => `${num(n, 2)} mm`;
export const meters = (mmValue: number | null | undefined, dec = 2) => (mmValue == null ? '—' : `${fixed(mmValue / 1000, dec)} m`);
export const kg = (n: number | null | undefined, dec = 2) => `${fixed(n, dec)} kg`;
export const pct = (ratio: number | null | undefined, dec = 1) => (ratio == null || !Number.isFinite(ratio) ? '—' : `${fixed(ratio * 100, dec)} %`);

export function dateMx(iso: string | null | undefined) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

/** Interpreta números escritos con coma o punto decimal; devuelve null si está vacío o es inválido. */
export function parseNum(s: string): number | null {
  const t = s.trim().replace(/\s/g, '').replace(/,/g, '.');
  if (t === '' || t === '.' || t === '-') return null;
  if (!/^-?\d*\.?\d*$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const t = new Date(y, m - 1, d).getTime();
  return Math.floor((Date.now() - t) / 86_400_000);
}
