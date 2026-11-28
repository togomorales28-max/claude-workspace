import { it, expect } from 'vitest';
import { parsePieces } from '../src/domain/parse';
it('captura rápida de piezas', () => {
  const r = parsePieces('1200 x 4; 850x2 travesaño\n3 de 600\n120cm*2\n1.5 m\n47 1/4"\n10 pzas de 300 mm poste\nabc');
  expect(r.pieces).toEqual([
    { length: 1200, qty: 4, label: '' },
    { length: 850, qty: 2, label: 'travesaño' },
    { length: 600, qty: 3, label: '' },
    { length: 1200, qty: 2, label: '' },
    { length: 1500, qty: 1, label: '' },
    { length: 1200.15, qty: 1, label: '' },
    { length: 300, qty: 10, label: 'poste' },
  ]);
  expect(r.errors).toHaveLength(1);
});
