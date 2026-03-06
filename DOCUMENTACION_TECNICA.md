# Documentación Técnica — Inventary

> **Propósito:** Este documento cubre la arquitectura, decisiones de diseño, lógica crítica, análisis de puntos débiles y mapa de dependencias del proyecto Inventary. Te permite defender cada decisión como si las hubieras tomado desde cero.

---

## 1. Arquitectura de Alto Nivel

### Stack Tecnológico
- **Framework:** Next.js 15 (App Router)
- **Runtime:** React 19
- **Lenguaje:** TypeScript 5
- **Estilos:** CSS Modules (zero runtime, scoping automático)
- **Componentes UI:** lucide-react (iconos tree-shakeable)
- **Persistencia:** localStorage (sin backend, sin BBDD)

### Diagrama de Flujo de Datos
```
┌─────────────────────────────────────────────────────────┐
│ localStorage ('inventoryItems')                         │
│ + mock-data.ts (seed data inicial)                      │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ↕ (hidratación en useEffect)
                       │
┌──────────────────────┴──────────────────────────────────┐
│ useInventory.ts                                         │
│ ├─ addProduct(data)                                     │
│ ├─ updateProduct(id, patch)                             │
│ ├─ deleteProduct(id)                                    │
│ ├─ replaceAll(items) ← CSV import                       │
│ └─ findByQrCode(code) ← QR scanner                       │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ↓
        InventoryView.tsx ('use client')
        │ Orquestador central
        │
        ├─→ TanStack Table
        │   ├─ Filtrado global (nombre, descripción, QR)
        │   ├─ Filtrado por categoría (multi-select)
        │   └─ Sorting por stock
        │   → getRowModel().rows → InventoryList
        │
        ├─→ SearchBar + Filter/Sort Sheet
        ├─→ InventoryList → InventoryCard (render)
        ├─→ ProductFormModal (CRUD)
        ├─→ ProductDetailModal (lectura + QR visual)
        ├─→ QrScannerModal (cámara del dispositivo)
        └─→ CsvPreviewModal (vista previa de importación)

┌─────────────────────────────────────────────────────────┐
│ useCsvImport.ts                                         │
│ ├─ parse(file, category?)                               │
│ │  └─ PapaParse + csv-parser.ts                         │
│ │     └─ html5-qrcode (decodificador QR)                │
│ ├─ confirm() → replaceAll()                             │
│ └─ reset()                                              │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ useToast.ts (Context)                                   │
│ └─ toast(message, type?) → Toast.tsx                    │
└─────────────────────────────────────────────────────────┘
```

### Capas del Proyecto

