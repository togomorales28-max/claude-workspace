import type { ClientDocument } from '@/lib/document';
import { decimal, money } from '@/domain/format';

/** Vista previa en pantalla del documento (mismo contenido que el PDF). */
export function QuoteDocument({ doc }: { doc: ClientDocument }) {
  const Label = ({ children }: { children: string }) => (
    <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#707078]">{children}</div>
  );
  return (
    <article className="relative mx-auto w-full max-w-[816px] overflow-hidden rounded-lg bg-white text-[#1c1c20] shadow-2xl shadow-black/40">
      <div className="h-1.5 bg-[#c8611a]" />
      <div className="px-6 py-8 sm:px-12 sm:py-10">
        <header className="flex flex-col gap-6 border-b border-[#e2e2e6] pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            {doc.shop.logo && <img src={doc.shop.logo} alt="" className="max-h-14 max-w-[130px] object-contain" />}
            <div>
              <div className="text-lg font-bold">{doc.shop.name}</div>
              <div className="mt-1 text-xs leading-relaxed text-[#707078]">
                {[doc.shop.owner, doc.shop.phone && `Tel. ${doc.shop.phone}`, doc.shop.email, doc.shop.rfc && `RFC ${doc.shop.rfc}`]
                  .filter(Boolean)
                  .join(' · ')}
                {doc.shop.address && <div>{doc.shop.address}</div>}
              </div>
            </div>
          </div>
          <div className="sm:text-right">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c8611a]">Cotización</div>
            <div className="mt-0.5 font-mono text-lg font-semibold">{doc.number}</div>
            <div className="mt-1 text-xs text-[#707078]">Fecha: {doc.date}</div>
            <div className="text-xs text-[#707078]">Vigente hasta: {doc.validUntil}</div>
          </div>
        </header>

        <div className="grid gap-6 py-6 sm:grid-cols-2">
          <div>
            <Label>Cliente</Label>
            <div className="font-semibold">{doc.client.name || '—'}</div>
            {doc.client.phone && <div className="text-sm text-[#707078]">Tel. {doc.client.phone}</div>}
          </div>
          <div>
            <Label>Trabajo</Label>
            <div className="font-semibold">{doc.job.title}</div>
            <div className="text-sm text-[#707078]">{doc.job.type}</div>
            {doc.job.dims && <div className="text-sm text-[#707078]">{doc.job.dims}</div>}
            {doc.job.qty > 1 && <div className="text-sm text-[#707078]">Cantidad: {doc.job.qty} piezas</div>}
          </div>
        </div>

        {doc.job.description && (
          <div className="pb-6">
            <Label>Descripción</Label>
            <p className="whitespace-pre-line text-sm leading-relaxed">{doc.job.description}</p>
          </div>
        )}

        {doc.items.length > 0 && (
          <table className="mb-5 w-full text-sm">
            <thead>
              <tr className="bg-[#f7f6f4] text-left text-[10px] font-bold uppercase tracking-wider text-[#707078]">
                <th className="px-3 py-2">Materiales y consumibles</th>
                <th className="px-3 py-2 text-right">Cantidad</th>
                <th className="px-3 py-2">Unidad</th>
              </tr>
            </thead>
            <tbody>
              {doc.items.map((i, k) => (
                <tr key={k} className="border-b border-[#ececef]">
                  <td className="px-3 py-2">{i.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{decimal(i.qty)}</td>
                  <td className="px-3 py-2">{i.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {doc.services.length > 0 && (
          <table className="mb-6 w-full text-sm">
            <thead>
              <tr className="bg-[#f7f6f4] text-left text-[10px] font-bold uppercase tracking-wider text-[#707078]">
                <th className="px-3 py-2">Servicios incluidos</th>
              </tr>
            </thead>
            <tbody>
              {doc.services.map((s, k) => (
                <tr key={k} className="border-b border-[#ececef]">
                  <td className="px-3 py-2">{s}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="flex flex-col-reverse gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex max-w-sm flex-col gap-4 text-sm">
            {doc.deliveryTime && (
              <div>
                <Label>Tiempo de entrega</Label>
                {doc.deliveryTime}
              </div>
            )}
            {doc.paymentTerms && (
              <div>
                <Label>Condiciones de pago</Label>
                <p className="whitespace-pre-line">{doc.paymentTerms}</p>
              </div>
            )}
            <div>
              <Label>Vigencia</Label>
              {doc.validityDays} días (hasta el {doc.validUntil})
            </div>
          </div>
          <div className="w-full rounded-md bg-[#f7f6f4] p-4 sm:w-72">
            {doc.unitPrice && (
              <div className="flex justify-between py-0.5 text-sm">
                <span className="text-[#707078]">Precio por pieza ({doc.job.qty} pzas)</span>
                <span className="tabular-nums">{money(doc.unitPrice)}</span>
              </div>
            )}
            {doc.totals.tax && (
              <>
                <div className="flex justify-between py-0.5 text-sm">
                  <span className="text-[#707078]">Subtotal</span>
                  <span className="tabular-nums">{doc.totals.subtotal}</span>
                </div>
                <div className="flex justify-between py-0.5 text-sm">
                  <span className="text-[#707078]">{doc.totals.taxLabel}</span>
                  <span className="tabular-nums">{doc.totals.tax}</span>
                </div>
              </>
            )}
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#c8611a]">{doc.totals.tax ? 'Total con IVA' : 'Total'}</span>
              <span className="text-2xl font-bold tabular-nums">{doc.totals.total}</span>
            </div>
            {!doc.totals.tax && <div className="mt-1 text-[11px] text-[#707078]">Precio en pesos mexicanos (MXN)</div>}
          </div>
        </div>

        {doc.notes && (
          <div className="mt-6">
            <Label>Notas</Label>
            <p className="whitespace-pre-line text-sm">{doc.notes}</p>
          </div>
        )}

        {doc.shop.footer && <footer className="mt-10 border-t border-[#e2e2e6] pt-4 text-[11px] text-[#707078]">{doc.shop.footer}</footer>}
      </div>
    </article>
  );
}
