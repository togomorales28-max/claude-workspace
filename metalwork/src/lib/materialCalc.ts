import { kgPerMeter, plateWeight, PROFILE_MAP } from '../domain/profiles';
import { kgPriceFromBar, priceFromKg } from '../domain/budget';
import type { Material, Settings } from '../data/types';

export function densityOf(settings: Settings, id: string) {
  return settings.densities.find((d) => d.id === id) ?? settings.densities[0];
}

/** Datos derivados de un material del catálogo. Nunca inventa precios: solo convierte entre barra y kg. */
export function materialInfo(m: Material, settings: Settings) {
  const dens = densityOf(settings, m.densityId);
  let kgm: number | null = null;
  let kgBar: number | null = null;
  let error: string | null = null;
  try {
    if (PROFILE_MAP[m.profile].kind === 'superficie') {
      kgBar = plateWeight(m.dims.a ?? 0, m.stockLength, m.dims.t ?? 0, dens.value);
      kgm = kgBar / (m.stockLength / 1000);
    } else {
      kgm = kgPerMeter(m.profile, m.dims, dens.value);
      kgBar = kgm * (m.stockLength / 1000);
    }
  } catch (e) {
    error = (e as Error).message;
  }
  const barPrice = m.pricePerBar ?? (kgBar ? priceFromKg(m.pricePerKg, kgBar) : null);
  const kgPrice = m.pricePerKg ?? (kgBar ? kgPriceFromBar(m.pricePerBar, kgBar) : null);
  return {
    density: dens, kgm, kgBar, error,
    barPrice, kgPrice,
    barPriceDerived: m.pricePerBar == null && barPrice != null,
    kgPriceDerived: m.pricePerKg == null && kgPrice != null,
    pricePerMeter: barPrice != null ? barPrice / (m.stockLength / 1000) : null,
  };
}
