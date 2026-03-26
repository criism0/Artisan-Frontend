# Deuda Visual y UX — Frontend Artisan ERP
> Este archivo documenta inconsistencias de diseño, componentes
> desactualizados y mejoras de UX pendientes. No bloquean funcionalidad
> pero afectan la calidad percibida del producto y la consistencia
> del sistema visual.

---

## Módulo: Inventario

### DV1 — Inventario de Materias Primas desactualizado
**Estado:** Pendiente — sin prioridad activa del cliente
**Archivos:**
- `src/pages/Inventario/Inventario.jsx`
- `src/pages/Inventario/BultosPorBodega.jsx` (problemas menores adicionales)

**Descripción del estado actual:**

`Inventario.jsx` usa el componente genérico `<Table>` de `components/Table.jsx`
(tabla sencilla, sin filtros por columna, sin ordenación inline, sin selección
múltiple), mientras que `InventarioBultos.jsx` tiene una tabla tipo Excel con:
filtros por columna en fila secundaria, selección múltiple con checkbox,
ordenación por cualquier columna, badges de categoría con colores, exportación
a Excel, y persistencia de filtros en `localStorage`.

Diferencias visuales concretas:

- `Inventario.jsx` usa `bg-background` (variable CSS); `InventarioBultos.jsx`
  usa `bg-gray-50`. Ambas vistas del mismo módulo tienen fondo distinto.
- Los `<select>` de filtro usan `border-gray-300 shadow-sm` vs `border rounded
  px-3 py-2` en Bultos: estilos inconsistentes para el mismo control.
- No hay badge de estado visual coherente: el estado de stock se muestra con
  un `<span>` genérico cuya lógica es frágil (`(s || "").toLowerCase() ===
  "bien"`), sin mapeo de colores para los distintos valores posibles.
- No hay exportación a Excel (Bultos sí tiene, con selección).
- No hay iconografía (Bultos usa `lucide-react`; Inventario.jsx no usa ningún
  icono).
- No hay verificación de permisos/scopes (Bultos usa `checkScope` para
  condicionar acciones).

**`BultosPorBodega.jsx`** es una vista auxiliar con problemas propios:
- No tiene loading state ni error state con toast (solo `alert()`).
- Usa `axiosInstance` para descarga de PDF (D2 pendiente).
- La tabla `<Table>` no tiene filtros ni búsqueda.
- Bug potencial: el segundo botón "Descargar etiquetas del lote" pasa
  `ids_bultos: [row.lote.identificador_proveedor]` — un string de texto
  en lugar de un ID numérico.

**Referencia de diseño:**
`src/pages/Inventario/InventarioBultos.jsx` — tomar como estándar visual
para este módulo. Ambas vistas deben sentirse parte del mismo sistema.

**Qué necesita `Inventario.jsx`:**
- [x] Añadir loading state — ✅ resuelto 2026-03-25 (`isLoading` + spinner)
- [x] Añadir manejo de error con `toast.error(...)` — ✅ resuelto 2026-03-25 (todos los `catch`)
- [x] Reemplazar `<Table>` genérico por tabla con filtros/ordenación — ✅ resuelto 2026-03-25
      (reescritura completa: tabla inline ordenable + acordeón de bultos por fila)
- [x] Unificar estilos — ✅ resuelto 2026-03-25 (`bg-gray-50`, selects `border rounded px-3 py-2`,
      badges `BadgeEstado`/`BadgeCategoria`/`BadgeClaveCat` con colores del sistema)
- [x] Añadir iconografía con `lucide-react` — ✅ resuelto 2026-03-25 (`ChevronDown`/`ChevronRight`)
- [x] Condición de carrera en llamadas API al cambiar filtros — ✅ corregido 2026-03-25
      (añadido `AbortController` + `signal` en las 6 llamadas `api()` del efecto)
- [x] `useMemo` de columnas con dependencia incorrecta `[sortConfig]` — ✅ corregido 2026-03-25
      (`renderHeader` convertido a `useCallback([sortConfig, handleSort])`; `columns` depende de `[renderHeader]`)
