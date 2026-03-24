## 🔴 Alta prioridad

### D1 — Sistema de permisos/scopes no implementado
**Estado:** Pendiente

**Contexto:** El backend expone `/roles` y `/scopes` con verificación granular por
operación. El frontend solo distingue "autenticado / no autenticado". Todas las
rutas privadas son accesibles por cualquier usuario logueado, independientemente
de su rol.

**Archivos relevantes:**
- `src/Routing.jsx` — rutas protegidas solo con `<RequireAuth>`
- `src/components/ProtectedRouteMessage.jsx` — tiene `TODO: USE SCOPES`
- `src/pages/Roles/RolManagement.jsx`
- `src/utils/permissionUtils.js` — helpers de permisos ya creados, sin uso activo

**Solución propuesta:** Implementar verificación de scope por ruta en `<RequireAuth>`,
consumiendo el payload del JWT (campo `scopes`) o un endpoint `GET /usuarios/me`
para leer los scopes del usuario autenticado. El JWT ya incluye `scopes` según
`src/auth/AuthContext.jsx` (`scope: p?.scopes ?? []`).

---

### D2 — 24 archivos usan axiosInstance en vez de api()
**Estado:** ✅ Fix temporal aplicado — migración completa pendiente

**Contexto:** El proyecto tiene dos clientes HTTP paralelos:
- `src/lib/api.js` (fetch nativo, **estándar**): maneja 401 → redirect a `/login`,
  lanza `ApiError` con mensaje del backend, maneja `Content-Type` automáticamente.
- `src/axiosInstance.js` (axios): tiene interceptor 401 añadido,
  pero no lanza `ApiError` ni normaliza errores igual que `api.js`.

**Fix temporal aplicado:**
Se añadió interceptor de respuesta en `src/axiosInstance.js` que, en error 401,
limpia el token y redirige a `/login` — igual que `api.js`.

**Mapa de migración completo (24 archivos):**

| Complejidad | Cantidad | Archivos |
|-------------|----------|---------|
| Baja | 14 | `Lotes/LotesList`, `Logistica/Pallets`, `Lotes/LotesDetail`, `Lotes/LoteProductoFinalDetail`, `Logistica/Envios`, `Logistica/EnviosDetail`, `Usuarios/UsuarioById`, `Insumos/Categorias`, `Insumos/Insumos`, `Inventario/BultosPorBodega`, `PIP/PIPList`, `Compras/RecepcionarOrden`, `OM/InventarioProductosTerminados`, `Locales/LocalClienteDetail` |
| Media | 8 | `IngredientesTable`, `Compras/OrdenDetail`, `Insumos/AddCategoria`, `Insumos/AddInsumo`, `Insumos/EditCategoria`, `Locales/AddLocalCliente`, `Locales/EditLocalCliente`, `Solicitudes/RecepcionarSolicitud` |
| Alta | 2 | `Clientes/ClienteEdit` (FormData ×8), `Solicitudes/PrepararPedido` (error.response ×6, .data ×12) |

**Top 5 para migrar primero:**
1. `pages/Logistica/Pallets.jsx` — get, path relativo, 0 ajustes
2. `pages/Lotes/LotesList.jsx` — get, 0 ajustes
3. `pages/Lotes/LoteProductoFinalDetail.jsx` — get+delete, 0 ajustes
4. `pages/Lotes/LotesDetail.jsx` — get+delete, 0 ajustes
5. `pages/Usuarios/UsuarioById.jsx` — get, 1 ajuste menor

**Patrón de migración estándar (Baja):**
```js
// Antes (Axios — URL absoluta):
const base = import.meta.env.VITE_BACKEND_URL;
const { data } = await axiosInstance.get(`${base}/endpoint`);

// Después (api.js — path relativo):
const data = await api('/endpoint');
```
**Patrón de migración con error.response (Media):**
```js
// Antes:
} catch (err) {
  toast.error(err.response?.data?.error || 'Error');
}
// Después (err es ApiError con .data y .message):
} catch (err) {
  toast.error(err.message || 'Error');
}
```

**Solución completa:** Migrar los 24 archivos progresivamente y eliminar
`axios` del `package.json` al terminar.

---

## 🟡 Prioridad media

### D3 — Páginas críticas sin loading state
**Estado:** Pendiente

**Contexto:** ~28% de las páginas no muestran ningún indicador visual mientras
esperan respuesta de la API. El usuario ve la página vacía sin saber si está
cargando o si hubo un error.

**Archivos afectados:**
`src/pages/Inventario/Inventario.jsx`,
`src/pages/Inventario/InventarioBultos.jsx`,
`src/pages/Proveedores/Proveedores.jsx`,
`src/pages/Proveedores/AddProvider.jsx`,
`src/pages/Roles/RolManagement.jsx`,
`src/pages/Roles/AsignarRoles.jsx`,
`src/pages/ListasPrecio/AddListaPrecio.jsx`,
`src/pages/CostoMarginal/CostoMarginalList.jsx`,
`src/pages/CostosIndirectos/CostosIndirectos.jsx`

**Solución propuesta:** Añadir estado `isLoading` con un spinner en el bloque de
carga inicial de cada página, siguiendo el patrón ya establecido en el resto del
proyecto:
```jsx
const [isLoading, setIsLoading] = useState(true);
// en el try/finally del useEffect:
setIsLoading(false);
// en el JSX:
if (isLoading) return <div>Cargando...</div>;
```

---

## 🟢 Mejoras pendientes

### D4 — Llamadas .then() sin .catch()
**Estado:** Pendiente

`src/pages/Ventas/AddOrdenVenta.jsx` (líneas ~43–45) hace 3 llamadas `api()` en
paralelo usando `.then()` sin `.catch()`. Si alguna falla, la página carga vacía
sin ningún mensaje al usuario.

**Solución:** Envolver en `Promise.all` + `try/catch`, o añadir `.catch()` a cada
llamada con `toast.error(...)`.

---

### D5 — TODOs pendientes en Navbar y Routing
**Estado:** Pendiente

- `src/components/Navbar.jsx` líneas 52 y 70: `// TODO Ventas navbar` —
  la sección de Ventas en la barra de navegación está incompleta.
- `src/Routing.jsx` línea ~178: comentario de verificación de rol de admin
  nunca implementado (relacionado con D1).

