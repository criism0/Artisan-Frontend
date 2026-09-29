import { describe, expect, it } from "vitest";
import {
  TIPOS,
  conteoPorTipo,
  filaExportacion,
  filtrarPorTipo,
  formatearStock,
  textoBusqueda,
} from "../inventarioVista.js";

/**
 * Reporte de Logística (2026-09-29): un insumo aparecía con Tipo = Materias Primas y no con
 * Tipo = Todos. La vista filtra ahora por tipo sobre UNAS mismas filas; esto fija que ningún
 * filtro pueda mostrar algo que «Todos» no muestra, ni perder algo que «Todos» sí muestra.
 */
const FILAS = [
  { clave: "materia_prima:59", tipo: "materia_prima", nombre: "LECHE EN POLVO", categoria: "Insumo", stock: 25, unidad_medida: "kilogramos", bultos: 1, estado_stock: "Bien", precio_total: 20000 },
  { clave: "pip:59", tipo: "pip", nombre: "LECHE EN POLVO", categoria: "Insumo", stock: 5, unidad_medida: "kilogramos", bultos: 1, estado_stock: null, precio_total: 4000 },
  { clave: "subproducto:70", tipo: "subproducto", nombre: "SUERO", categoria: "Insumo", stock: 100, unidad_medida: "litros", bultos: 2, estado_stock: null, precio_total: 0 },
  { clave: "producto_terminado:12", tipo: "producto_terminado", nombre: "Yogur Griego 1 L", categoria: "Producto terminado", stock: 40, unidad_medida: "unidades", bultos: 4, estado_stock: null, precio_total: 120000 },
];

describe("filtrarPorTipo — los filtros son subconjuntos exactos de «Todos»", () => {
  it("«Todos» son todas las filas", () => {
    expect(filtrarPorTipo(FILAS, "todos")).toBe(FILAS);
  });

  it("🔴 la unión de todos los tipos es exactamente «Todos», sin repetir ni perder filas", () => {
    const union = TIPOS.flatMap((t) => filtrarPorTipo(FILAS, t.id));
    expect(union.map((f) => f.clave).sort()).toEqual(FILAS.map((f) => f.clave).sort());
  });

  it("cada tipo trae sólo filas de ese tipo", () => {
    for (const t of TIPOS) {
      expect(filtrarPorTipo(FILAS, t.id).every((f) => f.tipo === t.id)).toBe(true);
    }
  });

  it("la materia prima y su PIP son filas distintas, cada una en su pestaña", () => {
    expect(filtrarPorTipo(FILAS, "materia_prima").map((f) => f.stock)).toEqual([25]);
    expect(filtrarPorTipo(FILAS, "pip").map((f) => f.stock)).toEqual([5]);
  });
});

describe("conteoPorTipo", () => {
  it("cuenta cada tipo y el total, y las pestañas vacías en cero", () => {
    expect(conteoPorTipo(FILAS)).toEqual({ todos: 4, materia_prima: 1, pip: 1, subproducto: 1, producto_terminado: 1 });
    expect(conteoPorTipo([])).toEqual({ todos: 0, materia_prima: 0, pip: 0, subproducto: 0, producto_terminado: 0 });
  });
});

describe("búsqueda y formato", () => {
  it("el buscador encuentra por nombre, categoría y tipo", () => {
    const t = textoBusqueda(FILAS[1]).toLowerCase();
    expect(t).toContain("leche");
    expect(t).toContain("insumo");
    expect(t).toContain("pip");
  });

  it("el stock va con su unidad abreviada", () => {
    expect(formatearStock(2300, "kilogramos")).toBe("2.300 kg");
    expect(formatearStock(1.5, "litros")).toBe("1,5 L");
  });

  it("la exportación lleva tipo, stock y costo redondeado", () => {
    expect(filaExportacion({ ...FILAS[0], precio_total: 20000.4, ultimo_movimiento: null }))
      .toEqual(["LECHE EN POLVO", "Materias primas", "Insumo", 25, "kilogramos", 1, "Bien", 20000, "—"]);
  });
});
