import { describe, it, expect } from "vitest";
import {
  cantidadFacturable,
  tieneDiferenciaDePicking,
  hayPickingRegistrado,
  netoFacturable,
  netoPedido,
  resumenFacturable,
} from "../cantidadFacturable";

/** Las 9 líneas reales de la OV 778 (WalMart), factura 33-24265 emitida el 2026-08-17. */
const OV_778 = [
  { id: 1525, cantidad: 320, cantidad_pickeada: 240, precio_venta: 688, porcentaje_descuento: 0, NombreFacturacion: { nombre: "Vegurt - Frutilla 150 g" } },
  { id: 1526, cantidad: 800, cantidad_pickeada: 800, precio_venta: 1490, porcentaje_descuento: 0 },
  { id: 1527, cantidad: 80, cantidad_pickeada: 80, precio_venta: 1490, porcentaje_descuento: 0 },
  { id: 1528, cantidad: 240, cantidad_pickeada: 240, precio_venta: 1490, porcentaje_descuento: 0 },
  { id: 1529, cantidad: 320, cantidad_pickeada: 320, precio_venta: 725, porcentaje_descuento: 0 },
  { id: 1530, cantidad: 160, cantidad_pickeada: 160, precio_venta: 725, porcentaje_descuento: 0 },
  { id: 1531, cantidad: 320, cantidad_pickeada: 320, precio_venta: 725, porcentaje_descuento: 0 },
  { id: 1532, cantidad: 128, cantidad_pickeada: 128, precio_venta: 830.0625, porcentaje_descuento: 0 },
  { id: 1533, cantidad: 160, cantidad_pickeada: 160, precio_venta: 830.0625, porcentaje_descuento: 0 },
];

describe("cantidadFacturable", () => {
  it("🔴 null es «sin picking», no cero: manda lo pedido", () => {
    expect(cantidadFacturable({ cantidad: 320, cantidad_pickeada: null })).toBe(320);
    expect(cantidadFacturable({ cantidad: 320 })).toBe(320);
  });

  it("con picking manda lo pickeado", () => {
    expect(cantidadFacturable({ cantidad: 320, cantidad_pickeada: 240 })).toBe(240);
    expect(cantidadFacturable({ cantidad: 320, cantidad_pickeada: 0 })).toBe(0);
  });

  it("⚠️ un valor ilegible cae a lo pedido, no a cero", () => {
    expect(cantidadFacturable({ cantidad: 320, cantidad_pickeada: "x" })).toBe(320);
  });
});

describe("tieneDiferenciaDePicking / hayPickingRegistrado", () => {
  it("distingue «sin pickear» de «pickeado igual»", () => {
    expect(tieneDiferenciaDePicking({ cantidad: 10, cantidad_pickeada: null })).toBe(false);
    expect(tieneDiferenciaDePicking({ cantidad: 10, cantidad_pickeada: 10 })).toBe(false);
    expect(tieneDiferenciaDePicking({ cantidad: 10, cantidad_pickeada: 8 })).toBe(true);
  });

  it("la columna sólo aparece si ALGUNA línea se pickeó", () => {
    expect(hayPickingRegistrado([{ cantidad: 1, cantidad_pickeada: null }])).toBe(false);
    expect(hayPickingRegistrado(OV_778)).toBe(true);
    expect(hayPickingRegistrado(null)).toBe(false);
  });
});

describe("netos", () => {
  it("🔴 los $55.040 de la OV 778, línea 1525", () => {
    const l = OV_778[0];
    expect(netoPedido(l)).toBe(220160);
    expect(netoFacturable(l)).toBe(165120);
    expect(netoPedido(l) - netoFacturable(l)).toBe(55040);
  });

  it("aplica el descuento sobre la cantidad que corresponde", () => {
    const l = { cantidad: 920, cantidad_pickeada: 800, precio_venta: 2444, porcentaje_descuento: 13 };
    expect(netoFacturable(l)).toBeCloseTo(1701024, 6); //  800 × 2.444 − 13%
    expect(netoPedido(l)).toBeCloseTo(1956177.6, 6); //   920 × 2.444 − 13%
  });
});

describe("resumenFacturable", () => {
  it("🔴 reproduce los dos netos de la factura viva de WalMart", () => {
    const r = resumenFacturable(OV_778);
    // El neto que se emitió, y el que correspondía. Los dos medidos en producción.
    expect(Math.round(r.pedido)).toBe(2708018);
    expect(Math.round(r.facturable)).toBe(2652978);
    expect(r.difieren).toBe(true);
    expect(r.diferencias).toEqual([
      { nombre: "Vegurt - Frutilla 150 g", pedida: 320, pickeada: 240 },
    ]);
  });

  it("una orden sin picking no muestra ninguna diferencia", () => {
    const sinPicking = OV_778.map((l) => ({ ...l, cantidad_pickeada: null }));
    const r = resumenFacturable(sinPicking);
    expect(r.difieren).toBe(false);
    expect(r.hayPicking).toBe(false);
    expect(r.diferencias).toHaveLength(0);
    expect(Math.round(r.facturable)).toBe(2708018);
  });

  it("una orden pickeada completa tampoco: es el caso normal", () => {
    const completo = OV_778.map((l) => ({ ...l, cantidad_pickeada: l.cantidad }));
    const r = resumenFacturable(completo);
    expect(r.difieren).toBe(false);
    expect(r.hayPicking).toBe(true);
    expect(Math.round(r.pedido)).toBe(Math.round(r.facturable));
  });

  it("cuenta las líneas que quedaron en cero", () => {
    const r = resumenFacturable([
      { cantidad: 10, cantidad_pickeada: 0, precio_venta: 100 },
      { cantidad: 10, cantidad_pickeada: 10, precio_venta: 100 },
    ]);
    expect(r.sinNada).toBe(1);
    expect(r.facturable).toBe(1000);
  });

  it("⚠️ una diferencia menor a un peso no se avisa: el documento redondea igual", () => {
    const r = resumenFacturable([
      { cantidad: 3, cantidad_pickeada: 3.0001, precio_venta: 1, porcentaje_descuento: 0 },
    ]);
    expect(r.difieren).toBe(false);
  });

  it("aguanta una lista vacía o nula", () => {
    expect(resumenFacturable([]).facturable).toBe(0);
    expect(resumenFacturable(null).difieren).toBe(false);
  });
});
