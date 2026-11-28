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
  return downloadBlob(filename, new Blob([text], { type }));
}

type Saver = { save: (r: { filename: string; data: Blob }) => Promise<unknown> } | null;
type ClaudeHost = { use?: (name: string) => Promise<unknown> };
let saverPromise: Promise<Saver> | null = null;

/** Dentro de Claude (artifact) las descargas pasan por la capacidad «downloads». */
function hostSaver(): Promise<Saver> {
  const host = (window as unknown as { claude?: ClaudeHost }).claude;
  if (!host?.use) return Promise.resolve(null);
  saverPromise ??= host.use('downloads').then((d) => (d as Saver) ?? null).catch(() => null);
  return saverPromise;
}

export class DownloadError extends Error {}

export async function downloadBlob(filename: string, blob: Blob): Promise<void> {
  if (import.meta.env.VITE_ARTIFACT === '1') {
    const saver = await hostSaver();
    if (!saver) throw new DownloadError('Este visor no permite guardar archivos. Abre la app en un navegador para descargar.');
    try {
      await saver.save({ filename, data: blob });
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === 'declined') return;
      if (code === 'host_unavailable') throw new DownloadError('Esta app no puede guardar archivos. Abre el enlace en un navegador o computadora.');
      throw new DownloadError('No se pudo guardar el archivo. Intenta de nuevo.');
    }
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Inicia la conexión con el visor lo antes posible (la respuesta llega en segundo plano). */
export function warmDownloads() { void hostSaver(); }
