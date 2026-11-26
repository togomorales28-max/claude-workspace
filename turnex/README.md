# Turnex

Reservas de citas para barberías. Cada barbería tiene:

- **Panel del barbero** (`/dashboard`): citas del día, servicios, horario y su enlace.
- **Página del cliente** (`/barbero/tu-enlace`): el cliente elige servicio, día y hora y reserva **sin crear cuenta**.
- **Enlace de la cita** (`/cita/…`): el cliente la ve o la cancela.

El enlace de reservas se copia desde **Mi enlace**, junto con un botón listo para pegar en cualquier página web.

---

## Puesta en marcha (unos 20 minutos)

### 1. Base de datos en Supabase (gratis)
1. Crea una cuenta y un proyecto en <https://supabase.com>.
2. Ve a **SQL Editor**, pega el contenido de `supabase/schema.sql` y pulsa **Run**.
3. En **Authentication → URL Configuration**, pon en *Site URL* la dirección donde vivirá tu web
   (por ejemplo `https://tu-barberia.netlify.app`). Así funcionan los correos de confirmación y de “olvidé mi contraseña”.
4. En **Project Settings → API** copia la *Project URL* y la *anon public key*.

### 2. Probar en tu computadora (opcional)
```bash
cp .env.example .env      # y pega ahí la URL y la anon key
npm install
npm run dev
```

### 3. Publicar la web en Netlify (gratis)
1. Sube esta carpeta a un repositorio de GitHub.
2. En <https://app.netlify.com> → **Add new site → Import from Git** y elige el repositorio.
   Netlify lee `netlify.toml` solo (comando `npm run build`, carpeta `dist`).
3. En **Site configuration → Environment variables** añade `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
4. Publica. Entra a `/registro`, crea tu cuenta y copia tu enlace desde **Mi enlace**.

### 4. Correos automáticos (opcional)
Confirmación al reservar (al cliente si dejó su correo, y al barbero) y recordatorio unas 24 h antes.
1. Crea una cuenta en <https://resend.com> y una API key. Para enviar a cualquier correo hay que verificar
   un dominio en Resend; sin dominio solo llega a tu propio correo.
2. Instala la CLI de Supabase y despliega la función:
   ```bash
   supabase login
   supabase link --project-ref TU-PROJECT-REF
   supabase secrets set RESEND_API_KEY=re_xxx RESEND_FROM="Tu Barbería <citas@tudominio.com>" APP_URL=https://tu-barberia.netlify.app
   supabase functions deploy send-appointment-email
   ```
3. Abre `supabase/cron_correos.sql`, cambia las dos líneas marcadas con `<<<` y córrelo en el SQL Editor.
   Programa una tarea cada 15 minutos que reintenta avisos pendientes y manda los recordatorios.

---

## Cómo está hecho
- React 18 + Vite 5 + Tailwind 3 + React Router 6, íconos `lucide-react`.
- Supabase: Auth, Postgres con RLS, funciones RPC, Edge Function para correos con Resend, pg_cron.
- Detalles técnicos y reglas para cambiar el código: ver `CLAUDE.md`.

## Fuera de alcance por ahora
WhatsApp/SMS/push automáticos, pagos, varios empleados por barbería, apps nativas.
