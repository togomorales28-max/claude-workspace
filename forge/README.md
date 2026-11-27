# FORGE — Cotizaciones para talleres de herrería

Aplicación web para calcular cuánto cobrar por un trabajo de herrería, conocer los costos reales y generar cotizaciones profesionales en PDF.

Funciona **sin servidor**: todos los datos se guardan en el navegador (IndexedDB) del dispositivo. Haz respaldos desde *Configuración → Datos y respaldo*.

## Funciones

- **Panel**: cotizaciones realizadas, pendientes y aceptadas; total cotizado; ganancia estimada; trabajos recientes; lista de pasos para preparar el taller.
- **Cotizador en 8 pasos** (trabajo → medidas → materiales → mano de obra → gastos → ganancia → revisión → documento) con el precio actualizado en vivo.
- **Catálogo de materiales** con tus precios reales e historial de precios. FORGE no inventa precios: la lista de "materiales comunes" se agrega **sin precio**.
- **Estimador por medida**: si un barandal de 10 ft se cobró en $200, uno de 12 ft se estima en $240 (por longitud, por área o por pieza, con parte fija opcional). También escala una cotización guardada a otra medida (cantidades de material y horas).
- **Documento para el cliente**: PDF vectorial, impresión, envío por WhatsApp (en celular se comparte el PDF directamente), duplicar y cambiar el estado (Borrador, Enviada, Aceptada, Rechazada, Completada).
- **Clientes** con su historial de cotizaciones y trabajos realizados.
- **Configuración**: datos del taller, logotipo, mano de obra por hora, ganancia, desperdicio, imprevistos, IVA, folios, condiciones y respaldo/restauración en JSON. Incluye un modo de demostración que se puede eliminar.

## Fórmulas

```
Materiales    = Σ cantidad × precio unitario      (× piezas si "por pieza")
Desperdicio   = Materiales × % desperdicio
Consumibles   = Σ cantidad × precio unitario      (× piezas si "por pieza")
Mano de obra  = trabajadores × horas × costo/hora (× piezas si "por pieza")
Adicionales   = transporte + instalación + otros gastos
Costo directo = Materiales + Desperdicio + Consumibles + Mano de obra + Adicionales
Imprevistos   = Costo directo × % imprevistos

COSTO TOTAL     = Costo directo + Imprevistos
PRECIO DE VENTA = Costo total + Ganancia
  · Margen sobre venta:  Precio = Costo ÷ (1 − margen)
  · Recargo sobre costo: Precio = Costo × (1 + recargo)
Total = Precio de venta + IVA (opcional)
```

El precio se puede redondear hacia arriba ($10, $50, $100…) o fijar manualmente para ver el margen real.

## Desarrollo

```bash
npm install
npm run dev        # servidor de desarrollo
npm test           # pruebas de cálculos (Vitest)
npm run build      # compilación de producción en dist/
npm run preview    # servir la compilación
```

`dist/` es un sitio estático (usa `HashRouter` y rutas relativas), así que se puede publicar gratis en Netlify, Vercel, Cloudflare Pages o GitHub Pages, o abrirse desde cualquier servidor estático.

## Arquitectura

```
src/
  domain/     Tipos, constantes, cálculos puros (calc.ts, scale.ts), validación y formato. Sin dependencias de UI.
  data/       IndexedDB (Dexie), repositorios, fábrica de cotizaciones, demo y respaldo.
  lib/        Hooks de datos en vivo, PDF (jsPDF), documento del cliente, compartir, utilidades.
  components/ Sistema de UI propio (botones, campos, modales, layout).
  features/   Pantallas: dashboard, quotes, estimator, materials, clients, settings.
tests/        Pruebas de cálculos.
```

### Preparado para Supabase

- Las pantallas solo escriben mediante `src/data/repo.ts`; para sincronizar en la nube basta con implementar esos mismos repositorios contra Supabase (o agregar una cola de sincronización) sin tocar la UI.
- Todas las tablas usan IDs UUID en texto y `createdAt`/`updatedAt` en ISO, compatibles con tablas Postgres y con una resolución de conflictos de tipo "última escritura gana".
- Las cotizaciones guardan una copia del cliente y de los precios de cada material, así el historial no cambia si después se edita el catálogo.
