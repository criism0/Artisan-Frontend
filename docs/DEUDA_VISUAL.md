# Deuda Visual y UX — Frontend Artisan ERP
> Documento de referencia para auditoría de vistas, mapeo de componentes
> y estandarización del sistema visual.

> **Nota sobre deuda heredada:** La mayor parte de la deuda visual documentada
> aquí es **heredada**: proviene del crecimiento orgánico del proyecto sin una
> guía de diseño formalizada. Las páginas más antiguas (Clientes, Lotes,
> Insumos, Logística, Roles, Proveedores) fueron escritas antes de que se
> establecieran los patrones actuales. Las páginas más recientes (Inventario,
> OM, Solicitudes, Compras) sí siguen el estándar. La estrategia
> recomendada es estandarizar progresivamente al actualizar, no reescribir en
> masa.

---

## 1. Sistema Visual Estándar de Referencia

### 1.1 Paleta y layout

| Elemento | Clase Tailwind | Notas |
|----------|---------------|-------|
| Fondo de página | `bg-background min-h-screen` | Variable CSS del sistema |
| Contenedor / card | `bg-white shadow rounded p-4` | |
| Panel de filtros | `bg-white shadow rounded p-4 mb-4` | |
| Fondo alternativo (tablas) | `bg-gray-50` | Para headers de tabla inline |
| Hover de fila | `hover:bg-gray-50` | |
| Bordes de tabla | `border border-gray-300` | |
| Texto principal | `text-text` o `text-gray-900` | Variable CSS |
| Texto secundario | `text-gray-500`, `text-gray-600` | |
| Selects / inputs | `border rounded px-3 py-2 text-sm` | |
| Botón primario | `bg-blue-600 text-white rounded px-4 py-2` | via ActionButtons |
| Botón destructivo | icono `Trash2` de lucide-react + confirmación | via TrashButton |

### 1.2 Patrones de comportamiento estándar

- **HTTP:** `api()` / `useApi()` de `lib/api.js`. Nunca `axiosInstance`.
- **Notificaciones:** `toast.success/error/info` de `lib/toast.js`. Nunca `alert()`.
- **Loading state:** `const [isLoading, setIsLoading] = useState(true)` con
  `if (isLoading) return <div className="p-8 text-gray-500">Cargando...</div>`.
- **Race conditions:** `AbortController` + `signal` en `useEffect` con
  múltiples llamadas API; `return () => controller.abort()` como cleanup.
- **Iconografía:** `lucide-react` exclusivamente. No `react-icons/fi`.
- **Formateo de datos:** `formatCLP`, `formatNumberCL` de `services/formatHelpers.js`.
- **Permisos:** `checkScope(ModelType.X, ScopeType.Y)` de `services/scopeCheck.js`
  para condicionar botones de acción destructiva o escritura.

### 1.3 Páginas de referencia (adoptar como patrón)

| Página | Fortaleza principal |
|--------|-------------------|
| `Inventario/InventarioBultos.jsx` | Filtros por columna, persistencia localStorage, export Excel, badges |
| `Inventario/Inventario.jsx` | Acordeón inline, loading state, AbortController, useCallback/useMemo correcto |
| `Solicitudes/Solicitudes.jsx` | Chips de estado, sorting, UI compacta y limpia |
| `Compras/Ordenes.jsx` | Modales de confirmación, estado dinámico de botones, flujo de estados |
| `OM/OMList.jsx` | Paginación, SearchBar, toast, lucide-react, api() |
| `Admin/InsumosPipProductosHub.jsx` | Hub de navegación modular, sin deuda |
| `Admin/CambiarBodegaBulto.jsx` | checkScope integrado, flujo correcto |

---

## 2. Estado de Vistas por Módulo

**Leyenda:**
- `✅` — Cumple el estándar moderno en todos los criterios relevantes
- `⚠️` — Deuda menor: uno o dos items pendientes (axiosInstance, sin loading, etc.)
- `❌` — Deuda significativa: múltiples issues o un issue crítico (alert, axiosInstance alta complejidad)

