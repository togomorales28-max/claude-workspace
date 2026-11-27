import Dexie, { type Table } from 'dexie';
import type { Client, Material, Quote, ReferencePrice, Settings } from '@/domain/types';

/**
 * Base de datos local (IndexedDB vía Dexie).
 * Cada tabla usa IDs string + createdAt/updatedAt, el mismo esquema que tendría
 * una tabla de Supabase/Postgres, para poder sincronizar en el futuro.
 */
export class ForgeDB extends Dexie {
  materials!: Table<Material, string>;
  clients!: Table<Client, string>;
  quotes!: Table<Quote, string>;
  settings!: Table<Settings, string>;
  references!: Table<ReferencePrice, string>;

  constructor(name = 'forge') {
    super(name);
    this.version(1).stores({
      materials: 'id, name, category, kind, updatedAt',
      clients: 'id, name, phone, updatedAt',
      quotes: 'id, number, clientId, status, jobType, createdAt, updatedAt',
      settings: 'id',
      references: 'id, jobType, updatedAt',
    });
  }
}

export const db = new ForgeDB();
