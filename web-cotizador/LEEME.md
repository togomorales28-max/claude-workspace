# Cotizador de Rojo Ironworks AZ

- **En tu web (RojoironworksAZ.com):** el cliente toca **«Cotizar»** y el cotizador se abre **encima de la misma página**, como el «Personalizar» de Rhinoshield. No abre otra página ni otra pestaña.
  - Ahí elige el trabajo, escribe sus medidas y describe su diseño, y ve su estimado al instante.
  - Para enviar es **obligatorio** dejar su número con **+ y código de país** (ej. `+1 602 555 0123`) y elegir **WhatsApp o SMS**.
- **En tu app (`admin.html`):**
  - Entras **una sola vez** con correo y contraseña; la sesión queda abierta en ese teléfono o computadora.
  - Ves la **lista de cotizaciones con fecha y hora**, agrupadas por día.
  - Recibes una **notificación** cada vez que alguien cotiza, aunque la app esté cerrada.
  - Ahí mismo cambias los precios, y tu web se actualiza sola.

## Lo que ya está listo en Supabase
Proyecto **rojo-ironworks-cotizador** (región California):
- **Tablas y permisos:** los visitantes solo pueden leer precios y enviar cotizaciones. Solo tu cuenta ve las cotizaciones y cambia precios. Una cotización sin `+` y código de país se rechaza también en la base de datos.
- **Tiempo real:** los cambios de precio llegan a la web al instante y las cotizaciones nuevas llegan a la app al instante.
- **Notificaciones:** la función `notify-quote` manda el aviso a tus dispositivos. Las llaves de los avisos están guardadas en Supabase Vault.
- **Precios iniciales:** los de ejemplo. Cámbialos desde la app.
- **`config.js`:** ya tiene la dirección y las llaves públicas del proyecto.

## Lo que falta (lo haces tú, unos 10 minutos)

### 1. Sube estos archivos a la raíz de tu sitio (junto a tu `index.html`)
```
cotizador.js
config.js
admin.html
cotizador-sw.js
cotizador-admin.webmanifest
cotizador-icon-192.png
cotizador-icon-512.png
```

### 2. Pega estas 3 líneas antes de `</body>` en cada página de tu web
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"></script>
<script src="config.js"></script>
<script src="cotizador.js"></script>
```
- Aparece un botón flotante **«Cotizar»** abajo a la derecha. Si no lo quieres, pon `floatingButton: false` en `config.js`.
- Para que **tus propios botones** abran el cotizador, agrégales `data-cotizar`:
  ```html
  <button data-cotizar>Cotizar mi proyecto</button>
  <a href="#cotizar">Cotizar</a>
  ```
- El enlace `https://rojoironworksaz.com/#cotizar` abre el cotizador directo, útil para Facebook, Instagram o WhatsApp.
- `ejemplo.html` muestra cómo se ve.

### 3. En Supabase, configura las direcciones (para recuperar tu contraseña)
Entra a supabase.com → proyecto **rojo-ironworks-cotizador** → **Authentication → URL Configuration**:
- **Site URL:** `https://rojoironworksaz.com`
- **Redirect URLs** → *Add URL*: `https://rojoironworksaz.com/admin.html`

### 4. Crea tu cuenta (una sola vez)
Abre `https://rojoironworksaz.com/admin.html` → **«Primera vez: crear cuenta»** → tu correo y una contraseña → **Crear cuenta y entrar**.
- **La primera cuenta que se cree queda como dueña**, así que créala en cuanto subas los archivos.
- Puede llegarte un correo de «confirmar correo»: ignóralo. Tu cuenta ya queda confirmada.
- Recomendado: después, en Supabase → **Authentication → Sign In / Providers**, apaga **«Allow new users to sign up»** para que nadie más pueda crear cuentas.

### 5. Activa las notificaciones en tu teléfono
- **Android (Chrome):** abre `admin.html` → **Activar avisos** → Permitir. Para tenerla como app: menú ⋮ → *Instalar app*.
- **iPhone (Safari):**
  1. Abre `admin.html` → Compartir → **«Agregar a pantalla de inicio»**.
  2. Abre la app **desde el ícono**.
  3. Toca **Activar avisos** → Permitir. En iPhone las notificaciones web solo funcionan instalada así (iOS 16.4 o más nuevo).
- **Computadora:** abre `admin.html` en Chrome o Edge → **Activar avisos**.
- Con **«Probar aviso»** verificas que llegan. Puedes activarlos en varios dispositivos.

## Cómo calcula
- **Material** = pies de metal × precio por pie del proveedor, + desperdicio.
  - Los pies salen de las medidas: marco, travesaños y barrotes; en barandal, pasamanos, postes y barrotes.
- **Mano de obra:** tu ejemplo («10 × 24 lo hacen 2 personas en 1 día») se ajusta al tamaño del trabajo.
  - Va 1 persona si el trabajo cabe en un día; si no, hasta 2.
  - Cada persona cobra $40 por día, con mínimo de $40.
- **Dificultad:** el estilo, más los detalles que pide el cliente (arcos, forja, lámina calada, puerta peatonal…), suben un %.
- El total se redondea, y nunca baja del **mínimo** de cada trabajo.

## Archivos técnicos
- `supabase/migrations/`: el SQL que se aplicó en tu proyecto (tablas, permisos, avisos).
- `supabase/functions/notify-quote/`: la función que manda las notificaciones.
- `tests/core.test.mjs`: pruebas del cálculo (`node tests/core.test.mjs`).

## Para saber
- **Proyecto en pausa:** el plan gratis de Supabase pausa el proyecto si pasa **7 días sin ninguna actividad**. Se reactiva con un clic en supabase.com. Con visitas normales en tu web no se pausa.
- **Olvidaste tu contraseña:** en `admin.html` → «¿Olvidaste tu contraseña?» (requiere el paso 3).
- **Si al crear la cuenta dice «confirma tu correo»:** avísame y la confirmo desde Supabase.
