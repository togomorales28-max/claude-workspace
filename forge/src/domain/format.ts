const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const mxn0 = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
const dec = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });

export const money = (n: number) => mxn.format(Number.isFinite(n) ? n : 0);
export const moneyShort = (n: number) => mxn0.format(Number.isFinite(n) ? n : 0);
export const decimal = (n: number) => dec.format(Number.isFinite(n) ? n : 0);
export const pct = (n: number, digits = 1) =>
  Number.isFinite(n) ? `${n.toLocaleString('es-MX', { maximumFractionDigits: digits })} %` : '—';

export const dateShort = (iso: string) =>
  new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
export const dateLong = (iso: string) =>
  new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });

export const addDays = (iso: string, days: number) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
};

/** Normaliza un teléfono mexicano para wa.me (52 + 10 dígitos). */
export function waPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `52${digits}`;
  if (digits.length === 13 && digits.startsWith('521')) return `52${digits.slice(3)}`;
  return digits;
}
