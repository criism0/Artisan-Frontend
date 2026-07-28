// Auditoría estática de navegación del frontend Artisan.
// Cruza las rutas declaradas en Routing.jsx contra todos los targets de
// navegación usados en el código (navigate(), <Link to>, BackButton to, <Navigate to>).
// Reporta: (1) links a rutas inexistentes (rotos) y (2) rutas sin enlace entrante
// (huérfanas / candidatas a obsoletas). Sin browser, determinista.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// scripts/ vive dentro del repo → src está un nivel arriba.
const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const ROUTING = join(SRC, "Routing.jsx");

// --- utilidades ---
const stripComments = (code) =>
  code
    .replace(/\/\*[\s\S]*?\*\//g, "") // /* ... */  (incluye {/* ... */} de JSX tras quitar llaves)
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1"); // // ...  (evita romper http://)

// Canonicaliza una ruta/target: quita query/hash, colapsa segmentos dinámicos (:param o ${..}) a '*'
const canon = (p) => {
  let s = p.split(/[?#]/)[0];
  s = s.replace(/\$\{[^}]*\}/g, "*"); // template literal expr -> *
  const segs = s.split("/").map((seg) => (seg.startsWith(":") || seg === "*" ? "*" : seg));
  let out = segs.join("/");
  if (out.length > 1 && out.endsWith("/")) out = out.slice(0, -1);
  return out;
};

// --- 1) rutas declaradas ---
const routingCode = stripComments(readFileSync(ROUTING, "utf8"));
const routePaths = [...routingCode.matchAll(/<Route\s+[^>]*?path=("|')([^"']+)\1/g)].map((m) => m[2]);
const routeSet = new Map(); // canon -> original
for (const r of routePaths) {
  if (r === "*") continue; // catch-all 404
  routeSet.set(canon(r), r);
}

// --- 2) walk de todos los .jsx/.js buscando targets ---
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full);
    else if (/\.(jsx?|tsx?)$/.test(name)) files.push(full);
  }
})(SRC);

// target -> [{file, raw}]
const targets = new Map();
const addTarget = (raw, file) => {
  if (!raw || !raw.startsWith("/")) return;
  const c = canon(raw);
  if (!targets.has(c)) targets.set(c, { raw, files: new Set() });
  targets.get(c).files.add(relative(SRC, file));
};

// Extrae TODOS los literales de ruta ("/..", '/..', `/..`) de un fragmento de
// código, incluyendo templates con ${} (canon los colapsa a *).
const extractPathLiterals = (fragment) => {
  const out = [];
  for (const m of fragment.matchAll(/`(\/[^`]*)`|"(\/[^"]*)"|'(\/[^']*)'/g)) {
    out.push(m[1] ?? m[2] ?? m[3]);
  }
  return out;
};

// Toma el código desde `start` hasta el primer cierre de contexto de navegación
// (`;`, `>` de cierre de tag JSX, o tope de N chars). Cubre `to={ternario}` y
// `navigate(cond ? \`/a\` : \`/b\`)` que las regex simples no capturaban.
const navWindow = (code, start) => {
  const cap = code.slice(start, start + 400);
  const stop = cap.search(/[;>]/);
  return stop === -1 ? cap : cap.slice(0, stop + 1);
};

for (const file of files) {
  const code = stripComments(readFileSync(file, "utf8"));
  // Contextos de navegación del router: navigate( ... ), to=... , <Navigate to=...
  for (const m of code.matchAll(/\bnavigate\(|\bto=|<Navigate\b/g)) {
    for (const lit of extractPathLiterals(navWindow(code, m.index))) addTarget(lit, file);
  }
}

// --- 3) cruces ---
const routeCanonLower = new Map([...routeSet.keys()].map((k) => [k.toLowerCase(), k]));
const brokenLinks = []; // target sin ruta (exacta)
const casingLinks = []; // target que solo calza ignorando mayúsculas
for (const [c, info] of targets) {
  if (c === "" || c === "/") continue;
  if (routeSet.has(c)) continue;
  const ci = routeCanonLower.get(c.toLowerCase());
  if (ci) casingLinks.push({ canon: c, route: ci, raw: info.raw, files: [...info.files] });
  else brokenLinks.push({ canon: c, raw: info.raw, files: [...info.files] });
}

const orphanRoutes = []; // ruta sin ningún target entrante
for (const [c, orig] of routeSet) {
  if (!targets.has(c)) orphanRoutes.push({ canon: c, orig });
}

// --- salida ---
const line = "─".repeat(70);
console.log(`\n${line}\nAUDITORÍA ESTÁTICA DE NAVEGACIÓN`);
console.log(`Rutas declaradas: ${routeSet.size} | Targets de navegación únicos: ${targets.size}\n${line}`);

console.log(`\n■ LINKS ROTOS (target sin ninguna ruta): ${brokenLinks.length}`);
for (const b of brokenLinks.sort((a, z) => a.canon.localeCompare(z.canon)))
  console.log(`  ✗ ${b.raw}\n      canon=${b.canon}\n      en: ${b.files.join(", ")}`);

console.log(`\n■ INCONSISTENCIA DE MAYÚSCULAS (calza solo ignorando case; React Router es case-insensitive por defecto, pero es link inconsistente): ${casingLinks.length}`);
for (const c of casingLinks.sort((a, z) => a.canon.localeCompare(z.canon)))
  console.log(`  ~ link "${c.raw}" vs ruta "${c.route}"\n      en: ${c.files.join(", ")}`);

console.log(`\n■ RUTAS HUÉRFANAS (sin navigate/Link entrante — revisar si están obsoletas): ${orphanRoutes.length}`);
for (const o of orphanRoutes.sort((a, z) => a.orig.localeCompare(z.orig)))
  console.log(`  ? ${o.orig}`);

console.log(`\n${line}\nNota: rutas huérfanas pueden alcanzarse por medios no estáticos`);
console.log(`(redirecciones, params calculados). Verificar caso a caso antes de borrar.\n${line}`);
