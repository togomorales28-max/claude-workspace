import type { CutPlan } from '../data/types';
import { runGroup } from './cutPlan';

const esc = (v: unknown) => {
  const s = String(v ?? '');
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Lista de cortes en CSV (UTF-8 con BOM para que Excel respete los acentos). */
export function cutListCsv(plan: CutPlan): string {
  const rows: (string | number)[][] = [['Material', 'Barra #', 'Tipo', 'Longitud barra (mm)', 'Orden', 'Pieza', 'Largo (mm)', 'Inicio (mm)', 'Sobrante barra (mm)', 'Sobrante reutilizable']];
  for (const g of plan.groups) {
    const run = runGroup(g);
    if (!run.ok) { rows.push([g.label, '', 'ERROR', '', '', run.error, '', '', '', '']); continue; }
    run.result.bars.forEach((b, i) => {
      b.cuts.forEach((c, k) => rows.push([g.label, i + 1, b.isOffcut ? 'Retazo' : 'Nueva', b.stockLength, k + 1, c.label, c.length, c.start, k === b.cuts.length - 1 ? b.offcut : '', k === b.cuts.length - 1 ? (b.reusable ? 'Sí' : 'No') : '']));
    });
    for (const u of run.result.unplaced) rows.push([g.label, '', 'SIN COLOCAR', '', '', u.label, u.length, '', '', `${u.qty} pz: ${u.reason}`]);
  }
  return '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n');
}

export function downloadText(filename: string, text: string, type = 'text/plain;charset=utf-8') {
  downloadBlob(filename, new Blob([text], { type }));
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
