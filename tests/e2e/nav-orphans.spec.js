import { test, expect } from "@playwright/test";

// Verificación de rutas HUÉRFANAS (sin acceso por UI, detectadas por
// scripts/nav-audit.mjs). Renderiza cada una con un ID real para distinguir
// "página funcional pero inalcanzable" (candidata a retiro) de "ya rota".
// No es parte del smoke de navegación reachable; documenta el estado de las huérfanas.

const API = process.env.E2E_API_URL || "http://localhost:3100";

async function firstId(page, path, keys = ["id"]) {
  return await page.evaluate(
    async ({ path, keys, API }) => {
      try {
        const r = await fetch(API + path, { credentials: "include" });
        if (!r.ok) return null;
        const j = await r.json();
        const arr = Array.isArray(j) ? j : j.rows ?? j.data ?? j.items ?? j.ordenes ?? [];
        for (const it of arr) for (const k of keys) if (it?.[k] != null) return it[k];
      } catch { /* noop */ }
      return null;
    },
    { path, keys, API }
  );
}

async function checkRender(page, ruta) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(ruta, { waitUntil: "commit" });
  // Espera a que aparezca contenido principal O el texto de 404.
  let rendered = false;
  try {
    await page
      .locator('h1, h2, table, form, main, :text("404 — ruta no encontrada")')
      .first()
      .waitFor({ state: "visible", timeout: 12_000 });
    rendered = true;
  } catch { /* nada visible */ }
  const is404 = (await page.getByText("404 — ruta no encontrada").count()) > 0;
  const info = { ruta, is404, rendered: rendered && !is404, errors, url: page.url() };
  console.log(
    `  ${info.is404 ? "404" : rendered ? "RENDER" : "VACÍO"} ${ruta}` +
      (errors.length ? ` · pageerror: ${errors.join(" | ")}` : "")
  );
  return info;
}

test("huérfanas: render con ID real (documenta candidatas a retiro)", async ({ page }) => {
  test.slow();
  await page.goto("/Home");

  const ocId = await firstId(page, "/proceso-compra/ordenes", ["id", "id_orden_compra"]);
  const solId = await firstId(page, "/solicitudes-mercaderia", ["id", "id_solicitud"]);
  const cliId = await firstId(page, "/clientes", ["id"]);
  const bodId = await firstId(page, "/bodegas", ["id"]);
  const loteFinalId = await firstId(page, "/lotes-producto-final", ["id"]);
  console.log("IDs:", JSON.stringify({ ocId, solId, cliId, bodId, loteFinalId }));

  const rutas = [
    "/PautasValorAgregado",
    "/Solicitudes/cargar-pallets",
    ...(ocId ? [`/Ordenes/enviar/${ocId}`, `/Ordenes/validar/${ocId}`] : []),
    ...(solId ? [`/Solicitudes/${solId}/preparar-pedido`] : []),
    ...(bodId ? [`/Inventario/${bodId}`] : []),
    ...(cliId ? [`/clientes/${cliId}/locales/add`] : []),
    // control: la ruta restaurada debe renderizar (regresión de lotes-final)
    ...(loteFinalId ? [`/lotes-producto-final/${loteFinalId}`] : []),
  ];

  console.log("\n== Render de rutas huérfanas ==");
  const resultados = [];
  for (const r of rutas) resultados.push(await checkRender(page, r));

  // Único aserto duro: la ruta restaurada (lotes-producto-final) debe renderizar
  // — es alcanzable por Link ternario en LotesList y NO debe estar rota.
  const loteFinal = resultados.find((x) => x.ruta.startsWith("/lotes-producto-final/"));
  if (loteFinal) {
    expect(loteFinal.is404, "/lotes-producto-final/:id volvió a estar 404").toBe(false);
    expect(loteFinal.errors, `pageerror en ${loteFinal.ruta}`).toEqual([]);
  }
  // El resto son huérfanas confirmadas (candidatas a retiro): solo se documentan
  // arriba (RENDER = dead-code funcional; VACÍO/404/pageerror = ya rota).
});
