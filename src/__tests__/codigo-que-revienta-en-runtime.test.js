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

describe("los avisos al usuario se muestran de verdad", () => {
  // 🔴 La app reemplazó react-toastify por su propio sistema (`lib/toast.js`, «Custom toast
  // system to replace react-toastify for React 19 compatibility») y **no monta ningún
  // `<ToastContainer>`**. Un `toast.error` importado de react-toastify no falla, no avisa y no
  // deja rastro: simplemente no aparece.
  //
  // Así fallaba en silencio absoluto el botón de previsualizar de la pestaña Documentos, y es
  // el peor modo posible — el código parece manejar el error y el operario no ve nada.
  const archivos = archivosFuente(SRC).filter((f) => !f.includes("__tests__"));

  it("nadie importa toast desde react-toastify", () => {
    const malos = archivos.filter((f) =>
      /from\s+['"]react-toastify['"]/.test(readFileSync(f, "utf8"))
    );
    expect(malos.map((f) => path.relative(RAIZ, f))).toEqual([]);
  });

  it("si algún día se vuelve a usar react-toastify, tiene que haber un ToastContainer", () => {
    // El test de arriba sería una regla arbitraria sin esto: lo que importa no es la librería,
    // es que el aviso llegue a la pantalla. Si alguien monta el contenedor, react-toastify pasa
    // a ser legítimo y este par de tests deja de exigir nada raro.
    const usaLibreria = archivos.some((f) =>
      /from\s+['"]react-toastify['"]/.test(readFileSync(f, "utf8"))
    );
    const montaContenedor = archivos.some((f) =>
      /<ToastContainer/.test(readFileSync(f, "utf8"))
    );
    expect(usaLibreria && !montaContenedor).toBe(false);
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

// ── Un formulario que REESCRIBE un campo tiene que haberlo LEÍDO ────────────
//
// 🔴 El 2026-08-16 se midió que `EditOrdenVenta` mandaba `porcentaje_descuento: 0` literal en
// el PUT de toda línea existente, sin haber leído nunca el descuento que esa línea traía. O
// sea: abrir una orden en «Editar» y guardarla BORRABA los descuentos.
//
// En producción eso apuntaba a la OV 746 (Cencosud, Validada, tres líneas al 13%, 13% y 15%):
// guardarla la habría inflado de $7.351.714 a $7.767.628 — **$415.914 de sobrecobro** en una
// factura a punto de emitirse. No revienta, no avisa, y el número resultante se ve razonable.
//
// El invariante es más general que el descuento: **ningún formulario de OV manda un campo de
// la línea con un literal fijo.** Si el valor es siempre el mismo, o el campo sobra o se está
// pisando lo que había.
describe("los formularios de OV no pisan campos con literales", () => {
  const formularios = [
    "src/pages/Ventas/AddOrdenVenta.jsx",
    "src/pages/Ventas/EditOrdenVenta.jsx",
    "src/pages/Ventas/ColaIAPage.jsx",
  ];

  it.each(formularios)("%s no manda porcentaje_descuento con un valor fijo", (relativo) => {
    const texto = readFileSync(path.join(RAIZ, relativo), "utf8");
    const literales = texto
      .split("\n")
      .map((linea, i) => [i + 1, linea])
      // Los comentarios se descartan: este mismo archivo y los de las vistas EXPLICAN el bug
      // citando `porcentaje_descuento: 0`, y el invariante es sobre el código, no sobre el
      // texto. Es la misma razón por la que el test de jspdf se excluye a sí mismo.
      .filter(([, linea]) => !/^\s*(\/\/|\*|\/\*)/.test(linea))
      .filter(([, linea]) => /porcentaje_descuento:\s*-?\d/.test(linea))
      .map(([n, linea]) => `:${n} → ${linea.trim()}`);
    expect(literales).toEqual([]);
  });

  it.each(formularios)("%s calcula los montos con descuentoLinea", (relativo) => {
    // La otra mitad del mismo problema: si la tabla hace `cantidad × precio` por su cuenta,
    // muestra el bruto mientras se guarda el neto. Es exactamente cómo el bug de 16× se
    // mantuvo invisible — la pantalla decía lo correcto y la base guardaba otra cosa.
    const texto = readFileSync(path.join(RAIZ, relativo), "utf8");
    expect(texto).toMatch(/utils\/descuentoLinea/);
  });
});
