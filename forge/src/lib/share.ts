import type { Quote, Settings } from '@/domain/types';
import { whatsappText } from './document';
import { waPhone } from '@/domain/format';
import { IS_ARTIFACT, saveFile } from './platform';

export async function quotePdfBlob(q: Quote, s: Settings) {
  const { generateQuotePdf, pdfFileName } = await import('./pdf');
  return { blob: generateQuotePdf(q, s).output('blob'), name: pdfFileName(q) };
}

export async function downloadQuotePdf(q: Quote, s: Settings) {
  const { blob, name } = await quotePdfBlob(q, s);
  return saveFile(blob, name);
}

/** Imprimir no está disponible dentro de un artefacto (el marco bloquea el diálogo). */
export const canPrint = !IS_ARTIFACT;

/** Imprime el PDF mediante un iframe oculto; en celular lo abre en otra pestaña. */
export async function printQuotePdf(q: Quote, s: Settings) {
  const { blob } = await quotePdfBlob(q, s);
  const url = URL.createObjectURL(blob);
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile) {
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  iframe.src = url;
  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      window.open(url, '_blank');
    }
    setTimeout(() => {
      iframe.remove();
      URL.revokeObjectURL(url);
    }, 60_000);
  };
  document.body.appendChild(iframe);
}

/** Enlace de WhatsApp con el resumen de la cotización (para usar en un <a href>). */
export const whatsappUrl = (q: Quote, s: Settings) =>
  `https://wa.me/${q.clientPhone ? waPhone(q.clientPhone) : ''}?text=${encodeURIComponent(whatsappText(q, s))}`;

/**
 * En celulares con hoja de compartir (fuera del artefacto) comparte el PDF directamente.
 * Devuelve true si lo compartió; false si se debe seguir con el enlace de WhatsApp.
 */
export async function trySharePdf(q: Quote, s: Settings): Promise<'shared' | 'cancelled' | 'fallback'> {
  if (IS_ARTIFACT) return 'fallback';
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (!/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || !nav.share) return 'fallback';
  const { blob, name } = await quotePdfBlob(q, s);
  const file = new File([blob], name, { type: 'application/pdf' });
  if (!nav.canShare?.({ files: [file] })) return 'fallback';
  try {
    await nav.share({ files: [file], text: whatsappText(q, s), title: `Cotización ${q.number}` });
    return 'shared';
  } catch (e) {
    return (e as Error).name === 'AbortError' ? 'cancelled' : 'fallback';
  }
}
