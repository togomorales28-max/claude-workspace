/**
 * Geometría de perfiles metálicos.
 *
 * Convención de unidades del dominio:
 *   - Dimensiones de sección y espesores: milímetros (mm)
 *   - Áreas de sección: mm²
 *   - Longitudes de corte: mm
 *   - Densidad: kg/m³
 *   - Peso lineal: kg/m
 *
 * Las fórmulas son geométricas, con esquinas vivas. En tubos se puede indicar un
 * radio exterior de esquina para corregir el área. En perfiles laminados (canal, viga)
 * se ignoran los radios de raíz, así que el resultado es aproximado.
 */

export type ProfileType =
  | 'ptr_cuadrado'
  | 'ptr_rectangular'
  | 'tubo_redondo'
  | 'angulo'
  | 'solera'
  | 'barra_redonda'
  | 'barra_cuadrada'
  | 'barra_hexagonal'
  | 'canal_u'
  | 'viga_i'
  | 'placa'
  | 'personalizado';

export interface ProfileDims {
  /** Lado / ancho / diámetro principal (mm) */
  a?: number;
  /** Segundo lado o alto (mm) */
  b?: number;
  /** Espesor de pared, de ala o de placa (mm) */
  t?: number;
  /** Espesor de alma (canal, viga) (mm) */
  tw?: number;
  /** Radio exterior de esquina en tubos (mm), opcional */
  r?: number;
  /** Peso lineal manual (kg/m), solo para perfil personalizado */
  kgm?: number;
}

export interface FieldDef {
  key: keyof ProfileDims;
  label: string;
  unit: 'mm' | 'kg/m';
  optional?: boolean;
  hint?: string;
}

export interface ProfileDef {
  type: ProfileType;
  label: string;
  short: string;
  /** Si es lineal (tiene peso por metro) o superficial (placa) */
  kind: 'lineal' | 'superficie';
  fields: FieldDef[];
  /** Se puede optimizar en el cortador (barras) */
  cuttable: boolean;
  note?: string;
}

export const PROFILES: ProfileDef[] = [
  {
    type: 'ptr_cuadrado', label: 'PTR cuadrado', short: 'PTR', kind: 'lineal', cuttable: true,
    fields: [
      { key: 'a', label: 'Lado', unit: 'mm' },
      { key: 't', label: 'Espesor de pared', unit: 'mm' },
      { key: 'r', label: 'Radio exterior de esquina', unit: 'mm', optional: true, hint: '0 = esquina viva' },
    ],
  },
  {
    type: 'ptr_rectangular', label: 'PTR rectangular', short: 'PTR', kind: 'lineal', cuttable: true,
    fields: [
      { key: 'a', label: 'Ancho', unit: 'mm' },
      { key: 'b', label: 'Alto', unit: 'mm' },
      { key: 't', label: 'Espesor de pared', unit: 'mm' },
      { key: 'r', label: 'Radio exterior de esquina', unit: 'mm', optional: true, hint: '0 = esquina viva' },
    ],
  },
  {
    type: 'tubo_redondo', label: 'Tubo redondo', short: 'Tubo', kind: 'lineal', cuttable: true,
    fields: [
      { key: 'a', label: 'Diámetro exterior', unit: 'mm' },
      { key: 't', label: 'Espesor de pared', unit: 'mm' },
    ],
  },
  {
    type: 'angulo', label: 'Ángulo', short: 'Áng.', kind: 'lineal', cuttable: true,
    fields: [
      { key: 'a', label: 'Ala A', unit: 'mm' },
      { key: 'b', label: 'Ala B', unit: 'mm', hint: 'Igual a A si es ángulo de lados iguales' },
      { key: 't', label: 'Espesor', unit: 'mm' },
    ],
    note: 'Sin radio de raíz (aprox. −1 % respecto a tablas de fabricante).',
  },
  {
    type: 'solera', label: 'Solera', short: 'Solera', kind: 'lineal', cuttable: true,
    fields: [
      { key: 'a', label: 'Ancho', unit: 'mm' },
      { key: 't', label: 'Espesor', unit: 'mm' },
    ],
  },
  {
    type: 'barra_redonda', label: 'Barra maciza redonda', short: 'Redondo', kind: 'lineal', cuttable: true,
    fields: [{ key: 'a', label: 'Diámetro', unit: 'mm' }],
  },
  {
    type: 'barra_cuadrada', label: 'Barra maciza cuadrada', short: 'Cuadrado', kind: 'lineal', cuttable: true,
    fields: [{ key: 'a', label: 'Lado', unit: 'mm' }],
  },
  {
    type: 'barra_hexagonal', label: 'Barra maciza hexagonal', short: 'Hex.', kind: 'lineal', cuttable: true,
    fields: [{ key: 'a', label: 'Entre caras', unit: 'mm' }],
  },
  {
    type: 'canal_u', label: 'Canal U', short: 'Canal', kind: 'lineal', cuttable: true,
    fields: [
      { key: 'b', label: 'Peralte (alto)', unit: 'mm' },
      { key: 'a', label: 'Ancho de patín', unit: 'mm' },
      { key: 'tw', label: 'Espesor de alma', unit: 'mm' },
      { key: 't', label: 'Espesor de patín', unit: 'mm' },
    ],
    note: 'Patines de espesor constante y sin radios: valor aproximado.',
  },
  {
    type: 'viga_i', label: 'Viga I / IPR', short: 'Viga', kind: 'lineal', cuttable: true,
    fields: [
      { key: 'b', label: 'Peralte (alto)', unit: 'mm' },
      { key: 'a', label: 'Ancho de patín', unit: 'mm' },
      { key: 'tw', label: 'Espesor de alma', unit: 'mm' },
      { key: 't', label: 'Espesor de patín', unit: 'mm' },
    ],
    note: 'Sin radios de raíz: valor aproximado.',
  },
  {
    type: 'placa', label: 'Placa / lámina', short: 'Placa', kind: 'superficie', cuttable: false,
    fields: [
      { key: 'a', label: 'Ancho', unit: 'mm' },
      { key: 't', label: 'Espesor', unit: 'mm' },
    ],
  },
  {
    type: 'personalizado', label: 'Perfil personalizado', short: 'Perfil', kind: 'lineal', cuttable: true,
    fields: [{ key: 'kgm', label: 'Peso por metro', unit: 'kg/m', hint: 'Dato del fabricante o de tu proveedor' }],
  },
];

