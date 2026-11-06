import { describe, it, expect } from "vitest";
import { describirBulto, repartirParejo, sinCaja } from "../despacho";

describe("bultos de despacho en la web", () => {
  const lineas = [{ id_nombre_facturacion: 1, nombre: "Yogur", por_preparar: 7 }, { id_nombre_facturacion: 2, nombre: "Queso", por_preparar: 2.5 }];

  it("reparte parejo en enteros y lo fraccionado entero en la primera caja", () => {
    expect(repartirParejo(lineas, 3)).toEqual([[3, 2, 2], [2.5, 0, 0]]);
  });

  it("lo que queda sin caja descuenta las cajas cerradas", () => {
    expect(sinCaja(lineas, [[3, 2, 0], [2.5, 0, 0]], { 1: 2 })).toEqual([0, 0]);
    expect(sinCaja(lineas, [["1", "", 0], [0, 0, 0]])).toEqual([6, 2.5]);
  });

  it("describe cada bulto como se lee en la etiqueta", () => {
    expect(describirBulto({ tipo: "Armado", numero: 2, total: 3, lineas: [{ nombre: "Yogur", cantidad: 12 }] })).toBe("Caja 2 de 3 · 12 Yogur");
    expect(describirBulto({ tipo: "Suelto", numero: 1, total: 1, lineas: [{ nombre: "Queso", cantidad: 1.5 }] })).toBe("Suelto · 1,5 Queso");
  });
});
