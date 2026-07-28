import { test, expect } from "@playwright/test";

// Guardia de regresión: /lotes-producto-final/:id se alcanza SOLO por un
// <Link to={ternario}> en LotesList (el linter estático no siempre ve esos
// patrones). Se borró por error una vez; este test asegura que siga viva.
const API = process.env.E2E_API_URL || "http://localhost:3100";

test("regresión: /lotes-producto-final/:id renderiza (Link ternario en LotesList)", async ({ page }) => {
  await page.goto("/Home");
  const id = await page.evaluate(async (API) => {
    try {
      const r = await fetch(API + "/lotes-producto-final", { credentials: "include" });
      if (!r.ok) return null;
      const j = await r.json();
      const arr = Array.isArray(j) ? j : j.rows ?? j.data ?? [];
      return arr[0]?.id ?? null;
    } catch {
      return null;
    }
  }, API);

  test.skip(!id, "No hay lotes de producto final en la BD para probar.");

  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`/lotes-producto-final/${id}`, { waitUntil: "commit" });

  await expect(page.locator("h1, h2, table, main").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("404 — ruta no encontrada")).toHaveCount(0);
  expect(errors, `pageerror: ${errors.join(" | ")}`).toEqual([]);
});