export const PROFILE_MAP: Record<ProfileType, ProfileDef> = Object.fromEntries(
  PROFILES.map((p) => [p.type, p]),
) as Record<ProfileType, ProfileDef>;

export class GeometryError extends Error {}

const req = (v: number | undefined, name: string): number => {
  if (v === undefined || v === null || !Number.isFinite(v) || v <= 0) {
    throw new GeometryError(`Falta un valor válido para «${name}».`);
  }
  return v;
};

/** Corrección de área por esquinas redondeadas en un tubo rectangular hueco. */
function cornerCorrection(r: number | undefined, t: number): number {
  if (!r || r <= 0) return 0;
  const ri = Math.max(r - t, 0);
  return (4 - Math.PI) * (r * r - ri * ri);
}

/**
 * Área de la sección transversal en mm².
 * En una placa devuelve el área de la sección ancho × espesor, que sirve para el peso por metro de largo.
 */
export function sectionArea(type: ProfileType, d: ProfileDims): number {
  switch (type) {
    case 'ptr_cuadrado': {
      const a = req(d.a, 'Lado'), t = req(d.t, 'Espesor');
      if (2 * t >= a) throw new GeometryError('El espesor debe ser menor que la mitad del lado.');
      if (d.r && d.r > a / 2) throw new GeometryError('El radio no puede ser mayor que la mitad del lado.');
      return a * a - (a - 2 * t) ** 2 - cornerCorrection(d.r, t);
    }
    case 'ptr_rectangular': {
      const a = req(d.a, 'Ancho'), b = req(d.b, 'Alto'), t = req(d.t, 'Espesor');
      if (2 * t >= Math.min(a, b)) throw new GeometryError('El espesor debe ser menor que la mitad del lado menor.');
      if (d.r && d.r > Math.min(a, b) / 2) throw new GeometryError('El radio no puede ser mayor que la mitad del lado menor.');
      return a * b - (a - 2 * t) * (b - 2 * t) - cornerCorrection(d.r, t);
    }
    case 'tubo_redondo': {
      const D = req(d.a, 'Diámetro'), t = req(d.t, 'Espesor');
      if (2 * t > D) throw new GeometryError('El espesor no puede ser mayor que el radio.');
      return (Math.PI / 4) * (D * D - (D - 2 * t) ** 2);
    }
    case 'angulo': {
      const a = req(d.a, 'Ala A'), t = req(d.t, 'Espesor');
      const b = d.b && d.b > 0 ? d.b : a;
      if (t >= Math.min(a, b)) throw new GeometryError('El espesor debe ser menor que las alas.');
      return t * (a + b - t);
    }
    case 'solera':
    case 'placa': {
      const a = req(d.a, 'Ancho'), t = req(d.t, 'Espesor');
      return a * t;
    }
    case 'barra_redonda': {
      const D = req(d.a, 'Diámetro');
      return (Math.PI / 4) * D * D;
    }
    case 'barra_cuadrada': {
      const a = req(d.a, 'Lado');
      return a * a;
    }
    case 'barra_hexagonal': {
      const s = req(d.a, 'Entre caras');
      return (Math.sqrt(3) / 2) * s * s;
    }
    case 'canal_u': {
      const H = req(d.b, 'Peralte'), B = req(d.a, 'Ancho de patín');
      const tw = req(d.tw, 'Espesor de alma'), tf = req(d.t, 'Espesor de patín');
      if (2 * tf >= H || tw >= B) throw new GeometryError('Los espesores no son compatibles con las dimensiones.');
      return H * tw + 2 * (B - tw) * tf;
    }
    case 'viga_i': {
      const H = req(d.b, 'Peralte'), B = req(d.a, 'Ancho de patín');
      const tw = req(d.tw, 'Espesor de alma'), tf = req(d.t, 'Espesor de patín');
      if (2 * tf >= H || tw >= B) throw new GeometryError('Los espesores no son compatibles con las dimensiones.');
      return 2 * B * tf + (H - 2 * tf) * tw;
    }
    case 'personalizado':
      throw new GeometryError('El perfil personalizado se define por su peso por metro.');
  }
}