| Vista | Estado | HTTP | Loading | Errores | Iconos | Deuda principal |
|-------|--------|------|---------|---------|--------|-----------------|
| **Admin** | | | | | | |
| CambiarBodegaBulto | ✅ | api() | ✅ | toast | lucide | — |
| InsumosPipProductosHub | ✅ | — | — | — | react-icons | Hub estático, sin deuda |
| **Bodegas** | | | | | | |
| Bodegas | ✅ | api() | ✅ | toast | lucide | — |
| AddBodega | ✅ | api() | ✅ | toast | — | — |
| BodegaDetail | ⚠️ | api() | ✅ | toast | — | Sin checkScope en acciones |
| BodegaEdit | ⚠️ | api() | ✅ | toast | — | Sin checkScope en acciones |
| BodegaAsignarEncargados | ⚠️ | api() | ✅ | silencioso | — | Catch sin toast en algunos paths |
| **Clientes** | | | | | | |
| Clientes | ⚠️ | api() | — | toast | — | Sin loading initial, sin localStorage |
| AddClientes | ❌ | api() | — | alert() | — | alert(), DynamicCombobox inline duplicado |
| ClienteDetail | ❌ | api() | ✅ | alert() | — | alert() en eliminación, combobox inline |
| ClienteEdit | ❌ | axiosInstance | ✅ | — | — | D2 alta: axiosInstance + FormData ×8 |
| **Compras** | | | | | | |
| Ordenes | ✅ | api() | ✅ | toast | lucide | — |
| CrearOrden | ✅ | api() | ✅ | toast | lucide | — |
| EditarOrden | ✅ | api() | ✅ | toast | lucide | — |
| ValidarOrden | ✅ | api() | ✅ | toast | lucide | — |
| EnviarOrden | ⚠️ | api() | ✅ | toast | react-icons | react-icons/fi (legacy iconos) |
| OrdenDetail | ⚠️ | axiosInstance | ✅ | toast | — | D2 media: axiosInstance |
| RecepcionarOrden | ⚠️ | axiosInstance | ✅ | toast | — | D2 baja: axiosInstance |
| **CostoMarginal** | | | | | | |
| CostoMarginalList | ❌ | api() | — | — | — | D3: sin loading state |
| CostoMarginalDetail | ⚠️ | api() | ✅ | toast | — | — |
| **CostosIndirectos** | | | | | | |
| CostosIndirectos | ❌ | api() | — | — | — | D3: sin loading state |
| **Excel / Facturas_IA** | | | | | | |
| AddExcel | ⚠️ | api() | ✅ | toast | — | Vista especializada, aceptable |
| facturas | ⚠️ | apiExtra1 | ✅ | toast | lucide | Usa servicio externo, aceptable |
| **GenerarQR** | | | | | | |
| GenerarQR | ⚠️ | api() | ✅ | toast | lucide | Sin deuda crítica |
| **HomePage / LandingPage / Login** | | | | | | |
| HomePage | ✅ | api() | ✅ | toast | lucide | — |
| LandingPage | ✅ | — | — | — | — | Estático |
| Login | ✅ | api() | ✅ | toast | — | Estándar propio de auth |
| **Insumos** | | | | | | |
| Insumos | ⚠️ | axiosInstance | — | toast | — | D2 baja + sin loading |
| Categorias | ⚠️ | axiosInstance | — | toast | — | D2 baja |
| InsumoDetail | ⚠️ | api() | ✅ | toast | — | — |
| InsumoEdit | ⚠️ | api() | ✅ | toast | — | — |
| AddInsumo | ⚠️ | axiosInstance | ✅ | toast | — | D2 media |
| EditCategoria | ⚠️ | axiosInstance | ✅ | toast | — | D2 media |
| AddCategoria | ⚠️ | axiosInstance | ✅ | toast | — | D2 media |
| AddAsociacion | ⚠️ | api() | ✅ | toast | — | — |
| EditAsociacion | ⚠️ | api() | ✅ | toast | — | — |
| **Inventario** | | | | | | |
| Inventario | ✅ | api() | ✅ | toast | lucide | — |
| InventarioBultos | ✅ | api() | ✅ | toast | lucide | — (referencia) |
| BultosPorBodega | ⚠️ | axiosInstance (PDF) | — | alert() | — | D2 baja (PDF), sin loading, alert() |
| EditarBulto | ⚠️ | api() | ✅ | toast | — | — |
| **Inventario_Insumos** | | | | | | |
| InventarioInsumos | ⚠️ | api() | ✅ | toast | — | Sin filtros avanzados |
| **Jumpseller** | | | | | | |
| AddOrdenJumpseller | ⚠️ | api() | ✅ | toast | — | Integración externa, aceptable |
| **ListasPrecio** | | | | | | |
| ListasPrecioPage | ⚠️ | api() | ✅ | toast | — | — |
| AddListaPrecio | ❌ | api() | — | — | — | D3: sin loading state |
| ListaPrecioDetail | ⚠️ | api() | ✅ | toast | — | — |
| ListaPrecioEdit | ⚠️ | api() | ✅ | toast | — | — |
| **Locales** | | | | | | |
| LocalClienteDetail | ⚠️ | axiosInstance | ✅ | toast | — | D2 baja |
| AddLocalCliente | ⚠️ | axiosInstance | ✅ | toast | — | D2 media |
| EditLocalCliente | ⚠️ | axiosInstance | ✅ | toast | — | D2 media |
| **Logística** | | | | | | |
| Pallets | ⚠️ | axiosInstance | — | toast | — | D2 baja — candidato #1 para migrar |
| Envios | ⚠️ | axiosInstance | — | toast | — | D2 baja |
| EnviosDetail | ⚠️ | axiosInstance | ✅ | toast | — | D2 baja |
| PalletsDashboard | ⚠️ | api() | ✅ | toast | lucide | — |
| Rutas | ⚠️ | api() | ✅ | toast | — | Sin deuda crítica |
| **Lotes** | | | | | | |
| LotesList | ⚠️ | axiosInstance | — | — | — | D2 baja + Table genérico sin filtros |
| LotesDetail | ⚠️ | axiosInstance | ✅ | toast | — | D2 baja |
| LoteProductoFinalDetail | ⚠️ | axiosInstance | ✅ | toast | — | D2 baja |
| **Orden de Manufactura** | | | | | | |
| OMList | ✅ | api() | ✅ | toast | lucide | — |
| OMDetail | ✅ | api() | ✅ | toast | lucide | — |
| AddOM | ✅ | api() | ✅ | toast | lucide | — |
| AsignarInsumos | ✅ | api() | ✅ | toast | lucide | InsumosTable integrado |
| AsignarInsumosPVA | ✅ | api() | ✅ | toast | lucide | — |
| EjecutarPasos | ✅ | api() | ✅ | toast | lucide | — |
| EjecutarPasosPVA | ✅ | api() | ✅ | toast | lucide | — |
| ProduccionFinal | ✅ | api() | ✅ | toast | lucide | — |
| RegistrarSubproductos | ✅ | api() | ✅ | toast | lucide | — |
| SubproductosDecision | ✅ | api() | ✅ | toast | lucide | — |
| InventarioProductosTerminados | ⚠️ | axiosInstance | — | toast | — | D2 baja |
| **PIP** | | | | | | |
| CreatePipWizard | ✅ | api() | ✅ | toast | lucide | Wizard complejo, limpio |
| PIPList | ⚠️ | axiosInstance | — | toast | — | D2 baja |
| **PVAProducto** | | | | | | |
| PVAPorProducto | ✅ | api() | ✅ | toast | lucide | — |
| AddPVAPorProducto | ✅ | api() | ✅ | toast | lucide | — |
| EditPVAPorProducto | ✅ | api() | ✅ | toast | lucide | — |
| DetailPVAPorProducto | ✅ | api() | ✅ | toast | lucide | — |
| DeletePVAPorProducto | ✅ | api() | ✅ | toast | lucide | — |
| **Pautas Elaboración** | | | | | | |
| PautasElaboracion | ✅ | api() | ✅ | toast | lucide | — |
| AddPautaElaboracion | ✅ | api() | ✅ | toast | lucide | — |
| PautaElaboracionDetail | ✅ | api() | ✅ | toast | lucide | — |
| PautaElaboracionEdit | ✅ | api() | ✅ | toast | lucide | — |
| **Pautas Valor Agregado** | | | | | | |
| PautasValorAgregado | ✅ | api() | ✅ | toast | lucide | — |
| AddPautaValorAgregado | ✅ | api() | ✅ | toast | lucide | — |
| DetailPautaValorAgregado | ✅ | api() | ✅ | toast | lucide | — |
| EditPautaValorAgregado | ✅ | api() | ✅ | toast | lucide | — |
| DeletePautaValorAgregado | ✅ | api() | ✅ | toast | lucide | — |
| **Procesos Valor Agregado** | | | | | | |
| ProcesosValorAgregado | ✅ | api() | ✅ | toast | lucide | — |
| AddProcesoValorAgregado | ✅ | api() | ✅ | toast | lucide | — |
| DetailProcesoValorAgregado | ✅ | api() | ✅ | toast | lucide | — |
| EditProcesoValorAgregado | ✅ | api() | ✅ | toast | lucide | — |
| DeleteProcesoValorAgregado | ✅ | api() | ✅ | toast | lucide | — |
| **Productos** | | | | | | |
| Productos | ✅ | api() | ✅ | toast | lucide | — |
| CreateProductoWizard | ✅ | api() | ✅ | toast | lucide | Wizard con WizardTabs |
| ProductDetail | ⚠️ | api() | ✅ | toast | lucide | Sin checkScope en acciones |
| ProductoEdit | ⚠️ | api() | ✅ | toast | lucide | — |
| **Proveedores** | | | | | | |
| Proveedores | ❌ | api() | — | — | — | D3: sin loading state |
| AddProvider | ❌ | api() | — | — | — | D3: sin loading state |
| ProviderDetail | ⚠️ | api() | ✅ | toast | — | — |
| ProviderEdit | ⚠️ | api() | ✅ | toast | — | — |
| **Recetas** | | | | | | |
| Recetas | ✅ | api() | ✅ | toast | lucide | — |
| AddReceta | ✅ | api() | ✅ | toast | lucide | Usa IngredientesTable (legacy interno) |
| RecetaDetail | ✅ | api() | ✅ | toast | lucide | — |
| RecetaEdit | ✅ | api() | ✅ | toast | lucide | — |
| **Roles** | | | | | | |
| RolManagement | ❌ | api() | — | — | — | D3: sin loading state |
| AsignarRoles | ❌ | api() | — | — | — | D3: sin loading state |
| RolDetail | ⚠️ | api() | ✅ | toast | — | — |
| **Solicitudes** | | | | | | |
| Solicitudes | ✅ | api() | ✅ | toast | react-icons | Referencia — react-icons menor |
| AddSolicitud | ✅ | api() | ✅ | toast | lucide | InsumosTable integrado |
| SolicitudDetail | ✅ | api() | ✅ | toast | lucide | — |
| EditSolicitud | ✅ | api() | ✅ | toast | lucide | — |
| CargarPallet | ✅ | api() | ✅ | toast | lucide | — |
| RecepcionarSolicitud | ⚠️ | axiosInstance | ✅ | toast | — | D2 media |
| PrepararPedido | ❌ | axiosInstance | ✅ | toast | — | D2 alta: error.response×6, .data×12 |
| **Usuarios** | | | | | | |
| Usuarios | ✅ | api() | ✅ | toast | lucide | — |
| AddUsuario | ✅ | api() | ✅ | toast | lucide | — |
| UsuariosEdit | ✅ | api() | ✅ | toast | lucide | — |
| UsuarioById | ⚠️ | axiosInstance | ✅ | toast | — | D2 baja (1 ajuste menor) |
| CambiarContrasena | ✅ | api() | ✅ | toast | — | — |
| **Ventas** | | | | | | |
| OrdenesVentaPage | ⚠️ | api() | — | toast | lucide | Sin loading en fetch inicial (D3) |
| AddOrdenVenta | ⚠️ | api() | — | — | lucide | D4: .then() sin .catch() en 3 llamadas |
| EditOrdenVenta | ✅ | api() | ✅ | toast | lucide | — |
| OrdenVentaDetail | ✅ | api() | ✅ | toast | lucide | — |
| AsignarVenta | ✅ | api() | ✅ | toast | lucide | — |
| ResumenAsignacionVenta | ✅ | api() | ✅ | toast | lucide | — |

