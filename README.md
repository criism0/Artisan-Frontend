# Artisan Web — React + Vite + Tailwind

Frontend del ERP Artisan (elaboradora de alimentos gourmet). SPA en React 19
servida como sitio estático; toda la lógica de negocio vive en el backend
(Koa + PostgreSQL), esta app consume su API con sesión por cookies.

## Stack

- **React 19** + **Vite** (`@vitejs/plugin-react-swc`)
- **Tailwind CSS** (tokens del proyecto: `primary #7A5AF8`, `text #4A4A4A`)
- **react-router-dom 7** — rutas protegidas por permisos (`ProtectedRoute` + scopes del backend)
- **Vitest** para tests unitarios, **ESLint** para lint, **Husky** para hooks de pre-commit
- Yarn 4 (Corepack; npm está bloqueado)

## Cómo correr

```bash
yarn install
yarn dev            # dev server (VITE_BACKEND_URL define la API; ver .env)
yarn build          # build de producción (dist/)
yarn test           # vitest
yarn lint           # eslint
```

Variables de entorno relevantes (`.env.local` para desarrollo):

- `VITE_BACKEND_URL` — URL base de la API
- `VITE_GOOGLE_CLIENT_ID` — OAuth de Google (export a Sheets); opcional en local

## Estructura

```
src/
├── Routing.jsx         ← todas las rutas + permisos por vista
├── auth/               ← contexto de sesión (cookies + refresh token)
├── lib/                ← api.js (fetch con refresh), toast, fechas
├── services/           ← scopeCheck (permisos), dteService (facturación), helpers
├── hooks/              ← hooks compartidos (useDTE, etc.)
├── components/
│   ├── Tables/DataTable.jsx  ← lista estándar (búsqueda/orden/paginación)
│   ├── Forms/, Modals/, Buttons/, UI/  ← piezas reutilizables
│   └── DTE/, Wizard/, Scanner/, ...    ← componentes por dominio
└── pages/              ← una carpeta por módulo del navbar
    (Adquisiciones, Producción, Logística, Inventario, Ventas, Calidad, Administración)
```

## Entender el dominio

Antes de tocar una vista conviene leer **`docs/MODULOS.md` del repo Backend**: explica qué
resuelve cada módulo del ERP y por qué. Las decisiones de UI de acá se entienden mucho mejor
con ese contexto.

Lo que más se olvida:

- **Los productos se muestran por su nombre comercial** (nombre de facturación), no por el
  nombre físico de producción. La OV se pide por nombre comercial y el picking acepta
  cualquier producto del grupo. Usar `utils/nombreComercial.js`, que además cubre las dos
  formas en que la API entrega la asociación (`NombreFacturacion` en ventas,
  `nombreFacturacion` en listas de precio). El campo `id_producto_base` es legacy y **viene
  en NULL en la mayoría de las filas**: nunca pintarlo.
- **La facturación electrónica está deshabilitada a propósito.** Las OV se quedan en *Lista
  para facturación*; no es un error de la vista.

## Convenciones de UI

- **Listas**: usar `components/Tables/DataTable.jsx` (título + acciones de header,
  búsqueda, orden por columna, paginación). No re-implementar tablas a mano.
- **Detalles/formularios**: cards `bg-white rounded-xl shadow-sm border border-gray-200`.
- **Permisos**: cada acción sensible se protege con `checkScope(ModelType, ScopeType)`
  y las rutas con `ProtectedRoute`; los toasts de permiso usan `toast.permissionError`.
- **Confirmaciones**: modales de `components/Modals/` (no `window.confirm`).
- **Nombres similares**: los POST de catálogos manejan el 409 `SIMILAR_NAME`
  con `SimilarNameConfirmModal`.
- **Llamadas a la API**: usar siempre `lib/api.js`. ⚠️ La sesión vive en cookies `httpOnly`,
  así que un `fetch` suelto sin `credentials: "include"` llega **sin credenciales** y recibe
  un 401 aunque el usuario tenga sesión abierta. Ya pasó con el correo de órdenes de compra.

## Deploy

`yarn build` genera `dist/`, que se sube a S3 y se sirve por CloudFront
(el pipeline solo corre `build`, no `lint`).