/** Peso lineal en kg/m. Área (mm²) × 1e-6 (m²) × densidad (kg/m³) × 1 m. */
export function kgPerMeter(type: ProfileType, d: ProfileDims, density: number): number {
  if (type === 'personalizado') return req(d.kgm, 'Peso por metro');
  req(density, 'Densidad');
  return sectionArea(type, d) * 1e-6 * density;
}

/** Peso de una placa en kg: ancho × largo × espesor (mm) → m³ × densidad. */
export function plateWeight(widthMm: number, lengthMm: number, thicknessMm: number, density: number): number {
  req(widthMm, 'Ancho'); req(lengthMm, 'Largo'); req(thicknessMm, 'Espesor'); req(density, 'Densidad');
  return widthMm * lengthMm * thicknessMm * 1e-9 * density;
}

/** Peso por metro cuadrado de placa (kg/m²). */
export function plateKgPerM2(thicknessMm: number, density: number): number {
  req(thicknessMm, 'Espesor'); req(density, 'Densidad');
  return thicknessMm * 1e-3 * density;
}

/** Descripción corta y legible de un perfil, p. ej. «PTR 50.8 × 50.8 × 1.90 mm». */
export function describeProfile(type: ProfileType, d: ProfileDims): string {
  const f = (n?: number) => (n === undefined ? '?' : trimNum(n));
  switch (type) {
    case 'ptr_cuadrado': return `PTR ${f(d.a)} × ${f(d.a)} × ${f(d.t)} mm`;
    case 'ptr_rectangular': return `PTR ${f(d.a)} × ${f(d.b)} × ${f(d.t)} mm`;
    case 'tubo_redondo': return `Tubo Ø${f(d.a)} × ${f(d.t)} mm`;
    case 'angulo': return `Ángulo ${f(d.a)} × ${f(d.b ?? d.a)} × ${f(d.t)} mm`;
    case 'solera': return `Solera ${f(d.a)} × ${f(d.t)} mm`;
    case 'barra_redonda': return `Redondo Ø${f(d.a)} mm`;
    case 'barra_cuadrada': return `Cuadrado ${f(d.a)} mm`;
    case 'barra_hexagonal': return `Hexagonal ${f(d.a)} mm`;
    case 'canal_u': return `Canal U ${f(d.b)} × ${f(d.a)} mm`;
    case 'viga_i': return `Viga I ${f(d.b)} × ${f(d.a)} mm`;
    case 'placa': return `Placa ${f(d.t)} mm`;
    case 'personalizado': return `Perfil ${f(d.kgm)} kg/m`;
  }
}

export function trimNum(n: number, maxDec = 2): string {
  return String(Math.round(n * 10 ** maxDec) / 10 ** maxDec);
}

/** Calibres de lámina (Manufacturers' Standard Gauge), en mm. Son los más usados en PTR y lámina en México. */
export const GAUGES: { cal: number; mm: number }[] = [
  { cal: 7, mm: 4.554 }, { cal: 8, mm: 4.176 }, { cal: 9, mm: 3.797 }, { cal: 10, mm: 3.416 },
  { cal: 11, mm: 3.038 }, { cal: 12, mm: 2.657 }, { cal: 13, mm: 2.278 }, { cal: 14, mm: 1.897 },
  { cal: 15, mm: 1.709 }, { cal: 16, mm: 1.519 }, { cal: 18, mm: 1.214 }, { cal: 20, mm: 0.912 },
  { cal: 22, mm: 0.759 }, { cal: 24, mm: 0.607 }, { cal: 26, mm: 0.455 },
];

export const INCH_MM = 25.4;
export const FOOT_MM = 304.8;
