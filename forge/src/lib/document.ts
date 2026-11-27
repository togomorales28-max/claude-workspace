import type { Quote, Settings } from '@/domain/types';
import { calculate } from '@/domain/calc';
import { jobTypeLabel, unitShort } from '@/domain/constants';
import { addDays, dateLong, decimal, money } from '@/domain/format';

/** Contenido del documento para el cliente (compartido entre PDF, vista previa e impresión). */
export function buildDocument(q: Quote, s: Settings) {
  const b = calculate(q);
  const d = q.dimensions;
  const dims: string[] = [];
  if (d.width > 0) dims.push(`Ancho ${decimal(d.width)} m`);
  if (d.height > 0) dims.push(`Alto ${decimal(d.height)} m`);
  if (d.length > 0) dims.push(`Largo ${decimal(d.length)} m`);
  const qty = Math.max(1, d.quantity);

  // Agrupa materiales iguales y multiplica por piezas cuando aplica.
  const items = q.lines
    .filter((l) => l.qty > 0 && l.name.trim())
    .map((l) => ({
      name: l.name,
      kind: l.kind,
      qty: q.perPiece ? l.qty * qty : l.qty,
      unit: unitShort(l.unit),
    }));

  const services: string[] = [];
  if (b.labor > 0) services.push(`Mano de obra especializada de fabricación${b.laborHours ? ` (${decimal(b.laborHours)} h estimadas)` : ''}`);
  if (q.installation > 0) services.push('Instalación en sitio');
  if (q.transport > 0) services.push('Transporte / flete');
  q.extras.filter((e) => e.amount > 0).forEach((e) => services.push(e.label));

  return {
    b,
    shop: {
      name: s.shopName || 'Mi taller',
      owner: s.ownerName,
      phone: s.phone,
      email: s.email,
      address: s.address,
      rfc: s.rfc,
      logo: s.logo,
      footer: s.quoteFooter,
    },
    number: q.number || 'BORRADOR',
    date: dateLong(q.createdAt),
    validUntil: dateLong(addDays(q.createdAt, q.validityDays)),
    validityDays: q.validityDays,
    client: { name: q.clientName, phone: q.clientPhone },
    job: {
      type: jobTypeLabel(q.jobType),
      title: q.title,
      description: q.description,
      dims: dims.join('  ·  '),
      qty,
    },
    items: q.docDetail === 'quantities' ? items : [],
    services,
    unitPrice: qty > 1 ? b.price / qty : null,
    totals: {
      subtotal: money(b.price),
      tax: q.taxEnabled ? money(b.tax) : null,
      taxLabel: `IVA ${q.taxPct} %`,
      total: money(b.total),
    },
    deliveryTime: q.deliveryTime,
    paymentTerms: q.paymentTerms,
    notes: q.notes,
  };
}

export type ClientDocument = ReturnType<typeof buildDocument>;

export function whatsappText(q: Quote, s: Settings): string {
  const doc = buildDocument(q, s);
  const lines = [
    `*${doc.shop.name}*`,
    `Cotización ${doc.number}`,
    '',
    `Hola ${q.clientName.split(' ')[0] || ''}, le comparto la cotización de:`,
    `• ${doc.job.title} (${doc.job.type})`,
    doc.job.dims ? `• Medidas: ${doc.job.dims}` : '',
    doc.job.qty > 1 ? `• Cantidad: ${doc.job.qty} piezas` : '',
    '',
    `*Total: ${doc.totals.total}*${doc.totals.tax ? ' (IVA incluido)' : ''}`,
    doc.deliveryTime ? `Entrega: ${doc.deliveryTime}` : '',
    doc.paymentTerms ? `Pago: ${doc.paymentTerms}` : '',
    `Vigencia: hasta el ${doc.validUntil}`,
    '',
    s.phone ? `Dudas al ${s.phone}` : '',
  ];
  return lines.filter((l, i, arr) => l !== '' || (arr[i - 1] ?? '') !== '').join('\n').trim();
}
