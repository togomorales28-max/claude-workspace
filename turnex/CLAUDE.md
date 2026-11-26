# CLAUDE.md — Turnex

Contexto del proyecto para Claude Code. Léelo antes de hacer cambios.

## Qué es

**Turnex** es una app web de reservas de citas para barberías. Cada barbero tiene
su panel privado y una página pública (`/barbero/:slug`) donde sus clientes
reservan sin crear cuenta. El cliente ve o cancela su cita en `/cita/:token`.

- Idioma de la app, del código y de los comentarios: **español** (variables y funciones
  en español; comentarios que explican el *porqué*).
- Zona horaria por defecto del negocio: `America/Hermosillo`.

## Stack

- React 18 + Vite 5 (JavaScript, sin TypeScript), React Router v6, Tailwind CSS 3, `lucide-react`
- Backend: **Supabase** (Auth + Postgres con RLS + RPC + pg_cron/pg_net)
- Correo: Resend, a través de la Edge Function `send-appointment-email`
- Despliegue: Netlify (`netlify.toml`, `public/_redirects` para la SPA)

## Comandos

```bash
npm install
npm run dev      # servidor local
npm run build    # build de producción a dist/
npm run preview
```

No hay tests ni linter configurados.

## Variables de entorno

`.env` (copia de `.env.example`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
Nunca pongas claves en el código. `src/lib/supabase.js` usa un cliente de repuesto si
faltan, para que la app muestre un aviso en vez de quedar en blanco.

Secretos de la Edge Function: `RESEND_API_KEY` (obligatorio), `RESEND_FROM`, `APP_URL`.

## Estructura

```
src/
  App.jsx                  Rutas
  layouts/DashboardLayout.jsx   Barra lateral (escritorio) / barra inferior (móvil)
  components/ProtectedRoute.jsx, PageHeader.jsx, AuthCard.jsx
  lib/
    supabase.js            Cliente + mensajeError()
    AuthContext.jsx        Sesión + perfil del barbero
    tiempoReserva.js       Fechas/horas en la zona del barbero (Intl, sin librerías)
    citasVistas.js         Marca "Nueva" en citas (localStorage, por barbero)
    formato.js, telefono.js
  pages/
    Login, Registro, RecuperarPassword, RestablecerPassword
    Dashboard (citas del día), Servicios, Horarios, EnlacePublico
    PublicBooking.jsx      Flujo público de reserva
    MiCita.jsx             Ver/cancelar cita con el token
supabase/
  schema.sql               Esquema completo e idempotente
  cron_correos.sql         Programa la Edge Function cada 15 min (editar 2 valores antes)
  functions/send-appointment-email/index.ts
  migrations/              Cambios futuros: 001_..., 002_..., idempotentes
```

## Rutas

| Ruta | Página |
|---|---|
| `/login`, `/registro`, `/recuperar-password`, `/restablecer-password` | Auth |
| `/dashboard` | Citas del día (protegido) |
| `/dashboard/servicios` | CRUD de servicios |
| `/dashboard/horarios` | Horario semanal, anticipación mínima y zona horaria |
| `/dashboard/enlace` | Enlace público, botón HTML para la web, nombre y slug |
| `/barbero/:slug` | Reserva pública |
| `/cita/:token` | El cliente ve o cancela su cita |

## Base de datos

Tablas: `profiles`, `business_hours`, `services`, `appointments` (ver `schema.sql`).

Reglas de seguridad. No las debilites:

- RLS en todas las tablas; cada barbero solo lee y escribe sus filas.
- **El público no lee ninguna tabla.** Todo pasa por RPC `security definer`:
  - `get_public_booking_data(slug)`: nombre, zona, anticipación, horarios y servicios activos. Nunca teléfono ni correo.
  - `get_booked_slots(user_id, fecha)`: solo `start_time` y `end_time` ocupados.
  - `book_appointment(...)`: crea la cita. Calcula `end_time` en el servidor y valida servicio,
    teléfono, horario de trabajo, pasado/anticipación (con `now()` en la zona del barbero) y
    máximo 90 días. Error de horario: "Este horario ya no está disponible…" (el front detecta
    "ya no está disponible").
  - `get_appointment_by_token` / `cancel_appointment_by_token`: cancelar hasta la hora de inicio.
- Restricción `appointments_sin_traslape` (`EXCLUDE USING gist` con `tsrange`, requiere
  `btree_gist`): impide citas encimadas de cualquier duración; ignora las canceladas (código 23P01).
- `price` NULL = sin precio fijo; nunca 0 (check).
- Control de correos: `_claimed_at` es un bloqueo temporal (UPDATE atómico, caduca a los 10 min);
  `_sent_at` solo se llena cuando Resend confirma.

Cambios de esquema: nueva migración numerada en `supabase/migrations/` (idempotente,
sin borrar datos) y reflejarla también en `schema.sql`.

## Convenciones

- Disponibilidad siempre en la zona del barbero (`tiempoReserva.js`), nunca la del navegador.
- Validaciones del navegador = solo UX. La validación real vive en Postgres.
- Componentes funcionales con hooks; llamadas a Supabase directo en las páginas.
- Estilos solo con clases de Tailwind (componentes base en `src/index.css`).