### Resumen por estado

| Estado | Cantidad | % |
|--------|----------|---|
| ✅ Cumple estándar | ~58 | ~48% |
| ⚠️ Deuda menor | ~47 | ~38% |
| ❌ Deuda significativa | ~17 | ~14% |

La mayoría de las páginas con estado ❌ son **heredadas** (escritas antes de 2025)
y concentradas en módulos: Clientes, Proveedores, Roles, CostoMarginal/CostosIndirectos,
PrepararPedido y CambiarBodega (algunos).

---

## 3. Mapa de Componentes Compartidos

### 3.1 Inventario actual de componentes (`src/components/`)

#### Primitivos genéricos (uso transversal)
| Componente | Uso en páginas | Descripción |
|-----------|---------------|-------------|
| `Table.jsx` | ~32 páginas | Tabla genérica con columnas, acciones, filas expandibles |
| `SearchBar.jsx` | ~20 páginas | Input de búsqueda con callback `onSearch` |
| `Pagination.jsx` | ~20 páginas | Navegación de páginas con rango visible |
| `RowsPerPageSelector.jsx` | ~20 páginas | Selector de registros por página |
| `FormField.jsx` | ~15 páginas | Input/select/textarea universal con validación |
| `Selector.jsx` | ~9 páginas | Dropdown con búsqueda fuzzy y agrupación |
| `MultiSelectInput.jsx` | ~5 páginas | Chips de selección múltiple con búsqueda |
| `EditableTable.jsx` | ~3 páginas | Tabla con edición inline (edit/save/cancel) |
| `QRScanner.jsx` | ~2 páginas | Escáner QR con html5-qrcode |

