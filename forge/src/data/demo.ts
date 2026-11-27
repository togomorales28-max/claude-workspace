import { db } from './db';
import { settingsRepo, uid, quotesRepo } from './repo';
import { newQuote } from './factory';
import { calculate } from '@/domain/calc';
import type { Client, Material, Quote, QuoteStatus, ReferencePrice } from '@/domain/types';

/**
 * MODO DEMOSTRACIÓN.
 * Todos los registros llevan isDemo = true y precios ILUSTRATIVOS (no son precios de mercado).
 * Se pueden eliminar en un clic desde Configuración sin afectar datos reales.
 */
export async function loadDemo() {
  const t = new Date();
  const iso = (daysAgo: number) => new Date(t.getTime() - daysAgo * 86400000).toISOString();
  const mat = (name: string, category: string, unit: string, price: number, kind: Material['kind'] = 'material'): Material => ({
    id: uid(), name: `${name}`, category, unit, price, kind, isDemo: true,
    priceHistory: [{ price, date: iso(30) }], createdAt: iso(30), updatedAt: iso(30),
  });
  const materials = [
    mat('[Demo] PTR 2" x 2" cal. 14', 'PTR', 'tramo', 300),
    mat('[Demo] PTR 4" x 2" cal. 14', 'PTR', 'tramo', 500),
    mat('[Demo] Tubular cuadrado 3/4" cal. 18', 'Tubular', 'tramo', 150),
    mat('[Demo] Solera 1" x 1/8"', 'Solera', 'tramo', 80),
    mat('[Demo] Lámina negra cal. 18', 'Lámina', 'hoja', 600),
    mat('[Demo] Electrodo 6013 1/8"', 'Electrodos', 'kg', 90, 'consumable'),
    mat('[Demo] Disco de corte 4 1/2"', 'Discos', 'pza', 30, 'consumable'),
    mat('[Demo] Primer anticorrosivo', 'Pintura', 'l', 120, 'consumable'),
  ];
  const client = (name: string, phone: string, d: number): Client => ({
    id: uid(), name, phone, isDemo: true, createdAt: iso(d), updatedAt: iso(d),
  });
  const clients = [client('[Demo] Cliente Ejemplo A', '5512345678', 25), client('[Demo] Cliente Ejemplo B', '3398765432', 12)];

  const s = await settingsRepo.get();
  const base = { ...s, laborRate: s.laborRate || 100 };
  const mk = (
    title: string, jobType: string, c: Client, status: QuoteStatus, daysAgo: number,
    dims: Quote['dimensions'], lines: [Material, number][], hours: number,
  ): Quote => {
    const q = newQuote(base);
    const lineRows = lines.map(([m, qty]) => ({ id: uid(), materialId: m.id, kind: m.kind, name: m.name, unit: m.unit, unitPrice: m.price, qty }));
    const out: Quote = {
      ...q, title, jobType, clientId: c.id, clientName: c.name, clientPhone: c.phone, status, isDemo: true,
      description: 'Registro de demostración con precios ilustrativos.',
      dimensions: dims, lines: lineRows, labor: { workers: 1, hours, rate: base.laborRate },
      statusHistory: [{ status: 'draft', date: iso(daysAgo) }, ...(status !== 'draft' ? [{ status, date: iso(daysAgo - 1) }] : [])],
      createdAt: iso(daysAgo), updatedAt: iso(daysAgo),
    };
    const b = calculate(out);
    out.totals = { cost: b.cost, price: b.price, profit: b.profit, total: b.total };
    return out;
  };
  const [ptr2, ptr4, tub, sol, lam, ele, disco, primer] = materials;
  const quotes = [
    mk('[Demo] Barandal de balcón 10 ft', 'barandal', clients[0], 'accepted', 20, { width: 3.05, height: 1.09, length: 3.05, quantity: 1 },
      [[ptr2, 1], [ptr4, 1], [tub, 5], [ele, 1], [disco, 2], [primer, 1]], 6),
    mk('[Demo] Portón corredizo', 'porton', clients[1], 'sent', 8, { width: 4, height: 2.2, length: 0, quantity: 1 },
      [[ptr4, 4], [lam, 4], [sol, 2], [ele, 2], [disco, 4], [primer, 4]], 16),
    mk('[Demo] Protección de ventana', 'proteccion', clients[0], 'draft', 2, { width: 1.5, height: 1.2, length: 0, quantity: 3 },
      [[tub, 4], [sol, 1], [ele, 1], [disco, 1]], 5),
  ];
  for (const q of quotes) q.number = await quotesRepo.nextNumber();

  const refs: ReferencePrice[] = [{
    id: uid(), name: '[Demo] Barandal de balcón (plano 10 ft)', jobType: 'barandal', method: 'linear', unit: 'ft',
    refLength: 10, refHeight: 3.58, price: 200, fixedPct: 0, isDemo: true, createdAt: iso(20), updatedAt: iso(20),
    notes: 'Ejemplo: si el de 10 ft se cobra en $200, el de 12 ft se estima en $240.',
  }];

  await db.transaction('rw', [db.materials, db.clients, db.quotes, db.references], async () => {
    await db.materials.bulkAdd(materials);
    await db.clients.bulkAdd(clients);
    await db.quotes.bulkAdd(quotes);
    await db.references.bulkAdd(refs);
  });
}

export async function clearDemo() {
  await db.transaction('rw', [db.materials, db.clients, db.quotes, db.references], async () => {
    await db.materials.filter((x) => !!x.isDemo).delete();
    await db.clients.filter((x) => !!x.isDemo).delete();
    await db.quotes.filter((x) => !!x.isDemo).delete();
    await db.references.filter((x) => !!x.isDemo).delete();
  });
}

export async function hasDemo() {
  return (await db.quotes.filter((q) => !!q.isDemo).count()) + (await db.materials.filter((m) => !!m.isDemo).count()) > 0;
}
