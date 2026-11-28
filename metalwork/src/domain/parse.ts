/**
 * Interpreta capturas rápidas de piezas:
 *   "1200"            → 1200 mm × 1
 *   "1200 x 4"        → 1200 mm × 4      (también "1200*4", "4 @ 1200", "4 pzas de 1200")
 *   "120cm x 2"       → 1200 mm × 2
 *   "1.2 m x 3", "47.25in", "47 1/4\""   → conversión a mm
 *   Varias piezas separadas por ";" o salto de línea.
 *   Texto adicional al final se usa como etiqueta: "850 x 2 travesaño".
 */
export interface ParsedPiece { length: number; qty: number; label: string }

const UNIT: Record<string, number> = { mm: 1, cm: 10, m: 1000, in: 25.4, pulg: 25.4, '"': 25.4, ft: 304.8, "'": 304.8 };

function parseLen(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(',', '.');
  const m = s.match(/^(\d+(?:\.\d+)?)(?:\s+(\d+)\/(\d+))?\s*(mm|cm|m|in|pulg|"|ft|')?$/);
  if (!m) return null;
  let v = Number(m[1]);
  if (m[2] && m[3]) { const den = Number(m[3]); if (!den) return null; v += Number(m[2]) / den; }
  const f = UNIT[m[4] ?? 'mm'];
  const mmv = Math.round(v * f * 100) / 100;
  return mmv > 0 ? mmv : null;
}

export function parsePieces(input: string): { pieces: ParsedPiece[]; errors: string[] } {
  const pieces: ParsedPiece[] = [];
  const errors: string[] = [];
  for (const chunk of input.split(/[;\n]+/).map((c) => c.trim()).filter(Boolean)) {
    const len = `(\\d+(?:[.,]\\d+)?(?:\\s+\\d+\\/\\d+)?\\s*(?:mm|cm|m|in|pulg|"|ft|')?)`;
    let m = chunk.match(new RegExp(`^${len}\\s*(?:x|\\*|×)\\s*(\\d+)\\s*(?:pzas?|piezas?|pz)?\\s*(.*)$`, 'i'));
    let length: number | null = null, qty = 1, label = '';
    if (m) { length = parseLen(m[1]); qty = Number(m[2]); label = m[3]; }
    else if ((m = chunk.match(new RegExp(`^(\\d+)\\s*(?:pzas?|piezas?|pz)?\\s*(?:@|de)\\s*${len}\\s*(.*)$`, 'i')))) {
      qty = Number(m[1]); length = parseLen(m[2]); label = m[3];
    } else if ((m = chunk.match(new RegExp(`^${len}\\s*(.*)$`, 'i')))) {
      length = parseLen(m[1]); label = m[2];
    }
    if (length === null || !Number.isInteger(qty) || qty < 1) { errors.push(`No se entendió «${chunk}».`); continue; }
    pieces.push({ length, qty, label: label.trim() });
  }
  return { pieces, errors };
}
