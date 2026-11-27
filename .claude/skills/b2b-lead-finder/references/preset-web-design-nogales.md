# Preset: Negocios locales que necesitan web (CraftCode) — Nogales, Sonora, México

Sell-to fit: creación y rediseño de páginas web para negocios locales (CraftCode). Leads que
venden por redes y WhatsApp sin web propia, o con una web antigua, rota o solo de directorio.

## Location filter

Nogales, Sonora, México. Hard filter: excluir Nogales, Arizona (EE. UU.): direcciones en AZ,
CP 85621/85628, teléfonos +1 520. Areas: obtener las colonias y zonas comerciales reales en la
primera ronda (Google Maps, INEGI) y guardarlas en `./leads/zonas-nogales.md`. Zona confirmada
de partida: Centro / Av. Álvaro Obregón.

## Lead categories

1. Barberías
2. Estéticas, salones de belleza, spas, cejas y pestañas
3. Dentistas y clínicas dentales
4. Salones de uñas
5. Gimnasios, crossfit, estudios de yoga y pilates
6. Salones de eventos, jardines y quintas para fiestas
(Opcional: negocios locales independientes que el usuario nombre.)

## Mention terms

Spanish (señales públicas de que venden sin web propia): "agenda por WhatsApp", "citas por
WhatsApp", "mándanos inbox", "manda DM", "pide informes por mensaje", "cotiza por mensaje",
"precios por inbox", "link en bio", "linktr.ee", "solo con cita", "aparta tu fecha",
"pregunta por paquetes", "síguenos en Facebook".

English (frontera, clientela de Arizona): "book on WhatsApp", "DM for prices", "link in bio",
"we speak English".

Evidencia adicional que cuenta como cita (`exact_source_quote`): el campo de sitio web de la
ficha de Google Maps vacío o apuntando a Facebook/Instagram; un dominio que no carga; el pie
"© 20XX" de hace 3+ años; el aviso de "No seguro" (sin HTTPS).

## Priority rubric

- High: activo en los últimos 90 días, 30+ reseñas o publicaciones frecuentes, contacto por
  WhatsApp o teléfono, y sin web / solo redes / web rota.
- Medium: web antigua o básica verificada, o sin web pero con poca actividad.
- Low: web moderna con problemas menores, o actividad dudosa.

## Exclusions

Cadenas y franquicias nacionales; negocios de Nogales, Arizona; negocios cerrados o sin
actividad en 12 meses; directorios y agregadores (Sección Amarilla, Doctoralia, Fresha,
Booksy) como lead en sí mismos (sí cuentan como evidencia de "solo directorio" del negocio).

## Market notes

- WhatsApp e Instagram/Facebook dominan; el correo es raro en barberías y uñas. No descartar
  por falta de correo.
- Verificación cruzada: ficha de Google Maps + página de Facebook/Instagram + Sección Amarilla;
  para dentistas, cédula profesional en el Registro Nacional de Profesionistas (SEP).
- Ciudad fronteriza: una web bilingüe es un argumento real para dentistas, estéticas y salones
  de eventos con clientela de EE. UU.
- Puntuación y CSV finales: usar la skill `craftcode-prospecting` y su script
  `craftcode_leads.py`.
