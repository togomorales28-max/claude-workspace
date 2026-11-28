import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { MetalworkDB } from '../src/data/db';
import { createRepos, uid, nowIso } from '../src/data/repo';
import { exportBackup, parseBackup, restoreBackup } from '../src/data/backup';
import type { Material } from '../src/data/types';

const mat = (): Material => ({
  id: uid(), createdAt: nowIso(), updatedAt: nowIso(), name: 'PTR 2" cal 14', profile: 'ptr_cuadrado',
  dims: { a: 50.8, t: 1.897 }, densityId: 'acero', stockLength: 6100, pricePerBar: null, pricePerKg: null,
  supplier: '', priceDate: null, notes: '',
});

describe('almacenamiento', () => {
  it('guarda, lista y borra', async () => {
    const r = createRepos(new MetalworkDB('t1'));
    const m = await r.materials.save(mat());
    expect((await r.materials.list())).toHaveLength(1);
    expect((await r.materials.get(m.id))?.name).toBe('PTR 2" cal 14');
    await r.materials.remove(m.id);
    expect(await r.materials.list()).toHaveLength(0);
  });
  it('folios consecutivos sin repetir', async () => {
    const r = createRepos(new MetalworkDB('t2'));
    const a = await Promise.all([r.nextQuoteNumber(), r.nextQuoteNumber(), r.nextQuoteNumber()]);
    expect(new Set(a).size).toBe(3);
    expect(a.sort()).toEqual(['COT-0001', 'COT-0002', 'COT-0003']);
  });
  it('respaldo de ida y vuelta', async () => {
    const d1 = new MetalworkDB('t3');
    const r1 = createRepos(d1);
    await r1.materials.save(mat());
    const s = await r1.getSettings();
    await r1.saveSettings({ ...s, shop: { ...s.shop, name: 'Herrería Prueba' } });
    const json = JSON.stringify(await exportBackup(d1));
    const d2 = new MetalworkDB('t4');
    await restoreBackup(parseBackup(json), d2);
    const r2 = createRepos(d2);
    expect(await r2.materials.list()).toHaveLength(1);
    expect((await r2.getSettings()).shop.name).toBe('Herrería Prueba');
  });
  it('rechaza archivos que no son respaldo', () => {
    expect(() => parseBackup('{"a":1}')).toThrow();
    expect(() => parseBackup('no json')).toThrow();
  });
});