#### Botones y acciones
| Componente | Uso en páginas | Exports |
|-----------|---------------|---------|
| `Buttons/ActionButtons.jsx` | ~50+ páginas | `ViewDetailButton`, `EditButton`, `TrashButton`, `BackButton`, `ValidarButton`, `UndoButton`, `AddButton`, `PagarButton`, `ToggleActiveButton`, `NextStepButton`, y más |

#### Modales
| Componente | Descripción |
|-----------|-------------|
| `Modals/ConfirmActionModal.jsx` | Modal genérico de confirmación con backdrop blur |
| `Modals/ConfirmDeletePreviewModal.jsx` | Modal con preview antes de eliminar |
| `ConfirmModal.jsx` | Modal de confirmación simple (legacy, considerar deprecar) |
| `SimilarNameConfirmModal.jsx` | Alerta de nombre duplicado al crear recursos |
| `DireccionModal.jsx` | Edición modal de dirección |
| `DividirBultoModal.jsx` | Modal para dividir un bulto |
| `ProductoBaseModal.jsx` | Modal para gestión de productos base |

#### Layout y navegación
| Componente | Descripción |
|-----------|-------------|
| `Navbar.jsx` | Navegación principal con menús dropdown, AuthContext |
| `NavbarFunction.jsx` | Sub-componentes del Navbar: Dropdown, MenuGroup, MenuLink, ClockCompact |
| `Layout.jsx` | Wrapper base de página |
| `ProtectedRouteMessage.jsx` | Mensaje de acceso denegado (TODO: usar scopes) |

