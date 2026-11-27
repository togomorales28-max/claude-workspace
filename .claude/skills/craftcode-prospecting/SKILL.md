---
name: craftcode-prospecting
description: Sistema de prospección de clientes de CraftCode (creación y rediseño de páginas web) para Nogales, Sonora, México. Orquesta las skills local-client-prospector, b2b-lead-finder, local-lead-finder (Apify) y google-maps-lead-generation (ScrapeGraphAI) con la configuración comercial de CraftCode - nichos, términos de búsqueda en español, criterios de web deficiente, verificación, puntuación 0-100, CSV/tablas y mensajes personalizados. Úsala cuando el usuario pida buscar clientes, prospectos o leads para CraftCode; negocios sin página web o con web antigua en Nogales u otra ciudad; barberías, estéticas, dentistas, salones de uñas, gimnasios o salones de eventos que necesiten web; reportes CSV de prospectos; o mensajes de WhatsApp/correo para ofrecer servicios web.
---

# CraftCode: prospección de clientes

CraftCode crea y rediseña páginas web para negocios locales. Esta skill es la capa de
configuración: decide qué herramienta usar, con qué términos, cómo verificar, cómo puntuar
y cómo redactar el primer mensaje. Las skills instaladas hacen el trabajo pesado.

## Perfil del negocio

- Negocio: **CraftCode**. Servicios: creación de páginas web nuevas y rediseño de webs existentes.
- Datos del remitente (rellenar antes de enviar cualquier mensaje; nunca enviar con `{{`):
  - Nombre: `{{NOMBRE_CONTACTO}}`
  - WhatsApp: `{{WHATSAPP_CRAFTCODE}}`
  - Correo: `{{CORREO_CRAFTCODE}}`
  - Portafolio / ejemplos: `{{URL_PORTAFOLIO}}`
  - Rango de precios (opcional): `{{PRECIOS}}`
- Si estos datos siguen vacíos al redactar mensajes, pídeselos al usuario. No los inventes.

## Mercado

- Ciudad inicial: **Nogales, Sonora, México**. País `mx`, idioma `es`. Lada local de
  referencia: 631 (confírmala en la ficha del negocio, no la supongas).
- **Excluir Nogales, Arizona (EE. UU.)**. Es la ciudad vecina del otro lado de la frontera y
  Google Maps mezcla resultados. Descarta todo lo que tenga dirección en AZ, código postal
  85621/85628 o teléfono +1 520.
- Sectores de la ciudad: no uses una lista genérica. En la primera búsqueda de cada sesión
  obtén las colonias y zonas comerciales reales de Nogales (Google Maps, INEGI, directorios)
  y guárdalas en `./leads/zonas-nogales.md` para reutilizarlas. Una zona confirmada de partida:
  Centro / Av. Álvaro Obregón.
- Otras ciudades: acepta cualquier ciudad que el usuario indique; aplica las mismas reglas.

## Nichos y términos de búsqueda

Busca siempre en español y añade el término en inglés cuando el negocio lo use (frontera).

| Nicho (`niche`) | Términos de búsqueda |
|---|---|
| barberia | barbería, barber shop, barbero |
| estetica / salon de belleza | estética, salón de belleza, peluquería, spa, cejas y pestañas |
| dentista | dentista, consultorio dental, clínica dental, ortodoncista |
| salon de unas | uñas, salón de uñas, nail salon, manicure |
| gimnasio | gimnasio, gym, crossfit, box, estudio de yoga/pilates |
| salon de eventos | salón de eventos, salón de fiestas, jardín de eventos, quinta, terraza para eventos |
| independiente | taller mecánico, florería, panadería, veterinaria, restaurante familiar, consultorio, papelería, tienda de ropa |

Advertencia medida por AIPM (mercado EE. UU.): barberías y salones de uñas casi nunca
publican correo. En México el canal real suele ser **WhatsApp e Instagram**, así que no
descartes un lead por no tener correo.