| Capa | Archivos | Responsabilidad |
|------|----------|-----------------|
| **lib/** | types.ts, validation.ts, csv-parser.ts, url-utils.ts, mock-data.ts | Lógica pura: tipos, validación, parsing, transformación de datos |
| **hooks/** | useInventory.ts, useCsvImport.ts, useToast.ts | Estado reactivo, persistencia, efectos secundarios |
| **components/** | layout/, inventory/, ui/ | Presentación y UI |
| **app/** | layout.tsx, page.tsx, globals.css | Entry points Next.js, proveedores (ToastProvider, AppLayout), reset CSS + design tokens |

### Principios Arquitectónicos

1. **Unidireccional:** localStorage → hook → componentes (no state bubbling inverso)
2. **Headless:** TanStack Table proporciona lógica, componentes proveen render
3. **Composición sobre herencia:** modales y pantallas son composiciones de primitivos UI
4. **Separación de concerns:** lib = datos/lógica, hooks = estado, components = UI
5. **No-backend:** localStorage es la fuente de verdad; no hay API routes ni server actions

---

## 2. Diccionario de Decisiones Técnicas

### ¿Por qué elegimos esto y no aquello?

| Decisión | Elegimos | Razonamiento | Alternativa rechazada |
|----------|----------|-------------|----------------------|
| **Framework principal** | Next.js 15 | <ul><li>Scaffolding moderno con TypeScript integrado</li><li>Turbopack: bundler ultrarrápido en dev</li><li>Server Components por defecto (SSR future-proof)</li><li>next/image para optimización automática</li><li>Preparado para API routes si se necesita backend futuro</li></ul> | <ul><li>**Vite/React + React Router:** más ligero pero sin SSR, sin image optimization, sin build integrado</li><li>**Create React App:** deprecated en favor de Next.js</li><li>**Remix:** exceso de funcionalidad para case use offline-first</li></ul> |
| **Estilos** | CSS Modules | <ul><li>Zero runtime overhead: el CSS se aplica en build time</li><li>Scoping automático: no hay colisiones de clases</li><li>Type-safe en TypeScript (tipos de imports)</li><li>Legible: correspondencia 1:1 componente ↔ archivo .module.css</li><li>Portable: cada componente lleva su CSS</li></ul> | <ul><li>**Tailwind:** acoplamiento markup-diseño; clases utilitarias polución HTML; requiere JIT compiler en runtime</li><li>**styled-components:** overhead de runtime (JS in JS); inyección de estilos por componente</li><li>**SASS global:** sin scoping automático; colisiones de nombres inevitable</li></ul> |
| **Tabla de datos** | @tanstack/react-table v8 (headless) | <ul><li>Separa lógica de datos (filtrado, sorting) de presentación</li><li>Headless: renderizo lo que quiero (InventoryCard, no <table>)</li><li>Maduro: maneja edge cases (tipos genéricos, múltiples filtros simultáneos)</li><li>Escalable: cuando la lógica crece, no reescribo render</li></ul> | <ul><li>**MUI DataGrid o AG Grid:** estilos y HTML impuestos, overhead visual, API compleja</li><li>**Array.filter/map manual:** frágil cuando crecen filtros; no hay deduplicación de lógica</li><li>**React Table v7:** versión anterior, menos optimizado</li></ul> |
| **Persistencia** | localStorage | <ul><li>Suficiente para PYME pequeña local</li><li>Funciona offline: no necesita red</li><li>Zero configuración: es nativo del navegador</li><li>Debug fácil: inspeccionable en DevTools</li><li>Migrations puntuales: no requiere versionado de schema</li></ul> | <ul><li>**Firestore/Supabase:** overkill para local-first; requiere auth, backend, internet siempre</li><li>**IndexedDB:** API más compleja; overkill para este volumen de datos</li><li>**PostgreSQL + API REST:** requiere hosting, auth, CORS, versionado de API</li></ul> |
| **Parser CSV** | PapaParse v5 | <ul><li>Estándar de facto para CSV en JS</li><li>Robusto: maneja comillas anidadas, encoding Unicode, headers con espacios</li><li>beforeFirstChunk: hook para skipear metadata arriba del header real</li><li>Streaming: puede procesar archivos grandes sin memory spike</li><li>Bien testeado: proyecto maduro con miles de usuarios</li></ul> | <ul><li>**Fast-csv:** más ligero pero menos tolerante con CSVs malformados</li><li>**d3-dsv:** CSS/data-specific; no es un parser de propósito general</li><li>**Implementación manual (split, regex):** break con CSVs reales del mundo (espacios, comillas, encoding)</li></ul> |
| **QR Code (lectura)** | html5-qrcode v2 | <ul><li>Acceso directo a cámara vía MediaDevices API</li><li>Funciona offline: decodificación en el cliente</li><li>Múltiples formatos: QR + 1D barcodes (Code39, EAN, etc.)</li><li>Sin dependencias del SO: webbrowser nativo</li></ul> | <ul><li>**jsQR:** requiere captura manual de frames; control bajo</li><li>**ZXing-js:** más pesado (~200KB vs ~50KB); más formatos innecesarios</li><li>**Barcode Scanner app externa:** requiere app nativa instalada</li></ul> |
| **QR Code (generación)** | qrcode.react v4 | <ul><li>Renderiza SVG puro: escalable, accesible</li><li>React-native: no canvas, no browser APIs raras</li><li>Cero dependencias extra: minimal overhead</li><li>Printable: SVG se imprime perfectamente</li></ul> | <ul><li>**node-qrcode:** genera PNG/Canvas; más pesado; no React-first</li><li>**qr-code-styling:** sobredimensionado para logos + colores custom</li></ul> |
| **Iconografía** | lucide-react v0.474 | <ul><li>Tree-shakeable: importas `Icon` directamente, solo ese SVG se bundlea</li><li>Consistencia: diseño minimalista, stroke 2px uniforme</li><li>Size prop: tamaño configurable en cada uso (18, 24, 32px típico)</li><li>Accesible: SVG semántico, no obstruye lectores de pantalla</li></ul> | <ul><li>**react-icons:** agrupa por librería (FontAwesome, Bootstrap, etc.); bundlea múltiples sets innecesarios</li><li>**Font icons (icomoon):** font loading latency; fallbacks feos</li><li>**CSS sprites:** maintenance burden; difícil de colorear dinámicamente</li></ul> |
| **Derived state: StockStatus** | Computada en render (no almacenada) | <ul><li>Fuente de verdad única: `stock` y `reorderPoint`</li><li>Sincronización automática: si `stock` cambia, `status` refleja sin lógica extra</li><li>No hay inconsistencias: imposible que `stock=5` y `status=out-of-stock`</li><li>Derivación simple: `stock <= reorderPoint ? 'low-stock' : 'in-stock'`</li></ul> | <ul><li>**Guardar `status` en objeto:** duplica información, posible desynch post-actualización</li><li>**Context global:** overkill; mejor computar on-demand</li></ul> |
| **html5-qrcode: importación dinámica** | `dynamic(() => import(...))` | <ul><li>html5-qrcode usa `window` y APIs de cámara (MediaDevices)</li><li>Next.js ejecuta SSR en Node.js donde no hay `window`</li><li>Importación estática causaría: `ReferenceError: window is not defined` en build</li><li>dynamic + ssr: false asegura que el módulo solo se carga en el cliente</li></ul> | <ul><li>**Importación estática:** crash en `next build`</li><li>**try/catch manual:** sucio; mejor dejar que Next.js lo maneje</li></ul> |
| **Modo de componentes** | Server Components por defecto, `'use client'` selectivamente | <ul><li>Reducción de JS: funciones que no necesitan evento/state quedan en servidor</li><li>Server Components: `AppLayout`, `Header`, `InventoryList` no necesitan hooks</li><li>`'use client'` solo en: InventoryView (tabla, modales, estado), SearchBar, Toast</li><li>Mejor perf: menos code que descarga el navegador</li></ul> | <ul><li>**Todo `'use client'`:** bundles JS innecesarios</li><li>**Todo Server Component:** no puedo usar hooks ni state</li></ul> |
| **CSV: reemplazar vs mergear** | Reemplazar (replaceAll) | <ul><li>Simplicidad: el CSV que ves es lo que queda</li><li>Predecibilidad: no hay lógica de resolución de conflictos</li><li>Menos errores: sin estrategias como "ID única", "última escritura gana", etc.</li></ul> | <ul><li>**Mergear:** requeriría identificador único (¿ID? ¿nombre?), estrategia de actualización (¿sobrescribir? ¿ignorar duplicados?), testing de edge cases</li></ul> |

---

## 3. Anatomía del Código — Funciones Críticas

### 3.1. `useInventory.ts` — Hydration Guard

**Ubicación:** `src/hooks/useInventory.ts`

**Código relevante:**
```typescript
const [items, setItems] = useState<InventoryItem[]>(mockInventoryItems);
const [hydrated, setHydrated] = useState(false);

useEffect(() => {
  const stored = localStorage.getItem('inventoryItems');
  if (stored) {
    try {
      setItems(JSON.parse(stored));
    } catch (e) {
      console.error('Failed to parse inventory from localStorage', e);
    }
  }
  setHydrated(true);
}, []);

useEffect(() => {
  if (hydrated) {
    localStorage.setItem('inventoryItems', JSON.stringify(items));
  }
}, [items, hydrated]);
```

**Razonamiento:**

React 19 en Next.js ejecuta dos fases:
1. **Server-side rendering (SSR):** Node.js genera el HTML inicial. No hay `localStorage` disponible — es un concepto del navegador.
2. **Client-side hydration:** El navegador descarga el bundle JS y "hidrata" el árbol de componentes, atachando event listeners.

Si implementáramos así (❌ **INCORRECTO**):
```typescript
const storedData = localStorage.getItem('inventoryItems'); // ← falla en SSR
const [items] = useState(storedData ? JSON.parse(storedData) : mockInventoryItems);
```

Ocurriría:
- En SSR: `localStorage` es undefined → error o fallback a `mockInventoryItems`
- En hydration: `localStorage` tiene datos reales → se renderiza con datos reales
- **Resultado:** Mismatch entre HTML renderizado en servidor y el que espera el cliente → hydration error + flash de contenido

**Solución:** El patrón de "hydration guard"
- Estado inicial (`mockInventoryItems`) es seguro de renderizar en ambos lados
- `useEffect` corre SOLO en cliente (post-hidratación)
- Flag `hydrated` asegura que localStorage persists DESPUÉS de que el cliente ha tomado el control
- Segunda lectura de localStorage (en el efecto) es cliente-only

**Implicaciones:**
- Primer render: lista con mock data
- Después de montar: se carga desde localStorage si existe
- Usuario no ve flash (mock data es presentable)
- Sincronización automática: cada cambio en `items` persiste a localStorage (si `hydrated`)

---

### 3.2. `csv-parser.ts` — Hook `beforeFirstChunk`

**Ubicación:** `src/lib/csv-parser.ts`

**Código relevante:**
```typescript
const parseRows = (rows: any[], category?: string) => {
  const format = detectFormat(Object.keys(rows[0] || {}));
  // ...
};

const parseFile = async (file: File, category?: string) => {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      beforeFirstChunk: (chunk) => {
        const lines = chunk.split('\n');
        // Busca la primera línea que contiene 'Nombre' o 'Producto'
        const headerIndex = lines.findIndex((line) =>
          line.includes('Nombre') || line.includes('Producto')
        );
        // Si encontró el header real encima, descarta todo antes
        if (headerIndex > 0) {
          return lines.slice(headerIndex).join('\n');
        }
        return chunk;
      },
      transformHeader: (h) => h.trim(), // Elimina espacios en nombres de columnas
      complete: (results) => {
        const parsed = parseRows(results.data, category);
        resolve(parsed);
      },
    });
  });
};
```

**Razonamiento:**

Los CSVs en el mundo real (especialmente los exportados de Excel, Google Sheets o ERP sistemas) tienen **metadata arriba del header real:**

```csv
Inventario - Reporte del 2026-03-01
Exportado por: Admin
---

Nombre,Cantidad,Precio de compra,Precio de venta,Foto,Ficha tecnica
Relay 4ch,15,8.50,12.00,url,url
DHT22,32,3.20,5.50,url,url
```

**Problema:** PapaParse es agnóstico a este formato — si no le especificamos dónde está el header, parsea la primera línea (`Inventario - Reporte...`) como si fuese el header real.

**Solución:** El hook `beforeFirstChunk` te permite interceptar el texto crudo **antes de que PapaParse lo pase**. Aquí:
- Dividimos por newlines
- Buscamos la primera línea que contiene las keywords `'Nombre'` o `'Producto'`
- Si está en índice > 0, descartamos todo lo anterior
- Retornamos las líneas limpias

**Bonus:** `transformHeader` elimina espacios en blanco alrededor de los nombres de columnas. Así `' Nombre '` se normaliza a `'Nombre'`.

**Edge cases manejados:**
- CSV ya tiene header en línea 0 → no hace nada (headerIndex === 0)
- CSV con múltiples secciones → captura el PRIMER header encontrado
- Espacios/tabulaciones en headers → `transformHeader` los limpia

---

### 3.3. `InventoryView.tsx` — TanStack Table Headless

**Ubicación:** `src/components/inventory/InventoryView.tsx`

**Código relevante:**
```typescript
'use client';

const [globalFilter, setGlobalFilter] = useState('');
const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
const [sorting, setSorting] = useState<SortingState>([]);

// Definición de columnas (meta, no HTML)
const columns: ColumnDef<InventoryItem>[] = [
  {
    accessorKey: 'name',
    header: 'Nombre',
    enableGlobalFilter: true,
    enableColumnFilter: false,
  },
  {
    accessorKey: 'description',
    enableGlobalFilter: true,
  },
  {
    accessorKey: 'qrCode',
    enableGlobalFilter: true,
  },
  {
    accessorKey: 'category',
    header: 'Categoría',
    filterFn: 'categoryFilter', // Custom filter function
    enableGlobalFilter: false,
  },
  {
    accessorKey: 'stock',
    header: 'Stock',
    enableSorting: true,
    enableGlobalFilter: false,
  },
];

// Instancia de tabla
const table = useReactTable({
  data: items,
  columns,
  state: {
    globalFilter,
    columnFilters,
    sorting,
  },
  filterFns: {
    categoryFilter: (row, columnId, filterValue: string[]) => {
      return filterValue.length === 0 || filterValue.includes(row.getValue(columnId));
    },
  },
  globalFilterFn: (row, columnId, filterValue) => {
    const text = String(row.original.name + ' ' + row.original.description + ' ' + row.original.qrCode);
    return text.toLowerCase().includes(filterValue.toLowerCase());
  },
  onGlobalFilterChange: setGlobalFilter,
  onColumnFiltersChange: setColumnFilters,
  onSortingChange: setSorting,
  getCoreRowModel: getCoreRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getSortedRowModel: getSortedRowModel(),
});

// Extrae el array plano de items filtrados/ordenados
const visibleItems = table.getRowModel().rows.map((row) => row.original);

// Render
return (
  <>
    <SearchBar value={globalFilter} onChange={setGlobalFilter} />
    <InventoryList items={visibleItems} onCardClick={handleCardClick} />
  </>
);
```

**Razonamiento:**

TanStack Table es un **motor de datos headless** — no renderiza HTML, solo gestiona filtrado, sorting y selección.

**Por qué es superior a hacer Array.filter() manual:**

❌ **Enfoque naive:**
```typescript
let filtered = items.filter(item => item.name.includes(search));
filtered = filtered.filter(item => selectedCategories.includes(item.category));
let sorted = filtered.sort((a, b) => a.stock - b.stock);
```

**Problemas:**
- Cada cambio de estado requiere recalcular el array completo
- Múltiples filtros = múltiples iteraciones (ineficiente)
- Si agregamos paginación después, los índices de página se rompen
- Sin mecanismo de deduplicación de cálculos

✅ **Enfoque con TanStack Table:**
```typescript
const table = useReactTable({
  data: items,
  state: { globalFilter, columnFilters, sorting },
  getCoreRowModel: getCoreRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getSortedRowModel: getSortedRowModel(),
});

const visibleItems = table.getRowModel().rows.map(r => r.original);
```

**Ventajas:**
- Composición de transformaciones: Core → Filtered → Sorted
- Memoization automática: TanStack Table cacheea resultados
- Escalable: añadir paginación es `.getPaginationRowModel()`
- Type-safe: todos los accesores tipados con TypeScript
- Testeable: `table` es un objeto predecible

**¿Por qué usamos `table.getRowModel()` en lugar de renderizar una `<table>`?**

Porque necesitamos una lista vertical de cards (InventoryCard), no una tabla HTML clásica:
```
┌─────────────────────────────┐
│ [IMG] Name                  │  ← InventoryCard
│       Description           │
└─────────────────────────────┘
┌─────────────────────────────┐
│ [IMG] Name                  │  ← Otra InventoryCard
│       Description           │
└─────────────────────────────┘
```

TanStack Table se adapta a cualquier layout porque es headless — nosotros extraemos `visibleItems` y los renderizamos como queremos.

---

### 3.4. `url-utils.ts` — `sanitizeDriveUrl`

**Ubicación:** `src/lib/url-utils.ts`

**Código relevante:**
```typescript
export const sanitizeDriveUrl = (url: string): string => {
  if (!url) return url;

  // Patrón 1: /file/d/{ID}/view?...
  const fileMatch = url.match(/\/file\/d\/([^/]+)\//);

  // Patrón 2: ?id={ID} or &id={ID}
  const openMatch = url.match(/[?&]id=([^&]+)/);

  const id = fileMatch?.[1] ?? openMatch?.[1];

  if (id) {
    return `https://drive.google.com/uc?export=view&id=${id}`;
  }

  // Si no es URL de Google Drive, devuelve sin cambios
  return url;
};
```

**Razonamiento:**

Google Drive genera dos tipos principales de URLs compartidas:

```
Tipo 1: https://drive.google.com/file/d/ABC123XYZ/view?usp=sharing
Tipo 2: https://drive.google.com/open?id=ABC123XYZ
```

Cuando intentas usar estas URLs directamente en un `<img src>` o `<a href>`:
```html
<img src="https://drive.google.com/file/d/ABC123/view?..." />
```

**Qué ocurre:** Google Drive retorna una **página HTML** (con login, viewer, etc.), no el binario del archivo.

**Solución:** Google Drive ofrece un endpoint de descarga directo:
```
https://drive.google.com/uc?export=view&id={ID}
```

Este endpoint retorna el binario directamente (imagen, PDF, etc.) sin interfaz.

**Extracción del ID:**
- Regex 1 captura `/file/d/(.+?)/` → grupo 1 es el ID
- Regex 2 captura `?id=X` o `&id=X` → grupo 1 es el ID
- Si ninguna coincide, retorna la URL sin cambios (YouTube, HTTPS plano, etc.)

**Aplicación en el código:**
- **ProductFormModal:** OnBlur de `techSheetUrl`, invoca `sanitizeDriveUrl` antes de persistir
- **csv-parser.ts:** Cuando parsea columna `Ficha tecnica` (Google Drive URL), sanitiza automáticamente

**Edge cases:**
- URL vacía → retorna como está
- URL de YouTube → no coincide regex, retorna sin cambios
- URL de Drive sin ID válido → retorna sin cambios (graceful degradation)

---

### 3.5. `QrScannerModal.tsx` — Semáforo `resolvedRef`

**Ubicación:** `src/components/inventory/QrScannerModal.tsx`

**Código relevante:**
```typescript
'use client';

const QrScannerModal = ({ isOpen, onFound, onNotFound, onClose }) => {
  const [scanner, setScanner] = useState<Html5Qrcode | null>(null);
  const resolvedRef = useRef(false); // ← Semáforo

  useEffect(() => {
    if (!isOpen) return;

    const initScanner = async () => {
      try {
        const html5QrCode = new Html5Qrcode('qr-reader');

        await html5QrCode.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: 250 },
          (decodedText) => {
            // Este callback se dispara múltiples veces por segundo
            if (resolvedRef.current) return; // ← Protección
            resolvedRef.current = true; // ← Marcar como procesado

            const product = products.find((p) => p.qrCode === decodedText);
            if (product) {
              onFound(product);
            } else {
              onNotFound(decodedText);
            }
          }
        );

        setScanner(html5QrCode);
      } catch (err) {
        console.error('Failed to start QR scanner', err);
        onClose();
      }
    };

    initScanner();

    return () => {
      if (scanner) {
        scanner.stop();
      }
    };
  }, [isOpen]);

  // Resetea el semáforo cuando se cierra la modal
  useEffect(() => {
    if (!isOpen) {
      resolvedRef.current = false;
    }
  }, [isOpen]);

  return (
    <div id="qr-reader" />
  );
};
```

**Razonamiento:**

`html5-qrcode` usa la cámara para capturar frames continuamente (10 FPS por defecto). En cada frame, intenta decodificar un QR code y, si lo encuentra, invoca el callback.

**El problema:**

Si el usuario apunta la cámara a un QR code visible:
- Frame 1: detecta el código → callback se dispara
- Frame 2: aún ve el mismo código → callback se dispara OTRA VEZ
- Frame 3-10: sigue viendo → callback se dispara 8 veces más

En código naive sin protección:
```typescript
const decodedText = (code) => {
  const product = findProduct(code); // ← búsqueda costosa
  onFound(product); // ← modal se cierra
  onFound(product); // ← se dispara OTRA VEZ (¡error!)
};
```

Esto causaría:
- Múltiples llamadas a `onFound` antes de que React pueda reaccionar
- Posible race condition: ¿cierro la modal antes del segundo `onFound`?
- State inconsistente

**Solución: Semáforo con useRef**

```typescript
const resolvedRef = useRef(false);

if (resolvedRef.current) return; // Ya procesé este código
resolvedRef.current = true; // Marca como procesado
onFound(product); // Procesa solo una vez
```

**¿Por qué useRef y no useState?**

- `useState` causaría re-render cuando se actualiza el flag, lo que podría disparar el efecto de nuevo
- `useRef` es una referencia mutable que NO causa re-render — es invisible a React
- Semáforo puro: solo queremos marcar "este callback ya fue procesado", sin cambiar la UI

**Reinicio del semáforo:**

Cuando la modal se cierra (`isOpen = false`), el segundo `useEffect` resetea el semáforo:
```typescript
useEffect(() => {
  if (!isOpen) {
    resolvedRef.current = false;
  }
}, [isOpen]);
```

Así cuando se vuelve a abrir la modal, el semáforo está limpio para el próximo QR.

---

## 4. Guía de Debate — Preguntas Difíciles y Respuestas

### P1: ¿Por qué guardas todo en localStorage y no en una base de datos?

**R:** El requisito actual es un inventario local para una PYME pequeña sin acceso multi-usuario ni sincronización en la nube. localStorage es suficiente, funciona offline 100%, y elimina la complejidad de:
- Autenticación de usuarios
- Hosting de backend (Heroku, Railway, AWS Lambda)
- Gestión de BBDD (PostgreSQL, MongoDB, schema migrations)
- CORS y rate limiting
- Versionado de API

**¿Pero qué si escalamos?** La arquitectura está preparada para migración:
```typescript
// Actualmente:
localStorage.getItem('inventoryItems') // ← Una línea

// Futuro:
const response = await fetch('/api/inventory');
return response.json();
```

Solo necesito cambiar `useInventory.ts` — el resto del código no se entera. El patrón de "custom hook como puerta de abstracción" permite el cambio sin reescribir componentes.

**Trade-off consciente:** Sí, el usuario pierde datos si borra localStorage. Por eso existe la función de exportar CSV — es el mecanismo de backup. En v2, consideraría exportación automática cada noche o sincronización de Cloud Storage.

---

### P2: ¿Qué pasa si el usuario limpia el localStorage o usa "Borrar datos del sitio"?

**R:** Se pierden todos los datos. Ese es el riesgo calculado de esta arquitectura offline-first.

**Mitigación actual:**
- CSV export: el usuario puede guardar un backup en cualquier momento
- El código mantiene una referencia a `mockInventoryItems` — podría implementar un "Restore defaults" button

**Mejora futura:**
- Detección de localStorage vaciado → mostrar toast "¿Deseas restaurar desde el último backup?"
- Sincronización con iCloud/Google Drive (requeriría OAuth)
- Service Worker con IndexedDB + sincronización

---

### P3: ¿Por qué usas Next.js si todo es client-side y no tienes rutas?

**R:** Porque Next.js nos proporciona:

1. **Turbopack en dev:** El bundler es 10-100x más rápido que Webpack/Vite en cambios iterativos
2. **TypeScript integrado:** Sin configurar `tsconfig`, `babel`, linters — out-of-the-box
3. **next/image:** Optimización automática de imágenes (responsive, lazy loading, formato WebP)
4. **Preparación para futuro:** Si mañana necesitamos un `/api/export` para generar CSVs servidor-side o añadir autenticación, no reescribimos el proyecto — solo añadimos rutas
5. **Ecosistema:** Auth0, Stripe, Google OAuth se integran naturalmente en Next.js

**¿Y si uso Vite?** Más ligero, sí, pero:
- Configurar TypeScript, ESLint, imagen optimization manual
- Si escalamos a backend después, migraría a Express o Hono + Vite → arquitectura desincronizada
- Next.js es "el todo de una pieza" — menor riesgo técnico

---

### P4: ¿No es TanStack Table excesivo para una lista simple?

**R:** A primera vista, sí. Pero la lógica actual requiere:
1. Búsqueda global por nombre, descripción, QR code
2. Filtrado multi-select por categoría
3. Sorting por stock (ascendente/descendente)

Implementar esto manualmente:
```typescript
let filtered = items.filter(item =>
  item.name.toLowerCase().includes(search) ||
  item.description.toLowerCase().includes(search) ||
  item.qrCode.toLowerCase().includes(search)
);
if (selectedCategories.length > 0) {
  filtered = filtered.filter(item => selectedCategories.includes(item.category));
}
let sorted = [...filtered];
if (sortBy === 'stock-asc') {
  sorted.sort((a, b) => a.stock - b.stock);
} else if (sortBy === 'stock-desc') {
  sorted.sort((a, b) => b.stock - a.stock);
}
```

**Problemas:**
- Cada re-render ejecuta los filtros de nuevo (sin memoization)
- Si añado paginación, los índices se rompen
- Si añado columnas filtrable, duplico la lógica
- Testing: sin estructura, es difícil testear cada filtro aisladamente

**Con TanStack Table:**
- Cada transformación es composable y memoized
- Paginación: `getPaginationRowModel()` en una línea
- Nuevo filtro: defino una columna nueva y done
- Testing: `table.getState()` me da el estado de forma predecible

---

### P5: ¿Por qué no usas Context o Zustand en lugar de pasar props?

**R:** Porque **no hay prop drilling profundo** en el árbol actual:

```
InventoryView (tiene estado)
├── SearchBar (props: globalFilter, setGlobalFilter) — 1 nivel
├── FilterSheet (props: categories, setCategories) — 1 nivel
├── InventoryList (props: items, onCardClick) — 1 nivel
│   └── InventoryCard × N (props: item, onClick) — 2 niveles
└── ProductFormModal (props: product, onSave) — 1 nivel
```

Ningún componente recibe props que no usa directamente. No hay intermediarios invisibles pasando datos.

**¿Cuándo Context/Zustand SÍ tiene sentido?**
- Prop drilling 4+ niveles profundo
- Estado compartido entre ramas distantes del árbol (ej: Header y Footer ambos necesitan user info)
- Reducir renders de intermediarios (Context selectors, Zustand subscriptions)

Aquí, la simplicidad de props gana:
- Props son explícitas: leyendo el componente, veo exactamente qué datos consume
- Menos magia: no hay providers, selectores, hooks de Context
- Debugging más fácil: React DevTools muestra props claras

**Si el árbol crece 3-4 niveles más,** reconsideraré. Pero ahora es prematuramente optimizar.

---

### P6: ¿Cómo manejas la seguridad de los QR codes y URLs importadas?

**R:** Los QR codes y URLs se tratan como datos, no como código:

1. **QR codes:** Son strings que se buscan por igualdad exacta (`findByQrCode(code)`). No se ejecutan, no pasan a `eval()`, no se inyectan en el DOM como HTML.
2. **URLs (techSheetUrl, videoUrl):** Se renderizan como `href` en un `<a target="_blank" rel="noopener noreferrer">`. El usuario decide si hace click.

**Potencial vector de ataque:**
- Un CSV malicioso contiene un QR que decodifica a: `https://malicious.com/phishing`
- El usuario abre el "video" → phishing

**Mitigación:**
- URLs se muestran en plaintext antes de hacer click
- `noopener noreferrer` en los links previene acceso al `window.opener`
- No hay redirección automática — el usuario es responsable de qué enlace abre

**Mejora futura:** Validación de URL (bloquear http://, requerir https://, whitelist de dominios conocidos).

---

### P7: ¿Escala bien CSS Modules?

**R:** CSS Modules escala perfectamente a nivel de componente:

✅ **Qué escala bien:**
- Cada componente tiene su `.module.css` — no hay colisiones de nombres
- CSS muerto es eliminable por análisis estático (build tools pueden tree-shake)
- Refactoring es seguro: renombro una clase y TypeScript me avisa si hay referencias

❌ **Qué NO escala:**
- **Theming dinámico:** Si necesitara dark mode basado en preferencia del usuario, requeriría:
  - Variables CSS globales en `globals.css` (ya parcialmente hecho)
  - Atributos `data-theme="dark"` en el root
  - Overrides en cada componente
  - No es automático como con Tailwind o styled-components

**Situación actual:** Light mode único, así que CSS Modules es óptimo (zero runtime, simple).

**Si necesitáramos dark mode:** Mantendría CSS Modules pero añadiría un `ThemeProvider` que controla el atributo `data-theme` en el DOM y variables CSS globales.

---

### P8: ¿Por qué el CSV import reemplaza TODO el inventario en vez de mergear?

**R:** Es una decisión de **simplicidad y predictibilidad**. Un merge requeriría:

1. **Identificador único:** ¿Cómo identifico productos duplicados? ¿Por `id`? ¿Por `name`? ¿Por `qrCode`?
2. **Estrategia de conflicto:** Si el CSV tiene un producto que ya existe, ¿lo actualizo o lo ignoro? ¿Y si el CSV tiene versión v2 y el local tiene v1?
3. **Testing de edge cases:** 5x más código para manejar:
   - Producto en CSV pero no en local → add
   - Producto en local pero no en CSV → keep o delete?
   - Producto en ambos con valores distintos → merge qué campos?

**Enfoque actual (replace):**
- Comportamiento determinista: `CSV = Verdad`
- Cero ambigüedad: lo que ves en el CSV es lo que queda
- Testing simple: antes/después

**¿Pero perder datos existentes es malo?** Mitigación:
```
[Flujo esperado para "merge"]
1. Exportar inventario actual → backup.csv
2. Editar backup.csv (añadir nuevos productos)
3. Importar backup.csv → inventario = actualizado
```

Si en el futuro hay casos de uso donde el merge es crítico, el hook `replaceAll` está en `useInventory.ts` — cambiar a `mergeAll` requeriría 10 líneas adicionales.

---

## 5. Mapa de Dependencias

### Dependencias de Runtime

| Paquete | Versión | Rol exacto | Tamaño aproximado | Tree-shakeable |
|---------|---------|-----------|-------------------|----------------|
| **next** | ^15.2.0 | Framework Next.js: App Router, Server Components, build system, Turbopack, `next/image`, TypeScript compiler | ~100KB (bundled) | No, es monolítico |
| **react** | ^19.0.0 | Runtime de React: hooks, reconciliación, rendering al DOM | ~40KB | Sí (tree-shakes funciones internas no usadas) |
| **react-dom** | ^19.0.0 | Bindging de React al DOM: `createRoot`, event delegation | ~20KB | Sí |
| **@tanstack/react-table** | ^8.21.3 | Motor headless de tabla: `useReactTable`, filtrado, sorting, pagination | ~50KB | Sí (importas funciones específicas) |
| **html5-qrcode** | ^2.3.8 | Acceso a cámara + decodificación QR/barcode: `Html5Qrcode`, API MediaDevices | ~50KB | No (importación dinámica mitiga) |
| **qrcode.react** | ^4.2.0 | Generación de QR SVG: `QRCodeSVG` componente | ~5KB | Sí |
| **papaparse** | ^5.5.3 | Parser CSV: `Papa.parse()` con soporte de streaming y edge cases | ~30KB | Sí (funciones seleccionables) |
| **lucide-react** | ^0.474.0 | Librería de iconos SVG: `import { Icon } from 'lucide-react'` | ~0.5KB per icon (tree-shaken) | Sí (importas iconos individual) |

**Tamaño bundle total (gzip, sin third-party deps):** ~350-400KB (Next.js + React + tabla + parser)

### Dependencias de Desarrollo

| Paquete | Versión | Propósito | Nota |
|---------|---------|----------|------|
| **typescript** | ^5 | Tipado estático en compilación | No aparece en bundle final — solo en transpilación |
| **@types/node** | ^22 | Tipos TypeScript para Node.js APIs | Necesario para `useEffect`, `setTimeout`, etc. |
| **@types/react** | ^19 | Tipos TypeScript para React | JSX, hooks, componentes |
| **@types/react-dom** | ^19 | Tipos TypeScript para react-dom | `ReactNode`, eventos DOM |
| **@types/papaparse** | ^5.5.2 | Tipos para PapaParse | Signatures de `Papa.parse()` y callbacks |
| **eslint** | ^9 | Linter de código | Detecta bugs estáticos, estilo |
| **eslint-config-next** | ^15.2.0 | Reglas ESLint específicas de Next.js | React best practices, hooks rules, a11y |

---

## Resumen Ejecutivo

**Inventary es una aplicación offline-first construida sobre Next.js, React y localStorage.** La arquitectura prioriza:

1. **Simplicidad:** Zero backend, cero BBDD, cero complejidad de deployment
2. **Escalabilidad de código:** Patrones claros (hooks como abstracción, componentes composables, TanStack Table para lógica)
3. **Robustez:** Hydration guards, validación de datos, manejo de edge cases (CSVs malformados, QR duplicados, URLs de Google Drive)
4. **Performance:** CSS Modules zero-runtime, Server Components donde no se necesita interactividad, dynamic imports para browser-only code

**Puntos fuertes:**
- Offline primero
- Interfaz rápida (Turbopack, bundle pequeño)
- CSV import/export para data portability
- QR scanning integrado

**Puntos débiles (aceptados conscientemente):**
- localStorage no es persistencia confiable a largo plazo (backup = responsabilidad del usuario)
- No hay multi-usuario ni sincronización
- Dark mode requeriría trabajo adicional
- CSV merge es complejo — actualmente solo replace

**Pasos de migración futura (si se necesita):**
1. Sumar backend: cambiar `useInventory.ts` a llamadas API REST
2. Base de datos: agregar PostgreSQL + Prisma
3. Autenticación: OAuth con Auth0 o NextAuth
4. Sincronización: WebSockets para real-time updates

Cada cambio es predecible porque la arquitectura es modular.

---

## Referencias Rápidas

| Concepto | Ubicación | Línea clave |
|----------|-----------|-------------|
| **Seed data** | `src/lib/mock-data.ts` | 10 productos predefinidos |
| **Validación** | `src/lib/validation.ts` | `validateProduct()` |
| **CSV parsing** | `src/lib/csv-parser.ts` | `beforeFirstChunk` hook, `detectFormat()` |
| **Estado central** | `src/hooks/useInventory.ts` | Hydration guard, CRUD operations |
| **Orquestador UI** | `src/components/inventory/InventoryView.tsx` | TanStack Table setup, modales |
| **Design tokens** | `src/app/globals.css` | Palette, spacings, shadows, breakpoints |
| **Componentes base** | `src/components/ui/*.tsx` | Button, Card, Input, Toast, ScanFab |

---

## Conclusión

Este documento es tu **"manual de defensa técnica"** del proyecto. Cada decisión tiene razonamiento sólido, cada función tiene propósito claro, y cada trade-off es consciente.

Cuando alguien pregunta "¿Por qué hiciste esto así?", tienes una respuesta fundamentada. Y cuando necesites escalar o cambiar algo, tienes un mapa claro de qué modificar y cómo hacerlo sin reescribir el proyecto.

**Keep learning. Keep iterating.**
