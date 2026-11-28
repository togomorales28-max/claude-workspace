// Convierte dist-artifact/index.html en el contenido de página que espera el visor de artifacts
// (sin <!doctype>, <html>, <head> ni <body> propios).
import { readFileSync, writeFileSync } from 'node:fs';
const html = readFileSync('dist-artifact/index.html', 'utf8');
// El JavaScript empaquetado contiene textos como «<head>» y «<body>»: se ubican las etiquetas reales desde el final.
const bodyOpen = html.lastIndexOf('<body>');
const body = html.slice(bodyOpen + 6, html.lastIndexOf('</body>'));
const headClose = html.lastIndexOf('</head>', bodyOpen);
const head = html.slice(html.indexOf('<head>') + 6, headClose);
const keep = head
  .replace(/<meta charset[^>]*>/i, '')
  .replace(/<meta name="viewport"[^>]*>/i, '')
  .replace(/<link rel="(icon|apple-touch-icon|manifest)"[^>]*>/gi, '')
  .trim();
const title = keep.match(/<title>[\s\S]*?<\/title>/)[0];
const rest = keep.replace(title, '');
writeFileSync('dist-artifact/metalwork-calculator.html', `${title}\n${rest}\n${body.trim()}\n`);
console.log('ok', (readFileSync('dist-artifact/metalwork-calculator.html').length / 1024).toFixed(0), 'KB');