## Qué herramienta usar (de menor a mayor coste)

1. **Gratis, por defecto: `local-client-prospector`** (WebSearch + WebFetch). Para listas de
   10 a 30 prospectos por nicho. Sin API keys.
2. **Gratis, verificación y evidencia: `b2b-lead-finder`** con el preset
   `references/preset-web-design-nogales.md`. Úsalo para la pasada de verificación adversarial
   (segunda fuente para cada dato) y para el archivo de rechazados con motivo.
3. **Volumen desde Google Maps: `local-lead-finder`** (AIPM, Apify). Requiere
   `APIFY_API_TOKEN`. Cuesta unos 0.005 a 0.007 USD por negocio (cuenta gratis: unos 5 USD de
   crédito al mes, 600 a 800 negocios). **Antes de ejecutar, di el coste estimado y espera un sí.**
   Ejecuta un nicho a la vez en español; no uses `--sweep` (su lista de oficios es de EE. UU.):
   ```bash
   cd ~/.claude/skills/local-lead-finder
   ~/.venvs/local-lead-finder/bin/python setup_check.py
   ~/.venvs/local-lead-finder/bin/python find_leads.py "barbería" "Nogales, Sonora" \
     --country mx --language es --limit 30 --no-sheet --no-crm --fast --no-verify-emails \
     --output "$OLDPWD/leads/craftcode-barberia-nogales-$(date +%F)/apify.csv"
   ```
   **En Claude Code en la nube, `--fast --no-verify-emails` es obligatorio**: el contenedor no
   resuelve DNS ni abre webs arbitrarias, así que la comprobación local marcaría todas las webs
   como "rotas" y vaciaría todos los correos. Después audita cada web con WebFetch y aplica la
   tabla de `website_status` de abajo. En un equipo local con internet completo puedes quitar
   esas dos opciones.
   No uses `--email` (envío masivo) sin aprobación explícita.
