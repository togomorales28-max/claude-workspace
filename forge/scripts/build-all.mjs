// Compila las tres versiones de FORGE:
//  dist/            sitio web + PWA (+ dist/forge.html para descargar la app como archivo)
//  dist-file/       un solo HTML que funciona sin internet
//  dist-artifact/   page.html (contenido para artefacto de Claude) + forge.html
import { execSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const run = (cmd, env = {}) => execSync(cmd, { stdio: 'inherit', env: { ...process.env, ...env } });
run('npx tsc -b');
run('npx vite build', { VITE_TARGET: 'file' });
run('npx vite build', { VITE_TARGET: 'artifact' });
run('npx vite build', { VITE_TARGET: 'web' });

copyFileSync('dist-file/index.html', 'dist/forge.html');

// El artefacto se publica sin doctype/html/head/body propios: se extraen título, estilos y scripts.
const html = readFileSync('dist-artifact/index.html', 'utf8');
// Recorre el documento elemento por elemento desde <head>, saltando el contenido de cada
// <script>/<style> (el JS incluido contiene textos como "</head>" que no son etiquetas reales).
const blocks = [];
for (let i = html.indexOf('<head>') + 6; i < html.length; ) {
  const lt = html.indexOf('<', i);
  if (lt < 0) break;
  const tag = html.slice(lt + 1, lt + 12).match(/^\/?[a-z]+/)?.[0];
  if (tag === 'script' || tag === 'style') {
    const end = html.indexOf(`</${tag}>`, lt);
    if (end < 0) throw new Error(`<${tag}> sin cierre`);
    blocks.push({ tag, text: html.slice(lt, end + tag.length + 3) });
    i = end + tag.length + 3;
  } else if (tag === '/body' || tag === '/html') break;
  else i = html.indexOf('>', lt) + 1;
}
const styles = blocks.filter((b) => b.tag === 'style').map((b) => b.text).join('\n');
const scripts = blocks.filter((b) => b.tag === 'script').map((b) => b.text).join('\n');
const page = `<title>FORGE Cotizaciones</title>
<meta name="theme-color" content="#141415">
<style>:root{color-scheme:dark}body{background:#141415;color:#ececef}</style>
${styles}
<div id="root"></div>
${scripts}
`;
mkdirSync('dist-artifact', { recursive: true });
writeFileSync('dist-artifact/page.html', page);
copyFileSync('dist-file/index.html', 'dist-artifact/forge.html');
console.log('\nListo: dist/, dist/forge.html, dist-artifact/page.html');
