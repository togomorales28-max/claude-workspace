/**
 * Capa de repositorios. La interfaz no depende de Dexie, así que en el futuro se puede
 * cambiar por una implementación remota o con sincronización: cada entidad lleva id,
 * createdAt y updatedAt para resolver conflictos (última escritura gana).
 */
import { db, type MetalworkDB } from './db';
import { DEFAULT_SETTINGS } from './defaults';
import type { Client, CutPlan, Entity, Material, Quote, Settings } from './types';

export interface Repository<T extends Entity> {
  list(): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  save(item: T): Promise<T>;
  remove(id: string): Promise<void>;
}

export const uid = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
export const nowIso = () => new Date().toISOString();
export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

class DexieRepo<T extends Entity> implements Repository<T> {
  constructor(private table: () => import('dexie').Table<T, string>) {}
  async list() {
    const all = await this.table().toArray();
    return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  get(id: string) { return this.table().get(id); }
  async save(item: T) {
    const next = { ...item, updatedAt: nowIso() };
    await this.table().put(next);
    return next;
  }
  remove(id: string) { return this.table().delete(id); }
}

export function createRepos(database: MetalworkDB = db) {
  return {
    materials: new DexieRepo<Material>(() => database.materials),
    clients: new DexieRepo<Client>(() => database.clients),
    cutPlans: new DexieRepo<CutPlan>(() => database.cutPlans),
    quotes: new DexieRepo<Quote>(() => database.quotes),
    async getSettings(): Promise<Settings> {
      const s = await database.settings.get('settings');
      return mergeSettings(s);
    },
    async saveSettings(s: Settings) {
      const next = { ...s, updatedAt: nowIso() };
      await database.settings.put(next);
      return next;
    },
    /** Reserva el siguiente folio de cotización de forma atómica. */
    async nextQuoteNumber(): Promise<string> {
      return database.transaction('rw', database.settings, async () => {
        const s = mergeSettings(await database.settings.get('settings'));
        const n = s.nextQuoteNumber;
        await database.settings.put({ ...s, nextQuoteNumber: n + 1, updatedAt: nowIso() });
        return `${s.quotePrefix}${String(n).padStart(4, '0')}`;
      });
    },
  };
}

/** Completa configuraciones guardadas con valores nuevos que se agreguen en versiones futuras. */
export function mergeSettings(s: Partial<Settings> | undefined): Settings {
  const d = DEFAULT_SETTINGS;
  if (!s) return structuredClone(d);
  return {
    ...d, ...s,
    shop: { ...d.shop, ...s.shop },
    cut: { ...d.cut, ...s.cut },
    budget: { ...d.budget, ...s.budget },
    densities: s.densities?.length ? s.densities : d.densities,
  } as Settings;
}

export const repos = createRepos();
export type Repos = ReturnType<typeof createRepos>;
