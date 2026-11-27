const DISPLAY = new Set(['block', 'inline-block', 'inline', 'flex', 'inline-flex', 'grid', 'inline-grid', 'hidden', 'contents', 'table']);

/**
 * Une clases y resuelve conflictos de `display` sin prefijo: la última gana.
 * Así `cn('inline-flex', 'hidden sm:inline-flex')` oculta el elemento en móvil.
 */
export function cn(...parts: (string | false | null | undefined)[]) {
  const tokens = parts.filter(Boolean).join(' ').split(/\s+/).filter(Boolean);
  const lastDisplay = [...tokens].reverse().find((t) => DISPLAY.has(t));
  return tokens.filter((t) => !DISPLAY.has(t) || t === lastDisplay).filter((t, i, a) => !(t === lastDisplay && a.indexOf(t) !== i)).join(' ');
}
