import Dexie, { type Table } from 'dexie';
import type { Client, CutPlan, Material, Quote, Settings } from './types';

export class MetalworkDB extends Dexie {
  materials!: Table<Material, string>;
  clients!: Table<Client, string>;
  cutPlans!: Table<CutPlan, string>;
  quotes!: Table<Quote, string>;
  settings!: Table<Settings, string>;

  constructor(name = 'metalwork-calculator') {
    super(name);
    this.version(1).stores({
      materials: 'id, name, profile, updatedAt',
      clients: 'id, name, updatedAt',
      cutPlans: 'id, name, clientId, updatedAt',
      quotes: 'id, number, clientId, status, date, updatedAt',
      settings: 'id',
    });
  }
}

export const db = new MetalworkDB();

/** Pide al navegador que no borre los datos por falta de espacio. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
