import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { mergeSettings, repos } from './repo';
import type { Settings } from './types';

export const useMaterials = () => useLiveQuery(() => repos.materials.list(), []);
export const useClients = () => useLiveQuery(() => repos.clients.list(), []);
export const useCutPlans = () => useLiveQuery(() => repos.cutPlans.list(), []);
export const useQuotes = () => useLiveQuery(() => repos.quotes.list(), []);
export const useSettings = (): Settings | undefined =>
  useLiveQuery(async () => mergeSettings(await db.settings.get('settings')), []);
