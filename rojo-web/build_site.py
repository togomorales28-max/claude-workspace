"""
Optimiza la web de Rojo Iron Works y le integra el cotizador.

Uso:  python3 build_site.py <index_original.html> <carpeta_salida>

- Saca las fotos incrustadas (base64) a archivos .webp en dos tamaños (800 px y 1600 px).
- La página pasa de ~21 MB a ~60 KB: se muestra al instante y las fotos se descargan en paralelo.
- Todas las fotos empiezan a descargarse al entrar (no esperan a que el visitante baje).
- Botones más rápidos: sin retraso al tocar, respuesta visual inmediata, carrusel sin desenfoque pesado.
- Agrega los botones «Cotizar» y el cotizador (panel encima de la página).
"""
import base64, hashlib, io, os, re, shutil, sys
from PIL import Image

SRC, OUT = sys.argv[1], sys.argv[2]
IMG_DIR = os.path.join(OUT, 'img')
os.makedirs(IMG_DIR, exist_ok=True)
html = open(SRC, encoding='utf-8').read()
orig_size = len(html.encode('utf-8'))

def slug(s, n=40):
    s = re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')
    return s[:n].strip('-') or 'foto'

def save_webp(im, path, width, quality=80):
    if im.width > width:
        h = round(im.height * width / im.width)
        im = im.resize((width, h), Image.LANCZOS)
    im.save(path, 'WEBP', quality=quality, method=6)
    return im.width, im.height

def tiny_data_uri(im):
    t = im.copy(); t.thumbnail((32, 32))
    b = io.BytesIO(); t.convert('RGB').save(b, 'WEBP', quality=45)
    return 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()

stats = {'imgs': 0, 'bytes_in': 0, 'bytes_out': 0}
seen = {}

def process_img_tag(m):
    tag = m.group(0)
    src_m = re.search(r'src="(data:image/(png|jpeg|webp);base64,([^"]+))"', tag)
    if not src_m:
        return tag
    data = base64.b64decode(src_m.group(3))
    alt = (re.search(r'alt="([^"]*)"', tag) or [None, ''])[1]
    key = hashlib.sha1(data).hexdigest()[:8]
    name = f"{slug(alt)}-{key}"
    stats['imgs'] += 1; stats['bytes_in'] += len(data)
    im = Image.open(io.BytesIO(data))
    is_png_logo = src_m.group(2) == 'png'
    if is_png_logo:
        # logotipos con transparencia: se conservan nítidos (webp sin pérdida)
        path = os.path.join(IMG_DIR, name + '.webp')
        if key not in seen:
            im.save(path, 'WEBP', lossless=True, method=6)
            stats['bytes_out'] += os.path.getsize(path)
            seen[key] = True
        return tag.replace(src_m.group(1), 'img/' + name + '.webp')
    im = im.convert('RGB')
    is_carousel = 'data-slot="carousel"' in tag
    view_w = 1000 if is_carousel else 600            # tamaño que de verdad se ve en la página
    small_name, big_name = f"{name}-{view_w}.webp", f"{name}-1600.webp"
    w_small, w_big = os.path.join(IMG_DIR, small_name), os.path.join(IMG_DIR, big_name)
    if key not in seen:
        save_webp(im, w_small, view_w, 74)
        save_webp(im, w_big, 1600, 78)
        # Si la original ya pesa menos y no pasa de 1600 px, se usa tal cual (sin perder calidad).
        if im.width <= 1600 and len(data) <= os.path.getsize(w_big):
            if src_m.group(2) == 'webp':
                open(w_big, 'wb').write(data)
            else:
                Image.open(io.BytesIO(data)).convert('RGB').save(w_big, 'WEBP', quality=82, method=6)
        stats['bytes_out'] += os.path.getsize(w_small) + os.path.getsize(w_big)
        stats['first'] = stats.get('first', 0) + os.path.getsize(w_small)
        seen[key] = tiny_data_uri(im)
    small, big = 'img/' + small_name, 'img/' + big_name
    # La página usa la versión de su tamaño; la grande solo se descarga al abrir la foto en el visor.
    new = tag.replace(src_m.group(0), f'src="{small}" data-full="{big}" data-bg="{seen[key]}"')
    # Todas las fotos se descargan al entrar; la primera del carrusel con prioridad alta.
    new = new.replace('loading="lazy"', 'loading="eager"')
    if 'fetchpriority="high"' not in new:
        new = new.replace('loading="eager"', 'loading="eager" fetchpriority="low"', 1)
    new = new.replace(' data-slot="carousel"', '')
    return new

