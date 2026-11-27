import { describe, it, expect } from 'vitest';
import { decodeConfig, decodeRequest, encodeConfig, encodeRequest, webEstimate, type WebEstimatorConfig } from '../src/domain/webEstimator';

const cfg: WebEstimatorConfig = {
  shopName: 'Herrería Peña', whatsapp: '55 1234 5678', title: 'Cotiza', intro: 'Hola ñandú', disclaimer: 'x', rangePct: 10, roundTo: 50,
  accent: '#e8792b', theme: 'light', appUrl: 'https://forge.example.com/', items: [
    { jobType: 'barandal', label: 'Barandal', enabled: true, method: 'linear', rate: 65.62, minimum: 0 },
    { jobType: 'porton', label: 'Portón', enabled: true, method: 'area', rate: 1800, minimum: 5000 },
    { jobType: 'mueble', label: 'Mueble', enabled: false, method: 'unit', rate: 900, minimum: 0 },
    { jobType: 'cerco', label: 'Cerco', enabled: true, method: 'linear', rate: 0, minimum: 0 },
  ],
};

describe('web estimator', () => {
  it('codifica y decodifica la configuración (solo partidas activas con tarifa)', () => {
    const d = decodeConfig(encodeConfig(cfg))!;
    expect(d.shopName).toBe('Herrería Peña');
    expect(d.intro).toBe('Hola ñandú');
    expect(d.whatsapp).toBe('5512345678');
    expect(d.items.map((i) => i.jobType)).toEqual(['barandal', 'porton']);
    expect(d.items[1]).toMatchObject({ method: 'area', rate: 1800, minimum: 5000 });
    expect(decodeConfig('basura')).toBeNull();
  });
  it('estima por longitud: 12 ft (3.6576 m) a $65.62/m ≈ $240', () => {
    const e = webEstimate(cfg.items[0], { width: 0, height: 0, length: 12 * 0.3048, qty: 1 }, 0, 0);
    expect(e.price).toBeCloseTo(240, 0);
  });
  it('aplica mínimo y rango redondeado', () => {
    const e = webEstimate(cfg.items[1], { width: 2, height: 1, length: 0, qty: 1 }, 10, 50);
    expect(e.appliedMinimum).toBe(true);
    expect(e.price).toBe(5000);
    expect(e.low).toBe(4500);
    expect(e.high).toBe(5500);
    const big = webEstimate(cfg.items[1], { width: 4, height: 2.2, length: 0, qty: 1 }, 10, 50);
    expect(big.price).toBeCloseTo(15840);
    expect(big.low).toBe(14250);
    expect(big.high).toBe(17450);
  });
  it('valida medidas', () => {
    expect(webEstimate(cfg.items[1], { width: 2, height: 0, length: 0, qty: 1 }, 10, 50).valid).toBe(false);
  });
  it('codifica solicitudes', () => {
    const r = { jobType: 'porton', label: 'Portón', method: 'area' as const, width: 4, height: 2.2, length: 0, qty: 1, low: 14250, high: 17450, name: 'José Núñez', phone: '3312345678', comment: 'Negro mate' };
    expect(decodeRequest(encodeRequest(r))).toEqual(r);
  });
});
