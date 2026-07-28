import { test as setup, expect } from "@playwright/test";

const AUTH_FILE = "tests/e2e/.auth/user.json";

// Credenciales del usuario semilla local (documentadas en CLAUDE.md §0bis).
// Override con E2E_USER / E2E_PASS para otro ambiente.
const USER = process.env.E2E_USER || "admin@artisan.cl";
const PASS = process.env.E2E_PASS || "Artisan172!!";

setup("authenticate", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();

  await page.locator("#email").fill(USER);
  await page.locator("#password").fill(PASS);
  await page.getByRole("button", { name: "Entrar" }).click();

  // Login OK = salimos de /login. La auth va por cookie same-site (no localStorage),
  // y storageState captura la cookie de sesión para el resto de la suite.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });

  await page.context().storageState({ path: AUTH_FILE });
});
