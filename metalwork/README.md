# Metalwork Calculator

Sistema de cálculo, optimización de cortes y presupuestos para talleres de herrería. Funciona en español y en pesos mexicanos (MXN).

Es una aplicación web instalable (PWA) que funciona en Android, tablets y computadoras, también **sin internet** después de la primera visita. Los datos se guardan en el dispositivo y se conservan al cerrar la aplicación.

## Módulos

| Módulo | Qué hace |
|---|---|
| **Panel** | Cotizaciones, material calculado, desperdicio, ganancia estimada, últimos proyectos y accesos rápidos. |
| **Optimizador de cortes** | Distribuye piezas en barras comerciales considerando el **ancho de corte (kerf)**, el despunte y los retazos en inventario. Indica cuántas barras comprar, el diagrama a escala de cada barra, el sobrante, el aprovechamiento y el desperdicio en m, kg y $. Exporta la lista de cortes en PDF y CSV. |
| **Peso y material** | Peso por metro, por pieza y total; área de sección; barras necesarias; costo por pieza y total. Medidas en mm o pulgadas, espesor en mm, pulgadas o calibre. Muestra un corte transversal a escala. |
| **Presupuestos** | Materiales, desperdicio, mano de obra, consumibles de soldadura, discos, pintura, transporte y otros gastos, más utilidad, redondeo e IVA. Muestra costo real, ganancia, margen y precio final. Genera la cotización en PDF. |
| **Catálogo y precios** | Materiales con perfil, medidas, longitud comercial, precio por barra o por kg, proveedor y fecha del precio. **No incluye precios inventados**: el taller los captura. |
| **Clientes** | Datos de contacto e historial de presupuestos. |
| **Configuración** | Datos y logotipo del taller, valores predeterminados, densidades, folios, respaldo y restauración. |

Perfiles: PTR cuadrado y rectangular, tubo redondo, ángulo, solera, barra maciza (redonda, cuadrada, hexagonal), canal U, viga I/IPR, placa/lámina y perfil personalizado (kg/m del fabricante).

## Uso

```bash
cd metalwork
npm install
npm run dev        # desarrollo en http://localhost:5173
npm test           # pruebas del dominio y almacenamiento
npm run build      # versión de producción en dist/ (sitio estático)
```

`dist/` se publica en cualquier hosting estático (GitHub Pages, Netlify, Cloudflare Pages, Vercel). Para instalarla en Android, abre la dirección en Chrome y elige **Instalar app** o **Agregar a la pantalla principal**.

## Arquitectura

```
src/
  domain/      Cálculos puros, sin interfaz y con pruebas
    profiles.ts   Geometría de secciones, peso lineal, placas, calibres
    cutting.ts    Optimizador de cortes 1D con kerf
    budget.ts     Presupuesto, utilidad, IVA, reparto por partida
    parse.ts      Captura rápida de medidas ("1200 x 4; 47 1/4\"")
  data/        Persistencia
    types.ts      Entidades (id, createdAt, updatedAt en todas)
    repo.ts       Interfaz Repository<T> + implementación IndexedDB (Dexie)
    backup.ts     Respaldo/restauración JSON transaccional
  lib/         Integración entre módulos (plan de corte → presupuesto, PDF, CSV)
  features/    Pantallas: dashboard, cutter, weight, quotes, catalog, clients, settings
  components/  UI propia: paneles, campos numéricos, diagramas de barra y de sección
```

- **Sincronización futura:** las pantallas solo usan la interfaz `Repository<T>`, y cada registro lleva `updatedAt`. Para agregar una base de datos en la nube basta con implementar esa interfaz y resolver conflictos con «la última escritura gana». La interfaz de usuario no cambia.
- **Sin pérdida de datos:** los editores guardan automáticamente 500 ms después de cada cambio, al salir de la pantalla y al ocultar la aplicación. La app pide al navegador almacenamiento persistente, y la restauración de respaldos es atómica: si falla, no se borra nada.

## Optimizador de cortes

Modelo físico de cada barra de longitud `L`, con kerf `k` y despunte `T`:

```
inicio = T + k   (si hay despunte; si no, 0)
restricción:  inicio + Σ piezas + (n − 1)·k  ≤  L
resto r = L − inicio − Σ piezas − (n − 1)·k
  r = 0      → sin corte final
  0 < r ≤ k  → el corte final se come el resto
  r > k      → sobrante útil = r − k
```

Toda la aritmética se hace en enteros de 0.01 mm. Se calculan varias estrategias y se elige la mejor (menos material comprado, luego menos barras, luego el sobrante más grande):

1. **Llenado óptimo por barra:** mochila acotada por programación dinámica, que deja el menor resto posible en cada barra. Repite patrones idénticos.
2. **First Fit Decreasing** y **Best Fit Decreasing**.
3. **Mejora local:** intenta vaciar la barra menos aprovechada repartiendo sus piezas en las demás.
4. **Búsqueda exacta** (ramificación y acotamiento con límite de nodos) cuando no se alcanzó la cota inferior.

Si se alcanza la cota inferior, o si la búsqueda exacta termina por completo, la app muestra **«Mínimo de barras comprobado»**. Las pruebas comparan contra una búsqueda exhaustiva en 1,000 casos aleatorios y verifican de forma independiente que ningún corte exceda la barra ni invada el kerf.

## Fórmulas de peso

```
Peso lineal (kg/m) = Área de sección (mm²) × 10⁻⁶ × densidad (kg/m³)

PTR cuadrado      A = a² − (a − 2t)²            − (4 − π)(r² − (r − t)²)  si hay radio r
PTR rectangular   A = a·b − (a − 2t)(b − 2t)    − corrección por radio
Tubo redondo      A = π/4 · (D² − (D − 2t)²)
Ángulo            A = t · (a + b − t)
Solera            A = a · t
Barra redonda     A = π/4 · D²
Barra cuadrada    A = a²
Barra hexagonal   A = (√3 / 2) · s²     (s = entre caras)
Canal U           A = H·tw + 2·(B − tw)·tf
Viga I            A = 2·B·tf + (H − 2·tf)·tw
Placa             Peso = ancho × largo × espesor (m) × densidad
```

Densidades predeterminadas (editables): acero al carbono 7,850; inoxidable 8,000; aluminio 2,700; galvanizado 7,850; cobre 8,960; latón 8,500 kg/m³.

## Presupuesto

```
Materiales     = Σ cantidad × precio unitario
Desperdicio    = Σ (líneas con «+ desperdicio») × % desperdicio
                 (las barras del optimizador ya incluyen su sobrante: no se cobra doble)
Mano de obra   = Σ personas × horas × $/hora   (o importe fijo)
Gastos         = soldadura + discos + pintura + transporte + otros
COSTO REAL     = Materiales + Desperdicio + Mano de obra + Gastos
Utilidad       = Costo × %                    (sobre el costo)
              o  Precio = Costo ÷ (1 − %)       (margen sobre venta)
Subtotal       = Costo + Utilidad (+ redondeo hacia arriba, que se suma a la utilidad)
PRECIO FINAL   = Subtotal + IVA (opcional)
Margen         = Utilidad ÷ Subtotal
```

En el PDF, el cliente ve **solo conceptos y total**, o el **precio por partida**. En el segundo caso la utilidad se reparte de forma proporcional y las partidas suman exactamente el subtotal.
