import { useState, useSyncExternalStore } from 'react';
import { Download, Share, SquarePlus } from 'lucide-react';
import { toast } from 'sonner';
import { canPromptInstall, isIos, isStandalone, promptInstall, subscribeInstall } from '@/lib/pwa';
import { Button, Modal } from '@/components/ui';

/** Botón "Instalar app": usa el aviso nativo (Android/Chrome/Edge) o muestra instrucciones en iPhone. */
export function InstallButton({ compact }: { compact?: boolean }) {
  const can = useSyncExternalStore(subscribeInstall, canPromptInstall, () => false);
  const [help, setHelp] = useState(false);
  if (isStandalone()) return null;
  const ios = isIos();
  if (!can && !ios) return null;

  const onClick = async () => {
    if (can) {
      if (await promptInstall()) toast.success('FORGE se instaló como app');
    } else setHelp(true);
  };

  return (
    <>
      {compact ? (
        <button type="button" onClick={onClick} aria-label="Instalar app" className="grid size-9 place-items-center rounded-lg text-ember-400 hover:bg-ink-800">
          <Download className="size-5" />
        </button>
      ) : (
        <Button variant="ghost" icon={Download} onClick={onClick} className="w-full justify-start text-ember-300">
          Instalar app
        </Button>
      )}
      <Modal open={help} onClose={() => setHelp(false)} size="sm" title="Instalar FORGE en tu iPhone" description="Queda como una app en tu pantalla de inicio y funciona sin internet.">
        <ol className="flex flex-col gap-3 pb-2 text-sm text-ink-200">
          <li className="flex items-center gap-3">
            <span className="num grid size-6 place-items-center rounded-full bg-ink-750 text-xs">1</span>
            Abre esta página en Safari y toca <Share className="inline size-4 text-info" /> Compartir.
          </li>
          <li className="flex items-center gap-3">
            <span className="num grid size-6 place-items-center rounded-full bg-ink-750 text-xs">2</span>
            Elige <SquarePlus className="inline size-4" /> “Agregar a inicio”.
          </li>
          <li className="flex items-center gap-3">
            <span className="num grid size-6 place-items-center rounded-full bg-ink-750 text-xs">3</span>
            Toca “Agregar”. Abre FORGE desde su ícono.
          </li>
        </ol>
      </Modal>
    </>
  );
}
