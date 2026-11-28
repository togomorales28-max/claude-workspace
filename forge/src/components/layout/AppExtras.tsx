import { useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { Cloud, CloudOff, FileDown, Loader2 } from 'lucide-react';
import { getSyncError, getSyncState, subscribeSync } from '@/data/cloudSync';
import { IS_ARTIFACT, TARGET, saveFile } from '@/lib/platform';
import { Button } from '@/components/ui';
import { cn } from '@/lib/cn';

/** Descarga FORGE completo como un solo archivo HTML que funciona sin internet. */
export function DownloadAppButton({ className, full }: { className?: string; full?: boolean }) {
  const [busy, setBusy] = useState(false);
  if (TARGET === 'file') return null;
  return (
    <Button
      variant={full ? 'secondary' : 'ghost'}
      icon={busy ? Loader2 : FileDown}
      disabled={busy}
      className={cn(!full && 'w-full justify-start', className)}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await fetch('./forge.html');
          if (!res.ok) throw new Error();
          const r = await saveFile(await res.blob(), 'FORGE.html');
          if (r === 'saved') toast.success('FORGE.html descargado', { description: 'Ábrelo con Chrome o Edge; funciona sin internet.' });
          else if (r === 'unavailable') toast.error('Las descargas no están disponibles en esta vista.');
        } catch {
          toast.error('No se encontró el archivo de la app para descargar.');
        } finally {
          setBusy(false);
        }
      }}
    >
      Descargar app (archivo)
    </Button>
  );
}

/** Dónde se guardan los datos: en la cuenta (artefacto) o solo en este navegador. */
export function SyncStatus({ className }: { className?: string }) {
  const state = useSyncExternalStore(subscribeSync, getSyncState, getSyncState);
  if (!IS_ARTIFACT || state === 'off')
    return <span className={className}>Datos guardados en este dispositivo. Respalda desde Configuración.</span>;
  const map = {
    connecting: { icon: Loader2, text: 'Conectando con tu cuenta…', cls: 'text-ink-400' },
    synced: { icon: Cloud, text: 'Guardado en tu cuenta de Claude', cls: 'text-ok' },
    saving: { icon: Loader2, text: 'Guardando en tu cuenta…', cls: 'text-ink-300' },
    error: { icon: CloudOff, text: getSyncError() || 'No se pudo guardar en la nube', cls: 'text-warn' },
  } as const;
  const m = map[state as keyof typeof map];
  const Icon = m.icon;
  return (
    <span className={cn('inline-flex items-start gap-1.5', m.cls, className)}>
      <Icon className={cn('mt-px size-3.5 shrink-0', (state === 'connecting' || state === 'saving') && 'animate-spin')} />
      {m.text}
    </span>
  );
}