#### Componentes de dominio — Insumos y catálogo
| Componente | Usado en | Notas |
|-----------|----------|-------|
| `InsumosTable.jsx` | Solicitudes/Add, Solicitudes/Edit, OM/Asignar | 746 líneas, lógica compleja de stock |
| `SolicitudInsumosTable.jsx` | Detalle solicitudes | Vista de solo lectura de insumos |
| `IngredientesTable.jsx` | Recetas | **Usa axiosInstance** (legacy interno) |
| `EditIngredientes.jsx` | Recetas/Edit | Edición de ingredientes |
| `StepsTable.jsx` | Recetas | **Usa axios directo** (legacy interno) |

#### Componentes de dominio — Recetas y catálogo
| Componente | Descripción |
|-----------|-------------|
| `Recetas/IngredienteAdder.jsx` | Agregador de ingredientes con Selector |
| `Recetas/SubproductoAdder.jsx` | Agregador de subproductos |
| `Pautas/PautaEditor.jsx` | Editor de pauta de elaboración |
| `Pautas/StepsEditor.jsx` | Editor de pasos |
| `Pautas/PautaSelectorConCreacion.jsx` | Selector de pauta con creación inline |

#### Componentes de dominio — Productos / Wizard
| Componente | Descripción |
|-----------|-------------|
| `Wizard/TabButton.jsx` | Botón de tab para wizards |
| `WizardTabs/RecetaTab.jsx` | Tab de receta en wizard (384 líneas) |
| `WizardTabs/PautaTab.jsx` | Tab de pauta |
| `WizardTabs/CostosSecosTab.jsx` | Tab de costos secos (513 líneas) |
| `WizardTabs/CostosIndirectosTab.jsx` | Tab de costos indirectos |
| `WizardTabs/DatosPipTab.jsx` | Tab de datos PIP |
| `WizardTabs/DatosProductoComercialTab.jsx` | Tab de datos comerciales |
| `WizardTabs/PVAsTab.jsx` | Tab de PVAs (764 líneas, más pesado) |
| `ProductosBaseManager.jsx` | Gestor CRUD de productos base |

