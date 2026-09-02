import { describe, it, expect } from "vitest";
import {
  FILTROS_VACIOS,
  ordenPasaFiltros,
  contarFiltrosActivos,
  recortarParaTooltip,
} from "../filtrosOrdenesVenta";

const ov = (over = {}) => ({
  id: 846,
  estado: "Facturada",
  factura: { folio: 24322, estado_sii: "ACEPTADO" },
  ...over,
});

describe("ordenPasaFiltros", () => {
  it("sin filtros no deja nada fuera", () => {
    expect(ordenPasaFiltros(ov(), FILTROS_VACIOS)).toBe(true);
    expect(ordenPasaFiltros(ov({ factura: null }), {})).toBe(true);
  });

  it("distingue con y sin factura", () => {
    expect(ordenPasaFiltros(ov(), { facturacion: "con" })).toBe(true);
    expect(ordenPasaFiltros(ov({ factura: null }), { facturacion: "con" })).toBe(false);
    expect(ordenPasaFiltros(ov({ factura: null }), { facturacion: "sin" })).toBe(true);
    expect(ordenPasaFiltros(ov(), { facturacion: "sin" })).toBe(false);
  });

  // 🔴 El caso real de la OV 824: se facturó y después se anuló con una NC total. El backend
  // devuelve la factura igual (ver facturaDeOrden.ts) y acá tiene que contar como facturada; si
  // no, la orden se vería como si nunca se hubiera emitido nada.
  it("una factura ANULADA cuenta como facturada", () => {
    const anulada = ov({ factura: { folio: 24322, estado_sii: "ANULADO" } });
    expect(ordenPasaFiltros(anulada, { facturacion: "con" })).toBe(true);
    expect(ordenPasaFiltros(anulada, { facturacion: "sin" })).toBe(false);
  });

  it("tolera una orden sin el campo factura", () => {
    expect(ordenPasaFiltros({ id: 1 }, { facturacion: "sin" })).toBe(true);
    expect(ordenPasaFiltros({ id: 1 }, { facturacion: "con" })).toBe(false);
  });
});

describe("contarFiltrosActivos", () => {
  it("cuenta sólo los que tienen valor", () => {
    expect(contarFiltrosActivos(FILTROS_VACIOS)).toBe(0);
    expect(contarFiltrosActivos({ facturacion: "con" })).toBe(1);
  });

  // Sólo cuenta las claves conocidas: si contara cualquier propiedad, un filtro viejo guardado
  // en localStorage inflaría el contador y el botón de limpiar mentiría.
  it("ignora claves que ya no son filtros", () => {
    expect(contarFiltrosActivos({ ...FILTROS_VACIOS, comuna: "Renca", estado: "Facturada" })).toBe(0);
  });

  it("tolera undefined", () => {
    expect(contarFiltrosActivos(undefined)).toBe(0);
  });
});

describe("recortarParaTooltip", () => {
  it("un comentario corto pasa entero", () => {
    expect(recortarParaTooltip("LOCAL MUT")).toBe("LOCAL MUT");
  });

  // El caso real: la OV 1000 de producción trae 946 caracteres de comentario.
  it("uno largo se recorta y avisa que hay más", () => {
    const r = recortarParaTooltip("a".repeat(946));
    expect(r.length).toBeLessThan(400);
    expect(r.startsWith("a".repeat(240))).toBe(true);
    expect(r).toMatch(/abre el detalle/);
  });

  it("justo en el límite no se recorta", () => {
    const exacto = "b".repeat(240);
    expect(recortarParaTooltip(exacto)).toBe(exacto);
    expect(recortarParaTooltip("b".repeat(241))).toMatch(/abre el detalle/);
  });

  it("sin comentario no hay tooltip: undefined, no un string vacío", () => {
    expect(recortarParaTooltip(null)).toBeUndefined();
    expect(recortarParaTooltip("")).toBeUndefined();
    expect(recortarParaTooltip("   ")).toBeUndefined();
  });
});
