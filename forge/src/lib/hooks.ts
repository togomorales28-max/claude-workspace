import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import { DEFAULT_SETTINGS } from '@/data/repo';
import type { Settings } from '@/domain/types';
import { saveFile } from './platform';

/** Configuración en vivo. `undefined` mientras carga. */
export function useSettings(): Settings | undefined {
  return useLiveQuery(async () => {
    const s = await db.settings.get('settings');
    return { ...DEFAULT_SETTINGS, ...(s ?? {}), web: { ...DEFAULT_SETTINGS.web, ...(s?.web ?? {}) } };
  }, []);
}

export const useMaterials = () => useLiveQuery(() => db.materials.orderBy('name').toArray(), []);
export const useClients = () => useLiveQuery(() => db.clients.orderBy('name').toArray(), []);
export const useQuotes = () => useLiveQuery(() => db.quotes.orderBy('createdAt').reverse().toArray(), []);
export const useReferences = () => useLiveQuery(() => db.references.orderBy('updatedAt').reverse().toArray(), []);

/** Descarga un archivo (en el artefacto pide confirmación al visor). */
export const downloadBlob = (blob: Blob, filename: string) => saveFile(blob, filename);
