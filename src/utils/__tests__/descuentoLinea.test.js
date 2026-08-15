import { describe, it, expect } from "vitest";
import {
  netoLinea,
  montoDescontado,
  problemaDeDescuento,
  descuentoAGuardar,
  formatearDescuento,
} from "../descuentoLinea";

describe("netoLinea", () => {
  it("sin descuento es cantidad × precio", () => {
    expect(netoLinea(920, 2444, 0)).toBe(2248480);
    expect(netoLinea(920, 2444)).toBe(2248480);
  });

  it("aplica el descuento, con los números reales de la OV 746", () => {
    expect(Math.round(netoLinea(920, 2444, 13))).toBe(1956178);
    expect(Math.round(netoLinea(200, 2334, 13))).toBe(406116);
    expect(Math.round(netoLinea(192, 2185, 15))).toBe(356592);
  });

  it("🔴 reproduce el ingreso guardado de la OV 746 sumando sus 11 líneas", () => {
    const lineas = [
      [24, 3018, 0], [920, 2444, 13], [540, 2663, 0], [144, 3993, 0],
      [120, 3993, 0], [200, 2334, 13], [84, 2114, 0], [420, 2444, 0],
      [192, 2185, 15], [96, 3993, 0], [120, 4007, 0],
    ];
    const total = lineas.reduce((s, [c, p, d]) => s + netoLinea(c, p, d), 0);
    // Es exactamente el `ingreso_venta` que tiene esa orden en producción.
    expect(Math.round(total)).toBe(7351714);
  });

  it("NO redondea: el backend redondea una sola vez, al total de la orden", () => {
    // Si cada línea se redondeara acá, la suma de la tabla dejaría de calzar con la orden.
    expect(netoLinea(3, 1000, 13.5)).toBeCloseTo(2595, 6);
    expect(Number.isInteger(netoLinea(1, 1001, 13.5))).toBe(false);
  });

  it("acepta decimales en el porcentaje", () => {
    expect(netoLinea(100, 1000, 13.5)).toBe(86500);
  });

  it("un descuento de 100 deja la línea en 0", () => {
    expect(netoLinea(920, 2444, 100)).toBe(0);
  });

  it("tolera valores ausentes sin devolver NaN", () => {
    expect(netoLinea(null, null, null)).toBe(0);
    expect(netoLinea(10, 100, undefined)).toBe(1000);
    expect(netoLinea(10, 100, "")).toBe(1000);
  });
});

describe("montoDescontado", () => {
  it("es lo que se resta del bruto", () => {
    expect(montoDescontado(920, 2444, 13)).toBeCloseTo(292302.4, 1);
  });

  it("bruto = neto + descontado, siempre", () => {
    const [c, p, d] = [192, 2185, 15];
    expect(netoLinea(c, p, d) + montoDescontado(c, p, d)).toBeCloseTo(c * p, 6);
  });
});

describe("problemaDeDescuento", () => {
  it("vacío no es un problema: la mayoría de las líneas no lleva descuento", () => {
    expect(problemaDeDescuento("")).toBeNull();
    expect(problemaDeDescuento(null)).toBeNull();
    expect(problemaDeDescuento(undefined)).toBeNull();
  });

  it("acepta 0, enteros, decimales y el tope de 100", () => {
    expect(problemaDeDescuento(0)).toBeNull();
    expect(problemaDeDescuento(13)).toBeNull();
    expect(problemaDeDescuento("13.5")).toBeNull();
    expect(problemaDeDescuento(100)).toBeNull();
  });

  it("🔴 rechaza sobre 100: dejaría la línea en monto negativo", () => {
    expect(problemaDeDescuento(101)).toMatch(/100/);
    expect(problemaDeDescuento(130)).toMatch(/negativo/);
  });

  it("🔴 rechaza negativos: serían un recargo", () => {
    expect(problemaDeDescuento(-1)).toMatch(/recargo/);
  });

  it("rechaza lo que no es número", () => {
    expect(problemaDeDescuento("trece")).toMatch(/número/);
  });
});

describe("descuentoAGuardar", () => {
  it("convierte el vacío en 0, que es lo que espera el backend", () => {
    expect(descuentoAGuardar("")).toBe(0);
    expect(descuentoAGuardar(null)).toBe(0);
    expect(descuentoAGuardar(undefined)).toBe(0);
  });

  it("conserva el número, con decimales", () => {
    expect(descuentoAGuardar("13")).toBe(13);
    expect(descuentoAGuardar("13.5")).toBe(13.5);
  });
});

describe("formatearDescuento", () => {
  it("muestra guión cuando no hay descuento, no «0%»", () => {
    // Un «0%» se lee como un descuento que alguien puso en cero.
    expect(formatearDescuento(0)).toBe("—");
    expect(formatearDescuento(null)).toBe("—");
    expect(formatearDescuento("")).toBe("—");
    expect(formatearDescuento(undefined)).toBe("—");
  });

  it("muestra el porcentaje con coma decimal", () => {
    expect(formatearDescuento(13)).toBe("13%");
    expect(formatearDescuento(13.5)).toBe("13,5%");
  });
});

describe("la invariante que el descuento NO puede romper", () => {
  it("⚠️ un porcentaje no cambia al reexpresar cajas en unidades", () => {
    // 8 cajas de 16 a $11.984 la caja == 128 unidades a $749. El descuento es el mismo en las
    // dos expresiones: convertirlo junto con la cantidad lo aplicaría dos veces.
    const enCajas = netoLinea(8, 11984, 13);
    const enUnidades = netoLinea(128, 11984 / 16, 13);
    expect(enUnidades).toBeCloseTo(enCajas, 6);
  });
});
