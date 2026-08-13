import { describe, it, expect } from "vitest";
import {
  indexarPreciosPorNombre,
  precioUnitarioDeLista,
  precioUtil,
  formatearPesos,
} from "../preciosLista";

// Forma real de una entrada de `/producto-base-lista-precio/lista/:id`, tomada de la lista 6 de
// la copia de producción.
const entrada = (extra = {}) => ({
  id: 1,
  id_lista_precio: 6,
  id_producto_base: null,
  id_nombre_facturacion: 54,
  precio_unidad: 2334,
  precio_caja: 46680,
  unidades_por_caja: 20,
  nombreFacturacion: { id: 54, nombre: "Queso Brie - 120 g" },
  ...extra,
});

describe("indexarPreciosPorNombre", () => {
  it("indexa por nombre de facturación, no por producto físico", () => {
    // En producción `id_producto_base` viene NULL en 433 de 456 filas: indexar por ahí
    // dejaría fuera casi todo el catálogo.
    const indice = indexarPreciosPorNombre([entrada()]);
    expect(indice.get(54)).toMatchObject({ precio_unidad: 2334, precio_caja: 46680 });
    expect(indice.size).toBe(1);
  });

  it("descarta las entradas con precio 0 — es una fila sin llenar, no un precio", () => {
    const indice = indexarPreciosPorNombre([entrada({ precio_unidad: 0 })]);
    expect(indice.size).toBe(0);
  });

  it("descarta precios negativos o no numéricos", () => {
    const indice = indexarPreciosPorNombre([
      entrada({ id_nombre_facturacion: 1, precio_unidad: -5 }),
      entrada({ id_nombre_facturacion: 2, precio_unidad: null }),
      entrada({ id_nombre_facturacion: 3, precio_unidad: "no es un número" }),
    ]);
    expect(indice.size).toBe(0);
  });

  it("ignora las entradas sin nombre de facturación", () => {
    const indice = indexarPreciosPorNombre([entrada({ id_nombre_facturacion: null })]);
    expect(indice.size).toBe(0);
  });

  it("deja precio_caja en null cuando no está o es 0, sin perder el unitario", () => {
    const indice = indexarPreciosPorNombre([entrada({ precio_caja: 0 })]);
    expect(indice.get(54)).toMatchObject({ precio_unidad: 2334, precio_caja: null });
  });

  it("tolera una respuesta vacía o no-array sin reventar", () => {
    expect(indexarPreciosPorNombre([]).size).toBe(0);
    expect(indexarPreciosPorNombre(null).size).toBe(0);
    expect(indexarPreciosPorNombre(undefined).size).toBe(0);
    expect(indexarPreciosPorNombre({ data: [] }).size).toBe(0);
  });

  it("acepta el id como texto, que es como viaja en el selector", () => {
    const indice = indexarPreciosPorNombre([entrada({ id_nombre_facturacion: "54" })]);
    expect(indice.get(54)?.precio_unidad).toBe(2334);
  });
});

describe("precioUnitarioDeLista", () => {
  const indice = indexarPreciosPorNombre([entrada()]);

  it("devuelve el precio unitario del nombre pedido", () => {
    expect(precioUnitarioDeLista(indice, 54)).toBe(2334);
    expect(precioUnitarioDeLista(indice, "54")).toBe(2334);
  });

  it("devuelve null cuando el producto NO está en la lista del cliente", () => {
    // No es un error: significa que a ese cliente no se le ha fijado precio para ese producto,
    // y es justo lo que hay que decirle al operario en vez de dejar el campo en 0.
    expect(precioUnitarioDeLista(indice, 999)).toBeNull();
  });

  it("devuelve null sin índice o sin nombre", () => {
    expect(precioUnitarioDeLista(null, 54)).toBeNull();
    expect(precioUnitarioDeLista(indice, null)).toBeNull();
    expect(precioUnitarioDeLista(indice, undefined)).toBeNull();
  });
});

describe("precioUtil", () => {
  it("es la misma regla del backend: sólo un número finito mayor que 0", () => {
    expect(precioUtil(1)).toBe(true);
    expect(precioUtil("2334")).toBe(true);
    expect(precioUtil(0)).toBe(false);
    expect(precioUtil("")).toBe(false);
    expect(precioUtil(null)).toBe(false);
    expect(precioUtil(-1)).toBe(false);
    expect(precioUtil(Infinity)).toBe(false);
    expect(precioUtil("abc")).toBe(false);
  });
});

describe("formatearPesos", () => {
  it("usa separador de miles chileno", () => {
    expect(formatearPesos(2334)).toBe("$2.334");
    expect(formatearPesos(46680)).toBe("$46.680");
  });
});
