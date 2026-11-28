"""Genera admin.html en un solo archivo (configuración, cálculo e íconos incluidos).
Uso: python3 build_admin.py <config.js> <salida.html>
Para avisos con la app cerrada hace falta subir también cotizador-sw.js junto a admin.html."""
import base64, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
COT = os.path.join(HERE, '..', 'web-cotizador')
conf_path, out = sys.argv[1], sys.argv[2]
html = open(os.path.join(COT, 'admin.html'), encoding='utf-8').read()
conf = open(conf_path, encoding='utf-8').read()
cot = open(os.path.join(COT, 'cotizador.js'), encoding='utf-8').read()
icon = 'data:image/png;base64,' + base64.b64encode(open(os.path.join(COT, 'cotizador-icon-192.png'), 'rb').read()).decode()
S = 'script'
def must(old, new):
    global html
    assert old in html, old; html = html.replace(old, new, 1)
must('<script src="config.js"></script>', '<' + S + '>\n' + conf + '\n</' + S + '>')
must('<script src="cotizador.js"></script>', '<' + S + ' src="data:text/javascript;base64,' + base64.b64encode(cot.encode('utf-8')).decode() + '"></' + S + '>')
must('<link rel="icon" href="cotizador-icon-192.png">', '<link rel="icon" href="' + icon + '">')
must('<link rel="apple-touch-icon" href="cotizador-icon-192.png">', '<link rel="apple-touch-icon" href="' + icon + '">')
open(out, 'w', encoding='utf-8').write(html)
print(out, round(os.path.getsize(out) / 1024), 'KB')
