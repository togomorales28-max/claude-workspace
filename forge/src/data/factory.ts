import type { Quote, QuoteLine, Settings, Material } from '@/domain/types';
import { uid } from './repo';

export function newQuote(s: Settings): Quote {
  const t = new Date().toISOString();
  return {
    id: uid(),
    number: '',
    clientId: null,
    clientName: '',
    clientPhone: '',
    status: 'draft',
    jobType: '',
    title: '',
    description: '',
    dimensions: { width: 0, height: 0, length: 0, quantity: 1 },
    perPiece: false,
    lines: [],
    labor: { workers: 1, hours: 0, rate: s.laborRate },
    transport: 0,
    installation: 0,
    extras: [],
    wastePct: s.defaultWastePct,
    contingencyPct: s.defaultContingencyPct,
    profitMode: s.defaultProfitMode,
    profitPct: s.defaultProfitPct,
    roundTo: s.defaultRoundTo,
    manualPrice: null,
    taxEnabled: s.taxEnabledByDefault,
    taxPct: s.taxPct,
    deliveryTime: s.defaultDeliveryTime,
    paymentTerms: s.defaultPaymentTerms,
    validityDays: s.defaultValidityDays,
    notes: '',
    docDetail: 'quantities',
    totals: { cost: 0, price: 0, profit: 0, total: 0 },
    statusHistory: [{ status: 'draft', date: t }],
    createdAt: t,
    updatedAt: t,
  };
}

export const lineFromMaterial = (m: Material, qty = 1): QuoteLine => ({
  id: uid(),
  materialId: m.id,
  kind: m.kind,
  name: m.name,
  unit: m.unit,
  unitPrice: m.price,
  qty,
});

export const blankLine = (kind: 'material' | 'consumable'): QuoteLine => ({
  id: uid(),
  kind,
  name: '',
  unit: kind === 'consumable' ? 'pza' : 'tramo',
  unitPrice: 0,
  qty: 1,
});
