import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath, URL } from 'node:url';

// VITE_TARGET: "web" (sitio + PWA, por defecto), "file" (un solo HTML descargable)
// o "artifact" (un solo HTML para publicarse como artefacto de Claude).
const target = process.env.VITE_TARGET || 'web';
const single = target !== 'web';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), ...(single ? [viteSingleFile()] : [])],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: single
    ? { outDir: `dist-${target}`, emptyOutDir: true, copyPublicDir: false }
    : {
        rollupOptions: {
          input: {
            main: fileURLToPath(new URL('./index.html', import.meta.url)),
            widget: fileURLToPath(new URL('./widget.html', import.meta.url)),
          },
        },
      },
  test: { environment: 'node' },
});
