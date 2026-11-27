import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import { DEFAULT_SETTINGS } from '@/data/repo';
import type { Settings } from '@/domain/types';

/** Configuración en vivo. `undefined` mientras carga. */
export function useSettings(): Settings | undefined {
  return useLiveQuery(async () => ({ ...DEFAULT_SETTINGS, ...((await db.settings.get('settings')) ?? {}) }), []);
}

export const useMaterials = () => useLiveQuery(() => db.materials.orderBy('name').toArray(), []);
export const useClients = () => useLiveQuery(() => db.clients.orderBy('name').toArray(), []);
export const useQuotes = () => useLiveQuery(() => db.quotes.orderBy('createdAt').reverse().toArray(), []);
export const useReferences = () => useLiveQuery(() => db.references.orderBy('updatedAt').reverse().toArray(), []);

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
