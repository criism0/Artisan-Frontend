import { describe, it, expect } from "vitest";
import {
  derivarFolioOC,
  diasCreditoDe,
  vencimientoPorDefecto,
  origenVencimiento,
  MAX_FOLIO_REF,
} from "../referenciaOC";

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

describe("origenVencimiento", () => {
  const base = { fechaEmision: "2026-08-16" };

  it("🔴 lo guardado en la ORDEN manda sobre cualquier condición", () => {
    // Alguien lo escribió a propósito para esta venta: no se pisa con un cálculo.
    expect(
      origenVencimiento({
        ...base,
        guardadoEnOrden: "2026-10-01",
        condicionOrden: "Credito 30 dias",
        condicionCliente: "Credito 15 dias",
      }),
    ).toEqual({ fecha: "2026-10-01", origen: "orden", glosa: null });
  });

  it("🔴 después, la condición del DOCUMENTO del cliente, no la de su ficha", () => {
    // El pedido EDI la trae declarada: es lo que el cliente acaba de pedir.
    const r = origenVencimiento({
      ...base,
      condicionOrden: "Crédito 15 días desde la factura",
      condicionCliente: "Credito 30 dias",
    });
    expect(r).toEqual({
      fecha: "2026-08-31",
      origen: "condicion_orden",
      glosa: "Crédito 15 días desde la factura",
    });
  });

  it("y al final la ficha del cliente", () => {
    expect(origenVencimiento({ ...base, condicionCliente: "Credito 30 dias" })).toEqual({
      fecha: "2026-09-15",
      origen: "condicion_cliente",
      glosa: "Credito 30 dias",
    });
  });

  it("al contado no hay fecha, y eso es correcto", () => {
    expect(origenVencimiento({ ...base, condicionCliente: "Contado" })).toMatchObject({
      fecha: "",
      origen: "contado",
    });
  });

  it("🔴 pero «a plazo sin fecha» es un dato que FALTA, no una decisión", () => {
    // «Crédito» sin número: sabemos que es a plazo y no cuántos días. La factura saldría sin
    // vencimiento, que es lo que el cliente usa para pagar.
    expect(origenVencimiento({ ...base, condicionCliente: "Credito" })).toMatchObject({
      fecha: "",
      origen: "falta",
    });
    expect(origenVencimiento({ ...base, condicionOrden: "50% Contado; 50% 30 dias" }))
      .toMatchObject({ fecha: "", origen: "falta" });
  });

  it("una condición ilegible no inventa fecha ni alarma", () => {
    // «1», «30», «Bloqueado» no son condiciones de pago: se tratan como contado.
    for (const raro of ["1", "30", "Bloqueado", "No indicado", null]) {
      expect(origenVencimiento({ ...base, condicionCliente: raro })).toMatchObject({
        fecha: "",
        origen: "contado",
      });
    }
  });

  it("⚠️ la precedencia es la MISMA que aplica el backend al emitir", () => {
    // Si la pantalla propusiera una fecha y el documento saliera con otra, nadie se entera
    // hasta que el cliente reclama. Backend: `orden.fecha_vencimiento_pago` → `orden.condiciones`
    // → `cliente.condicion_pago`.
    const conTodo = origenVencimiento({
      ...base,
      guardadoEnOrden: "2026-12-01",
      condicionOrden: "Credito 15 dias",
      condicionCliente: "Credito 30 dias",
    });
    const sinGuardado = origenVencimiento({
      ...base,
      condicionOrden: "Credito 15 dias",
      condicionCliente: "Credito 30 dias",
    });
    const soloFicha = origenVencimiento({ ...base, condicionCliente: "Credito 30 dias" });
    expect([conTodo.fecha, sinGuardado.fecha, soloFicha.fecha])
      .toEqual(["2026-12-01", "2026-08-31", "2026-09-15"]);
  });
});
