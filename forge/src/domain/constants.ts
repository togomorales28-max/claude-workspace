import type { QuoteStatus, MaterialKind } from './types';

export interface JobTypeDef {
  id: string;
  label: string;
  hint: string;
  /** Método de escala sugerido para el estimador. */
  scale: 'linear' | 'area' | 'unit';
}

export const JOB_TYPES: JobTypeDef[] = [
  { id: 'porton', label: 'Portón', hint: 'Abatible o corredizo', scale: 'area' },
  { id: 'puerta', label: 'Puerta metálica', hint: 'Peatonal, de servicio', scale: 'area' },
  { id: 'proteccion', label: 'Protección para ventana', hint: 'Fija o abatible', scale: 'area' },
  { id: 'barandal', label: 'Barandal', hint: 'Balcón, terraza, pasillo', scale: 'linear' },
  { id: 'escalera', label: 'Escalera', hint: 'Recta, caracol, marinera', scale: 'unit' },
  { id: 'techumbre', label: 'Techumbre', hint: 'Cochera, terraza, nave', scale: 'area' },
  { id: 'estructura', label: 'Estructura metálica', hint: 'Mezanines, armaduras', scale: 'area' },
  { id: 'cerco', label: 'Cerco y reja', hint: 'Perimetral, malla, herrería', scale: 'linear' },
  { id: 'mueble', label: 'Mueble metálico', hint: 'Mesas, anaqueles, bases', scale: 'unit' },
  { id: 'personalizado', label: 'Trabajo personalizado', hint: 'Cualquier otro trabajo', scale: 'unit' },
];

export const jobTypeLabel = (id: string) => JOB_TYPES.find((j) => j.id === id)?.label ?? id;

export const UNITS = [
  { id: 'm', label: 'Metro (m)' },
  { id: 'tramo', label: 'Tramo (6 m)' },
  { id: 'pza', label: 'Pieza' },
  { id: 'kg', label: 'Kilogramo (kg)' },
  { id: 'hoja', label: 'Hoja' },
  { id: 'm2', label: 'Metro cuadrado (m²)' },
  { id: 'l', label: 'Litro (L)' },
  { id: 'gal', label: 'Galón' },
  { id: 'cubeta', label: 'Cubeta' },
  { id: 'caja', label: 'Caja' },
  { id: 'paq', label: 'Paquete' },
  { id: 'rollo', label: 'Rollo' },
  { id: 'juego', label: 'Juego' },
  { id: 'serv', label: 'Servicio' },
];

export const unitShort = (id: string) => {
  const map: Record<string, string> = { m2: 'm²', pza: 'pza', serv: 'serv.' };
  return map[id] ?? id;
};

export const MATERIAL_CATEGORIES = [
  'Tubular',
  'PTR',
  'Ángulo',
  'Solera',
  'Lámina',
  'Placa',
  'Varilla',
  'Herrajes',
  'Electrodos',
  'Discos',
  'Pintura',
  'Otros',
];

export const CATEGORY_KIND: Record<string, MaterialKind> = {
  Electrodos: 'consumable',
  Discos: 'consumable',
  Pintura: 'consumable',
};

/** Catálogo base SIN PRECIOS: solo nombres y unidades comunes; el taller captura sus precios reales. */
export const STARTER_MATERIALS: { name: string; category: string; unit: string }[] = [
  { name: 'Tubular cuadrado 1" cal. 18', category: 'Tubular', unit: 'tramo' },
  { name: 'Tubular cuadrado 3/4" cal. 18', category: 'Tubular', unit: 'tramo' },
  { name: 'Tubular rectangular 2" x 1" cal. 18', category: 'Tubular', unit: 'tramo' },
  { name: 'PTR 2" x 2" cal. 14', category: 'PTR', unit: 'tramo' },
  { name: 'PTR 4" x 2" cal. 14', category: 'PTR', unit: 'tramo' },
  { name: 'Ángulo 1" x 1/8"', category: 'Ángulo', unit: 'tramo' },
  { name: 'Solera 1" x 1/8"', category: 'Solera', unit: 'tramo' },
  { name: 'Lámina negra cal. 18 (4x8 ft)', category: 'Lámina', unit: 'hoja' },
  { name: 'Lámina pintro cal. 26', category: 'Lámina', unit: 'm' },
  { name: 'Placa 1/4"', category: 'Placa', unit: 'kg' },
  { name: 'Varilla cuadrada 1/2"', category: 'Varilla', unit: 'tramo' },
  { name: 'Bisagra tipo libro', category: 'Herrajes', unit: 'pza' },
  { name: 'Electrodo 6013 1/8"', category: 'Electrodos', unit: 'kg' },
  { name: 'Disco de corte 4 1/2"', category: 'Discos', unit: 'pza' },
  { name: 'Disco de desbaste 4 1/2"', category: 'Discos', unit: 'pza' },
  { name: 'Primer anticorrosivo', category: 'Pintura', unit: 'l' },
  { name: 'Esmalte alquidálico', category: 'Pintura', unit: 'l' },
  { name: 'Thinner', category: 'Pintura', unit: 'l' },
];

export const STATUSES: { id: QuoteStatus; label: string }[] = [
  { id: 'draft', label: 'Borrador' },
  { id: 'sent', label: 'Enviada' },
  { id: 'accepted', label: 'Aceptada' },
  { id: 'rejected', label: 'Rechazada' },
  { id: 'completed', label: 'Completada' },
];

export const statusLabel = (s: QuoteStatus) => STATUSES.find((x) => x.id === s)?.label ?? s;

export const ROUND_OPTIONS = [
  { value: 0, label: 'Sin redondeo' },
  { value: 1, label: 'Al peso' },
  { value: 10, label: 'A $10' },
  { value: 50, label: 'A $50' },
  { value: 100, label: 'A $100' },
  { value: 500, label: 'A $500' },
];
