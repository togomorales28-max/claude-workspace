import { db } from './db';
import type { Client, Material, Quote, QuoteStatus, ReferencePrice, Settings } from '@/domain/types';
import { calculate } from '@/domain/calc';
import { CATEGORY_KIND, STARTER_MATERIALS } from '@/domain/constants';

/**
 * Capa de acceso a datos. La UI solo usa estas funciones (nunca Dexie directamente para escribir),
 * de modo que en una versión futura se puede cambiar la implementación por Supabase
 * o agregar una cola de sincronización sin tocar las pantallas.
 */

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const now = () => new Date().toISOString();

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  shopName: '',
  ownerName: '',
  logo: null,
  phone: '',
  email: '',
  address: '',
  rfc: '',
  currency: 'MXN',
  defaultProfitMode: 'margin',
  defaultProfitPct: 30,
  laborRate: 0,
  defaultWastePct: 10,
  defaultContingencyPct: 5,
  defaultRoundTo: 10,
  taxPct: 16,
  taxEnabledByDefault: false,
  quotePrefix: 'COT',
  nextQuoteNumber: 1,
  defaultValidityDays: 15,
  defaultPaymentTerms: '50 % de anticipo para iniciar fabricación y 50 % contra entrega.',
  defaultDeliveryTime: '10 días hábiles a partir del anticipo',
  quoteFooter: 'Precios sujetos a cambio sin previo aviso después de la vigencia. No incluye trabajos de albañilería salvo que se indique.',
  onboarded: false,
};

// ---------- Settings ----------
export const settingsRepo = {
  async get(): Promise<Settings> {
    const s = await db.settings.get('settings');
    return { ...DEFAULT_SETTINGS, ...(s ?? {}) };
  },
  async save(patch: Partial<Settings>) {
    const current = await settingsRepo.get();
    await db.settings.put({ ...current, ...patch, id: 'settings' });
  },
};

// ---------- Materiales ----------
export const materialsRepo = {
  async create(data: Omit<Material, 'id' | 'createdAt' | 'updatedAt' | 'priceHistory'>) {
    const t = now();
    const m: Material = { ...data, id: uid(), createdAt: t, updatedAt: t, priceHistory: [{ price: data.price, date: t }] };
    await db.materials.add(m);
    return m;
  },
  async update(id: string, patch: Partial<Omit<Material, 'id' | 'priceHistory'>>) {
    await db.transaction('rw', db.materials, async () => {
      const m = await db.materials.get(id);
      if (!m) throw new Error('Material no encontrado');
      const t = now();
      const history = [...m.priceHistory];
      if (patch.price !== undefined && patch.price !== m.price) history.push({ price: patch.price, date: t });
      await db.materials.put({ ...m, ...patch, priceHistory: history.slice(-50), updatedAt: t });
    });
  },
  async remove(id: string) {
    await db.materials.delete(id);
  },
  /** Agrega nombres y unidades comunes con precio 0: el taller captura sus precios reales. */
  async addStarter() {
    const existing = new Set((await db.materials.toArray()).map((m) => m.name.toLowerCase()));
    const t = now();
    const rows: Material[] = STARTER_MATERIALS.filter((s) => !existing.has(s.name.toLowerCase())).map((s) => ({
      ...s,
      id: uid(),
      kind: CATEGORY_KIND[s.category] ?? 'material',
      price: 0,
      priceHistory: [],
      createdAt: t,
      updatedAt: t,
    }));
    await db.materials.bulkAdd(rows);
    return rows.length;
  },
};

// ---------- Clientes ----------
export const clientsRepo = {
  async create(data: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) {
    const t = now();
    const c: Client = { ...data, id: uid(), createdAt: t, updatedAt: t };
    await db.clients.add(c);
    return c;
  },
  async update(id: string, patch: Partial<Omit<Client, 'id'>>) {
    await db.transaction('rw', db.clients, db.quotes, async () => {
      await db.clients.update(id, { ...patch, updatedAt: now() });
      // Mantener la copia del nombre/teléfono en cotizaciones que aún no se envían
      if (patch.name !== undefined || patch.phone !== undefined) {
        const c = await db.clients.get(id);
        if (c)
          await db.quotes
            .where('clientId')
            .equals(id)
            .modify((q) => {
              if (q.status === 'draft') {
                q.clientName = c.name;
                q.clientPhone = c.phone;
              }
            });
      }
    });
  },
  /** Elimina el cliente; sus cotizaciones se conservan con el nombre guardado. */
  async remove(id: string) {
    await db.transaction('rw', db.clients, db.quotes, async () => {
      await db.quotes.where('clientId').equals(id).modify({ clientId: null });
      await db.clients.delete(id);
    });
  },
};

// ---------- Cotizaciones ----------
const totalsOf = (q: Quote) => {
  const b = calculate(q);
  return { cost: b.cost, price: b.price, profit: b.profit, total: b.total };
};

export const quotesRepo = {
  /** Reserva el siguiente folio de forma atómica. */
  async nextNumber(): Promise<string> {
    return db.transaction('rw', db.settings, async () => {
      const s = await settingsRepo.get();
      const n = s.nextQuoteNumber;
      await db.settings.put({ ...s, nextQuoteNumber: n + 1 });
      const year = new Date().getFullYear().toString().slice(-2);
      return `${s.quotePrefix || 'COT'}-${year}-${String(n).padStart(4, '0')}`;
    });
  },
  async save(q: Quote): Promise<Quote> {
    const t = now();
    const existing = await db.quotes.get(q.id);
    const number = existing?.number || q.number || (await quotesRepo.nextNumber());
    const saved: Quote = { ...q, number, totals: totalsOf(q), createdAt: existing?.createdAt ?? t, updatedAt: t };
    await db.quotes.put(saved);
    return saved;
  },
  async setStatus(id: string, status: QuoteStatus) {
    const q = await db.quotes.get(id);
    if (!q || q.status === status) return;
    await db.quotes.put({ ...q, status, statusHistory: [...q.statusHistory, { status, date: now() }], updatedAt: now() });
  },
  async duplicate(id: string): Promise<Quote> {
    const q = await db.quotes.get(id);
    if (!q) throw new Error('Cotización no encontrada');
    const t = now();
    const copy: Quote = {
      ...structuredClone(q),
      id: uid(),
      number: await quotesRepo.nextNumber(),
      title: `${q.title} (copia)`,
      status: 'draft',
      statusHistory: [{ status: 'draft', date: t }],
      isDemo: q.isDemo,
      createdAt: t,
      updatedAt: t,
    };
    copy.totals = totalsOf(copy);
    await db.quotes.add(copy);
    return copy;
  },
  async remove(id: string) {
    await db.quotes.delete(id);
  },
};

// ---------- Precios de referencia ----------
export const referencesRepo = {
  async save(r: Omit<ReferencePrice, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) {
    const t = now();
    const existing = r.id ? await db.references.get(r.id) : undefined;
    const row: ReferencePrice = { ...r, id: r.id ?? uid(), createdAt: existing?.createdAt ?? t, updatedAt: t };
    await db.references.put(row);
    return row;
  },
  async remove(id: string) {
    await db.references.delete(id);
  },
};
