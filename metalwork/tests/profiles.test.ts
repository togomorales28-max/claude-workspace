import { describe, it, expect } from 'vitest';
import { sectionArea, kgPerMeter, plateWeight, plateKgPerM2, GeometryError } from '../src/domain/profiles';

const STEEL = 7850;

describe('áreas de sección', () => {
  it('PTR cuadrado 50.8 × 1.897 (2" cal 14)', () => {
    // 50.8² − (50.8 − 3.794)² = 2580.64 − 2209.564 = 371.076 mm²
    expect(sectionArea('ptr_cuadrado', { a: 50.8, t: 1.897 })).toBeCloseTo(371.0756, 3);
    // 371.0756e-6 × 7850 = 2.9129 kg/m
    expect(kgPerMeter('ptr_cuadrado', { a: 50.8, t: 1.897 }, STEEL)).toBeCloseTo(2.9129, 3);
  });
  it('PTR con radio de esquina reduce el área', () => {
    const base = sectionArea('ptr_cuadrado', { a: 50, t: 3 });
    const r = sectionArea('ptr_cuadrado', { a: 50, t: 3, r: 6 });
    // corrección (4 − π)(6² − 3²) = 0.858407 × 27 = 23.177
    expect(base - r).toBeCloseTo(23.177, 2);
  });
  it('PTR rectangular 100 × 50 × 3', () => {
    expect(sectionArea('ptr_rectangular', { a: 100, b: 50, t: 3 })).toBeCloseTo(5000 - 94 * 44, 6); // 864
    expect(kgPerMeter('ptr_rectangular', { a: 100, b: 50, t: 3 }, STEEL)).toBeCloseTo(6.7824, 4);
  });
  it('tubo redondo Ø60.3 × 3.91 (cédula 40 de 2")', () => {
    const A = (Math.PI / 4) * (60.3 ** 2 - (60.3 - 7.82) ** 2);
    expect(sectionArea('tubo_redondo', { a: 60.3, t: 3.91 })).toBeCloseTo(A, 6);
    // tabla ASTM: 5.44 kg/m
    expect(kgPerMeter('tubo_redondo', { a: 60.3, t: 3.91 }, STEEL)).toBeCloseTo(5.44, 1);
  });
  it('ángulo 50.8 × 50.8 × 6.35 (2" × 1/4")', () => {
    expect(sectionArea('angulo', { a: 50.8, b: 50.8, t: 6.35 })).toBeCloseTo(6.35 * (101.6 - 6.35), 6);
    // tabla: 4.75 kg/m; sin radio de raíz da 4.748
    expect(kgPerMeter('angulo', { a: 50.8, t: 6.35 }, STEEL)).toBeCloseTo(4.748, 2);
  });
  it('solera 50.8 × 6.35', () => {
    expect(kgPerMeter('solera', { a: 50.8, t: 6.35 }, STEEL)).toBeCloseTo(2.5323, 4);
  });
  it('barras macizas', () => {
    expect(kgPerMeter('barra_redonda', { a: 12.7 }, STEEL)).toBeCloseTo(0.9944, 4);
    expect(kgPerMeter('barra_cuadrada', { a: 12.7 }, STEEL)).toBeCloseTo(1.2661, 4);
    expect(sectionArea('barra_hexagonal', { a: 20 })).toBeCloseTo(346.41, 2);
  });
  it('canal U y viga I', () => {
    expect(sectionArea('canal_u', { b: 100, a: 50, tw: 5, t: 7 })).toBeCloseTo(100 * 5 + 2 * 45 * 7, 6);
    expect(sectionArea('viga_i', { b: 200, a: 100, tw: 5.6, t: 8.5 })).toBeCloseTo(2 * 100 * 8.5 + (200 - 17) * 5.6, 6);
  });
  it('placa: 1220 × 2440 × 3.175 de acero', () => {
    expect(plateWeight(1220, 2440, 3.175, STEEL)).toBeCloseTo(74.19, 2);
    expect(plateKgPerM2(3.175, STEEL)).toBeCloseTo(24.924, 3);
  });
  it('densidades: el aluminio pesa 2700/7850 del acero', () => {
    const s = kgPerMeter('solera', { a: 50, t: 5 }, STEEL);
    const al = kgPerMeter('solera', { a: 50, t: 5 }, 2700);
    expect(al / s).toBeCloseTo(2700 / 7850, 10);
  });
  it('rechaza geometría imposible', () => {
    expect(() => sectionArea('ptr_cuadrado', { a: 20, t: 10 })).toThrow(GeometryError);
    expect(() => sectionArea('tubo_redondo', { a: 20 })).toThrow(GeometryError);
    expect(() => kgPerMeter('personalizado', {}, STEEL)).toThrow(GeometryError);
    expect(kgPerMeter('personalizado', { kgm: 3.2 }, STEEL)).toBe(3.2);
  });
});
