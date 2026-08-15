/**
 * 🔴 LA INVARIANTE DE LA CONVERSIÓN A CAJAS, EN EL FORMULARIO.
 *
 * La base guarda SIEMPRE `cantidad` en unidades y `precio_venta` por unidad. Cuando el cliente
 * compra en cajas, el formulario muestra cajas y precio por caja, y al guardar tiene que
 * convertir LAS DOS MITADES.
 *
 * El bug que esto cierra (reportado el 2026-08-15 cargando una OC de WalMart a mano): se
 * convertía la cantidad y NO el precio, así que 8 cajas a $11.984 se guardaban como 128 unidades
 * a $11.984 — dieciséis veces el pedido.
 *
 * ⚠️ Y era invisible: `total_linea` se calculaba con la cantidad SIN convertir, así que la tabla
 * mostraba $95.872, que es lo correcto. El error sólo aparecía en la orden guardada. Por eso el
 * test compara contra el monto del documento del cliente, no contra lo que se ve en pantalla.
 */
import { describe, it, expect } from "vitest";

/** Lo mismo que hacen `AddOrdenVenta` y `EditOrdenVenta` al armar el payload. */
function convertir({ cantidad, precioMostrado, unidadesPorCaja, enCajas }) {
  const convertible = Boolean(enCajas && unidadesPorCaja);
  return {
    cantidad: convertible ? cantidad * unidadesPorCaja : cantidad,
    precio_venta: convertible ? precioMostrado / unidadesPorCaja : precioMostrado,
  };
}

describe("conversión de cajas a unidades al guardar la OV", () => {
  it("🔴 el caso del correo: 8 cajas de Sémola a $11.984", () => {
    const r = convertir({ cantidad: 8, precioMostrado: 11984, unidadesPorCaja: 16, enCajas: true });
    expect(r.cantidad).toBe(128);
    expect(r.precio_venta).toBe(749);
    // Lo que importa: el monto de la línea es el del documento del cliente.
    expect(r.cantidad * r.precio_venta).toBe(8 * 11984);
  });

  it("🔴 y el precio que NO divide exacto: la caja de WalMart a $13.281 de 16", () => {
    const r = convertir({ cantidad: 10, precioMostrado: 13281, unidadesPorCaja: 16, enCajas: true });
    expect(r.cantidad).toBe(160);
    expect(r.precio_venta).toBe(830.0625);
    // Con `precio_venta` en decimal esto calza EXACTO. Con la columna INTEGER faltaba $1 por caja.
    expect(r.cantidad * r.precio_venta).toBe(10 * 13281);
  });

  it("el monto de la línea NUNCA cambia al convertir — la invariante", () => {
    const casos = [
      { cantidad: 31, precioMostrado: 46680, unidadesPorCaja: 20 },
      { cantidad: 20, precioMostrado: 11008, unidadesPorCaja: 16 },
      { cantidad: 100, precioMostrado: 11920, unidadesPorCaja: 8 },
      { cantidad: 273, precioMostrado: 12160, unidadesPorCaja: 8 },
    ];
    for (const c of casos) {
      const r = convertir({ ...c, enCajas: true });
      expect(r.cantidad * r.precio_venta).toBeCloseTo(c.cantidad * c.precioMostrado, 6);
    }
  });

  it("un cliente en unidades no se toca", () => {
    const r = convertir({ cantidad: 12, precioMostrado: 3690, unidadesPorCaja: 24, enCajas: false });
    expect(r).toEqual({ cantidad: 12, precio_venta: 3690 });
  });

  it("⚠️ sin tamaño de caja no se convierte NADA, ni cantidad ni precio", () => {
    // Convertir sólo una mitad es exactamente el bug. Si falta el dato, se dejan las dos.
    const r = convertir({ cantidad: 8, precioMostrado: 11984, unidadesPorCaja: 0, enCajas: true });
    expect(r).toEqual({ cantidad: 8, precio_venta: 11984 });
  });
});
