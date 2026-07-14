import { test, expect } from "@playwright/test";

// Smoke de render de TODAS las rutas autenticadas sin parámetros: cada una debe
// cargar sin 404, sin redirigir a /login y sin errores JS no capturados.
// Es la red de regresión de navegación (complementa el linter estático scripts/nav-audit.mjs).

const RUTAS = [
  "/Home",
  // Adquisiciones
  "/Ordenes", "/Ordenes/dashboard", "/Ordenes/add",
  "/Solicitudes", "/Solicitudes/add", "/Solicitudes/cargar-pallets",
  "/Proveedores", "/Proveedores/add",
  // Producción
  "/Produccion/dashboard",
  "/Orden_de_Manufactura", "/Orden_de_Manufactura/add",
  "/lotes-producto-en-proceso",
  // Logística
  "/Logistica", "/Logistica/dashboard", "/Pallets", "/Pallets/dashboard",
  // Inventario
  "/Inventario", "/Inventario/dashboard", "/Inventario/bultos", "/Inventario/tomas",
  "/productos-terminados",
  // Ventas
  "/ventas/dashboard", "/ventas/cola-ia", "/ventas/ordenes", "/ventas/ordenes/add",
  "/ventas/facturas", "/ventas/bandeja-sii", "/ventas/bandeja-dte-emitidos",
  // Calidad
  "/calidad/dashboard", "/calidad/formularios", "/calidad/formularios/nuevo",
  "/calidad/formularios/aprobaciones", "/calidad/no-conformidades", "/calidad/poes",
  // Administración · Gestión comercial
  "/clientes", "/clientes/add", "/lista-precio", "/lista-precio/add", "/NombresFacturacion",
  // Administración · Catálogos y productos
  "/InsumosPIPProductos",
  "/Insumos", "/Insumos/add", "/Insumos/asociar", "/Insumos/Categorias", "/Insumos/Categorias/add",
  "/PIP", "/PIP/crear",
  "/Productos", "/Productos/crear",
  "/CostosIndirectos", "/CostoMarginal",
  "/PautasElaboracion", "/PautasElaboracion/add",
  "/Recetas", "/Recetas/add",
  "/Bodegas", "/Bodegas/add",
  "/ProcesosValorAgregado", "/ProcesosValorAgregado/add",
  "/PautasValorAgregado", "/PautasValorAgregado/add",
  "/PVAPorProducto", "/PVAPorProducto/agregar",
  // Administración · Seguridad y acceso
  "/Usuarios", "/Usuarios/add", "/Roles", "/Roles/add", "/AsignarRoles", "/GenerarQR",
  // Integraciones / otros
  "/Excel/products", "/jumpseller/products", "/admin/bultos/cambiar-bodega",
];

for (const ruta of RUTAS) {
  test(`render ${ruta}`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));

    // "commit" resuelve al recibir la respuesta (no espera subrecursos); evita
    // timeouts por la compilación on-demand del dev server. El render real se
    // valida con la aserción de contenido de abajo.
    await page.goto(ruta, { waitUntil: "commit" });

    // Debe renderizar contenido principal (guarda contra página en blanco).
    await expect(
      page.locator("h1, h2, table, form, main").first(),
      `${ruta} no renderizó contenido`
    ).toBeVisible({ timeout: 25_000 });

    // No debe redirigir a login (sesión válida por storageState).
    expect(page.url(), `redirigió a login desde ${ruta}`).not.toContain("/login");

    // No debe ser la página 404.
    await expect(
      page.getByText("404 — ruta no encontrada"),
      `${ruta} cayó en 404`
    ).toHaveCount(0);

    // Sin excepciones JS no capturadas.
    expect(errors, `pageerrors en ${ruta}: ${errors.join(" | ")}`).toEqual([]);
  });
}
