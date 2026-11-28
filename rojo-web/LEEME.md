# Web de Rojo Iron Works con cotizador

`sitio/` es tu web (RojoironworksAZ.com) ya optimizada y con el cotizador integrado. `rojo-iron-works-sitio.zip` es lo mismo en un solo archivo, para subirlo.

## Qué cambió

### Las fotos están listas al entrar
- **Antes:** las 76 fotos iban dentro del HTML: un archivo de **21 MB** que había que bajar completo.
- **Ahora:** el HTML pesa **101 KB** y la página aparece al instante. Las fotos están en `img/`, optimizadas al tamaño en que se ven, y empiezan a descargarse todas en cuanto el visitante entra, sin esperar a que baje. La primera del carrusel va con prioridad.
- **Visor de pantalla completa:** al abrir una foto se muestra al instante la que ya está cargada, y en cuanto llega se cambia a la versión grande (1600 px), con todo el detalle.

### Botones más rápidos
- **Respuesta al tocar:** sin el retraso que el celular agrega al tocar, y con respuesta visual inmediata (se hunden al tocarlos).
- **Carrusel:** usa para su fondo desenfocado una miniatura de 32 px, en lugar de desenfocar la foto completa cada 2.5 segundos, que era lo que trababa el celular.
- **Partículas del inicio:** se pausan cuando no se ven, y en celular dibujan menos puntos.

### Cotizador
- **«Get a Quote · Cotizar»** debajo del lema y al final de la página, **«Quote»** en el menú y un botón flotante **«Cotizar»** abajo a la izquierda (a la derecha está «Text Us»).
- Todos abren el panel de cotización **encima de la página**, sin abrir otra.

## Cómo subirla
Sube **todo el contenido** de `sitio/` (o descomprime el zip) en la raíz de tu hosting, reemplazando tu `index.html`. La carpeta `img/` debe quedar junto a `index.html`.

Después:
1. Entra a `https://rojoironworksaz.com/admin.html` y crea tu cuenta (la primera cuenta queda como dueña).
2. Activa los avisos en tu teléfono.
3. Cambia los precios de ejemplo por los tuyos.

## Si cambias fotos o el diseño después
Vuelve a generar con:
```
python3 build_site.py tu_index_con_fotos.html sitio
```
Después copia los archivos del cotizador (`cotizador.js`, `config.js`, `admin.html`, `cotizador-sw.js`, `cotizador-admin.webmanifest`, `cotizador-icon-*.png`) desde `../web-cotizador/` a `sitio/`. En `config.js` del sitio van `floatingButtonSide: 'left'` y `color: '#b3241f'`.
