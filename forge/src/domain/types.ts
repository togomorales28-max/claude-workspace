import type { WebEstimatorConfig } from './webEstimator';

// Modelos de dominio de FORGE.
// Todos los montos se guardan en MXN como números (pesos con centavos).
// Los IDs son strings (UUID) para facilitar una futura sincronización con Supabase.

export type ID = string;

export interface Timestamps {
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

/** Marca de registros de demostración, para poder eliminarlos sin tocar datos reales. */
export interface DemoFlag {
  isDemo?: boolean;
}

export type MaterialKind = 'material' | 'consumable';

export interface PricePoint {
  price: number;
  date: string; // ISO
}

export interface Material extends Timestamps, DemoFlag {
  id: ID;
  name: string;
  category: string;
  kind: MaterialKind;
  unit: string;
  price: number;
  notes?: string;
  priceHistory: PricePoint[]; // precios anteriores (más reciente al final)
}

export interface Client extends Timestamps, DemoFlag {
  id: ID;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  notes?: string;
}

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'completed';

export type ProfitMode = 'margin' | 'markup';

export interface QuoteLine {
  id: ID;
  materialId?: ID; // vínculo al catálogo (opcional: puede ser un material libre)
  kind: MaterialKind;
  name: string;
  unit: string;
  unitPrice: number;
  qty: number;
}

export interface ExtraCost {
  id: ID;
  label: string;
  amount: number;
}

export interface Dimensions {
  width: number; // m
  height: number; // m
  length: number; // m
  quantity: number; // piezas
}

export interface Labor {
  workers: number;
  hours: number; // horas por trabajador
  rate: number; // MXN por hora
}

export interface QuoteInput {
  jobType: string;
  title: string;
  description: string;
  dimensions: Dimensions;
  /** Si es true, materiales, consumibles y mano de obra se capturan por pieza y se multiplican por la cantidad. */
  perPiece: boolean;
  lines: QuoteLine[];
  labor: Labor;
  transport: number;
  installation: number;
  extras: ExtraCost[];
  wastePct: number; // % sobre materiales
  contingencyPct: number; // % sobre costo directo
  profitMode: ProfitMode;
  profitPct: number;
  roundTo: number; // 0 = sin redondeo
  /** Precio final fijado manualmente (anula el recomendado). null = usar recomendado. */
  manualPrice: number | null;
  taxEnabled: boolean;
  taxPct: number;
}

export interface Quote extends QuoteInput, Timestamps, DemoFlag {
  id: ID;
  number: string;
  clientId: ID | null;
  clientName: string; // copia para el documento
  clientPhone: string;
  status: QuoteStatus;
  deliveryTime: string;
  paymentTerms: string;
  validityDays: number;
  notes: string;
  /** Detalle visible para el cliente en el documento: lista de materiales con cantidades, o solo resumen. */
  docDetail: 'quantities' | 'summary';
  /** Totales guardados para listados rápidos (se recalculan al guardar). */
  totals: { cost: number; price: number; profit: number; total: number };
  statusHistory: { status: QuoteStatus; date: string }[];
}

export interface Settings {
  id: 'settings';
  shopName: string;
  ownerName: string;
  logo: string | null; // data URL PNG
  phone: string;
  email: string;
  address: string;
  rfc: string;
  currency: 'MXN';
  defaultProfitMode: ProfitMode;
  defaultProfitPct: number;
  laborRate: number;
  defaultWastePct: number;
  defaultContingencyPct: number;
  defaultRoundTo: number;
  taxPct: number;
  taxEnabledByDefault: boolean;
  quotePrefix: string;
  nextQuoteNumber: number;
  defaultValidityDays: number;
  defaultPaymentTerms: string;
  defaultDeliveryTime: string;
  quoteFooter: string;
  onboarded: boolean;
  /** Configuración del estimador público para la web del taller. */
  web: WebEstimatorConfig;
}

/** Precio de referencia de un trabajo ya cobrado (para el estimador por escala). */
export interface ReferencePrice extends Timestamps, DemoFlag {
  id: ID;
  name: string;
  jobType: string;
  method: ScaleMethod;
  unit: LengthUnit;
  refLength: number;
  refHeight: number;
  price: number;
  fixedPct: number;
  notes?: string;
}

export type LengthUnit = 'm' | 'cm' | 'ft' | 'in';
export type ScaleMethod = 'linear' | 'area' | 'unit';
