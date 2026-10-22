import { describe, expect, it } from "vitest";
import { esGranel, lineaEnCajas, unidadesPorCajaDeLinea } from "../formatoCantidad";

// Better Food compra por cajas y su feta por kilo (31,5 kg) se mostraba como «1,31 cajas de 24».
describe("lo que se vende a granel no va en cajas", () => {
  const feta = {
    cantidad: 31.5,
    cantidad_por_caja: 24,
    NombreFacturacion: { nombre: "Queso Cabra - Feta - Pieza x Kg", unidad_venta: "Kilogramos", unidades_por_caja: 1 },
    ProductoBase: { unidades_por_caja: 24 },
  };

  it("la feta no tiene tamaño de caja aunque el producto físico diga 24", () => {
    expect(esGranel(feta.NombreFacturacion)).toBe(true);
    expect(unidadesPorCajaDeLinea(feta)).toBeNull();
    expect(lineaEnCajas(31.5, 15790, unidadesPorCajaDeLinea(feta)).cajas).toBeNull();
  });

  it("lo que se vende por unidad sigue en cajas", () => {
    expect(unidadesPorCajaDeLinea({ NombreFacturacion: { unidad_venta: "Unidades", unidades_por_caja: 8 } })).toBe(8);
    expect(esGranel({ unidad_venta: "Unidades" })).toBe(false);
    expect(esGranel(null)).toBe(false);
  });
});
