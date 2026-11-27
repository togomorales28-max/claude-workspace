import { useEffect } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import { newQuote } from '@/data/factory';
import { decodeRequest } from '@/domain/webEstimator';
import { decimal, money } from '@/domain/format';
import { useSettings } from '@/lib/hooks';
import type { Quote } from '@/domain/types';

/** Abre una solicitud enviada desde el estimador web como una cotización nueva ya llenada. */
export function RequestImport() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const settings = useSettings();
  const req = decodeRequest(params.get('d') ?? '');
  const digits = req?.phone.replace(/\D/g, '').slice(-10) ?? '';
  const client = useLiveQuery(
    async () => (digits.length === 10 ? ((await db.clients.filter((c) => c.phone.replace(/\D/g, '').endsWith(digits)).first()) ?? null) : null),
    [digits],
  );

  useEffect(() => {
    if (!req || !settings || client === undefined) return;
    const q: Quote = newQuote(settings);
    const dims =
      req.method === 'linear'
        ? `${decimal(req.length)} m`
        : req.method === 'area'
          ? `${decimal(req.width)} × ${decimal(req.height)} m`
          : '';
    navigate('/cotizaciones/nueva', {
      replace: true,
      state: {
        prefill: {
          ...q,
          jobType: req.jobType,
          title: `${req.label}${dims ? ` ${dims}` : ''}`,
          description: req.comment,
          clientId: client?.id ?? null,
          clientName: client?.name ?? req.name,
          clientPhone: client?.phone ?? req.phone,
          dimensions: {
            width: req.method === 'area' ? req.width : 0,
            height: req.method === 'area' ? req.height : 0,
            length: req.method === 'linear' ? req.length : 0,
            quantity: req.qty,
          },
          manualPrice: req.high > 0 ? Math.round((req.low + req.high) / 2) : null,
          webEstimate: `${money(req.low)} – ${money(req.high)}`,
        } satisfies Quote & { webEstimate: string },
      },
    });
  }, [req?.jobType, settings, client]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!req) return <Navigate to="/" replace />;
  return <div className="h-64" />;
}
