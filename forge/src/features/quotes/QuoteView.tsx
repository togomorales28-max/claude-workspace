import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { toast } from 'sonner';
import { ArrowLeft, Copy, Download, FileQuestion, MessageCircle, Pencil, Printer, Trash2, Eye, Calculator } from 'lucide-react';
import { db } from '@/data/db';
import { quotesRepo } from '@/data/repo';
import { useSettings } from '@/lib/hooks';
import { buildDocument } from '@/lib/document';
import { canPrint, downloadQuotePdf, printQuotePdf, trySharePdf, whatsappUrl } from '@/lib/share';
import { Button, EmptyState, IconButton, Select, StatusBadge, Segmented } from '@/components/ui';
import { useConfirm } from '@/components/ui/confirm';
import { STATUSES, statusLabel } from '@/domain/constants';
import { dateShort } from '@/domain/format';
import type { QuoteStatus } from '@/domain/types';
import { QuoteDocument } from './QuoteDocument';
import { CostSummary } from './CostSummary';

export function QuoteView() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const settings = useSettings();
  const quote = useLiveQuery(async () => (await db.quotes.get(id)) ?? null, [id]);
  const [tab, setTab] = useState<'doc' | 'costs'>('doc');
  // Precargar el generador de PDF para que compartir/descargar responda al instante
  useEffect(() => {
    void import('@/lib/pdf');
  }, []);
  const [busy, setBusy] = useState(false);
  const doc = useMemo(() => (quote && settings ? buildDocument(quote, settings) : null), [quote, settings]);

  if (quote === undefined || !settings) return <div className="h-64" />;
  if (quote === null || !doc)
    return (
      <EmptyState
        icon={FileQuestion}
        title="Cotización no encontrada"
        action={
          <Link to="/cotizaciones">
            <Button>Ver cotizaciones</Button>
          </Link>
        }
      />
    );

  const run = async (fn: () => void | Promise<unknown>, ok?: string) => {
    setBusy(true);
    try {
      await fn();
      if (ok) toast.success(ok);
    } catch (e) {
      toast.error('Ocurrió un error', { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const missingShop = !settings.shopName;

  return (
    <div>
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <IconButton icon={ArrowLeft} label="Volver" onClick={() => navigate('/cotizaciones')} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-ember-400">{quote.number}</span>
              <StatusBadge status={quote.status} />
              {quote.isDemo && <span className="rounded bg-warn/15 px-1.5 text-[10px] font-semibold uppercase text-warn">Demo</span>}
            </div>
            <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{quote.title}</h1>
            <p className="text-xs text-ink-400">
              {quote.clientName} · creada {dateShort(quote.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label="Estado"
            value={quote.status}
            className="h-9 w-36"
            onChange={(e) => {
              const s = e.target.value as QuoteStatus;
              void run(() => quotesRepo.setStatus(quote.id, s), `Estado: ${statusLabel(s)}`);
            }}
          >
            {STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
          <Link to={`/cotizaciones/${quote.id}/editar`}>
            <Button icon={Pencil} size="md">
              Editar
            </Button>
          </Link>
          <IconButton
            icon={Copy}
            label="Duplicar"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const c = await quotesRepo.duplicate(quote.id);
                toast.success(`Duplicada como ${c.number}`);
                navigate(`/cotizaciones/${c.id}/editar`);
              })
            }
          />
          <IconButton
            icon={Calculator}
            label="Escalar a otro tamaño"
            onClick={() => navigate('/estimador', { state: { quoteId: quote.id } })}
          />
          <IconButton
            icon={Trash2}
            label="Eliminar"
            tone="danger"
            onClick={async () => {
              if (await confirm({ title: `¿Eliminar ${quote.number}?`, description: 'Esta acción no se puede deshacer.', confirmLabel: 'Eliminar', danger: true })) {
                await quotesRepo.remove(quote.id);
                toast.success('Cotización eliminada');
                navigate('/cotizaciones');
              }
            }}
          />
        </div>
      </div>

      {missingShop && (
        <div className="no-print mb-4 rounded-lg border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
          Tu documento aún no tiene el nombre del taller.{' '}
          <Link to="/configuracion" className="font-medium underline">
            Configúralo aquí
          </Link>
          .
        </div>
      )}

      <div className={`no-print mb-5 grid gap-2 sm:flex sm:flex-wrap ${canPrint ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <Button
          variant="primary"
          icon={Download}
          disabled={busy}
          onClick={() =>
            run(async () => {
              const r = await downloadQuotePdf(quote, settings);
              if (r === 'saved') toast.success('PDF descargado');
              else if (r === 'unavailable') toast.error('Las descargas no están disponibles en esta vista.');
            })
          }
        >
          PDF
        </Button>
        {canPrint && (
          <Button icon={Printer} disabled={busy} onClick={() => run(() => printQuotePdf(quote, settings))}>
            Imprimir
          </Button>
        )}
        <a
          href={whatsappUrl(quote, settings)}
          target="_blank"
          rel="noopener noreferrer"
          className="contents"
          onClick={async (e) => {
            const markSent = () => quote.status === 'draft' && quotesRepo.setStatus(quote.id, 'sent');
            if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && canPrint) {
              // En celular (fuera del artefacto) intentar compartir el PDF directamente.
              e.preventDefault();
              const r = await trySharePdf(quote, settings);
              if (r === 'shared') return void markSent();
              if (r === 'cancelled') return;
              window.open(whatsappUrl(quote, settings), '_blank', 'noopener');
            }
            void markSent();
            const pdf = await downloadQuotePdf(quote, settings);
            if (pdf === 'saved') toast.success('Adjunta en WhatsApp el PDF que se descargó');
          }}
        >
          <Button icon={MessageCircle} disabled={busy} className="text-[#5fd48a]" tabIndex={-1}>
            WhatsApp
          </Button>
        </a>
        <Segmented
          className="col-span-full sm:ml-auto"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'doc', label: <span className="inline-flex items-center gap-1.5"><Eye className="size-3.5" /> Documento</span> },
            { value: 'costs', label: <span className="inline-flex items-center gap-1.5"><Calculator className="size-3.5" /> Mis costos</span> },
          ]}
        />
      </div>

      {tab === 'doc' ? (
        <div className="anim-fade -mx-4 bg-ink-950/50 px-2 py-4 sm:mx-0 sm:rounded-xl sm:p-8">
          <QuoteDocument doc={doc} />
        </div>
      ) : (
        <div className="anim-fade grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
          <div className="rounded-xl border border-ink-750 bg-ink-850 p-5">
            <h2 className="mb-1 text-sm font-semibold">Desglose interno</h2>
            <p className="mb-4 text-xs text-ink-400">Solo tú ves esta información; no aparece en el documento del cliente.</p>
            <CostSummary b={doc.b} quantity={quote.dimensions.quantity} taxPct={quote.taxPct} />
          </div>
          <div className="rounded-xl border border-ink-750 bg-ink-850 p-5">
            <h2 className="mb-3 text-sm font-semibold">Historial de estado</h2>
            <ol className="flex flex-col gap-3">
              {[...quote.statusHistory].reverse().map((h, i) => (
                <li key={i} className="flex items-center justify-between gap-3 text-sm">
                  <StatusBadge status={h.status} />
                  <span className="text-xs text-ink-400">{new Date(h.date).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