#### Componentes de dominio — Logística
| Componente | Descripción |
|-----------|-------------|
| `PalletTable.jsx` | Tabla de pallets |
| `TablePallets.jsx` | Tabla de pallets alternativa (posible duplicado) |
| `Palets.jsx` | Componente pallet simple |

#### Componentes de dominio — Clientes / Proveedores
| Componente | Descripción |
|-----------|-------------|
| `DireccionesManager.jsx` | CRUD de direcciones con modal (Clientes, Proveedores, Locales) |
| `OrderSummary.jsx` | Resumen de orden de venta |

#### Componentes de dominio — OM y análisis
| Componente | Descripción |
|-----------|-------------|
| `OrdenDeManufactura/HistorialBultosModal.jsx` | Modal historial de bultos |
| `OrdenDeManufactura/HistorialCostosModal.jsx` | Modal historial de costos |
| `OrdenDeManufactura/HistorialPasosModal.jsx` | Modal historial de pasos |
| `OM/ResumenOMOperario.jsx` | Resumen para vista de operario |
| `AnalisisSensorial/DefinicionForm.jsx` | Formulario de definición sensorial |
| `AnalisisSensorial/ModalRegistro.jsx` | Modal de registro sensorial |

#### Formularios dinámicos
| Componente | Descripción |
|-----------|-------------|
| `DynamicForm.jsx` | Genera formularios a partir de configuración |
| `DynamicFormWithSelect.jsx` | Ídem con selects dinámicos |

---

### 3.2 Reorganización recomendada

La estructura actual es relativamente plana con demasiados archivos en la raíz
de `components/`. Se recomienda la siguiente reorganización familiar:

```
src/components/
├── ui/                     # Primitivos genéricos reutilizables
│   ├── Table.jsx           (mover de raíz)
│   ├── SearchBar.jsx       (mover de raíz)
│   ├── Pagination.jsx      (mover de raíz)
│   ├── RowsPerPageSelector.jsx  (mover de raíz)
│   ├── FormField.jsx       (mover de raíz)
│   ├── Selector.jsx        (mover de raíz)
│   ├── MultiSelectInput.jsx (mover de raíz)
│   ├── EditableTable.jsx   (mover de raíz)
│   ├── QRScanner.jsx       (mover de raíz)
│   └── (futuro) PageLoader.jsx, Spinner.jsx, Badge.jsx
│
├── layout/                 # Estructura y navegación
│   ├── Navbar.jsx          (mover de raíz)
│   ├── NavbarFunction.jsx  (mover de raíz)
│   ├── Layout.jsx          (mover de raíz)
│   └── ProtectedRouteMessage.jsx (mover de raíz)
│
├── modals/                 # (ya existe) — consolidar todos los modales
│   ├── ConfirmActionModal.jsx       (ya está)
│   ├── ConfirmDeletePreviewModal.jsx (ya está)
│   ├── SimilarNameConfirmModal.jsx  (mover de raíz)
│   ├── DireccionModal.jsx           (mover de raíz)
│   ├── DividirBultoModal.jsx        (mover de raíz)
│   └── ProductoBaseModal.jsx        (mover de raíz)
│   # Deprecar: ConfirmModal.jsx (reemplazar por ConfirmActionModal)
│
├── buttons/                # (renombrar Buttons/ → buttons/)
│   └── ActionButtons.jsx
│
├── forms/                  # Formularios dinámicos
│   ├── DynamicForm.jsx     (mover de raíz)
│   └── DynamicFormWithSelect.jsx (mover de raíz)
│
└── domain/                 # Componentes acoplados a dominio
    ├── insumos/
    │   ├── InsumosTable.jsx         (mover de raíz)
    │   ├── SolicitudInsumosTable.jsx (mover de raíz)
    │   ├── IngredientesTable.jsx    (mover de raíz — migrar axiosInstance)
    │   └── EditIngredientes.jsx     (mover de raíz)
    │
    ├── catalogo/
    │   ├── StepsTable.jsx           (mover de raíz — migrar axios)
    │   └── Recetas/                 (ya existe)
    │
    ├── productos/
    │   ├── Wizard/                  (ya existe)
    │   ├── WizardTabs/              (ya existe)
    │   └── ProductosBaseManager.jsx (mover de raíz)
    │
    ├── logistica/
    │   ├── PalletTable.jsx          (mover de raíz)
    │   ├── TablePallets.jsx         (mover de raíz — evaluar si es duplicado)
    │   └── Palets.jsx               (mover de raíz)
    │
    ├── pautas/
    │   └── Pautas/                  (ya existe)
    │
    ├── om/
    │   ├── OrdenDeManufactura/      (ya existe)
    │   └── OM/                      (ya existe)
    │
    ├── analisis/
    │   └── AnalisisSensorial/       (ya existe)
    │
    └── clientes/
        ├── DireccionesManager.jsx   (mover de raíz)
        └── OrderSummary.jsx         (mover de raíz)
```

