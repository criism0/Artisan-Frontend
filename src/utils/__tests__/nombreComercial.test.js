import { describe, it, expect } from "vitest";
import { getNombreComercial } from "../nombreComercial";

describe("getNombreComercial", () => {
  it("usa el nombre de facturación de los endpoints de listas de precio", () => {
    expect(
      getNombreComercial({ nombreFacturacion: { nombre: "Queso Cabra - Feta 175 g" } }),
    ).toBe("Queso Cabra - Feta 175 g");
  });

  it("usa el nombre de facturación de los endpoints de ventas", () => {
    expect(
      getNombreComercial({ NombreFacturacion: { nombre: "Yogur Griego - Natural 1 L" } }),
    ).toBe("Yogur Griego - Natural 1 L");
  });

  it("acepta también la forma plana que usa mobile", () => {
    expect(getNombreComercial({ nombre_facturacion: "Queso Brie - 120 g" })).toBe(
      "Queso Brie - 120 g",
    );
  });

  // Es el caso que rompía: 433 de las 456 filas de listas de precio tienen
  // id_producto_base en NULL, así que el respaldo antiguo pintaba "Producto #null".
  it("nunca muestra el id del producto cuando viene en NULL", () => {
    const fila = {
      id_producto_base: null,
      nombreFacturacion: { nombre: "Queso Mantecoso - Pieza x Kg" },
    };
    expect(getNombreComercial(fila)).toBe("Queso Mantecoso - Pieza x Kg");
    expect(getNombreComercial(fila)).not.toContain("null");
  });

  it("cae al producto físico en las filas legacy sin nombre de facturación", () => {
    expect(getNombreComercial({ productoBase: { nombre: "Griego 360 Valdivia" } })).toBe(
      "Griego 360 Valdivia",
    );
    expect(getNombreComercial({ ProductoBase: { nombre: "Cottage 250g SF" } })).toBe(
      "Cottage 250g SF",
    );
  });

  it("prefiere el nombre comercial por sobre el físico cuando están los dos", () => {
    expect(
      getNombreComercial({
        nombreFacturacion: { nombre: "Yogur Griego - Natural 360 g" },
        productoBase: { nombre: "Yogur Griego 360g SF" },
      }),
    ).toBe("Yogur Griego - Natural 360 g");
  });

  it("da un respaldo legible en vez de romper con datos incompletos", () => {
    expect(getNombreComercial(null)).toBe("Sin nombre");
    expect(getNombreComercial(undefined)).toBe("Sin nombre");
    expect(getNombreComercial({})).toBe("Sin nombre");
    expect(getNombreComercial({ nombreFacturacion: null })).toBe("Sin nombre");
    expect(getNombreComercial({}, "—")).toBe("—");
  });
});
