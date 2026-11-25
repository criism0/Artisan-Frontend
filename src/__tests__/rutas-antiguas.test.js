import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { REDIRECCIONES } from "../rutas";

/**
 * Fase 1 de UI (2026-11-25): las rutas de la web pasaron a minúsculas, en español y con el módulo
 * como primer tramo. Las antiguas sólo existen en `src/rutas.js` como redirecciones; si una vista
 * vuelve a navegar a una ruta antigua, el enlace funciona por la redirección pero las rutas vuelven
 * a divergir. Este test lo atrapa.
 */
const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

function archivos(dir) {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return nombre === "__tests__" ? [] : archivos(ruta);
    return /\.(jsx?|tsx?)$/.test(nombre) ? [ruta] : [];
  });
}

const PARAM = "(?:\\$\\{[^}]*\\}|[^/?#\"'`]+)";
const patron = (ruta) =>
  new RegExp(
    "^" + ruta.split("/").map((s) => (s.startsWith(":") ? PARAM : s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))).join("/") + "$",
  );
// Las de menos parámetros primero: «/clientes/add» se reporta como tal y no como «/clientes/:clienteId».
const ANTIGUAS = REDIRECCIONES.map(([antigua]) => [antigua, patron(antigua)]).sort(
  ([a], [b]) => (a.match(/:/g) || []).length - (b.match(/:/g) || []).length,
);

// Contextos de navegación (no llamadas al backend, que comparten algunos tramos como /clientes).
const NAVEGACION = /(?:navigate\(|\bto=\{?|\bto:\s*|volverA=\{?|href=\{?|<Navigate\s+to=\{?)\s*([`"'])(\/[^`"']*)\1/g;

describe("rutas de la web", () => {
  it("ninguna vista navega a una ruta antigua", () => {
    const hallazgos = [];
    for (const archivo of archivos(SRC)) {
      if (archivo.endsWith("rutas.js")) continue;
      const texto = readFileSync(archivo, "utf8");
      for (const m of texto.matchAll(NAVEGACION)) {
        const ruta = m[2].split(/[?#]/)[0];
        const antigua = ANTIGUAS.find(([, rx]) => rx.test(ruta));
        if (antigua) hallazgos.push(`${relative(SRC, archivo)}: ${m[2]} (usar la ruta nueva de ${antigua[0]})`);
      }
    }
    expect(hallazgos).toEqual([]);
  });

  it("cada redirección lleva a una ruta que existe en Routing.jsx", () => {
    const routing = readFileSync(join(SRC, "Routing.jsx"), "utf8");
    const rutas = new Set([...routing.matchAll(/path="\s*([^"]+?)\s*"/g)].map((m) => m[1].replace(/:[A-Za-z]+/g, ":p").toLowerCase()));
    const sinDestino = REDIRECCIONES.filter(([, nueva]) => !rutas.has(nueva.replace(/:[A-Za-z]+/g, ":p").toLowerCase()));
    expect(sinDestino).toEqual([]);
  });

  it("las rutas nuevas van en minúsculas", () => {
    const routing = readFileSync(join(SRC, "Routing.jsx"), "utf8");
    const conMayusculas = [...routing.matchAll(/path="\s*([^"]+?)\s*"/g)]
      .map((m) => m[1].replace(/:[A-Za-z]+/g, ""))
      .filter((p) => p !== p.toLowerCase());
    expect(conMayusculas).toEqual([]);
  });
});