> **Prioridad de reorganización:** Baja. La reorganización es estética y no
> desbloquea funcionalidad. Hacerla progresivamente al tocar cada módulo,
> actualizando los imports en las páginas afectadas. No hacerlo en un solo PR
> masivo ya que el riesgo de romper imports es alto.

---

## 4. Mapeo Vistas → Componentes por Módulo

Referencia rápida para orientar modificaciones. Se listan solo los componentes
compartidos relevantes (no los de `lib/` ni `services/`).

| Módulo / Vista | Componentes clave | Notas |
|---------------|-------------------|-------|
| **Solicitudes** (todas) | `InsumosTable`, `Table`, `SearchBar`, `Pagination`, `RowsPerPageSelector`, `ActionButtons`, `SolicitudInsumosTable` | InsumosTable es el componente más complejo del módulo |
| **OM** (OMList, OMDetail) | `Table`, `SearchBar`, `Pagination`, `ActionButtons`, `HistorialBultosModal`, `HistorialCostosModal`, `HistorialPasosModal`, `ResumenOMOperario` | — |
| **OM** (AsignarInsumos/PVA) | `InsumosTable` | InsumosTable con bodegaId y callbacks |
| **OM** (EjecutarPasos) | `Pautas/StepsEditor`, `ActionButtons` | — |
| **Compras** (Ordenes) | `Table`, `SearchBar`, `Pagination`, `ActionButtons`, `ConfirmActionModal`, `ConfirmDeletePreviewModal` | — |
| **Compras** (Crear/Editar) | `InsumosTable`, `FormField`, `Selector`, `DireccionesManager` | — |
| **Inventario** (Inventario) | `ActionButtons` (parcial), `lucide-react` directo | Tabla inline sin Table genérico |
| **Inventario** (InventarioBultos) | `ActionButtons`, `Table`, `SearchBar` | Filtros por columna inline |
| **Inventario** (BultosPorBodega) | `Table`, `ActionButtons` | axiosInstance para PDF descarga |
| **Productos** (Wizard) | `Wizard/TabButton`, todos los `WizardTabs/*`, `ProductosBaseManager`, `AnalisisSensorial/*` | Wizard más complejo del sistema |
| **PIP** (CreatePipWizard) | `Wizard/TabButton`, `WizardTabs/*` (subset) | Wizard simplificado vs Productos |
| **Recetas** | `InsumosTable` (para ingredientes), `IngredientesTable`, `StepsTable`, `Recetas/*`, `ActionButtons` | IngredientesTable y StepsTable tienen deuda legacy interna |
| **Pautas Elaboración/VA** | `Pautas/*`, `ActionButtons` | — |
| **PVAProducto / ProcesosVA** | `Pautas/*`, `WizardTabs/PVAsTab`, `ActionButtons` | — |
| **Clientes** | `Table`, `SearchBar`, `Pagination`, `ActionButtons`, `DireccionesManager`, `SimilarNameConfirmModal` | AddClientes/ClienteDetail usan DynamicCombobox inline (no componente) |
| **Proveedores** | `Table`, `SearchBar`, `Pagination`, `ActionButtons`, `DireccionesManager` | — |
| **Locales** | `DireccionesManager`, `FormField`, `ActionButtons` | — |
| **Usuarios** | `Table`, `SearchBar`, `Pagination`, `ActionButtons`, `FormField`, `MultiSelectInput` | — |
| **Roles** | `Table`, `ActionButtons`, `EditableTable` | — |
| **Bodegas** | `Table`, `SearchBar`, `Pagination`, `ActionButtons`, `Selector` | — |
| **Logística** (Pallets) | `Table`, `PalletTable`, `SearchBar`, `Pagination`, `ActionButtons` | — |
| **Logística** (Envíos) | `Table`, `SearchBar`, `Pagination`, `ActionButtons` | — |
| **Insumos** (Insumos) | `Table`, `SearchBar`, `Pagination`, `ActionButtons`, `SimilarNameConfirmModal` | — |
| **Lotes** | `Table`, `SearchBar`, `Pagination`, `ActionButtons` | LotesList: tabla sin filtros avanzados |
| **Ventas** (OrdenesVenta) | `Table`, `SearchBar`, `Pagination`, `ActionButtons`, `OrderSummary` | — |
| **ListasPrecio** | `Table`, `ActionButtons`, `FormField` | — |
| **Facturas_IA** | `Table`, `QRScanner`, lucide-react | Integración especial con apiExtra1 |
| **GenerarQR** | `QRScanner`, `ActionButtons` | — |

