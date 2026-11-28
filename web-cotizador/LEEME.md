# Cotizador de herrería para tu página web

- **En tu web:** el cliente elige el trabajo, escribe medidas y describe su diseño, y ve su estimado al instante. Al tocar **«Obtener mi cotización»** se abre un panel **en la misma página**, sin pestaña nueva. Ahí deja su nombre y su WhatsApp o celular y envía.
- **En tu panel (`admin.html`):** entras con tu correo. Las cotizaciones llegan **al momento**, con botones para escribirle al cliente por WhatsApp o SMS o llamarle. También cambias precios; al tocar **Guardar**, tu web se actualiza sola en segundos, incluso para quien ya la tenga abierta.

Todo se guarda en **Supabase** (gratis). Solo tu correo puede ver cotizaciones y cambiar precios.

## Archivos

| Archivo | Qué es |
|---|---|
| `cotizador.js` | El cotizador que va en tu web. También tiene todos los cálculos. |
| `config.js` | Los datos de tu proyecto de Supabase (los llenas en el paso 4). |
| `admin.html` | Tu panel de dueño. |
| `supabase.sql` | Crea las tablas y los permisos en Supabase. |
| `ejemplo.html` | Ejemplo de una página con el cotizador ya puesto. |

## Instalación (unos 10 minutos)

### 1. Crea tu proyecto en Supabase
1. Entra a **supabase.com** → *Start your project* → entra con tu cuenta de GitHub o con tu correo.
2. *New project* → ponle un nombre (por ejemplo, `herreria`), elige una contraseña para la base de datos (guárdala) y la región más cercana → *Create new project*.

### 2. Crea las tablas
1. Abre `supabase.sql` y, al final, cambia `TU_CORREO@gmail.com` por **el correo con el que vas a entrar a tu panel**.
2. En Supabase: menú izquierdo → **SQL Editor** → *New query* → pega todo el archivo → **Run**. Debe decir *Success*.

### 3. Permite el enlace de entrada a tu panel
En Supabase: **Authentication → URL Configuration**:
- **Site URL:** la dirección de tu web, por ejemplo `https://tuherreria.com`
- **Redirect URLs** → *Add URL*: `https://tuherreria.com/admin.html` (la dirección donde vas a subir `admin.html`)

### 4. Llena `config.js`
En Supabase: **Project Settings → API**. Copia:
- **Project URL** → en `supabaseUrl`
- **anon public** key → en `supabaseAnonKey`

```js
window.COTIZADOR_CONFIG = {
  supabaseUrl: 'https://abcdefghijkl.supabase.co',
  supabaseAnonKey: 'eyJhbGciOi...',
  siteUrl: 'https://tuherreria.com'
};
```
La clave *anon* es pública, está hecha para ir en páginas web, y los permisos del paso 2 protegen tus datos. **Nunca** pongas la clave *service_role*.

### 5. Sube los archivos a tu hosting
Sube `cotizador.js`, `config.js` y `admin.html` a la misma carpeta que tu página.

### 6. Pon el cotizador en tu página
Pega esto donde quieras que aparezca:
```html
<div id="cotizador-herreria" data-color="#1f6fe5"></div>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"></script>
<script src="config.js"></script>
<script src="cotizador.js"></script>
```
- `data-color` es el color de los botones; cámbialo por el de tu marca.
- El cotizador usa la letra de tu página y sus estilos no chocan con los de tu web.

### 7. Entra a tu panel
Abre `https://tuherreria.com/admin.html` → escribe tu correo → abre el enlace que te llega → listo.
1. En **Precios**, cambia los precios de ejemplo por los de tu proveedor.
2. Toca **Guardar**.

## Cómo calcula

- **Material** = pies de metal × precio por pie del proveedor, + desperdicio.
  - Los pies salen de las medidas: marco, travesaños y barrotes según la separación del estilo; en barandal, pasamanos, postes y barrotes.
- **Mano de obra:** tu ejemplo («10 × 24 lo hacen 2 personas en 1 día») se ajusta al tamaño del trabajo.
  - Va 1 persona si el trabajo cabe en un día; si no, hasta 2.
  - Cada persona cobra $40 por día, con mínimo de $40.
- **Dificultad:** el estilo, más los detalles que pide el cliente (arcos, forja, lámina calada, puerta peatonal…), suben un %.
  - Se detectan solos en la descripción del cliente, y él puede marcarlos o desmarcarlos.
- El total se redondea, y nunca baja del **mínimo** de cada trabajo.

## Probar sin Supabase
Si `config.js` está vacío, todo funciona en **modo de prueba**: los datos se guardan solo en ese navegador. Abre `ejemplo.html` y `admin.html` en el mismo navegador para ver cómo se conectan.

## Para saber
- **Proyecto en pausa:** el plan gratis de Supabase pausa el proyecto si pasa **7 días sin ninguna actividad**. Se reactiva desde supabase.com con un clic. Con visitas normales en tu web no se pausa.
- **Correos de entrada:** el correo de entrada lo manda Supabase, con un límite de pocos correos por hora. Para ti solo es suficiente.
- **WhatsApp:** el cliente también puede tocar «Escribirnos por WhatsApp» (es opcional). En el celular abre la app de WhatsApp; en computadora, WhatsApp Web.
- **Pruebas del cálculo:** `node tests/core.test.mjs`
