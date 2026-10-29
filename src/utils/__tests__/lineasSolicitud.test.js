import { describe, it, expect } from "vitest";
import {
  construirLineasSolicitud,
  desglosarEnCajas,
  totalDesdeCajas,
  normalizarLinea,
  tipoDeLinea,
} from "../lineasSolicitud";

const insumo = {
  id: 1,
  materiaPrima: { nombre: "Cuajo líquido", unidad_medida: "Litros", costo_unitario: 12000 },
  cantidad_solicitada: 2.5,
  cantidad_despachada: 2,
  cantidad_recepcionada: null,
  costo_unitario: 12000,
};

const productoTerminado = {
  id: 2,
  nombreFacturacion: { nombre: "Yogurt Griego Litro Artisan" },
  producto_por_cajas: true,
  cantidad_por_caja: 12,
  cantidad_solicitada: 36,
  cantidad_despachada: 36,
};

describe("tipoDeLinea", () => {
  it("reconoce un insumo por su materia prima", () => {
    expect(tipoDeLinea(insumo)).toBe("INSUMO");
  });

  it("reconoce un PT por su nombre de facturación", () => {
    expect(tipoDeLinea(productoTerminado)).toBe("PT");
  });

  it("reconoce un PT legacy que solo trae producto base", () => {
    expect(tipoDeLinea({ productoBase: { nombre: "Queso Crema" } })).toBe("PT");
  });

  it("devuelve null si el detalle no es ni lo uno ni lo otro", () => {
    expect(tipoDeLinea({ id: 9 })).toBeNull();
    expect(tipoDeLinea(null)).toBeNull();
  });
});

describe("normalizarLinea", () => {
  it("no le pega el sufijo (PT) al nombre", () => {
    expect(normalizarLinea(productoTerminado).nombre).toBe("Yogurt Griego Litro Artisan");
  });

  it("desglosa las cajas del PT", () => {
    const linea = normalizarLinea(productoTerminado);
    expect(linea.enCajas).toBe(true);
    expect(linea.cajas).toBe(3);
    expect(linea.unidadesPorCaja).toBe(12);
  });

  it("no inventa cajas cuando el PT se pide por unidad", () => {
    const linea = normalizarLinea({
      nombreFacturacion: { nombre: "Queso de Cabra" },
      cantidad_solicitada: 5,
    });
    expect(linea.enCajas).toBe(false);
    expect(linea.cajas).toBeNull();
  });

  it("marca como legacy el PT sin nombre de facturación", () => {
    expect(normalizarLinea({ productoBase: { nombre: "Queso Crema" } }).legacy).toBe(true);
    expect(normalizarLinea(productoTerminado).legacy).toBe(false);
  });

  it("calcula el costo despachado del insumo", () => {
    const linea = normalizarLinea(insumo);
    expect(linea.costo_despachado).toBe(30000);
    expect(linea.unidad_medida).toBe("Litros");
  });

  it("distingue una cantidad ausente de un cero", () => {
    const linea = normalizarLinea(insumo);
    expect(linea.cantidad_recepcionada).toBeNull();
    expect(normalizarLinea({ ...insumo, cantidad_recepcionada: 0 }).cantidad_recepcionada).toBe(0);
  });
});

describe("construirLineasSolicitud", () => {
  it("separa las dos listas y cuenta cada una por su lado", () => {
    const { insumos, productosTerminados, totales } = construirLineasSolicitud([
      insumo,
      productoTerminado,
    ]);

    expect(insumos).toHaveLength(1);
    expect(productosTerminados).toHaveLength(1);
    expect(totales.insumos).toBe(1);
    expect(totales.productosTerminados).toBe(1);
    expect(totales.costoInsumos).toBe(30000);
    expect(totales.cajas).toBe(3);
    expect(totales.unidadesPT).toBe(36);
  });

  it("el costo total solo considera insumos", () => {
    const { totales } = construirLineasSolicitud([productoTerminado]);
    expect(totales.costoInsumos).toBe(0);
  });

  it("tolera una solicitud sin detalles", () => {
    const { lineas, totales } = construirLineasSolicitud(undefined);
    expect(lineas).toEqual([]);
    expect(totales.insumos).toBe(0);
  });

  it("descarta detalles irreconocibles en vez de mostrarlos vacíos", () => {
    const { lineas } = construirLineasSolicitud([insumo, { id: 99 }]);
    expect(lineas).toHaveLength(1);
  });
});

// Hotfix 2026-10-28: PT sin QR despachados en cajas + sueltas (solicitudes #243/#252 en producción).

describe("despacho por cantidad de PT", () => {
  it("cajas × unidades por caja + sueltas", () => {
    expect(totalDesdeCajas(3, 2, 5)).toBe(17);
    expect(totalDesdeCajas("", 7, 5)).toBe(7);
  });

  it("lo despachado se vuelve a mostrar en cajas y sueltas", () => {
    expect(desglosarEnCajas(17, 5)).toEqual({ cajas: 3, sueltas: 2 });
    expect(desglosarEnCajas(null, 5)).toEqual({ cajas: 0, sueltas: 0 });
  });

  it("la línea trae si se despacha por cantidad y en qué unidad", () => {
    const l = normalizarLinea({
      id: 3208,
      cantidad_solicitada: 10,
      despacho_por_cantidad: true,
      nombreFacturacion: { nombre: "Queso Provoleta - Pieza x Kg", unidad_venta: "Kilogramos", unidades_por_caja: 1 },
    });
    expect(l).toMatchObject({ despachoPorCantidad: true, unidadVenta: "Kilogramos", unidadesPorCajaVenta: 1 });
  });
});
