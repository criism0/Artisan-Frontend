# Auditoría del Frontend

## Críticos

### 1. Token JWT en `localStorage`
**Descripción:** `getToken()` ([src/lib/api.js:4](src/lib/api.js#L4)) lee de `localStorage`. Cualquier XSS, dependencia comprometida o extensión maliciosa puede exfiltrar la sesión completa.
**Posible solución:** Mover a cookie `httpOnly + Secure + SameSite=Lax` emitida por el backend en login y leída automáticamente por el browser. Es un cambio coordinado con backend.
**Complejidad:** Alta
**Tiempo estimado:** ~2-3 días

### 2. `ModelType` del frontend desincronizado del backend
**Descripción:** El enum en [src/services/scopeCheck.js:19](src/services/scopeCheck.js#L19) se mantiene a mano. Cuando se agrega un modelo en el backend (ej. `Poes`), el menú deja de aparecer aunque el usuario tenga el scope.
**Posible solución:** Generar el enum desde un endpoint del backend o desde un schema compartido. Mínimo: un test que valide contra los `model_type` de la tabla `Scopes`.
**Complejidad:** Media
**Tiempo estimado:** ~4-6h

### 3. Sin Error Boundary global
**Descripción:** Un `throw` en cualquier componente baja toda la app. No hay `<ErrorBoundary>` envolviendo las rutas en [src/Routing.jsx](src/Routing.jsx).
**Posible solución:** Wrapper `<ErrorBoundary>` por sección con fallback amigable y reporte de error.
**Complejidad:** Baja
**Tiempo estimado:** ~3h

### 4. XSS en toasts vía `innerHTML`
**Descripción:** [src/lib/toast.js:64](src/lib/toast.js#L64) hace `toast.innerHTML = ...${message}...`. Si un mensaje viene del backend o de input del usuario y tiene HTML, se ejecuta.
**Posible solución:** Cambiar a `textContent` o sanitizar con DOMPurify si necesitas formato.
**Complejidad:** Baja
**Tiempo estimado:** ~30min

### 5. Ruta de demo expuesta sin auth en producción
**Descripción:** [src/Routing.jsx:201](src/Routing.jsx#L201) tiene `/demo12345` con `<HelloWorld />` fuera de `RequireAuth`.
**Posible solución:** Eliminar la ruta y el componente si era solo de prueba, o ponerla bajo auth.
**Complejidad:** Baja
**Tiempo estimado:** ~15min

### 6. Sistema de permisos paralelo en `permissionUtils.js`
**Descripción:** [src/utils/permissionUtils.js](src/utils/permissionUtils.js) duplica la lógica de `scopeCheck`, fetchea `/roles` sin token y guarda permisos en `localStorage` tratando `description` como CSV. Cualquier user puede editar `localStorage` y darse permisos.
**Posible solución:** Borrar el archivo entero (es legacy), buscar usos (`grep permissionUtils`) y reemplazarlos por `scopeCheck`.
**Complejidad:** Media
**Tiempo estimado:** ~3h

### 7. Credenciales en QR sin firma ni TTL
**Descripción:** [src/lib/qrCredentialsUtils.js:3](src/lib/qrCredentialsUtils.js#L3) hace `btoa(JSON.stringify({ user, password }))`. Cualquier foto del QR = login permanente. Y [src/pages/GenerarQR/GenerarQR.jsx:14](src/pages/GenerarQR/GenerarQR.jsx#L14) deja generar el QR sin verificar identidad.
**Posible solución:** Backend debe emitir un token corto (JWT con TTL ~5 min) que sirva para un único login; el QR contiene ese token, no las credenciales. Y la generación debe pedir reautenticación.
**Complejidad:** Alta
**Tiempo estimado:** ~1-2 días (coordinado con backend)

### 8. `emailService` silencia errores de envío
**Descripción:** [src/services/emailService.js:93](src/services/emailService.js#L93) hace `toast.error` y no propaga; los flujos que dependen de notificaciones (envío de OC) no detectan que el correo falló.
**Posible solución:** Hacer que la función propague el error (`throw`) y que el caller decida si mostrar toast o reintentar.
**Complejidad:** Baja
**Tiempo estimado:** ~2h

### 9. Login filtra "user existe" vs "password mal"
**Descripción:** [src/auth/AuthContext.jsx:108](src/auth/AuthContext.jsx#L108) propaga `j.message` del backend al toast. Eso permite enumeración de usuarios.
**Posible solución:** Mostrar siempre un mensaje genérico tipo "Credenciales inválidas" sin importar el error real. El backend también debería devolver mensajes uniformes.
**Complejidad:** Baja
**Tiempo estimado:** ~1h

### 10. `Aprobación de Formulario` PUT incompleto
**Descripción:** [src/pages/calidad/AprobacionDetail.jsx:79](src/pages/calidad/AprobacionDetail.jsx#L79) hace PUT sin enviar `codigo` ni `version`. Si el backend exige esos campos o crea nueva versión al actualizar, los formularios se corrompen al aprobarlos.
**Posible solución:** Pasar el objeto completo al PUT o usar un endpoint dedicado de aprobación.
**Complejidad:** Baja
**Tiempo estimado:** ~1h

### 11. `RespuestaDetail` patch reemplaza con datos parciales
**Descripción:** [src/pages/calidad/RespuestaDetail.jsx:163](src/pages/calidad/RespuestaDetail.jsx#L163) descarta campos "vacíos" pero la lógica también descarta strings con whitespace; si el usuario edita una respuesta con un campo en blanco, se borra del backend.
**Posible solución:** Definir explícitamente qué se considera "vacío" y enviar los campos siempre, dejando que el backend decida.
**Complejidad:** Baja
**Tiempo estimado:** ~2h

### 12. Inputs numéricos pasan `NaN` al backend
**Descripción:** [src/pages/calidad/CompletarFormulario.jsx:189](src/pages/calidad/CompletarFormulario.jsx#L189) y [src/pages/calidad/RespuestaDetail.jsx:169](src/pages/calidad/RespuestaDetail.jsx#L169) hacen `Number(val)` sin `Number.isFinite`. Si alguien escribe texto, se serializa como `NaN` que JSON convierte a `null`.
**Posible solución:** Validar con `Number.isFinite(Number(val))` antes de enviar; si falla, mostrar error.
**Complejidad:** Baja
**Tiempo estimado:** ~1h

### 13. Editar formulario aprobado muta el schema
**Descripción:** [src/pages/calidad/FormularioBuilder.jsx:243](src/pages/calidad/FormularioBuilder.jsx#L243) reusa el mismo `id` y baja `aprobado:false`. Las respuestas existentes quedan ligadas a un schema mutado sin migración.
**Posible solución:** Forzar versionado: editar = crear versión N+1, dejando la N intacta para preservar la integridad de las respuestas históricas.
**Complejidad:** Media
**Tiempo estimado:** ~6-8h

### 14. `EnviarOrden` crashea sin null-check
**Descripción:** [src/pages/Compras/EnviarOrden.jsx:75](src/pages/Compras/EnviarOrden.jsx#L75) accede a `ordenData.fecha_emision/proveedor/insumos` antes de que el fetch resuelva. Da "cannot read properties of null".
**Posible solución:** `if (!ordenData) return <Spinner/>` antes del render.
**Complejidad:** Baja
**Tiempo estimado:** ~30min

### 15. Uploads sin validar tipo/tamaño
**Descripción:** [src/pages/Compras/CrearOrden.jsx:259](src/pages/Compras/CrearOrden.jsx#L259), [src/pages/Compras/EditarOrden.jsx:410](src/pages/Compras/EditarOrden.jsx#L410), [src/pages/Facturas_IA/facturas.jsx:238](src/pages/Facturas_IA/facturas.jsx#L238) suben archivos a S3 / OCR sin chequear MIME ni tamaño. Riesgo de upload arbitrario y de PDFs gigantes que cuelgan el OCR.
**Posible solución:** Helper `validarArchivo(file, { maxMB, mimes })` y usarlo en cada upload. Para el OCR además agregar `AbortController` con timeout (60s).
**Complejidad:** Baja
**Tiempo estimado:** ~3h

### 16. Jumpseller crea clientes duplicados
**Descripción:** [src/pages/Jumpseller/AddOrdenJumpseller.jsx:402](src/pages/Jumpseller/AddOrdenJumpseller.jsx#L402) detecta cliente existente comparando nombres en lowercase exact-match. Cualquier diferencia (tilde, espacio extra) crea un cliente duplicado sin manejar el 409.
**Posible solución:** Usar match por RUT o pedir al backend un endpoint de "find or create" que devuelva 200 con el id si existe.
**Complejidad:** Media
**Tiempo estimado:** ~4h

### 17. IVA hardcodeado en frontend
**Descripción:** [src/pages/Ventas/OrdenesVentaPage.jsx:460](src/pages/Ventas/OrdenesVentaPage.jsx#L460) hace `fmtMoney(o.ingreso_venta * 1.19)`. Si `ingreso_venta` ya es bruto o es null, muestra montos mal o `NaN`.
**Posible solución:** El backend debe devolver el monto bruto ya calculado. El frontend nunca debería aplicar IVA.
**Complejidad:** Baja
**Tiempo estimado:** ~1h

### 18. Crear/editar venta sin transacción
**Descripción:** [src/pages/Ventas/AddOrdenVenta.jsx:439](src/pages/Ventas/AddOrdenVenta.jsx#L439) crea N productos en loop tras POST de orden. Si una llamada falla, queda una orden con productos parciales y no hay rollback. Mismo patrón en [EditOrdenVenta.jsx:399](src/pages/Ventas/EditOrdenVenta.jsx#L399), [Compras/CrearOrden.jsx](src/pages/Compras/CrearOrden.jsx), [Clientes/AddClientes.jsx:241](src/pages/Clientes/AddClientes.jsx#L241), [PrepararPedido.jsx:96](src/pages/Solicitudes/PrepararPedido.jsx#L96).
**Posible solución:** Endpoint del backend que reciba la orden completa + sus productos en un solo POST, hecho en una transacción. El frontend solo orquesta UI, no la atomicidad.
**Complejidad:** Alta
**Tiempo estimado:** ~2-3 días (varios endpoints + cambios cliente)

### 19. `pagarOrden` sin idempotencia ni confirm
**Descripción:** [src/pages/Compras/Ordenes.jsx:399](src/pages/Compras/Ordenes.jsx#L399) hace PUT directo. Doble click = doble pago.
**Posible solución:** Bloquear el botón al primer click (ya hablo de esto en el #25), e idealmente que el backend acepte una idempotency key.
**Complejidad:** Baja
**Tiempo estimado:** ~1h (frontend) + ~2h (backend)

### 20. Pasos de pauta se eliminan al instante (sin "Guardar")
**Descripción:** [src/pages/PautasElaboracion/PautaElaboracionEdit.jsx:98](src/pages/PautasElaboracion/PautaElaboracionEdit.jsx#L98) y [src/pages/ProcesosValorAgregado/EditProcesoValorAgregado.jsx:69](src/pages/ProcesosValorAgregado/EditProcesoValorAgregado.jsx#L69) llaman DELETE al backend cuando el usuario aprieta "Eliminar paso". Si después cancela la edición, el paso ya está borrado.
**Posible solución:** Mantener los cambios en estado local hasta que el usuario haga "Guardar". El "Guardar" hace el diff (creates/updates/deletes) en una sola operación.
**Complejidad:** Media
**Tiempo estimado:** ~6h

### 21. Editar receta usa "delete-all + recreate" no transaccional
**Descripción:** [src/pages/Recetas/RecetaEdit.jsx:188](src/pages/Recetas/RecetaEdit.jsx#L188) borra todos los pasos y los vuelve a crear. Si falla a mitad, la receta queda con pasos parciales y rompe OMs que la usen.
**Posible solución:** Endpoint del backend que reemplace pasos en transacción, o cambiar la estrategia a diff (insertar/modificar/borrar lo que cambió).
**Complejidad:** Media
**Tiempo estimado:** ~6h

### 22. `AsignarInsumosPVA` muta array y envía `undefined`
**Descripción:** [src/pages/Orden_de_Manufactura/AsignarInsumosPVA.jsx:164](src/pages/Orden_de_Manufactura/AsignarInsumosPVA.jsx#L164) hace `ins.id_bulto_asignado = ...` (mutación directa de state). Y la línea 110 envía `id_bulto: undefined` si no hay selección.
**Posible solución:** Reemplazar mutación por `setInsumos(prev => prev.map(...))` y validar que todos los insumos tengan `id_bulto` antes del submit.
**Complejidad:** Baja
**Tiempo estimado:** ~2h

### 23. PVA permite empezar con asignaciones parciales
**Descripción:** [src/pages/PautasValorAgregado/DetailPautaValorAgregado.jsx:151](src/pages/PautasValorAgregado/DetailPautaValorAgregado.jsx#L151) solo valida `bultos.length === 0` pero no que cada insumo tenga bulto. Se puede empezar con insumos sin asignar.
**Posible solución:** Validar `insumos.every(i => i.id_bulto)` antes de habilitar el submit.
**Complejidad:** Baja
**Tiempo estimado:** ~1h

### 24. Borrar receta no chequea OMs activas
**Descripción:** [src/pages/Recetas/Recetas.jsx:161](src/pages/Recetas/Recetas.jsx#L161) confía en que el backend rechace. Si el backend no lo hace, se rompe la integridad.
**Posible solución:** El backend debe validar y devolver 409 con un mensaje claro ("hay N OMs usando esta receta"). El frontend muestra el mensaje. Mientras tanto, advertir en el confirm con un GET previo a `/ordenes-manufactura?id_receta=...`.
**Complejidad:** Media
**Tiempo estimado:** ~3h

### 25. Wizard PVA por producto deja registros huérfanos
**Descripción:** [src/pages/PVAProducto/AddPVAPorProducto.jsx:82](src/pages/PVAProducto/AddPVAPorProducto.jsx#L82) crea el PVA en paso 1 y espera que el usuario complete los insumos en paso 2. Si refresca o cierra, queda un PVA sin insumos.
**Posible solución:** Mantener el estado del wizard local hasta el último paso y enviar todo en un solo POST. Para wizards complejos, el backend puede aceptar drafts con un flag `draft: true` que se limpian con un cron.
**Complejidad:** Media
**Tiempo estimado:** ~5h

### 26. Cambiar rol sin confirm
**Descripción:** [src/pages/Roles/AsignarRoles.jsx:109](src/pages/Roles/AsignarRoles.jsx#L109) aplica el cambio en un click. Promover a admin sin diálogo es peligroso.
**Posible solución:** Modal de confirmación con el cambio explícito ("Vas a cambiar a Juan Pérez de Operario a Administrador. ¿Confirmas?").
**Complejidad:** Baja
**Tiempo estimado:** ~1h

### 27. Asignar encargado de bodega sin confirm
**Descripción:** [src/pages/Bodegas/BodegaAsignarEncargados.jsx:39](src/pages/Bodegas/BodegaAsignarEncargados.jsx#L39) hace toggle DELETE/POST en cada click de checkbox.
**Posible solución:** Igual que la anterior, modal de confirmación o un botón "Aplicar cambios" al final que envíe el diff.
**Complejidad:** Baja
**Tiempo estimado:** ~2h

### 28. PrepararPedido: split + associate no atómicos
**Descripción:** [src/pages/Solicitudes/PrepararPedido.jsx:96](src/pages/Solicitudes/PrepararPedido.jsx#L96) divide el bulto y luego lo asocia. Si la segunda llamada falla, queda un bulto huérfano dividido en inventario. Mismo en `handleDeletePallet` línea 131.
**Posible solución:** Endpoint backend que haga split+associate en transacción.
**Complejidad:** Media
**Tiempo estimado:** ~4h (frontend) + backend

### 29. Import Excel sin validar columnas ni transaccional
**Descripción:** [src/pages/Excel/AddExcel.jsx:436](src/pages/Excel/AddExcel.jsx#L436) postea cada fila sin validar headers/columnas. Y línea 453 hace un `for await` que crea N órdenes; si una falla a mitad, hay datos parciales irreversibles.
**Posible solución:** (a) Validar columnas obligatorias antes de empezar. (b) Backend acepta el batch completo y lo procesa en transacción, devolviendo qué filas fallaron.
**Complejidad:** Alta
**Tiempo estimado:** ~2 días

### 30. `QRScanner` no libera la cámara
**Descripción:** [src/components/Scanner/QRScanner.jsx:21](src/components/Scanner/QRScanner.jsx#L21) usa `scanner` capturado del primer render (siempre null). El cleanup nunca llama `scanner.clear()` real, así que el stream de la cámara queda activo tras desmontar.
**Posible solución:** Usar `useRef` para guardar la instancia del scanner y limpiar desde el ref en el cleanup.
**Complejidad:** Baja
**Tiempo estimado:** ~1h

### 31. Componentes con datos hardcodeados ficticios en producción
**Descripción:** [src/components/Insumos/SolicitudInsumosTable.jsx:5](src/components/Insumos/SolicitudInsumosTable.jsx#L5) muestra "Harina, Azúcar" hardcoded. [src/components/OrdenDeManufactura/OrderSummary.jsx:4](src/components/OrdenDeManufactura/OrderSummary.jsx#L4) siempre muestra $0. Ambos están renderizados en pantallas reales.
**Posible solución:** Reemplazar por props reales o eliminar los componentes si no se usan.
**Complejidad:** Baja-Media (depende de qué tan profundo está el bind)
**Tiempo estimado:** ~3-5h

### 32. `DireccionModal` no hace `preventDefault`
**Descripción:** [src/components/Direcciones/DireccionModal.jsx:118](src/components/Direcciones/DireccionModal.jsx#L118) — `handleSubmit` no recibe el event. Apretar Enter en un input recarga la página.
**Posible solución:** `handleSubmit = (e) => { e.preventDefault(); ... }`.
**Complejidad:** Baja
**Tiempo estimado:** ~15min

---

## Importantes

### 33. `api()` y `apiBlob()` son código duplicado
**Descripción:** [src/lib/api.js:28-104](src/lib/api.js#L28-L104) son casi idénticos salvo el `res.json()` vs `res.blob()`. Bug fixes en uno se olvidan en el otro.
**Posible solución:** Extraer un `request(path, opts)` interno y que `api`/`apiBlob` solo difieran en el parser final.
**Complejidad:** Baja
**Tiempo estimado:** ~1h

### 34. Manejo de 401 hace `window.location.href`
**Descripción:** [src/lib/api.js:57](src/lib/api.js#L57) recarga toda la app perdiendo state y rompiendo deep-links.
**Posible solución:** Emitir un evento (CustomEvent o un emitter en context) y que `AuthContext` haga `useNavigate("/login", { state: { from: location } })`.
**Complejidad:** Media
**Tiempo estimado:** ~3h

### 35. `AuthContext` tiene `setInterval` con `window.location`
**Descripción:** [src/auth/AuthContext.jsx:75](src/auth/AuthContext.jsx#L75) chequea token cada 60s y redirige con `window.location.href` (no React Router). Además duplica la verificación del primer effect.
**Posible solución:** Quitar el interval (interceptar en `api()` con el evento del punto 34 es suficiente). Si querés validez proactiva, hacerlo en el render con `useEffect` y `useNavigate`.
**Complejidad:** Media
**Tiempo estimado:** ~3h

### 36. `api.js` serializa Blob/URLSearchParams como JSON
**Descripción:** [src/lib/api.js:34](src/lib/api.js#L34) hace `typeof opts.body === "object"` y `JSON.stringify`. Eso también serializa `URLSearchParams`, `Blob`, `ArrayBuffer`, corrompiendo cuerpos válidos.
**Posible solución:** Chequear explícitamente `body instanceof Blob || body instanceof URLSearchParams || body instanceof ArrayBuffer` y dejarlos pasar.
**Complejidad:** Baja
**Tiempo estimado:** ~1h

### 37. `uploadToS3` con doble slash y sin manejo de 401
**Descripción:** [src/lib/uploadToS3.js:16](src/lib/uploadToS3.js#L16) construye `${API_BASE}/s3/upload` y según el .env queda `//s3/upload`. Tampoco maneja 401.
**Posible solución:** Normalizar `API_BASE` (sin trailing slash siempre) y usar el wrapper `api` en vez de `fetch` directo, para que herede el manejo 401.
**Complejidad:** Baja
**Tiempo estimado:** ~1h

### 38. `downloadBlob` libera la URL antes de tiempo en Safari
**Descripción:** [src/lib/downloadBlob.js:5](src/lib/downloadBlob.js#L5) hace `URL.revokeObjectURL` en `finally`. En Safari el download a veces no alcanza a procesar.
**Posible solución:** Diferir el `revokeObjectURL` con `setTimeout(..., 1000)` o `requestAnimationFrame`.
**Complejidad:** Baja
**Tiempo estimado:** ~30min

### 39. `scopeCheck.some` sin verificar que sea array
**Descripción:** [src/services/scopeCheck.js:121](src/services/scopeCheck.js#L121) hace `.some` directo. Si el backend devuelve `null` o un objeto, lanza TypeError.
**Posible solución:** `Array.isArray(scopeTypes) && scopeTypes.some(...)`.
**Complejidad:** Baja
**Tiempo estimado:** ~15min

### 40. Rutas duplicadas en Routing
**Descripción:** [src/Routing.jsx:414-417](src/Routing.jsx#L414-L417) declara `/Insumos/Categorias/add` dos veces. La segunda no se alcanza.
**Posible solución:** Borrar la duplicada.
**Complejidad:** Baja
**Tiempo estimado:** ~5min

### 41. N+1 en analítica de calidad
**Descripción:** [src/services/calidadAnalytics.js:28](src/services/calidadAnalytics.js#L28) hace una llamada por cada formulario al cargar el dashboard y NoConformidades; sin caché compartida ni paginación.
**Posible solución:** Endpoint backend que devuelva las analíticas pre-agregadas. O al menos un caché global por sesión con SWR/react-query.
**Complejidad:** Media
**Tiempo estimado:** ~6h

### 42. Calidad: filtros y búsqueda 100% client-side
**Descripción:** [src/pages/calidad/NoConformidades.jsx:47](src/pages/calidad/NoConformidades.jsx#L47) y [CalidadDashboard.jsx:56](src/pages/calidad/CalidadDashboard.jsx#L56) cargan TODO al cliente. Con miles de respuestas se pone lento.
**Posible solución:** Mover filtros/paginación al backend (`?severidad=&from=&to=`).
**Complejidad:** Media
**Tiempo estimado:** ~1 día

### 43. Imágenes en respuestas de calidad como base64
**Descripción:** [src/pages/calidad/CompletarFormulario.jsx:422](src/pages/calidad/CompletarFormulario.jsx#L422) y [RespuestaDetail.jsx:481](src/pages/calidad/RespuestaDetail.jsx#L481) embeben PNG como data URL en el JSON de respuestas. Inflan el body y rompen límites del backend.
**Posible solución:** Usar el endpoint `/s3/upload` y guardar solo el `s3_key` en la respuesta.
**Complejidad:** Media
**Tiempo estimado:** ~4h

### 44. Modales sin Escape, focus trap ni `role="dialog"`
**Descripción:** Casi todos los modales del proyecto. Listo los principales: [ConfirmModal.jsx](src/components/ConfirmModal.jsx), [Modals/*](src/components/Modals/), [DireccionModal.jsx:150](src/components/Direcciones/DireccionModal.jsx#L150), [ProductoBaseModal.jsx:212](src/components/ProductosBase/ProductoBaseModal.jsx#L212), [ModalRegistro.jsx:183](src/components/AnalisisSensorial/ModalRegistro.jsx#L183), [DividirBultoModal.jsx:126](src/components/Pallets/DividirBultoModal.jsx#L126), [QRScanner.jsx:131](src/components/Scanner/QRScanner.jsx#L131), [ActionButtons.jsx](src/components/Buttons/ActionButtons.jsx) (todos sus modales inline).
**Posible solución:** Crear un componente `BaseModal` que maneje portal + escape + focus trap + aria, y reemplazar todos los modales por instancias de éste. Es trabajo grande pero un único cambio.
**Complejidad:** Media
**Tiempo estimado:** ~1-2 días

### 45. Confirm modales reimplementados varias veces
**Descripción:** [src/components/ConfirmModal.jsx](src/components/ConfirmModal.jsx) y [src/components/Modals/ConfirmModal.jsx](src/components/Modals/ConfirmModal.jsx) son casi idénticos (literalmente copiados). Más [ConfirmActionModal](src/components/Modals/ConfirmActionModal.jsx), [SimilarNameConfirmModal](src/components/Modals/SimilarNameConfirmModal.jsx), [ConfirmDeletePreviewModal](src/components/Modals/ConfirmDeletePreviewModal.jsx), y los inline de [ActionButtons.jsx](src/components/Buttons/ActionButtons.jsx).
**Posible solución:** Un único `<ConfirmModal>` parametrizable. Eliminar los duplicados.
**Complejidad:** Baja-Media
**Tiempo estimado:** ~4h

### 46. Mismo combobox reimplementado
**Descripción:** [src/components/UI/DynamicCombobox.jsx](src/components/UI/DynamicCombobox.jsx) y [src/components/ProductosBase/ProductoBaseModal.jsx:5-101](src/components/ProductosBase/ProductoBaseModal.jsx#L5-L101) (`ProductCombobox`) son el mismo componente.
**Posible solución:** Borrar el segundo y usar `DynamicCombobox`.
**Complejidad:** Baja
**Tiempo estimado:** ~2h

### 47. Componentes monstruosos (>500 líneas)
**Descripción:** [PVAsTab.jsx](src/components/Wizard/PVAsTab.jsx) (764), [InsumosTable.jsx](src/components/Insumos/InsumosTable.jsx) (746), [CostosSecosTab.jsx](src/components/Wizard/CostosSecosTab.jsx) (513), [POEsList.jsx](src/pages/calidad/POEsList.jsx) (~800).
**Posible solución:** Extraer subcomponentes. POEsList puede separar sus 4 modales a archivos propios.
**Complejidad:** Media
**Tiempo estimado:** ~1 día por archivo

### 48. Prop drilling extremo en wizards
**Descripción:** [src/components/Wizard/RecetaTab.jsx:5](src/components/Wizard/RecetaTab.jsx#L5) recibe 30+ props. Mismo en `CostosIndirectosTab` y `PautaTab`.
**Posible solución:** Context local del wizard con `useReducer` o Zustand.
**Complejidad:** Media
**Tiempo estimado:** ~6h

### 49. `Table.jsx` sin sort ni pagination
**Descripción:** [src/components/Tables/Table.jsx](src/components/Tables/Table.jsx) es genérica pero cada page reimplementa orden/paginación.
**Posible solución:** Migrar a `@tanstack/react-table` o agregar las features a la tabla compartida.
**Complejidad:** Media
**Tiempo estimado:** ~1 día

### 50. Cero PropTypes y cero TypeScript
**Descripción:** No hay validación de props en ninguno de los 58 componentes. Bugs por props mal pasadas pasan en silencio.
**Posible solución:** Migrar a TypeScript progresivamente (empezando por `lib` y `components/UI`). Si TS es demasiado, agregar `prop-types` al menos en componentes compartidos.
**Complejidad:** Alta (TS) / Media (prop-types)
**Tiempo estimado:** ~1 semana (TS gradual)

### 51. Listas potencialmente grandes sin paginación servidor
**Descripción:** [Clientes.jsx:30](src/pages/Clientes/Clientes.jsx#L30), [Productos.jsx:137](src/pages/Productos/Productos.jsx#L137), [ListasPrecioPage.jsx:123](src/pages/ListasPrecio/ListasPrecioPage.jsx#L123), [OrdenesVentaPage.jsx:37](src/pages/Ventas/OrdenesVentaPage.jsx#L37), [Compras/Ordenes.jsx:371](src/pages/Compras/Ordenes.jsx#L371), [Facturas_IA/facturas.jsx:86](src/pages/Facturas_IA/facturas.jsx#L86). Todos cargan la lista completa al cliente.
**Posible solución:** Paginación servidor (`?limit=50&page=N`) en todos. POEsList ya tiene la base con `?limit=100`, pero también debería paginar UI.
**Complejidad:** Media
**Tiempo estimado:** ~2-3 días

### 52. `OrdenesVentaPage` carga `/clientes` + direcciones por render
**Descripción:** [src/pages/Ventas/OrdenesVentaPage.jsx:37](src/pages/Ventas/OrdenesVentaPage.jsx#L37) hace N+1 funcional: trae todos los clientes para mapear nombres en cada render.
**Posible solución:** El backend de órdenes debería incluir `cliente_nombre` y `direccion_resumen`. Mientras tanto, cachear el lookup en el cliente con SWR/react-query.
**Complejidad:** Media
**Tiempo estimado:** ~4h

### 53. Edición de orden hace N PUT/POST/DELETE secuenciales
**Descripción:** [EditOrdenVenta.jsx:399](src/pages/Ventas/EditOrdenVenta.jsx#L399) — mismo patrón que el #18 pero en update. Misma falta de transacción.
**Posible solución:** Misma que el #18 (endpoint que reciba la orden completa).
**Complejidad:** Alta
**Tiempo estimado:** Cubierto en #18

### 54. `AddLocalCliente` envía body sin `JSON.stringify`
**Descripción:** [src/pages/Locales/AddLocalCliente.jsx:44](src/pages/Locales/AddLocalCliente.jsx#L44) pasa el body como objeto. Algunos wrappers fallan o envían "[object Object]".
**Posible solución:** Usar el wrapper `api()` que ya hace stringify automático.
**Complejidad:** Baja
**Tiempo estimado:** ~15min

### 55. Negativos no bloqueados en inputs numéricos
**Descripción:** [AddOrdenVenta.jsx:318](src/pages/Ventas/AddOrdenVenta.jsx#L318), [AddOrdenJumpseller.jsx:311](src/pages/Jumpseller/AddOrdenJumpseller.jsx#L311), [CrearOrden.jsx:543](src/pages/Compras/CrearOrden.jsx#L543), [Facturas_IA/facturas.jsx:280](src/pages/Facturas_IA/facturas.jsx#L280), [EditarBulto.jsx:288](src/pages/Inventario/EditarBulto.jsx#L288), [Productos/CreateProductoWizard.jsx:172](src/pages/Productos/CreateProductoWizard.jsx#L172). Todos aceptan negativos al pegar (el `min="0"` HTML es bypasseable).
**Posible solución:** Helper `toNumberPositivo(v)` y usarlo en todos los handlers que tocan dinero/cantidades.
**Complejidad:** Baja
**Tiempo estimado:** ~3h

### 56. `facturasExtra.js` postea sin Authorization
**Descripción:** [src/services/facturasExtra.js:12](src/services/facturasExtra.js#L12) usa `apiExtra1` que no añade token. Cualquiera con la URL puede subir PDFs.
**Posible solución:** Usar el wrapper `api()` o añadir auth a `apiExtra1`.
**Complejidad:** Baja
**Tiempo estimado:** ~1h

### 57. Botones sin `disabled` durante submit (doble-submit)
**Descripción:** [AsignarInsumos.jsx:867](src/pages/Orden_de_Manufactura/AsignarInsumos.jsx#L867), [AddReceta.jsx:798](src/pages/Recetas/AddReceta.jsx#L798), [PautaElaboracionEdit.jsx:284](src/pages/PautasElaboracion/PautaElaboracionEdit.jsx#L284), [EditProcesoValorAgregado.jsx:264](src/pages/ProcesosValorAgregado/EditProcesoValorAgregado.jsx#L264), [Compras/pagarOrden](src/pages/Compras/Ordenes.jsx#L399). Todos sin `disabled={submitting}`.
**Posible solución:** Estado `submitting` y `disabled={submitting}` en cada botón crítico.
**Complejidad:** Baja
**Tiempo estimado:** ~3h

### 58. `peso_objetivo = 0` aceptado en OM
**Descripción:** [src/pages/Orden_de_Manufactura/AddOM.jsx:494](src/pages/Orden_de_Manufactura/AddOM.jsx#L494) tiene `min="0"`; permite crear OM con cantidad inválida.
**Posible solución:** `min="0.01"` y validar en el handler.
**Complejidad:** Baja
**Tiempo estimado:** ~30min

### 59. N+1 al cargar bultos disponibles en OM
**Descripción:** [AsignarInsumos.jsx:169](src/pages/Orden_de_Manufactura/AsignarInsumos.jsx#L169), [EjecutarPasosPVA.jsx:161](src/pages/Orden_de_Manufactura/EjecutarPasosPVA.jsx#L161), [DetailPautaValorAgregado.jsx:109](src/pages/PautasValorAgregado/DetailPautaValorAgregado.jsx#L109). Loops `for await` por insumo.
**Posible solución:** Endpoint backend que reciba lista de insumos y devuelva bultos disponibles para todos en una sola llamada. Mientras tanto, `Promise.all` en vez de `for await`.
**Complejidad:** Media
**Tiempo estimado:** ~4h

### 60. `key={index}` en listas que se reordenan
**Descripción:** [StepsEditor.jsx:62](src/components/Pautas/StepsEditor.jsx#L62), [Tables/EditableTable.jsx:38](src/components/Tables/EditableTable.jsx#L38), [Pallets/Palets.jsx:31](src/components/Pallets/Palets.jsx#L31), [DividirBultoModal.jsx:148](src/components/Pallets/DividirBultoModal.jsx#L148), [HistorialPasosModal.jsx:94](src/components/OrdenDeManufactura/HistorialPasosModal.jsx#L94), [DefinicionForm.jsx:252](src/components/AnalisisSensorial/DefinicionForm.jsx#L252) y varios más.
**Posible solución:** Usar `id` estable en `key`. Cuando no hay id (creación local), generar uno con `crypto.randomUUID()` al añadir el item.
**Complejidad:** Baja
**Tiempo estimado:** ~3h

### 61. Login sin throttle/captcha
**Descripción:** [src/pages/Login.jsx:26](src/pages/Login.jsx#L26) permite spam ilimitado de intentos.
**Posible solución:** El backend debe limitar intentos por IP/usuario. El frontend puede agregar un timeout creciente entre intentos como mitigación menor.
**Complejidad:** Baja (frontend) + Media (backend)
**Tiempo estimado:** ~3h

### 62. Login `from` sin validar (open redirect en SPA)
**Descripción:** [src/pages/Login.jsx:18](src/pages/Login.jsx#L18) acepta cualquier `state.from`. Aunque al ser SPA es menos peligroso, conviene validar.
**Posible solución:** Validar que `from.pathname` empiece con `/` y no con `//` o `http`.
**Complejidad:** Baja
**Tiempo estimado:** ~30min

### 63. Cambiar contraseña sin pedir la actual
**Descripción:** [src/pages/Usuarios/CambiarContrasena.jsx:32](src/pages/Usuarios/CambiarContrasena.jsx#L32) no exige la contraseña actual. Cualquier sesión activa puede cambiar password de otro id.
**Posible solución:** Agregar campo "Contraseña actual" y validar en backend antes del cambio.
**Complejidad:** Baja (frontend) + Media (backend)
**Tiempo estimado:** ~3h

### 64. Recepcionar más unidades de las despachadas
**Descripción:** [src/pages/Solicitudes/RecepcionarSolicitud.jsx:71](src/pages/Solicitudes/RecepcionarSolicitud.jsx#L71) confía en el `max` HTML, que es bypasseable. Permite stock fantasma.
**Posible solución:** Validar en JS + en backend.
**Complejidad:** Baja
**Tiempo estimado:** ~1h

### 65. Wizard PIP: GET+PUT no atómico
**Descripción:** [src/pages/PIP/CreatePipWizard.jsx:412](src/pages/PIP/CreatePipWizard.jsx#L412) hace GET de la receta y luego PUT. Si alguien la modifica en paralelo, sobreescribe.
**Posible solución:** El backend debe aceptar una versión optimista (campo `updated_at` o `version` que rechace si cambió).
**Complejidad:** Media
**Tiempo estimado:** ~4h

### 66. `useEffect` con dependencias incompletas
**Descripción:** Caso típico repetido: `[]` en useEffects que usan `apiFetch`/`api`/`canReadForms` capturados del primer render. Ejemplos: [AsignarRoles.jsx:97](src/pages/Roles/AsignarRoles.jsx#L97), [CompletarFormulario.jsx:63](src/pages/calidad/CompletarFormulario.jsx#L63), [FormularioEdit.jsx:19](src/pages/calidad/FormularioEdit.jsx#L19), [LotesList.jsx:228](src/pages/Lotes/LotesList.jsx#L228), [AddOM.jsx:166](src/pages/Orden_de_Manufactura/AddOM.jsx#L166), [AddSolicitud.jsx:33](src/pages/Solicitudes/AddSolicitud.jsx#L33), [CrearOrden.jsx:80](src/pages/Compras/CrearOrden.jsx#L80).
**Posible solución:** Habilitar `react-hooks/exhaustive-deps` como `error` en eslint y arreglar uno por uno. Para funciones inestables, usar `useCallback`.
**Complejidad:** Media
**Tiempo estimado:** ~1 día

### 67. `Estado` editable como input texto libre
**Descripción:** [src/pages/Ventas/EditOrdenVenta.jsx:556](src/pages/Ventas/EditOrdenVenta.jsx#L556) deja escribir cualquier string en el estado, rompiendo la máquina de estados.
**Posible solución:** `<select>` con los estados válidos.
**Complejidad:** Baja
**Tiempo estimado:** ~30min

### 68. `RecepcionarOrden` usa `fetch` directo
**Descripción:** [src/pages/Compras/RecepcionarOrden.jsx:67](src/pages/Compras/RecepcionarOrden.jsx#L67) bypassea el wrapper `api`, perdiendo el manejo de 401 y errores.
**Posible solución:** Migrar a `api()`.
**Complejidad:** Baja
**Tiempo estimado:** ~30min

### 69. `useMemo` con dependencias mal en AuthContext
**Descripción:** [src/auth/AuthContext.jsx:154](src/auth/AuthContext.jsx#L154) excluye `login` y `logout` de las deps. Como se redefinen en cada render, el memo es inútil.
**Posible solución:** Envolver `login`/`logout` en `useCallback` y agregarlas a las deps.
**Complejidad:** Baja
**Tiempo estimado:** ~1h

### 70. Toasts inconsistentes entre archivos
**Descripción:** [src/components/Wizard/CostosSecosTab.jsx:2](src/components/Wizard/CostosSecosTab.jsx#L2) importa `react-toastify` mientras el resto del proyecto usa `lib/toast`.
**Posible solución:** Estandarizar todos a `lib/toast` y desinstalar `react-toastify` si no se usa para nada más.
**Complejidad:** Baja
**Tiempo estimado:** ~1h

### 71. `MultiSelectInput` con `<button>` sin `type`
**Descripción:** [src/components/Forms/MultiSelectInput.jsx:101](src/components/Forms/MultiSelectInput.jsx#L101) — los botones dentro del componente, dentro de un `<form>` padre, hacen submit por default.
**Posible solución:** `type="button"` en todos los botones de `<MultiSelectInput>`.
**Complejidad:** Baja
**Tiempo estimado:** ~15min

### 72. `Navbar` Dropdown sin keyboard nav
**Descripción:** [src/components/Layout/NavbarFunction.jsx:5](src/components/Layout/NavbarFunction.jsx#L5) solo tiene `onMouseEnter/Leave`, sin `aria-expanded`/`aria-haspopup`, no navegable con teclado.
**Posible solución:** Migrar a un componente headless con accesibilidad (Radix UI, Headless UI) o agregar la lógica a mano.
**Complejidad:** Media
**Tiempo estimado:** ~4h

### 73. `SearchBar` sin `aria-label`
**Descripción:** [src/components/UI/SearchBar.jsx:14](src/components/UI/SearchBar.jsx#L14).
**Posible solución:** Agregar prop `label` o `ariaLabel`.
**Complejidad:** Baja
**Tiempo estimado:** ~15min

### 74. Mismo formulario dinámico duplicado
**Descripción:** [DynamicForm.jsx](src/components/Forms/DynamicForm.jsx) y [DynamicFormWithSelect.jsx](src/components/Forms/DynamicFormWithSelect.jsx) son casi idénticos.
**Posible solución:** Unificar en un solo `DynamicForm` con prop opcional `selects`.
**Complejidad:** Baja
**Tiempo estimado:** ~3h

### 75. Validación cliente sin validación servidor explícita
**Descripción:** [AddReceta.jsx:165](src/pages/Recetas/AddReceta.jsx#L165) valida pesos solo en frontend. Si alguien hace bypass, el backend acepta lo que llegue.
**Posible solución:** Validación duplicada (backend + frontend). El frontend es UX, el backend es seguridad.
**Complejidad:** Media
**Tiempo estimado:** ~1 día

### 76. `setTimeout` sin cleanup
**Descripción:** [AddOrdenJumpseller.jsx:332](src/pages/Jumpseller/AddOrdenJumpseller.jsx#L332) hace `setTimeout(navigate, 800)` sin clear.
**Posible solución:** Guardar el id en useRef y clearTimeout en cleanup.
**Complejidad:** Baja
**Tiempo estimado:** ~15min

### 77. `Logistica/Envios` lista no deduplicada
**Descripción:** [src/pages/Logistica/Envios.jsx:42](src/pages/Logistica/Envios.jsx#L42) concatena listas paralelas sin deduplicar; un envío que cambia de estado mid-fetch aparece dos veces.
**Posible solución:** Deduplicar por `id` con `Map` antes de setear el state.
**Complejidad:** Baja
**Tiempo estimado:** ~30min

### 78. Mutación directa de state
**Descripción:** [DefinicionForm.jsx:84](src/components/AnalisisSensorial/DefinicionForm.jsx#L84) muta `campoActual.opciones`. [StepsEditor.jsx:5](src/components/Pautas/StepsEditor.jsx#L5) muta el array de pasos. React no re-renderiza confiablemente.
**Posible solución:** Reemplazar con copias inmutables (`...spread` o `prev.map(...)`).
**Complejidad:** Baja
**Tiempo estimado:** ~2h

### 79. `handleSubmit` sin event en varios componentes
**Descripción:** [ProductoBaseModal.jsx:186](src/components/ProductosBase/ProductoBaseModal.jsx#L186) y [ModalRegistro.jsx:71](src/components/AnalisisSensorial/ModalRegistro.jsx#L71) llaman a `e.preventDefault()` desde un onClick (no es un FormEvent).
**Posible solución:** Tener un `<form onSubmit={handleSubmit}>` y un botón `type="submit"`.
**Complejidad:** Baja
**Tiempo estimado:** ~1h

---

## Menores

Los listo de manera compacta. Casi todos son arreglos de <30min por uno.

- **`api.js`** — `safeJson` swallow del error sin log ([api.js:11](src/lib/api.js#L11)). El último fallback `"Error desconocido"` es código muerto ([api.js:54](src/lib/api.js#L54)).
- **`apiextra1.js`** — `DEFAULT_DEV` y `DEFAULT_PROD` apuntan a un proyecto de otro grupo ([apiextra1.js:2](src/lib/apiextra1.js#L2)).
- **`AuthContext`** — `console.warn("Login failed:", e?.message)` en producción ([AuthContext.jsx:130](src/auth/AuthContext.jsx#L130)).
- **`fuzzyMatch`** — Levenshtein O(m·n) sin cap; con queries largas y muchos items puede congelar la UI ([fuzzyMatch.js:22](src/services/fuzzyMatch.js#L22)).
- **`formatHelpers`** — `validarRut` no chequea `null/undefined` ([formatHelpers.js:103](src/services/formatHelpers.js#L103)).
- **`main.jsx`** — Sin `Suspense` ni manejo de error ([main.jsx:8](src/main.jsx#L8)).
- **`qrCredentialsUtils`** — `console.error` con detalles del decode error ([qrCredentialsUtils.js:14](src/lib/qrCredentialsUtils.js#L14)).
- **`permissionUtils`** — Compara `userRole === 'admin'` mientras el resto usa "Administrador"/"Super Admin" ([permissionUtils.js:4](src/utils/permissionUtils.js#L4)).
- **`emailService`** — `console.error` en producción con payload del error ([emailService.js:138](src/services/emailService.js#L138)).
- **`emailService`** — `templateId: 2` hardcodeado con comentario "no cambiar el api no funciona" ([emailService.js:70](src/services/emailService.js#L70)).
- **`scopeCheck`** — Severidad heurística con threshold `0.1` arbitrario ([calidadAnalytics.js:121](src/services/calidadAnalytics.js#L121)).
- **`evaluaCondicion`** — No soporta AND/OR ni `seleccion_multiple` con `igual` ([CompletarFormulario.jsx:31](src/pages/calidad/CompletarFormulario.jsx#L31)).
- **`FormulariosList.handleToggleActivo`** — sin catch del await ([FormulariosList.jsx:150](src/pages/calidad/FormulariosList.jsx#L150)).
- **`CalidadDashboard`** — Muestra `Usuario #${id_usuario}` sin resolver nombre ([CalidadDashboard.jsx:296](src/pages/calidad/CalidadDashboard.jsx#L296)).
- **`POEsList`** — `window.confirm` en lugar del componente `ConfirmModal` del resto del módulo (inconsistencia UX).
- **`POEsList`** — Effect del preview no recarga cuando cambia version vía `onSwitchDoc`. URL puede quedar stale.
- **`toggleActivoFormulario`** — POST sin idempotency key; doble click rápido = dos POSTs ([calidad.js:35](src/services/calidad.js#L35)).
- **`fmtMoneyCLP`** — Retorna número como string si no es number ([Facturas_IA/facturas.jsx:25](src/pages/Facturas_IA/facturas.jsx#L25)).
- **`Compras/Ordenes`** — `formatCLP` rompe sortConfig numérico para `total_neto` ([Ordenes.jsx:169](src/pages/Compras/Ordenes.jsx#L169)).
- **`OrdenesVentaPage`** y `CostoMarginalList` — Formato monetario inconsistente con `CrearOrden`.
- **`Clientes`** — `window.confirm` para eliminar canal mientras el resto usa `ConfirmModal` ([Clientes.jsx:178](src/pages/Clientes/Clientes.jsx#L178)).
- **`emailSender(resp.orden.id)`** — No espera y silencia errores si resp.orden es undefined ([CrearOrden.jsx:292](src/pages/Compras/CrearOrden.jsx#L292)).
- **`OrdenesVentaPage`** — `window.confirm` para acciones críticas (enviar/entregar/eliminar) ([OrdenesVentaPage.jsx:351](src/pages/Ventas/OrdenesVentaPage.jsx#L351)).
- **`InventarioBultos`** — Persiste filtros en localStorage con catch silencioso ([InventarioBultos.jsx:131](src/pages/Inventario/InventarioBultos.jsx#L131)).
- **`InventarioInsumos`** — `new Date(item.ultimo_movimiento)` sin validar ([InventarioInsumos.jsx:30](src/pages/Inventario_Insumos/InventarioInsumos.jsx#L30)).
- **`AddUsuario`** — `toast.error(error)` pasa el objeto Error completo (renderiza "[object Object]") ([AddUsuario.jsx:46](src/pages/Usuarios/AddUsuario.jsx#L46)).
- **`StepsEditor`** — Mutación directa del array de pasos ([StepsEditor.jsx:5](src/components/Pautas/StepsEditor.jsx#L5)).
- **`RecetaDetail`** — Cada operación de ingrediente hace 2 llamadas (acción + GET completo) ([RecetaDetail.jsx:296](src/pages/Recetas/RecetaDetail.jsx#L296)).
- **`EjecutarPasos`** — Importa `api` directamente bypassando AuthContext ([EjecutarPasos.jsx:88](src/pages/Orden_de_Manufactura/EjecutarPasos.jsx#L88)).
- **`AddPVAPorProducto`** — `handleSaveInsumos` filtra silenciosamente insumos incompletos sin avisar ([AddPVAPorProducto.jsx:127](src/pages/PVAProducto/AddPVAPorProducto.jsx#L127)).
- **`Pagination`** — Sin `aria-current`, sin `aria-label` en nav, botones sin `type` explícito ([Pagination.jsx](src/components/UI/Pagination.jsx)).
- **`PalletTable`** — Botón "Generar Etiquetas" con `onClick={() => {}}` (no implementado) ([PalletTable.jsx:71](src/components/Pallets/PalletTable.jsx#L71)).
- **Componentes huérfanos (no importados en ninguna page):** [ConfirmModal.jsx](src/components/ConfirmModal.jsx) (duplicado), [EditableTable.jsx](src/components/Tables/EditableTable.jsx), [StepsTable.jsx](src/components/Tables/StepsTable.jsx), [PalletTable.jsx](src/components/Pallets/PalletTable.jsx) (solo Palets.jsx que es UI dummy), [IngredienteAdder.jsx](src/components/Recetas/IngredienteAdder.jsx).
- **`ModalRegistro`** — import `jwtDecode` no usado ([ModalRegistro.jsx:4](src/components/AnalisisSensorial/ModalRegistro.jsx#L4)).
- **`DireccionModal`** — Bloque `if (name === 'es_principal' && checked) {}` vacío (código muerto) ([DireccionModal.jsx:82](src/components/Direcciones/DireccionModal.jsx#L82)).
- **`DireccionModal.handleClose`** — Resetea sin `tipo_recinto`, deja el campo desincronizado ([DireccionModal.jsx:134](src/components/Direcciones/DireccionModal.jsx#L134)).
- **`EditableTable.handleChange`** — Recibe `type` pero nunca lo usa ([EditableTable.jsx:28](src/components/Tables/EditableTable.jsx#L28)).
- **`EditIngredientes.handleChange`** — Ignora silenciosamente valores ≤ 0 sin feedback ([EditIngredientes.jsx:64](src/components/Recetas/EditIngredientes.jsx#L64)).

---

## Plan



1. **Seguridad rápida.** XSS de toast (#4), eliminación de `permissionUtils` (#6), filtrado del mensaje en login (#9), ruta `/demo12345` (#5), `MultiSelectInput` botones sin type (#71). Todos son cambios chicos pero cierran riesgos reales.
2. **QR y credenciales.** Flujo de login por QR con token de corta duración (#7). Coordinar backend.
3. **Atomicidad.** Atacar el patrón "loop de N llamadas sin transacción" en el flujo más crítico (probablemente AddOrdenVenta #18). Ese arreglo después se replica a Recetas, PrepararPedido, AddExcel.
4. **Modales y confirmación.** Componente `BaseModal` accesible (#44) y unificación de `ConfirmModal` (#45). Simultáneo: agregar disabled durante submit en los botones críticos (#57).

Lo del token en cookie httpOnly (#1) y la migración a TS (#50) e súper largos, los dejaría planificados aparte e iría solucionado de a poco sobre la marcha.
