import { describe, it, expect } from "vitest";
import {
  resumenSaldo,
  puedeCerrarSaldo,
  muestraColumnaFacturado,
  ESTADO_FACTURADA_PARCIAL,
} from "../saldoFacturacion.js";

describe("muestraColumnaFacturado", () => {
  it("🔴 una OV histórica Facturada despachada de menos se ve como antes (72 en producción)", () => {
    expect(muestraColumnaFacturado({ estado: "Facturada", saldo_facturacion: { facturas_vigentes: 1, hay_saldo: true } })).toBe(false);
    expect(muestraColumnaFacturado({ estado: "Entregada", saldo_facturacion: { facturas_vigentes: 1 } })).toBe(false);
  });
  it("sí en Facturada parcial, con dos facturas o con el saldo cerrado", () => {
    expect(muestraColumnaFacturado({ estado: ESTADO_FACTURADA_PARCIAL })).toBe(true);
    expect(muestraColumnaFacturado({ estado: "Facturada", saldo_facturacion: { facturas_vigentes: 2 } })).toBe(true);
    expect(muestraColumnaFacturado({ estado: "Facturada", saldo_cerrado_en: "2026-09-16" })).toBe(true);
  });
});

const linea = (over = {}) => ({
  id: 1,
  cantidad: 10,
  precio_venta: 1000,
  porcentaje_descuento: 0,
  NombreFacturacion: { nombre: "Queso Brie - 120 g" },
  ...over,
});

describe("resumenSaldo", () => {
  it("primera factura parcial: nada facturado antes, queda saldo tras facturar", () => {
    const r = resumenSaldo([linea({ cantidad_facturada: 0, cantidad_por_facturar: 6, cantidad_saldo: 10 })]);
    expect(r.hayFacturaPrevia).toBe(false);
    expect(r.netoPorFacturar).toBe(6000);
    expect(r.quedaSaldoTras).toBe(true);
    expect(r.lineasConSaldo).toEqual([
      { nombre: "Queso Brie - 120 g", pedida: 10, facturada: 0, por_facturar: 6, saldo_tras: 4 },
    ]);
  });

  it("segunda factura que completa: hay factura previa y no queda saldo", () => {
    const r = resumenSaldo([linea({ cantidad_facturada: 6, cantidad_por_facturar: 4, cantidad_saldo: 4 })]);
    expect(r.hayFacturaPrevia).toBe(true);
    expect(r.netoFacturado).toBe(6000);
    expect(r.netoPorFacturar).toBe(4000);
    expect(r.quedaSaldoTras).toBe(false);
  });

  it("aplica el descuento de la línea a los netos", () => {
    const r = resumenSaldo([linea({ porcentaje_descuento: 20, cantidad_facturada: 5, cantidad_por_facturar: 5 })]);
    expect(r.netoFacturado).toBe(4000);
    expect(r.netoPorFacturar).toBe(4000);
  });

  it("sin datos de saldo (respuesta vieja) no afirma nada", () => {
    const r = resumenSaldo([linea()]);
    expect(r.hayFacturaPrevia).toBe(false);
    expect(r.quedaSaldoTras).toBe(false);
  });
});

describe("puedeCerrarSaldo", () => {
  it("sólo en Facturada parcial y sin nada pickeado por facturar", () => {
    expect(puedeCerrarSaldo({ estado: ESTADO_FACTURADA_PARCIAL, saldo_facturacion: { hay_por_facturar: false } })).toBe(true);
    expect(puedeCerrarSaldo({ estado: ESTADO_FACTURADA_PARCIAL, saldo_facturacion: { hay_por_facturar: true } })).toBe(false);
    expect(puedeCerrarSaldo({ estado: "Facturada", saldo_facturacion: { hay_por_facturar: false } })).toBe(false);
  });
});
