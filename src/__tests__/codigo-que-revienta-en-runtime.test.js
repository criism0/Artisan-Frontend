import { describe, it, expect, beforeAll } from "vitest";
import { ESLint } from "eslint";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = path.join(RAIZ, "src");

// ⚠️ Recorrido a mano y no `globSync` de node:fs: esa función no existe en el Node del CI —sí
// en el local— y el archivo entero se caía con «globSync is not a function», llevándose de paso
// el chequeo de `no-undef`. Un test que no carga no protege nada, y encima se ve como un fallo
// de otra cosa.
function archivosFuente(dir, acumulado = []) {
  for (const entrada of readdirSync(dir)) {
    const completo = path.join(dir, entrada);
    if (statSync(completo).isDirectory()) archivosFuente(completo, acumulado);
    else if (/\.(js|jsx)$/.test(entrada)) acumulado.push(completo);
  }
  return acumulado;
}

// ── Por qué existe este archivo ─────────────────────────────────────────────
//
// El 2026-08-13 se reportó que el botón «Descargar PDF» de una solicitud no hacía NADA en
// producción. La causa era esto, en dos vistas:
//
//     import(jspdf)            en vez de   import("jspdf")
//     import(jspdf-autotable)  en vez de   import("jspdf-autotable")
//
// Sin comillas, `jspdf` es un identificador que no existe y `jspdf-autotable` es una RESTA.
// Las dos formas son sintaxis válida, así que `yarn build` compila sin una queja y revienta
// recién al hacer clic. Estuvo 10 días en producción.
//
// 🔴 Y lo importante: **eslint SÍ lo cazaba**, con tres `no-undef` señalando las líneas
// exactas. Lo que falló fue el proceso — el deploy sólo corre `yarn build`, y la disciplina de
// «eslint sin errores nuevos» compara CONTEOS, así que tres errores reales se escondieron entre
// los 86 `no-unused-vars` preexistentes.
//
// Por eso el test no revisa esas dos líneas: convierte la regla en un invariante que corre con
// el resto de la suite. Un conteo no sirve de red; un cero sí.

describe("no-undef: cero en todo src", () => {
  let resultados;

  beforeAll(async () => {
    const eslint = new ESLint({ cwd: RAIZ });
    resultados = await eslint.lintFiles(["src/**/*.{js,jsx}"]);
  }, 180_000);

  it("ningún archivo usa una variable que no existe", () => {
    const errores = resultados.flatMap((r) =>
      r.messages
        .filter((m) => m.ruleId === "no-undef")
        .map((m) => `${path.relative(RAIZ, r.filePath)}:${m.line} → ${m.message}`)
    );

    // Un `no-undef` es siempre un ReferenceError esperando el clic que lo dispare. No hay
    // versión benigna: o la variable existe, o la línea no se puede ejecutar.
    expect(errores).toEqual([]);
  });
});

describe("import() dinámico", () => {
  // Red específica para la FORMA del bug, que sobrevive aunque el identificador exista.
  //
  // `import(jspdf)` con una variable `jspdf` declarada arriba pasaría `no-undef` y seguiría
  // estando mal: Vite necesita un literal para saber qué trozo emitir, y con una expresión
  // arbitraria no puede resolverlo en build.
  // Se excluye este propio archivo: menciona `import(jspdf)` en sus comentarios y en las
  // cadenas que compara, así que se detectaría a sí mismo. Los tests no se despliegan, que es
  // lo que hace inofensiva la exclusión.
  const archivos = archivosFuente(SRC).filter((f) => !f.includes("__tests__"));

  it("hay archivos que revisar (si no, el test pasa por vacío)", () => {
    expect(archivos.length).toBeGreaterThan(100);
  });

  it("todo import() recibe un string literal", () => {
    // ⚠️ Hay que sacar los comentarios ANTES de buscar. La primera versión de este test marcó
    // en rojo los comentarios que el propio arreglo dejó explicando el bug —«el `import()`
    // roto»— y habría obligado a no poder escribir sobre él nunca más.
    const sinComentarios = (texto) =>
      texto.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

    // Acepta comillas simples, dobles y backticks sin interpolación. Rechaza cualquier otra
    // cosa: identificadores, expresiones, o template strings con `${}`.
    const dinamico = /\bimport\s*\(\s*([^)]*)\)/g;
    const literal = /^\s*(['"])[^'"]+\1\s*$/;
    const backtickSimple = /^\s*`[^`${]+`\s*$/;

    const malos = [];
    for (const archivo of archivos) {
      const texto = sinComentarios(readFileSync(archivo, "utf8"));
      for (const m of texto.matchAll(dinamico)) {
        const arg = m[1];
        if (literal.test(arg) || backtickSimple.test(arg)) continue;
        const linea = texto.slice(0, m.index).split("\n").length;
        malos.push(`${path.relative(RAIZ, archivo)}:${linea} → import(${arg.trim()})`);
      }
    }

    expect(malos).toEqual([]);
  });
});

describe("jspdf se carga bajo demanda", () => {
  // La división en trozos de `adf96bb` quiso sacar jsPDF del bundle de estas vistas, pero dejó
  // los `import` estáticos arriba: el trozo lo seguía arrastrando igual y el import dinámico
  // roto sólo servía para romper el botón. Que no vuelvan a convivir.
  const vistas = [
    "src/pages/Solicitudes/SolicitudDetail.jsx",
    "src/pages/Ventas/OrdenVentaDetail.jsx",
  ];

  it.each(vistas)("%s no importa jspdf estáticamente", (relativo) => {
    const texto = readFileSync(path.join(RAIZ, relativo), "utf8");
    const estaticos = texto
      .split("\n")
      .filter((l) => /^\s*import\s+[^(]*from\s+['"]jspdf(-autotable)?['"]/.test(l));
    expect(estaticos).toEqual([]);
  });

  it.each(vistas)("%s sí lo carga con import() dentro del handler", (relativo) => {
    const texto = readFileSync(path.join(RAIZ, relativo), "utf8");
    expect(texto).toContain('import("jspdf")');
    expect(texto).toContain('import("jspdf-autotable")');
  });

  it.each(vistas)("%s tiene el import dentro de un try, no antes", (relativo) => {
    // El síntoma reportado —«el botón no hace nada»— no vino sólo del import roto: vino de que
    // el `await` estaba FUERA del try (en solicitudes) o de que no había try (en la orden de
    // venta), así que el error se escapaba sin toast. Un fallo tiene que verse.
    const texto = readFileSync(path.join(RAIZ, relativo), "utf8");
    const idx = texto.indexOf('import("jspdf")');
    const antes = texto.slice(0, idx);
    const tryMasCercano = antes.lastIndexOf("try {");
    const handler = Math.max(
      antes.lastIndexOf("handleDescargarPDF"),
      antes.lastIndexOf("handleDownloadSolicitudInsumosPDF")
    );
    expect(tryMasCercano).toBeGreaterThan(handler);
  });
});