- [x] Corregir duplicados en definición de columnas — ✅ resuelto 2026-03-25 (eliminados en reescritura)
- [x] Eliminar comentario huérfano línea 146 — ✅ resuelto 2026-03-25 (eliminado en reescritura)

**Nueva funcionalidad añadida (2026-03-25):**
- Acordeón por fila: expande bultos en sub-tabla inline al hacer clic en cualquier insumo
  con `id_materia_prima`. Carga bajo demanda con caché (`bultosCache`) para evitar re-fetch.
- Backend: `GET /inventario/bultos` extendido para aceptar `?id_materia_prima` (antes solo `?id_bodega`).
- ⚠️ Sub-tabla "Ver más": **bloqueado por backend** — `GET /inventario/bultos` no tiene
  paginación (`page`/`limit`/`total`). Actualmente muestra todos los bultos del insumo.
  Para habilitar paginación, el backend debe añadir `page`, `limit` y campo `total` en la respuesta.

**Qué necesita `BultosPorBodega.jsx`:**
- [ ] Añadir loading state
- [ ] Reemplazar `alert()` por `toast.error(...)`
- [ ] Migrar descarga PDF de `axiosInstance` a `apiBlob()` (ver patrón en
      `InventarioBultos.jsx` línea 305)
- [x] ~~Bug potencial: segundo botón pasa `ids_bultos: [row.lote.identificador_proveedor]`~~
      ✅ Verificado 2026-03-25 — NO es un bug. El backend (`/bultos/etiquetas`)
      acepta explícitamente strings no numéricos como `identificador_proveedor`
      de `LoteMateriaPrima` y los resuelve a todos sus bultos asociados.
      Comportamiento intencional y documentado en el JSDoc del controlador.

**Valor para el cliente:**
Vista de resumen de inventario por materia prima (total en $, kg/litros,
alerta de stock crítico). Alta utilidad operativa cuando el cliente
comience a usarla activamente.

**Esfuerzo estimado:** Medio (1–2 días)
**Dependencias:** Ninguna — puede abordarse de forma independiente

---

### DV1-B — Inventario de Bultos: carga paginada en `InventarioBultos.jsx`
**Estado:** ⚠️ Bloqueado por backend — documentado 2026-03-25
**Archivos:**
- `src/pages/Inventario/InventarioBultos.jsx`
- `Backend/src/controllers/inventario/inventario/bultos.ts`

**Descripción:**
`InventarioBultos.jsx` carga **todos** los bultos del sistema en una sola petición
(`GET /inventario/bultos`), lo que escala mal a medida que crece el inventario.
Se investigó añadir paginación "Ver más" pero está bloqueado porque el backend no
expone `page`, `limit` ni `total` en esa ruta. Todos los filtros por columna
(identificador, item, pallet, peso, disponible, costo) también son client-side.

**Qué necesita el backend para desbloquear:**
- [ ] `GET /inventario/bultos`: añadir parámetros `page` y `limit`
- [ ] Respuesta debe incluir `{ data: [...], total: N }` para que el frontend
      sepa cuántos registros quedan por cargar
- [ ] (Opcional) Filtros server-side para: `id_materia_prima`, `id_bodega`,
      `identificador` (ILIKE), `id_lote_producto_final`, `id_pallet`

**Esfuerzo estimado (backend):** Bajo (añadir paginación a una query existente)

---

## Módulo: Lotes

### DV2 — LotesList.jsx usa axiosInstance (D2) y `<Table>` genérico
**Estado:** Pendiente (relacionado con D2 de DEUDA_TECNICA.md)
**Archivos:**
- `src/pages/Lotes/LotesList.jsx`

**Descripción:**
`LotesList.jsx` usa `axiosInstance` (pendiente de migración a `api()`) y el
componente `<Table>` genérico. Al igual que `Inventario.jsx`, carece del
nivel de sofisticación de filtros de `InventarioBultos.jsx`, aunque su
caso es menos crítico porque los lotes son una vista de detalle, no de
inventario operativo.

