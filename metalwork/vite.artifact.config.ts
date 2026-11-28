/** Compilación en un solo archivo HTML para publicar como artifact de Claude. */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  base: './',
  define: { 'import.meta.env.VITE_ARTIFACT': JSON.stringify('1') },
  plugins: [react(), tailwindcss(), viteSingleFile()],
  build: { outDir: 'dist-artifact', assetsInlineLimit: 100_000_000, copyPublicDir: false },
});
