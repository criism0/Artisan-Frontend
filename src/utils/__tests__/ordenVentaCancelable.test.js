import { describe, it, expect } from "vitest";
import { puedeCancelarOV, puedeReabrirCancelacion, puedeEliminarOV } from "../ordenVentaCancelable.js";

// Espejo de ESTADOS_ELIMINABLES del backend (409 en el resto): borrar es definitivo y arrastra
// pallets, pickeo, despacho y entregas.
describe("puedeEliminarOV", () => {
  it("permite eliminar mientras nada está comprometido con bodega", () => {
    for (const e of ["PendienteIA", "Creada", "Validada", "Cancelada"]) expect(puedeEliminarOV(e)).toBe(true);
  });

  it("bloquea desde el picking en adelante", () => {
    for (const e of ["En picking", "Lista para facturación", "Guía emitida", "Facturada parcial", "Facturada", "Entregada"])
      expect(puedeEliminarOV(e)).toBe(false);
    expect(puedeEliminarOV(undefined)).toBe(false);
  });
});

describe("puedeCancelarOV", () => {
  it("permite cancelar en Creada y en Validada", () => {
    expect(puedeCancelarOV("Creada")).toBe(true);
    expect(puedeCancelarOV("Validada")).toBe(true);
  });

  it("bloquea una vez que el picking comprometió bultos", () => {
    expect(puedeCancelarOV("En picking")).toBe(false);
    expect(puedeCancelarOV("Lista para facturación")).toBe(false);
  });

  it("bloquea una orden ya facturada o entregada", () => {
    expect(puedeCancelarOV("Facturada")).toBe(false);
    expect(puedeCancelarOV("Entregada")).toBe(false);
  });

  it("bloquea una orden ya cancelada", () => {
    expect(puedeCancelarOV("Cancelada")).toBe(false);
  });

  it("un estado desconocido o vacío no es cancelable", () => {
    expect(puedeCancelarOV(undefined)).toBe(false);
    expect(puedeCancelarOV(null)).toBe(false);
    expect(puedeCancelarOV("")).toBe(false);
  });
});

describe("puedeReabrirCancelacion", () => {
  it("sólo una orden Cancelada se puede reabrir", () => {
    expect(puedeReabrirCancelacion("Cancelada")).toBe(true);
    expect(puedeReabrirCancelacion("Creada")).toBe(false);
    expect(puedeReabrirCancelacion("Validada")).toBe(false);
    expect(puedeReabrirCancelacion(undefined)).toBe(false);
  });
});
