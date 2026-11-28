import type { ProfileDims, ProfileType } from '../domain/profiles';
import type { CutPiece, StockBar } from '../domain/cutting';
import type { BudgetInput } from '../domain/budget';

/** Campos comunes para sincronización futura (última escritura gana por updatedAt). */
export interface Entity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface Density {
  id: string;
  name: string;
  /** kg/m³ */
  value: number;
}

export interface Material extends Entity {
  name: string;
  profile: ProfileType;
  dims: ProfileDims;
  densityId: string;
  /** Longitud comercial (mm). En placa: largo de la hoja. */
  stockLength: number;
  /** Precio por barra / hoja (MXN), null = no capturado */
  pricePerBar: number | null;
  /** Precio por kg (MXN), null = no capturado */
  pricePerKg: number | null;
  supplier: string;
  /** Fecha ISO (AAAA-MM-DD) en que se actualizó el precio */
  priceDate: string | null;
  notes: string;
}

export interface Client extends Entity {
  name: string;
  phone: string;
  email: string;
  address: string;
  rfc: string;
  notes: string;
}

export interface CutGroup {
  id: string;
  materialId: string | null;
  /** Descripción del material (se copia del catálogo o se escribe) */
  label: string;
  /** Peso por metro usado para calcular kg (null si se desconoce) */
  kgm: number | null;
  /** Precio por barra nueva usado para costos (null si se desconoce) */
  pricePerBar: number | null;
  stock: StockBar[];
  kerf: number;
  trimStart: number;
  minReusable: number;
  pieces: CutPiece[];
}

export interface CutSummary {
  bars: number;
  newBars: number;
  stockLength: number;
  piecesLength: number;
  waste: number;
  scrap: number;
  kg: number;
  wasteKg: number;
  cost: number | null;
}

export interface CutPlan extends Entity {
  name: string;
  clientId: string | null;
  notes: string;
  groups: CutGroup[];
  summary: CutSummary | null;
}

export type QuoteStatus = 'borrador' | 'enviada' | 'aceptada' | 'rechazada' | 'terminada';

export const QUOTE_STATUS: { id: QuoteStatus; label: string }[] = [
  { id: 'borrador', label: 'Borrador' },
  { id: 'enviada', label: 'Enviada' },
  { id: 'aceptada', label: 'Aceptada' },
  { id: 'rechazada', label: 'Rechazada' },
  { id: 'terminada', label: 'Terminada' },
];

export interface QuoteSnapshot {
  cost: number;
  profit: number;
  total: number;
  weightKg: number;
}

export interface Quote extends Entity, BudgetInput {
  number: string;
  title: string;
  description: string;
  clientId: string | null;
  status: QuoteStatus;
  /** Fecha ISO AAAA-MM-DD */
  date: string;
  validDays: number;
  terms: string;
  cutPlanId: string | null;
  /** Qué ve el cliente en el PDF: solo conceptos y total, o precio por partida (con la utilidad prorrateada) */
  pdfDetail: 'conceptos' | 'precios';
  snapshot: QuoteSnapshot | null;
}

export interface ShopInfo {
  name: string;
  owner: string;
  address: string;
  phone: string;
  email: string;
  rfc: string;
  /** Logotipo como data URL (PNG/JPEG) */
  logo: string | null;
}

export interface Settings {
  id: 'settings';
  shop: ShopInfo;
  densities: Density[];
  defaultDensityId: string;
  cut: { kerf: number; trimStart: number; minReusable: number; stockLength: number };
  budget: {
    laborRate: number;
    profitPct: number;
    profitMode: 'recargo' | 'margen';
    wastePct: number;
    ivaEnabled: boolean;
    ivaPct: number;
    roundTo: number;
    validDays: number;
    terms: string;
  };
  quotePrefix: string;
  nextQuoteNumber: number;
  updatedAt: string;
}
