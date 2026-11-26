import { describe, expect, it, vi } from "vitest";
import {
  accionesOC,
  fechaDelPasoOC,
  marcaPagoOC,
  marcaRecepcionOC,
  porPagar,
} from "../ordenCompraVista.js";

const permisos = { puedeEscribir: true, puedeBorrar: true, ejecutar: vi.fn(), navigate: vi.fn() };
const etiquetas = (o, p = permisos) => {
  const { principal, menu, destructivas } = accionesOC(o, p);
  return { principal: principal?.label ?? null, menu: menu.map((a) => a.label), destructivas: destructivas.map((a) => `${a.label}${a.disabled ? " (off)" : ""}`) };
};

describe("accionesOC", () => {
  it("Creada: validar, editar, pagar y eliminar; no se retrocede", () => {
    expect(etiquetas({ id: 1, estado: "Creada" })).toEqual({
      principal: "Validar orden",
      menu: ["Editar", "Marcar como pagada"],
      destructivas: ["Eliminar"],
    });
  });

  it("Parcial: recepcionar lo que falta, cerrar con lo recibido y no se elimina", () => {
    expect(etiquetas({ id: 1, estado: "Parcialmente recepcionada", pagada: true })).toEqual({
      principal: "Recepcionar lo que falta",
      menu: ["Revertir pago", "Cerrar con lo recibido"],
      destructivas: ["Retroceder estado", "Eliminar (off)"],
    });
  });

  it("Recepcionada: sin acción principal", () => {
    expect(etiquetas({ id: 1, estado: "Recepcionada", pagada: true }).principal).toBeNull();
  });

  it("sin permiso de escritura no hay acciones que cambien la orden", () => {
    const r = etiquetas({ id: 1, estado: "Validada" }, { ...permisos, puedeEscribir: false, puedeBorrar: false });
    expect(r).toEqual({ principal: null, menu: [], destructivas: [] });
  });

  it("cerrar llama a la ruta del backend", () => {
    const ejecutar = vi.fn();
    const { menu } = accionesOC({ id: 9, estado: "Parcialmente recepcionada" }, { ...permisos, ejecutar });
    menu.find((a) => a.label === "Cerrar con lo recibido").onClick();
    expect(ejecutar).toHaveBeenCalledWith("cerrar", expect.any(String));
  });
});

describe("marcas", () => {
  it("recepción", () => {
    expect(marcaRecepcionOC(null)).toBeNull();
    expect(marcaRecepcionOC({ recepcion: { menos: 0, mas: 0 } }).texto).toBe("= pedido");
    expect(marcaRecepcionOC({ recepcion: { menos: 2, mas: 0 } }).texto).toBe("▼ 2 líneas");
    expect(marcaRecepcionOC({ recepcion: { menos: 0, mas: 1 } }).texto).toBe("▲ 1 línea");
  });

  it("pago", () => {
    expect(marcaPagoOC({ pagada: true }).texto).toBe("✓ Pagada");
    expect(marcaPagoOC({ pagada: false, requiere_prepago: true, estado: "Validada" }).texto).toBe("Prepago pendiente");
    expect(marcaPagoOC({ pagada: false, estado: "Creada" }).texto).toBe("Por pagar");
    expect(marcaPagoOC({ pagada: false, estado: "Rechazada" })).toBeNull();
  });

  it("por pagar no cuenta las creadas ni las pagadas", () => {
    expect(porPagar({ estado: "Validada", pagada: false })).toBe(true);
    expect(porPagar({ estado: "Creada", pagada: false })).toBe(false);
    expect(porPagar({ estado: "Recepcionada", pagada: true })).toBe(false);
  });
});

describe("fechaDelPasoOC", () => {
  const ahora = new Date("2026-11-26T12:00:00Z");
  it("abierta: fecha de emisión y antigua desde 30 días", () => {
    const r = fechaDelPasoOC({ estado: "Validada", fecha: "2026-10-27T12:00:00Z" }, ahora);
    expect(r).toMatchObject({ etiqueta: "emitida", dias: 30, antigua: true });
  });
  it("recibida: fecha de recepción y nunca antigua", () => {
    const r = fechaDelPasoOC({ estado: "Recepcionada", fecha: "2026-01-01", fecha_recepcion: "2026-11-20T12:00:00Z" }, ahora);
    expect(r).toMatchObject({ etiqueta: "recibida", dias: 6, antigua: false });
  });
});