# Marcar las fotos del carrusel para darles otro tamaño
track = re.search(r'(<div class="carousel-track" id="carouselTrack">)(.*?)(</div>)', html, re.S)
html = html[:track.start(2)] + track.group(2).replace('<img ', '<img data-slot="carousel" ') + html[track.end(2):]
html = re.sub(r'<img\b[^>]*>', process_img_tag, html)
html = html.replace('decoding="sync"', 'decoding="async"')

def rep(old, new, count=1):
    global html
    assert old in html, 'no encontrado: ' + old[:70]
    html = html.replace(old, new, count)

# ── Estilos: botones rápidos, carrusel ligero, botones de cotizar ──
rep('</style>\n<noscript>', r'''
  /* ═══ Rendimiento y respuesta inmediata de botones ═══ */
  a,button,[role="button"],.work-type-item,.carousel-btn,.carousel-dots span,.zoomable,.carousel-track img{ touch-action:manipulation; }
  .work-type-item,.carousel-btn,.cta-btn,.social-link,.text-us-btn,.site-header .phone,.quote-btn,.lightbox-close,.lightbox-nav{
    transition-duration:0.12s !important;
  }
  .work-type-item:active{ background:#e4dccb;transform:scale(0.97); }
  .carousel-btn:active,.lightbox-close:active,.lightbox-nav:active{ transform:translateY(-50%) scale(0.9); }
  .lightbox-close:active{ transform:scale(0.9); }
  .social-link:active,.cta-btn:active,.site-header .phone:active,.quote-btn:active{ transform:scale(0.96); }
  .carousel-dots span{ position:relative; }
  .carousel-dots span::after{ content:'';position:absolute;inset:-8px; } /* área táctil más grande */
  .carousel-track{ will-change:transform;transition:transform 0.3s cubic-bezier(.2,.7,.2,1); }
  .carousel-viewport::before{ filter:blur(14px) brightness(0.72) saturate(0.9); }
  .lightbox.open{ animation:lbIn .12s ease-out; }
  @keyframes lbIn{ from{ opacity:0; } }
  .gallery-stack img,.carousel-track img{ background:#ece9e3; }

  /* ═══ Botones «Cotizar» ═══ */
  .quote-btn{
    display:inline-flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;
    font-family:'Oswald',sans-serif;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;
    background:linear-gradient(135deg,var(--red-hot),var(--red));color:#fff;border:0;border-radius:999px;
    padding:15px 30px;font-size:1.05rem;box-shadow:0 8px 22px rgba(179,36,31,0.32);
    -webkit-tap-highlight-color:transparent;
  }
  .quote-btn:hover{ filter:brightness(1.06); }
  .quote-btn small{ font-family:'Barlow',sans-serif;font-weight:400;text-transform:none;letter-spacing:0;opacity:0.9;font-size:0.85em; }
  .hero-quote{ margin:-8px 0 30px; }
  .site-header nav a.nav-quote{ color:var(--red-hot);opacity:1;font-weight:700; }
  .closing-quote{ margin-top:22px; }
  @media (max-width:600px){ .quote-btn{ padding:14px 24px;font-size:0.98rem; } }
</style>
<noscript>''')

# Botón en el inicio (debajo del lema), en el menú y al final
rep('<div class="tagline">we handle all types of metal work</div>',
    '<div class="tagline">we handle all types of metal work</div>\n      <div class="hero-quote"><button class="quote-btn" type="button" data-cotizar>Get a Quote <small>· Cotizar</small></button></div>')
