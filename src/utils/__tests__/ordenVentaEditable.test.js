import { describe, it, expect } from "vitest";
import { puedeEditarLineasOV } from "../ordenVentaEditable.js";

describe("puedeEditarLineasOV", () => {
  it("permite editar en Creada y en Validada", () => {
    expect(puedeEditarLineasOV("Creada")).toBe(true);
    expect(puedeEditarLineasOV("Validada")).toBe(true);
  });

  it("bloquea una vez que el picking empezó", () => {
    expect(puedeEditarLineasOV("En picking")).toBe(false);
    expect(puedeEditarLineasOV("Lista para facturación")).toBe(false);
    expect(puedeEditarLineasOV("Facturada")).toBe(false);
    expect(puedeEditarLineasOV("Entregada")).toBe(false);
  });

  it("PendienteIA queda afuera — se edita desde la Cola IA, no desde este formulario", () => {
    expect(puedeEditarLineasOV("PendienteIA")).toBe(false);
  });

  it("un estado desconocido o vacío no es editable", () => {
    expect(puedeEditarLineasOV(undefined)).toBe(false);
    expect(puedeEditarLineasOV(null)).toBe(false);
    expect(puedeEditarLineasOV("")).toBe(false);
  });
});
