import { db, type MetalworkDB } from './db';
import { mergeSettings } from './repo';

export const BACKUP_FORMAT = 'metalwork-calculator-backup';
export const BACKUP_VERSION = 1;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  data: {
    materials: unknown[];
    clients: unknown[];
    cutPlans: unknown[];
    quotes: unknown[];
    settings: unknown[];
  };
}

export async function exportBackup(database: MetalworkDB = db): Promise<Backup> {
  const [materials, clients, cutPlans, quotes, settings] = await Promise.all([
    database.materials.toArray(), database.clients.toArray(), database.cutPlans.toArray(),
    database.quotes.toArray(), database.settings.toArray(),
  ]);
  return {
    format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString(),
    data: { materials, clients, cutPlans, quotes, settings },
  };
}

export function parseBackup(text: string): Backup {
  let obj: Backup;
  try { obj = JSON.parse(text); } catch { throw new Error('El archivo no es un respaldo válido (JSON dañado).'); }
  if (!obj || obj.format !== BACKUP_FORMAT || !obj.data) throw new Error('El archivo no es un respaldo de Metalwork Calculator.');
  if (obj.version > BACKUP_VERSION) throw new Error('El respaldo es de una versión más nueva de la aplicación.');
  for (const k of ['materials', 'clients', 'cutPlans', 'quotes', 'settings'] as const) {
    if (!Array.isArray(obj.data[k])) throw new Error(`El respaldo no contiene la sección «${k}».`);
    for (const row of obj.data[k]) {
      if (!row || typeof (row as { id?: unknown }).id !== 'string') throw new Error(`Registro inválido en «${k}».`);
    }
  }
  return obj;
}

/** Reemplaza todos los datos por los del respaldo, en una sola transacción: si falla no se pierde nada. */
export async function restoreBackup(b: Backup, database: MetalworkDB = db) {
  await database.transaction('rw', [database.materials, database.clients, database.cutPlans, database.quotes, database.settings], async () => {
    await Promise.all([database.materials.clear(), database.clients.clear(), database.cutPlans.clear(), database.quotes.clear(), database.settings.clear()]);
    await database.materials.bulkPut(b.data.materials as never[]);
    await database.clients.bulkPut(b.data.clients as never[]);
    await database.cutPlans.bulkPut(b.data.cutPlans as never[]);
    await database.quotes.bulkPut(b.data.quotes as never[]);
    const s = (b.data.settings as { id: string }[]).find((x) => x.id === 'settings');
    if (s) await database.settings.put(mergeSettings(s as never));
  });
}
