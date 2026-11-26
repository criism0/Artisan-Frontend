import { describe, expect, it } from "vitest";
import { cuadreDeLinea, cuerpoDesdeFormulario, formularioDesdeRecepcion, lotesDesde, problemasParaConfirmar, repartir } from "../recepcionOC.js";

const lineaOC = { id_linea: 7, nombre: "GUANTE TALLA L", ratio: 1 };
const listo = {
  id_bodega: "2",
  fecha_recepcion: "2026-11-26",
  fecha_documento: "2026-11-25",
  numero_factura: "4502",
  guia_despacho: "",
  lineas: { 7: { cantidad: "10", precio: "3290", bultos: [{ unidades: "5", lote: "L-1" }, { unidades: "5", lote: "L-1" }] } },
};

describe("repartir", () => {
  it("enteros parejos, el resto en los primeros", () => {
    expect(repartir(10, 3, "L").map((b) => b.unidades)).toEqual(["4", "3", "3"]);
  });
  it("decimales en partes iguales", () => {
    expect(repartir(2.5, 2).map((b) => b.unidades)).toEqual(["1.25", "1.25"]);
  });
  it("cero bultos no reparte", () => {
    expect(repartir(10, 0)).toEqual([]);
  });
});

describe("lotesDesde", () => {
  const bultos = ["asd", "a", "add", "a"].map((lote) => ({ unidades: "1", lote }));
  it("el lote del primero pasa a todos", () => {
    expect(lotesDesde(bultos, 0, "L-9").map((b) => b.lote)).toEqual(["L-9", "L-9", "L-9", "L-9"]);
  });
  it("el de un bulto del medio pasa a él y a los de abajo, no a los de arriba", () => {
    expect(lotesDesde(bultos, 2, "L-2").map((b) => b.lote)).toEqual(["asd", "a", "L-2", "L-2"]);
  });
});

describe("cuadreDeLinea", () => {
  it("cuadra con la cantidad por el formato base", () => {
    expect(cuadreDeLinea({ cantidad: "2", bultos: [{ unidades: "12" }, { unidades: "12" }] }, { ratio: 12 }).ok).toBe(true);
  });
  it("dice cuánto falta o sobra", () => {
    expect(cuadreDeLinea({ cantidad: "10", bultos: [{ unidades: "4" }] }, lineaOC).texto).toBe("faltan 6");
    expect(cuadreDeLinea({ cantidad: "1", bultos: [{ unidades: "3" }] }, lineaOC).texto).toBe("sobran 2");
  });
});

describe("problemasParaConfirmar", () => {
  it("nada que arreglar", () => {
    expect(problemasParaConfirmar(listo, [lineaOC])).toEqual([]);
  });
  it("factura o guía, fecha, y lote en cada bulto", () => {
    const f = { ...listo, numero_factura: "", fecha_documento: "", lineas: { 7: { ...listo.lineas[7], bultos: [{ unidades: "10", lote: "" }] } } };
    expect(problemasParaConfirmar(f, [lineaOC])).toEqual([
      "Indica el N° de factura o de guía.",
      "Indica la fecha de la factura o guía.",
      "Completa cantidad y lote de cada bulto de GUANTE TALLA L.",
    ]);
  });
  it("sin cantidades no se confirma", () => {
    expect(problemasParaConfirmar({ ...listo, lineas: {} }, [lineaOC])).toContain("Indica cuánto llegó de al menos un insumo.");
  });
});

describe("ida y vuelta con el servidor", () => {
  it("el borrador se lee y se vuelve a mandar igual", () => {
    const rec = {
      id_bodega: 2,
      fecha_recepcion: "2026-11-26T13:00:00.000Z",
      fecha_documento: null,
      numero_factura: ["4502", "4503"],
      guia_despacho: null,
      lineas: [{ id_linea: 7, cantidad: 10, precio: 3290, bultos: [{ unidades: 10, lote: "L-1" }] }],
    };
    const f = formularioDesdeRecepcion(rec);
    expect(f.numero_factura).toBe("4502, 4503");
    expect(cuerpoDesdeFormulario(f)).toEqual({
      id_bodega: 2,
      fecha_recepcion: "2026-11-26",
      fecha_documento: null,
      numero_factura: "4502, 4503",
      guia_despacho: "",
      lineas: [{ id_linea: 7, cantidad: 10, precio: 3290, bultos: [{ unidades: 10, lote: "L-1" }] }],
    });
  });
});