**Qué necesita:**
- [ ] Migrar de `axiosInstance` a `api()` (incluido en D2, complejidad Baja)
- [ ] (Opcional) Evaluar si amerita filtros avanzados tipo Bultos o si la
      paginación actual es suficiente para el volumen de datos esperado

**Esfuerzo estimado:** Bajo (ya en plan D2)
**Dependencias:** D2 de DEUDA_TECNICA.md

---

## Notas generales de sistema visual

### Design system implícito observado

El codebase tiene un sistema visual emergente, no formalizado en un componente
de design system, pero con patrones consistentes en las páginas más recientes:

**Paleta Tailwind usada en páginas modernas:**
- Fondo de página: `bg-gray-50 min-h-screen`
- Contenedores/cards: `bg-white shadow rounded` o `bg-white shadow rounded p-4`
- Bordes de tabla: `border border-gray-300`, celdas `border`
- Header de tabla: `bg-gray-100` (inline tables) o `bg-gray-50` (componente `<Table>`)
- Hover en filas: `hover:bg-gray-50`
- Texto principal: clase `text-text` (variable CSS del sistema)
- Texto secundario: `text-gray-500`, `text-gray-600`
- Acciones/iconos: `text-gray-400 hover:text-blue-600` o `hover:text-red-600`

**Componentes de UI reutilizados:**
- `components/Table.jsx` — tabla genérica, sin filtros (usada en vistas más simples)
- `components/SearchBar.jsx` — barra de búsqueda estandarizada
- `components/Pagination.jsx` — paginación
- `components/RowsPerPageSelector.jsx` — selector de filas por página
- `lib/toast.js` — wrapper sobre react-toastify para notificaciones

**Patrón de loading state:**
No hay un componente `<Spinner>` o `<LoadingState>` reutilizable. Cada página
que tiene loading lo implementa con texto simple:
```jsx
{cargando ? <p className="text-gray-600">Cargando...</p> : null}
```
o con un `if (isLoading) return <div>Cargando...</div>`. No hay consistencia
en el componente visual usado para indicar carga. Sería valioso crear un
componente `<LoadingSpinner>` o `<PageLoader>` que todas las páginas usen.

**Patrón de iconografía:**
Las páginas modernas usan `lucide-react` exclusivamente. Algunas páginas
más antiguas usan `react-icons/fi` (FiPlus, FiTrash, etc.). Conviene
estandarizar en `lucide-react` a medida que se actualicen las páginas.

**Formateo de datos:**
Estandarizado en `services/formatHelpers.js` con `formatCLP` y `formatNumberCL`.
Bien adoptado en las páginas recientes.

**Exportación Excel:**
Solo `InventarioBultos.jsx` tiene exportación. El patrón usa `xlsx` directamente
(ya en `package.json`). No hay un helper compartido para esto — si se añade
exportación a otras páginas conviene extraer una función `exportToExcel(rows, fileName)`
a `services/` o `utils/`.

---

## Mejoras transversales del sistema visual

### DV-TX1 — Ausencia de componente `<PageLoader>` / `<Spinner>` compartido
**Estado:** Pendiente — documentado, no priorizado
**Impacto:** Alto — afecta a todo el sistema

**Contexto:** No existe un componente centralizado de carga.
Cada página implementa su propio indicador visual, generando
inconsistencia en el look & feel del sistema. Algunos usan texto
"Cargando...", otros spinners distintos, otros nada.

**Archivos afectados:** ~28% de las páginas (ver D3 en DEUDA_TECNICA.md).
Abordar D3 sin primero crear este componente replicaría
la inconsistencia en las 9 páginas que aún no tienen loading state.

**Solución propuesta:**
1. Crear `src/components/ui/PageLoader.jsx` — spinner centrado
   en pantalla para carga de página completa
2. Crear `src/components/ui/Spinner.jsx` — spinner inline pequeño
   para botones y secciones parciales
3. Reemplazar todos los indicadores de carga ad-hoc existentes
   por estos componentes

**Recomendación:** Abordar este ítem ANTES de resolver D3
(loading states en páginas sin spinner), para que las 9 páginas
nuevas ya usen el componente estándar.

**Esfuerzo estimado:** Pequeño (2–3 horas para crear + reemplazar)