---

## 5. Deuda Visual Pendiente

### DV-TX1 — Ausencia de componente `<PageLoader>` / `<Spinner>` compartido
**Estado:** Pendiente — no priorizado
**Impacto:** Alto — afecta consistencia de UX en toda la app

No existe componente centralizado de carga. Cada página implementa su propio
indicador (texto "Cargando...", `null`, o nada). Abordar este item **antes**
de resolver las 8 páginas de D3 (ver DEUDA_TECNICA.md) para que todas usen
el mismo estándar desde el inicio.

**Solución propuesta:**
1. Crear `src/components/ui/PageLoader.jsx` — spinner centrado para carga de página completa
2. Crear `src/components/ui/Spinner.jsx` — spinner inline para botones/secciones parciales
3. Reemplazar todos los patrones `if (isLoading) return <div>Cargando...</div>` por `<PageLoader />`

**Esfuerzo estimado:** Pequeño (2–3 horas crear + reemplazar)
**Dependencia:** Ninguna. Abordable de inmediato.

---

### DV2 — LotesList.jsx: tabla sin filtros + axiosInstance
**Estado:** Pendiente (relacionado con D2 de DEUDA_TECNICA.md)
**Archivos:** `src/pages/Lotes/LotesList.jsx`

`LotesList.jsx` usa `axiosInstance` (D2 baja complejidad) y el componente
`<Table>` genérico. Al igual que antes, carece de filtros avanzados, aunque
su caso es menos crítico porque los lotes son una vista de detalle con
volumen de datos acotado.

**Qué necesita:**
- [ ] Migrar de `axiosInstance` a `api()` (incluido en D2, complejidad Baja)
- [ ] (Opcional) Evaluar si amerita filtros avanzados según volumen de datos

**Esfuerzo estimado:** Bajo (ya en plan D2)
**Dependencias:** D2 de DEUDA_TECNICA.md

---

### DV3 — DynamicCombobox duplicado en módulo Clientes
**Estado:** Pendiente
**Archivos:**
- `src/pages/Clientes/AddClientes.jsx` (líneas ~9–95)
- `src/pages/Clientes/ClienteDetail.jsx` (líneas ~16–112)

Ambas páginas definen inline un componente `DynamicCombobox` / `ProductCombobox`
prácticamente idéntico. No existe un componente reutilizable para este patrón.

**Qué necesita:**
- [ ] Extraer a `src/components/ui/DynamicCombobox.jsx` con props: `options`, `value`, `onChange`, `placeholder`, `disabled`
- [ ] Reemplazar las definiciones inline en ambas páginas

**Esfuerzo estimado:** Bajo (1–2 horas)
**Dependencias:** Ninguna

---

### DV4 — Inconsistencia de librería de iconos
**Estado:** Pendiente — baja prioridad
**Impacto:** Bajo (estético)

El sistema usa `lucide-react` como estándar moderno, pero varias páginas
heredadas usan `react-icons/fi`. Se recomienda estandarizar progresivamente
al actualizar cada página. No migrar en masa.

**Páginas con react-icons:** `Solicitudes.jsx`, `EnviarOrden.jsx`,
`Insumos/Insumos.jsx`, `OMList.jsx` (parcial), `Usuarios.jsx` (parcial),
`InsumosPipProductosHub.jsx`.

---

## Ver también

- `Frontend/docs/DEUDA_TECNICA.md` — deuda técnica: axiosInstance (D2),
  loading states (D3), .then() sin .catch() (D4), TODOs de Navbar (D5)

---

> **Aviso:** Este documento fue generado con asistencia de inteligencia artificial
> mediante análisis estático del código fuente. Puede contener errores, omisiones
> o apreciaciones incorrectas. Verificar cada ítem contra el código real antes de
> tomar decisiones basadas en este documento.
