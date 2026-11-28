import { useId } from 'react';
import type { ProfileDims, ProfileType } from '../domain/profiles';
import { trimNum } from '../domain/profiles';

/**
 * Sección transversal a escala con achurado técnico y cotas.
 * Si faltan medidas se dibuja con proporciones de referencia.
 */
export function ProfileSketch({ type, dims, className }: { type: ProfileType; dims: ProfileDims; className?: string }) {
  const hid = useId().replace(/:/g, '');
  const V = 240, P = 46; // lienzo y margen para cotas
  const ok = (n?: number) => (n && n > 0 ? n : undefined);
  let a = ok(dims.a) ?? 50, b = ok(dims.b) ?? (type === 'ptr_rectangular' ? 100 : a), t = ok(dims.t) ?? a * 0.06;
  const tw = ok(dims.tw) ?? t * 0.7;
  if (type === 'ptr_cuadrado') b = a;
  if (type === 'angulo') b = ok(dims.b) ?? a;
  if (type === 'canal_u' || type === 'viga_i') { b = ok(dims.b) ?? 100; a = ok(dims.a) ?? 50; }
  if (type === 'solera' || type === 'placa') { b = t; }

  // Extensión real (ancho W, alto H) del dibujo
  let Wr = a, Hr = b;
  if (type === 'tubo_redondo' || type === 'barra_redonda' || type === 'barra_cuadrada') { Wr = a; Hr = a; }
  if (type === 'barra_hexagonal') { Wr = a * 2 / Math.sqrt(3); Hr = a; }
  if (type === 'canal_u' || type === 'viga_i') { Wr = a; Hr = b; }
  if (type === 'solera' || type === 'placa') { Wr = a; Hr = Math.max(t, a * 0.02); }
  const s = (V - 2 * P) / Math.max(Wr, Hr);
  const w = Wr * s, h = Hr * s;
  const x0 = (V - w) / 2, y0 = (V - h) / 2;
  const T = Math.max(t * s, 1.2), TW = Math.max(tw * s, 1.2);
  const r = Math.min(ok(dims.r) ?? 0, Math.min(a, b) / 2) * s;

  let shape: JSX.Element | null = null;
  const fill = `url(#h${hid})`;
  const common = { fill, stroke: '#5aa6ff', strokeWidth: 1.4, fillRule: 'evenodd' as const };
  switch (type) {
    case 'ptr_cuadrado':
    case 'ptr_rectangular': {
      const ri = Math.max(r - T, 0);
      shape = <path {...common} d={`${roundRect(x0, y0, w, h, r)} ${roundRect(x0 + T, y0 + T, w - 2 * T, h - 2 * T, ri)}`} />;
      break;
    }
    case 'tubo_redondo': {
      const cx = V / 2, cy = V / 2, R = w / 2, ri = Math.max(R - T, 0);
      shape = <path {...common} d={`M ${cx - R} ${cy} a ${R} ${R} 0 1 0 ${2 * R} 0 a ${R} ${R} 0 1 0 ${-2 * R} 0 M ${cx - ri} ${cy} a ${ri} ${ri} 0 1 0 ${2 * ri} 0 a ${ri} ${ri} 0 1 0 ${-2 * ri} 0`} />;
      break;
    }
    case 'barra_redonda':
      shape = <circle {...common} cx={V / 2} cy={V / 2} r={w / 2} />; break;
    case 'barra_cuadrada':
    case 'solera':
    case 'placa':
      shape = <rect {...common} x={x0} y={y0} width={w} height={h} />; break;
    case 'barra_hexagonal': {
      const cx = V / 2, cy = V / 2, R = w / 2;
      const pts = Array.from({ length: 6 }, (_, i) => `${cx + R * Math.cos((Math.PI / 3) * i)},${cy + R * Math.sin((Math.PI / 3) * i)}`).join(' ');
      shape = <polygon {...common} points={pts} />; break;
    }
    case 'angulo':
      shape = <polygon {...common} points={`${x0},${y0} ${x0 + T},${y0} ${x0 + T},${y0 + h - T} ${x0 + w},${y0 + h - T} ${x0 + w},${y0 + h} ${x0},${y0 + h}`} />; break;
    case 'canal_u':
      shape = <polygon {...common} points={`${x0},${y0} ${x0 + w},${y0} ${x0 + w},${y0 + T} ${x0 + TW},${y0 + T} ${x0 + TW},${y0 + h - T} ${x0 + w},${y0 + h - T} ${x0 + w},${y0 + h} ${x0},${y0 + h}`} />; break;
    case 'viga_i': {
      const cx = V / 2;
      shape = <polygon {...common} points={`${x0},${y0} ${x0 + w},${y0} ${x0 + w},${y0 + T} ${cx + TW / 2},${y0 + T} ${cx + TW / 2},${y0 + h - T} ${x0 + w},${y0 + h - T} ${x0 + w},${y0 + h} ${x0},${y0 + h} ${x0},${y0 + h - T} ${cx - TW / 2},${y0 + h - T} ${cx - TW / 2},${y0 + T} ${x0},${y0 + T}`} />;
      break;
    }
    case 'personalizado':
      shape = <text x={V / 2} y={V / 2} textAnchor="middle" fill="#74839a" fontSize="12" fontFamily="IBM Plex Mono">kg/m del fabricante</text>;
  }

  const L = (n: number | undefined) => (n ? trimNum(n, 2) : '—');
  const showW = type !== 'personalizado';
  const showH = !['personalizado', 'tubo_redondo', 'barra_redonda', 'barra_cuadrada', 'ptr_cuadrado', 'barra_hexagonal'].includes(type);
  const wLabel = type === 'barra_hexagonal' ? `${L(dims.a)} e/c` : type === 'tubo_redondo' || type === 'barra_redonda' ? `Ø ${L(dims.a)}` : L(dims.a);
  const hLabel = type === 'solera' || type === 'placa' ? `${L(dims.t)}` : type === 'angulo' ? L(dims.b ?? dims.a) : L(dims.b);

  return (
    <svg viewBox={`0 0 ${V} ${V}`} className={className} role="img" aria-label="Sección transversal del perfil">
      <defs>
        <pattern id={`h${hid}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="#2f8cff" fillOpacity="0.10" />
          <line x1="0" y1="0" x2="0" y2="6" stroke="#5aa6ff" strokeOpacity="0.55" strokeWidth="1" />
        </pattern>
        <marker id={`a${hid}`} viewBox="0 0 8 8" refX="4" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,1 L8,4 L0,7 z" fill="#aab6c4" />
        </marker>
      </defs>
      {/* ejes */}
      <line x1={V / 2} y1={12} x2={V / 2} y2={V - 12} stroke="#2e3e52" strokeDasharray="6 3 1 3" />
      <line x1={12} y1={V / 2} x2={V - 12} y2={V / 2} stroke="#2e3e52" strokeDasharray="6 3 1 3" />
      {shape}
      {showW && (
        <g fontFamily="IBM Plex Mono" fontSize="10" fill="#aab6c4">
          <line x1={x0} y1={y0 + h + 16} x2={x0 + w} y2={y0 + h + 16} stroke="#aab6c4" strokeWidth="0.8" markerStart={`url(#a${hid})`} markerEnd={`url(#a${hid})`} />
          <line x1={x0} y1={y0 + h + 4} x2={x0} y2={y0 + h + 20} stroke="#74839a" strokeWidth="0.6" />
          <line x1={x0 + w} y1={y0 + h + 4} x2={x0 + w} y2={y0 + h + 20} stroke="#74839a" strokeWidth="0.6" />
          <text x={V / 2} y={y0 + h + 30} textAnchor="middle">{wLabel}</text>
        </g>
      )}
      {showH && (
        <g fontFamily="IBM Plex Mono" fontSize="10" fill="#aab6c4">
          <line x1={x0 - 16} y1={y0} x2={x0 - 16} y2={y0 + h} stroke="#aab6c4" strokeWidth="0.8" markerStart={`url(#a${hid})`} markerEnd={`url(#a${hid})`} />
          <text x={x0 - 22} y={V / 2} textAnchor="middle" transform={`rotate(-90 ${x0 - 22} ${V / 2})`}>{hLabel}</text>
        </g>
      )}
      {!['solera', 'placa', 'barra_redonda', 'barra_cuadrada', 'barra_hexagonal', 'personalizado'].includes(type) && (
        <text x={V - 8} y={16} textAnchor="end" fontFamily="IBM Plex Mono" fontSize="10" fill="#5aa6ff">t = {L(dims.t)}{dims.tw ? ` · tw = ${L(dims.tw)}` : ''}</text>
      )}
    </svg>
  );
}

function roundRect(x: number, y: number, w: number, h: number, r: number) {
  if (w <= 0 || h <= 0) return '';
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  if (!r) return `M${x},${y} h${w} v${h} h${-w} Z`;
  return `M${x + r},${y} h${w - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${h - 2 * r} a${r},${r} 0 0 1 ${-r},${r} h${-(w - 2 * r)} a${r},${r} 0 0 1 ${-r},${-r} v${-(h - 2 * r)} a${r},${r} 0 0 1 ${r},${-r} Z`;
}