4. **Alternativa a Apify: `google-maps-lead-generation`** (ScrapeGraphAI + Playwright).
   Requiere una API key de LLM (`GEMINI_API_KEY` tiene nivel gratuito; OpenAI/Anthropic son de
   pago; Ollama local es gratis pero no está instalado). Usa su entorno y el Chromium ya
   instalado:
   ```bash
   ~/.venvs/gmaps-leads/bin/python tu_script.py
   # en el script: p.chromium.launch(executable_path="/opt/pw-browsers/chromium")
   ```
   En la nube no funciona tal cual: la red del entorno no permite abrir Google Maps ni webs
   arbitrarias desde el contenedor. Úsala en un equipo local o en un entorno con acceso a red
   sin restricciones.
   Su generador de consultas (`query`) produce sectores genéricos ("Cantonment", "IT
   Corridor") que no existen en Nogales: sustitúyelos por las colonias reales.

Detalle de claves, límites y costes: [references/herramientas-y-costes.md](references/herramientas-y-costes.md).

## Clasificar la web (`website_status`, un valor por lead)

| Valor | Cuándo |
|---|---|
| `sin_web` | Ninguna web propia en Maps, Google, ni redes |
| `solo_redes` | Solo Facebook, Instagram, TikTok, Linktree o enlace de WhatsApp |
| `solo_directorio` | Solo Sección Amarilla, Doctoralia, Fresha, Booksy, Yelp u otra plataforma ajena |
| `web_rota` | El dominio no resuelve, error 4xx/5xx, SSL caducado o dominio en venta |
| `web_antigua` | Dos o más: sin HTTPS, sin `meta viewport` (no móvil), copyright de hace 3+ años, carga lenta (más de 5 s), Flash/tablas, sin botón de WhatsApp o reserva, diseño claramente antiguo |
| `web_basica` | Funciona y es móvil, pero es una sola página pobre, sin reservas ni llamada a la acción |
| `web_moderna` | Móvil, HTTPS, actual. Prospecto difícil |
| `sin_verificar` | No se pudo comprobar |

Anota en `website_issues` los problemas concretos observados (por ejemplo "sin HTTPS; copyright
2017; no se adapta al móvil"). Son el gancho del mensaje. Nunca escribas un problema que no
hayas comprobado.

## Contacto público

Recoge solo datos que el negocio publica: teléfono, WhatsApp (enlaces `wa.me`, botón de
WhatsApp, "WhatsApp" en la bio de Instagram), correo, Facebook, Instagram, TikTok, ficha de
Google Maps. No recopiles datos personales privados de dueños o empleados.

## Verificación (obligatoria antes de marcar confianza alta)

- Cada lead necesita al menos **dos fuentes independientes** para nombre + teléfono o dirección.
- Comprueba que está **activo**: publicación, reseña o cambio en los últimos 90 días. Anota la
  fecha en `last_activity`.
- Comprueba que está en Nogales, **Sonora** (no Arizona).
- `confidence`: `alta` (2+ fuentes coinciden), `media` (1 fuente fiable), `baja` (dudoso).
- Campo que no se encuentra: déjalo vacío. **Nunca inventes un teléfono, correo, número de
  reseñas o año de fundación.**
- Rechazados: guárdalos en `rechazados.csv` con el motivo (cerrado, duplicado, Arizona,
  cadena nacional, sin forma de contacto).
- Excluye cadenas y franquicias nacionales: no compran web local.

## Puntuación y reporte

Guarda cada búsqueda en `./leads/craftcode-<nicho>-<ciudad>-<AAAA-MM-DD>/`. Escribe las filas
como JSON (columnas de [assets/craftcode-leads-template.csv](assets/craftcode-leads-template.csv))
y genera el reporte con el script, que deduplica (por teléfono, o nombre sin acentos + zona),
puntúa 0-100 y ordena:

```bash
python3 ~/.claude/skills/craftcode-prospecting/scripts/craftcode_leads.py build \
  ./leads/craftcode-barberia-nogales-2026-11-27 ./leads/craftcode-barberia-nogales-2026-11-27/filas.json
```

Salida: `leads.csv` (todo, Excel UTF-8), `oportunidades.csv` (Caliente + Tibio) y `tabla.md`
(top 25). Para importar la salida de Apify, convierte su CSV a JSON con estas columnas
(`business_name` -> `business`, `website` -> `website_url`, etc.) y reclasifica
`website_status` con la tabla de arriba.

Puntuación (máx. 100): estado web (sin_web/web_rota 35, solo_redes/web_antigua 30,
solo_directorio 25, web_basica 15, moderna 0) + reseñas (100+: 20, 30+: 15, 10+: 8, 1+: 3) +
actividad reciente 10 + WhatsApp/teléfono 15 + correo 5 + nicho prioritario 10; confianza baja
-15; sin ningún canal de contacto, tope 29. Niveles: **Caliente** 70+, **Tibio** 50-69,
**Frío** 30-49, **Descartar** menos de 30.

Resumen en el chat: cuántos leads, reparto por nivel y por `website_status`, los 5 primeros con
el motivo, y qué no se pudo verificar.

## Mensajes personalizados

Plantillas y reglas en [references/mensajes.md](references/mensajes.md). Resumen de reglas:

- Cada mensaje cita **una observación real y verificada** del negocio (su Instagram activo, sus
  reseñas, un problema concreto de su web). Sin halagos genéricos.
- Una sola llamada a la acción (ver un ejemplo o una llamada de 10 minutos).
- Rellena `message_draft` en el CSV; **no envíes nada**. Enviar a personas reales requiere que
  el usuario vea un ejemplo completo, sepa cuántos destinatarios hay, y diga que sí.
- Nada de envíos masivos por WhatsApp: viola las políticas de WhatsApp y puede bloquear el número.
- Respeta la LFPDPPP (protección de datos en México): solo datos públicos de negocio, y si
  alguien pide no ser contactado, márcalo en `notes` y no vuelvas a escribirle.
