import { db } from './db';

/** Respaldo completo en JSON (los datos solo viven en este dispositivo). */
export async function exportBackup(): Promise<Blob> {
  const data = {
    app: 'forge',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: await db.settings.toArray(),
    materials: await db.materials.toArray(),
    clients: await db.clients.toArray(),
    quotes: await db.quotes.toArray(),
    references: await db.references.toArray(),
  };
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
}

export async function importBackup(file: File) {
  const text = await file.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('El archivo no es un respaldo válido.');
  }
  if (data.app !== 'forge') throw new Error('El archivo no es un respaldo de FORGE.');
  const arr = (k: string) => (Array.isArray(data[k]) ? (data[k] as never[]) : []);
  await db.transaction('rw', [db.settings, db.materials, db.clients, db.quotes, db.references], async () => {
    await Promise.all([db.settings.clear(), db.materials.clear(), db.clients.clear(), db.quotes.clear(), db.references.clear()]);
    await db.settings.bulkPut(arr('settings'));
    await db.materials.bulkPut(arr('materials'));
    await db.clients.bulkPut(arr('clients'));
    await db.quotes.bulkPut(arr('quotes'));
    await db.references.bulkPut(arr('references'));
  });
}

export async function wipeAll() {
  await db.transaction('rw', [db.settings, db.materials, db.clients, db.quotes, db.references], async () => {
    await Promise.all([db.settings.clear(), db.materials.clear(), db.clients.clear(), db.quotes.clear(), db.references.clear()]);
  });
}
