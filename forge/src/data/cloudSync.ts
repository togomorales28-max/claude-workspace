import { liveQuery } from 'dexie';
import { db } from './db';
import { useCapability } from '@/lib/platform';

/**
 * Sincronización con la cuenta de Claude (solo dentro del artefacto).
 * Cada registro local (IndexedDB) se refleja como un documento privado en
 * `data/users/<id>/<tabla>-<id>`, visible solo para la persona que lo creó.
 * Así los datos no se pierden si el navegador borra su almacenamiento y
 * aparecen en cualquier dispositivo donde se abra el artefacto con la misma cuenta.
 */

type Table = 'settings' | 'materials' | 'clients' | 'quotes' | 'references';
const TABLES: Table[] = ['settings', 'materials', 'clients', 'quotes', 'references'];
type Row = Record<string, unknown> & { id: string; updatedAt?: string };

interface DocSnap {
  id: string;
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}
interface DocRef {
  set(d: Record<string, unknown>): Promise<void>;
  delete(): Promise<void>;
}
interface QuerySnap {
  docs: DocSnap[];
  docChanges(): { type: 'added' | 'modified' | 'removed'; doc: DocSnap }[];
}
interface Collection {
  doc(id: string): DocRef;
  limit(n: number): { onSnapshot(next: (s: QuerySnap) => void, err?: (e: { code: string }) => void): () => void };
}
interface DbCap {
  collection(path: string): Collection;
}
interface UserCap {
  id(): Promise<string | null>;
}

export type SyncState = 'off' | 'connecting' | 'synced' | 'saving' | 'error';
let state: SyncState = 'off';
let lastError = '';
const listeners = new Set<() => void>();
const setState = (s: SyncState, err = '') => {
  state = s;
  lastError = err;
  listeners.forEach((l) => l());
};
export const getSyncState = () => state;
export const getSyncError = () => lastError;
export const subscribeSync = (fn: () => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};

/** JSON con llaves ordenadas: compara registros sin depender del orden de las propiedades. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object')
    return `{${Object.keys(v as object)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  return JSON.stringify(v ?? null);
}

const keyOf = (t: Table, id: string) => `${t}-${id}`;
const parseKey = (k: string): [Table, string] | null => {
  const i = k.indexOf('-');
  const t = k.slice(0, i) as Table;
  return TABLES.includes(t) ? [t, k.slice(i + 1)] : null;
};

async function readLocal(): Promise<Map<string, { t: Table; row: Row }>> {
  const out = new Map<string, { t: Table; row: Row }>();
  for (const t of TABLES) {
    const rows = (await db.table(t).toArray()) as Row[];
    for (const row of rows) out.set(keyOf(t, row.id), { t, row });
  }
  return out;
}

let started = false;

export async function startCloudSync() {
  if (started) return;
  started = true;
  setState('connecting');
  const [cap, user] = await Promise.all([useCapability<DbCap>('db'), useCapability<UserCap>('user')]);
  const uid = cap && user ? await user.id().catch(() => null) : null;
  if (!cap || !uid) {
    setState('off');
    return;
  }
  const col = cap.collection(`data/users/${uid}`);
  const synced = new Map<string, string>(); // llave → JSON estable del último estado igual en ambos lados
  let applyingRemote = false;
  let initial = true;

  // Cola de escrituras: una a la vez.
  let queue = Promise.resolve();
  const enqueue = (fn: () => Promise<void>) => {
    queue = queue.then(fn).catch(async (e: { code?: string; message?: string }) => {
      if (e?.code === 'unavailable') {
        await new Promise((r) => setTimeout(r, 800 + Math.random() * 800));
        return fn().catch((e2: { message?: string }) => setState('error', e2?.message ?? 'Error al guardar en la nube'));
      }
      setState('error', e?.code === 'invalid_argument' ? 'Un registro es demasiado grande para guardarse en la nube (¿logotipo muy pesado?).' : (e?.message ?? 'Error al guardar en la nube'));
    });
    return queue;
  };

  const push = async () => {
    if (applyingRemote || initial) return;
    const local = await readLocal();
    const ops: (() => Promise<void>)[] = [];
    for (const [k, { t, row }] of local) {
      const json = stable(row);
      if (synced.get(k) !== json) {
        synced.set(k, json);
        ops.push(() => col.doc(k).set({ t, v: row }));
      }
    }
    for (const k of [...synced.keys()]) {
      if (!local.has(k)) {
        synced.delete(k);
        ops.push(() => col.doc(k).delete());
      }
    }
    if (!ops.length) return;
    setState('saving');
    for (const op of ops) await enqueue(op);
    if (state !== 'error') setState('synced');
  };

  const applyRemote = async (changes: { type: string; doc: DocSnap }[]) => {
    applyingRemote = true;
    try {
      await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
        for (const { type, doc } of changes) {
          const parsed = parseKey(doc.id);
          if (!parsed) continue;
          const [t, id] = parsed;
          if (type === 'removed') {
            synced.delete(doc.id);
            await db.table(t).delete(id);
            continue;
          }
          const row = doc.data()?.v as Row | undefined;
          if (!row || row.id !== id) continue;
          const json = stable(row);
          if (synced.get(doc.id) === json) continue;
          synced.set(doc.id, json);
          await db.table(t).put(row);
        }
      });
    } finally {
      applyingRemote = false;
    }
  };

  col.limit(1000).onSnapshot(
    async (snap) => {
      if (initial) {
        // Primera lectura: unir lo de la nube con lo de este navegador (gana lo más reciente).
        const local = await readLocal();
        const remote = new Map(snap.docs.map((d) => [d.id, d]));
        const pull: { type: string; doc: DocSnap }[] = [];
        for (const [k, d] of remote) {
          const r = d.data()?.v as Row | undefined;
          const l = local.get(k)?.row;
          if (!r) continue;
          const localNewer = l && (l.updatedAt ?? '') > (r.updatedAt ?? '') && k !== 'settings-settings';
          if (l && localNewer) continue; // se subirá
          pull.push({ type: 'added', doc: d });
        }
        await applyRemote(pull);
        // Llaves remotas que no se bajaron (porque lo local es más nuevo) quedan pendientes de subir.
        for (const k of remote.keys()) if (!synced.has(k)) synced.set(k, '');
        initial = false;
        await push();
        setState('synced');
        return;
      }
      await applyRemote(snap.docChanges());
    },
    (e) => setState('error', `Sin conexión con la nube (${e.code}). Tus cambios siguen guardados en este navegador.`),
  );

  // Observa todos los cambios locales y los sube (con una pequeña espera para agruparlos).
  let timer: ReturnType<typeof setTimeout> | undefined;
  const watch = liveQuery(async () => {
    const parts = await Promise.all(TABLES.map((t) => db.table(t).toArray()));
    return parts.length;
  });
  watch.subscribe({
    next: () => {
      clearTimeout(timer);
      timer = setTimeout(() => void push(), 700);
    },
  });
}
