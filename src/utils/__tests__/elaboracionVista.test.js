import { describe, expect, it } from "vitest";
import { barraEtapas, diasAbierta, esAnulable, etapaDe, siguienteAccion, tipoProducto } from "../elaboracionVista.js";

const estados = (om) => Object.fromEntries(barraEtapas(om).map((p) => [p.id, p.estado]));

describe("elaboracionVista", () => {
  it("usa la etapa del backend y, si no viene, la deduce del estado", () => {
    expect(etapaDe({ etapa: "por_registrar", estado: "Borrador" })).toBe("por_registrar");
    expect(etapaDe({ estado: "En ejecución" })).toBe("en_elaboracion");
    expect(etapaDe({ estado: "Cancelada" })).toBe("anulada");
  });

  it("el siguiente paso dice qué hacer y adónde ir", () => {
    expect(siguienteAccion({ etapa: "planificada" })).toMatchObject({ label: "Preparar insumos", ruta: "insumos" });
    expect(siguienteAccion({ etapa: "en_elaboracion", pasos: { hechos: 4, total: 12 } })).toMatchObject({
      label: "Ejecutar pasos · 4 de 12",
      ruta: "pasos",
    });
    expect(siguienteAccion({ etapa: "en_elaboracion", pasos: { hechos: 12, total: 12 } }).ruta).toBe("produccion-final");
    expect(siguienteAccion({ etapa: "en_elaboracion", pasos: { hechos: 0, total: 0 } }).ruta).toBe("produccion-final");
    expect(siguienteAccion({ etapa: "por_registrar" }).label).toBe("Registrar producción");
    expect(siguienteAccion({ etapa: "valor_agregado", pva: { vencidas: 1, en_proceso: 1 } })).toMatchObject({ tab: "pva", urgente: true });
    expect(siguienteAccion({ etapa: "valor_agregado", pva: { en_proceso: 1, termina: "2026-11-29T15:00:00.000Z" } }).label).toBe(
      "Valor agregado · termina 29-11"
    );
    expect(siguienteAccion({ etapa: "valor_agregado", pva: { pendientes: 1 } }).label).toBe("Comenzar valor agregado");
    expect(siguienteAccion({ etapa: "cerrada" })).toBeNull();
  });

  it("marca detenida una elaboración abierta de 14 días o más, nunca una cerrada", () => {
    const hoy = new Date("2026-11-26T12:00:00");
    expect(diasAbierta({ etapa: "por_registrar", fecha: "2026-10-15T12:00:00" }, hoy)).toEqual({ dias: 42, detenida: true });
    expect(diasAbierta({ etapa: "planificada", fecha: "2026-11-20T12:00:00" }, hoy)).toEqual({ dias: 6, detenida: false });
    expect(diasAbierta({ etapa: "cerrada", fecha: "2026-01-01" }, hoy)).toBeNull();
  });

  it("se anula hasta antes de registrar la producción", () => {
    expect(esAnulable({ etapa: "por_registrar" })).toBe(true);
    expect(esAnulable({ etapa: "valor_agregado" })).toBe(false);
    expect(esAnulable({ etapa: "anulada" })).toBe(false);
  });

  it("PIP o PT según lo que sale", () => {
    expect(tipoProducto({ id_producto_base: 3 })).toBe("PT");
    expect(tipoProducto({ id_materia_prima: 9 })).toBe("PIP");
  });

  it("barra de etapas: sin pasos, el paso 2 no aplica y la producción es la actual", () => {
    expect(estados({ etapa: "en_elaboracion", pasos: { hechos: 0, total: 0 }, pva: { total: 0 } })).toEqual({
      insumos: "hecho",
      pasos: "no_aplica",
      produccion: "actual",
      pva: "pendiente",
      cerrada: "pendiente",
    });
  });

  it("barra de etapas: con pasos pendientes, los pasos son la actual", () => {
    expect(estados({ etapa: "en_elaboracion", pasos: { hechos: 4, total: 12 } })).toMatchObject({ pasos: "actual", produccion: "pendiente" });
  });

  it("barra de etapas: cerrada sin valor agregado lo marca como no aplica", () => {
    expect(estados({ etapa: "cerrada", pasos: { hechos: 3, total: 3 }, pva: { total: 0 } })).toEqual({
      insumos: "hecho",
      pasos: "hecho",
      produccion: "hecho",
      pva: "no_aplica",
      cerrada: "hecho",
    });
    expect(estados({ etapa: "valor_agregado", pasos: { hechos: 0, total: 0 }, pva: { total: 1 } })).toMatchObject({
      produccion: "hecho",
      pva: "actual",
    });
  });
});
