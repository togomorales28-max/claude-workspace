import type { Quote, Settings } from '@/domain/types';
import { whatsappText } from './document';
import { waPhone } from '@/domain/format';
import { downloadBlob } from './hooks';

export async function downloadQuotePdf(q: Quote, s: Settings) {
  const { generateQuotePdf, pdfFileName } = await import('./pdf');
  const pdf = generateQuotePdf(q, s);
  downloadBlob(pdf.output('blob'), pdfFileName(q));
}

/** Imprime el PDF mediante un iframe oculto; si el navegador no lo permite, lo abre en otra pestaña. */
export async function printQuotePdf(q: Quote, s: Settings) {
  const { generateQuotePdf } = await import('./pdf');
  const blob = generateQuotePdf(q, s).output('blob');
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

/**
 * Comparte por WhatsApp. En celulares que lo permiten se comparte el PDF directamente
 * (hoja de compartir del sistema). En otros casos se abre WhatsApp con el resumen y
 * se descarga el PDF para adjuntarlo.
 */
export async function shareWhatsApp(q: Quote, s: Settings): Promise<'shared' | 'link' | 'cancelled'> {
  const { generateQuotePdf, pdfFileName } = await import('./pdf');
  const text = whatsappText(q, s);
  const file = new File([generateQuotePdf(q, s).output('blob')], pdfFileName(q), { type: 'application/pdf' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile && nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text, title: `Cotización ${q.number}` });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
    }
  }
  const phone = q.clientPhone ? waPhone(q.clientPhone) : '';
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener');
  downloadBlob(file, file.name);
  return 'link';
}
