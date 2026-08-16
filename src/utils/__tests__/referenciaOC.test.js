import { describe, it, expect } from "vitest";
import { derivarFolioOC, diasCreditoDe, vencimientoPorDefecto, MAX_FOLIO_REF } from "../referenciaOC";

describe("derivarFolioOC", () => {
  it("deja pasar los números reales de producción", () => {
    for (const oc of ["5251131880", "13243", "WEB-260804-193256", "B202608-04499"]) {
      expect(derivarFolioOC(oc)).toEqual({ folio: oc, recortado: false, motivo: null });
    }
  });

  it("🔴 toma el primer campo cuando hay una nota pegada, y lo avisa", () => {
    expect(derivarFolioOC("B202608-04558 - Parmesano 1,5 k")).toEqual({
      folio: "B202608-04558", recortado: true, motivo: null,
    });
    expect(derivarFolioOC("WEB-260804-083619 FECHA ENTREGA 20/08").folio).toBe("WEB-260804-083619");
  });

  it("🔴 no trunca: una OC cortada es otra OC", () => {
    const r = derivarFolioOC("780791022055783379670");
    expect(r.folio).toBeNull();
    expect(r.motivo).toMatch(/21 caracteres/);
  });

  it("sin OC lo dice", () => {
    expect(derivarFolioOC("").motivo).toMatch(/no tiene número de OC/);
    expect(derivarFolioOC(null).folio).toBeNull();
  });

  it("el tope es el del SII", () => {
    expect(MAX_FOLIO_REF).toBe(18);
  });
});

describe("diasCreditoDe", () => {
  it("lee las dos grafías que conviven en producción", () => {
    expect(diasCreditoDe("Credito 30 dias")).toBe(30);
    expect(diasCreditoDe("Crédito 30 días")).toBe(30);
    expect(diasCreditoDe("Crédito 7 días")).toBe(7);
  });

  it("contado no tiene días", () => {
    expect(diasCreditoDe("Contado")).toBeNull();
  });

  it("🔴 no adivina con lo que no es una condición de pago", () => {
    for (const raro of ["1", "30", "Bloqueado", "No indicado", "", null]) {
      expect(diasCreditoDe(raro)).toBeNull();
    }
  });

  it("🔴 un pago partido no elige una mitad", () => {
    expect(diasCreditoDe("50% Contado; 50% 30 dias")).toBeNull();
  });
});

describe("vencimientoPorDefecto", () => {
  it("🔴 suma los días SIN correrse por zona horaria", () => {
    // La primera versión del backend daba 2026-09-14: `new Date('2026-08-16')` es medianoche
    // UTC y `setDate` trabaja en horario local. Un día de corrimiento en el vencimiento es lo
    // que el cliente usa para pagar.
    expect(vencimientoPorDefecto("2026-08-16", "Credito 30 dias")).toBe("2026-09-15");
    expect(vencimientoPorDefecto("2026-08-16", "Crédito 15 días")).toBe("2026-08-31");
  });

  it("cruza fin de mes y fin de año", () => {
    expect(vencimientoPorDefecto("2026-12-20", "Credito 30 dias")).toBe("2027-01-19");
    expect(vencimientoPorDefecto("2026-01-31", "Credito 30 dias")).toBe("2026-03-02");
  });

  it("sin condición legible no propone nada", () => {
    expect(vencimientoPorDefecto("2026-08-16", "Contado")).toBe("");
    expect(vencimientoPorDefecto("2026-08-16", "Bloqueado")).toBe("");
    expect(vencimientoPorDefecto("", "Credito 30 dias")).toBe("");
  });
});