rep('<a href="#contact">Contact</a>\n      </nav>', '<a href="#contact">Contact</a>\n        <a href="#cotizar" class="nav-quote">Quote</a>\n      </nav>')
rep('Simple repair or full custom build — bring it to us.</p>',
    'Simple repair or full custom build — bring it to us.</p>\n    <button class="quote-btn closing-quote" type="button" data-cotizar>Get a Free Quote <small>· Cotización gratis</small></button>')

# ── Partículas: más ligeras y en pausa cuando no se ven ──
rep("""        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 110) {""", """        var d2 = dx * dx + dy * dy;
        if (d2 < 12100) { var dist = Math.sqrt(d2);""")
rep("""    count = Math.min(Math.max(count, 40), 110);""", """    count = Math.min(Math.max(count, 30), w < 700 ? 55 : 90);""")
rep("""  function draw(t) {
    if (document.hidden) { animationId = 0; return; }""", """  var onScreen = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { onScreen = en[0].isIntersecting; if (onScreen) startDrawing(); }).observe(canvas);
  }
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  function draw(t) {
    if (document.hidden || !onScreen) { animationId = 0; return; }""")

# ── Carrusel: fondo desenfocado con miniatura (ligero) ──
rep("""    var activeSrc = slides[index] && slides[index].getAttribute('src');
    if (activeSrc) viewport.style.setProperty('--slide-bg', 'url(' + activeSrc + ')');""",
"""    var activeBg = slides[index] && (slides[index].getAttribute('data-bg') || slides[index].getAttribute('src'));
    if (activeBg) viewport.style.setProperty('--slide-bg', 'url(' + activeBg + ')');""")
rep("""    track.style.transition = 'transform 0.35s ease';""", """    track.style.transition = 'transform 0.3s cubic-bezier(.2,.7,.2,1)';""")

# ── Visor: muestra al instante la foto ya cargada y cambia a la versión grande en cuanto llega ──
rep("""  function lbShowSingle(src, alt, showWm) {
    lbItems = [];
    lightboxImg.src = src;""", """  function setLbImage(src, full) {
    lightboxImg.src = src;
    if (full && full !== src) {
      var hi = new Image();
      hi.onload = function () { if (lightboxImg.getAttribute('data-want') === full) lightboxImg.src = full; };
      lightboxImg.setAttribute('data-want', full);
      hi.src = full;
    }
  }
  function lbShowSingle(src, alt, showWm, full) {
    lbItems = [];
    setLbImage(src, full);""")
rep("""    var item = lbItems[lbIndex];
    lightboxImg.src = item.src;""", """    var item = lbItems[lbIndex];
    setLbImage(item.src, item.full);""")
rep("""      lbShowSingle(e.target.src, e.target.alt, false);
    });
  }

  var zoomables""", """      lbShowSingle(e.target.currentSrc || e.target.src, e.target.alt, false, e.target.getAttribute('data-full'));
    });
  }

  var zoomables""")
rep("""    zoomables[z].addEventListener('click', function(e){
      lbShowSingle(e.target.src, e.target.alt, false);""", """    zoomables[z].addEventListener('click', function(e){
      lbShowSingle(e.target.currentSrc || e.target.src, e.target.alt, false, e.target.getAttribute('data-full'));""")
rep("""          items.push({ src: photos[i].src, alt: photos[i].alt });""",
    """          items.push({ src: photos[i].currentSrc || photos[i].src, alt: photos[i].alt, full: photos[i].getAttribute('data-full') });""")

# ── Cotizador ──
rep('</body>\n</html>', '''<!-- Cotizador Rojo Iron Works: panel de cotización encima de la página -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js" defer></script>
<script src="config.js" defer></script>
<script src="cotizador.js" defer></script>
</body>
</html>''')

open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(html)
new_size = os.path.getsize(os.path.join(OUT, 'index.html'))
print(f"HTML: {orig_size/1e6:.1f} MB -> {new_size/1e3:.0f} KB")
print(f"Fotos: {stats['imgs']} etiquetas, {len(seen)} distintas; originales {stats['bytes_in']/1e6:.1f} MB")
print(f"  Lo que se descarga al entrar: {stats.get('first',0)/1e6:.1f} MB; versiones grandes para el visor: {(stats['bytes_out']-stats.get('first',0))/1e6:.1f} MB (solo al abrir una foto)")
