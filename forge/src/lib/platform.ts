/**
 * Plataforma de ejecución.
 * - "web": sitio normal / app instalada (PWA).
 * - "artifact": dentro de un artefacto de Claude (marco aislado: sin impresión,
 *   sin service worker, descargas mediante la capacidad `downloads`).
 * - "file": abierto como archivo local (forge.html descargado).
 */
export type Target = 'web' | 'artifact' | 'file';
export const TARGET: Target = (import.meta.env.VITE_TARGET as Target) || 'web';
export const IS_ARTIFACT = TARGET === 'artifact';
export const IS_SINGLE_FILE = TARGET === 'artifact' || TARGET === 'file';

/** Dirección pública de FORGE (GitHub Pages) usada por el estimador web cuando no se puede deducir. */
export const PUBLIC_URL = 'https://togomorales28-max.github.io/claude-workspace/';

type ClaudeWin = Window & { claude?: { use: (name: string) => Promise<unknown> } };

export async function useCapability<T>(name: string): Promise<T | null> {
  const c = (window as ClaudeWin).claude;
  if (!c?.use) return null;
  try {
    return ((await c.use(name)) as T | null) ?? null;
  } catch {
    return null;
  }
}

interface Downloads {
  save(r: { filename: string; data: Blob | string }): Promise<{ status: string }>;
}

/**
 * Descarga un archivo. En el artefacto usa la capacidad `downloads` (el visor pide confirmación);
 * en la web, un enlace temporal.
 */
export async function saveFile(blob: Blob, filename: string): Promise<'saved' | 'declined' | 'unavailable'> {
  if (IS_ARTIFACT) {
    const d = await useCapability<Downloads>('downloads');
    if (!d) return 'unavailable';
    try {
      await d.save({ filename, data: blob });
      return 'saved';
    } catch (e) {
      const code = (e as { code?: string }).code;
      return code === 'declined' || code === 'rate_limited' ? 'declined' : 'unavailable';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'saved';
}
