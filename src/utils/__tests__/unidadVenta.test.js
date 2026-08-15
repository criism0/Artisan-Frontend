/**
 * La unidad de venta en la web. Espejo de `unidad-venta-ov.test.ts` del backend.
 *
 * 🔴 LAS DOS IMPLEMENTACIONES TIENEN QUE DAR LO MISMO. Si la pantalla acepta 1,5 y el servidor
 * lo rechaza, el operario llena el formulario para nada — que es exactamente lo que le pasaba a
 * Hernán con el Parmesano Rueda. Si la pantalla lo rechaza y el servidor lo acepta, el pedido no
 * se puede ingresar aunque el sistema lo soporte.
 */
import { describe, it, expect } from "vitest";
import {
  unidadVentaDe,
  admiteFraccion,
  abreviaturaUnidad,
  cantidadConUnidad,
  formatearCantidad,
  stepDeUnidad,
  problemaDeCantidad,
} from "../unidadVenta.js";

describe("unidadVentaDe", () => {
  it("lee la unidad del nombre de facturación, directo o anidado", () => {
    expect(unidadVentaDe({ unidad_venta: "Kilogramos" })).toBe("Kilogramos");
    expect(unidadVentaDe({ NombreFacturacion: { unidad_venta: "Kilogramos" } })).toBe("Kilogramos");
    expect(unidadVentaDe({ nombreFacturacion: { unidad_venta: "Litros" } })).toBe("Litros");
  });

  it("🔴 cae a Unidades cuando falta — el lado seguro, que obliga a entero", () => {
    expect(unidadVentaDe(null)).toBe("Unidades");
    expect(unidadVentaDe(undefined)).toBe("Unidades");
    expect(unidadVentaDe({})).toBe("Unidades");
    expect(unidadVentaDe({ unidad_venta: "Toneladas" })).toBe("Unidades");
  });

  it("⚠️ NO adivina desde el nombre, aunque diga «x Kg»", () => {
    expect(unidadVentaDe({ nombre: "Queso Parmesano - Pieza x Kg" })).toBe("Unidades");
  });
});

describe("admiteFraccion", () => {
  it("sólo lo que se vende a granel", () => {
    expect(admiteFraccion("Unidades")).toBe(false);
    expect(admiteFraccion("Kilogramos")).toBe(true);
    expect(admiteFraccion("Litros")).toBe(true);
  });
});

describe("problemaDeCantidad — mismo criterio que el backend", () => {
  it("🔴 rechaza 1,5 en un producto que se vende por unidad", () => {
    const p = problemaDeCantidad(1.5, "Unidades");
    expect(p).toBeTruthy();
    expect(p).toMatch(/entero/i);
  });

  it("🔴 acepta 1,5 y 2,2 kg — el pedido real del Parmesano Rueda", () => {
    expect(problemaDeCantidad(1.5, "Kilogramos")).toBeNull();
    expect(problemaDeCantidad(2.2, "Kilogramos")).toBeNull();
  });

  it("acepta enteros en las dos", () => {
    expect(problemaDeCantidad(12, "Unidades")).toBeNull();
    expect(problemaDeCantidad(4, "Kilogramos")).toBeNull();
  });

  it("rechaza vacío, cero y negativos", () => {
    expect(problemaDeCantidad("", "Kilogramos")).toBeTruthy();
    expect(problemaDeCantidad(0, "Kilogramos")).toBeTruthy();
    expect(problemaDeCantidad(-2, "Unidades")).toBeTruthy();
  });

  it("acepta lo que viene como string desde un input", () => {
    expect(problemaDeCantidad("12", "Unidades")).toBeNull();
    expect(problemaDeCantidad("1.5", "Kilogramos")).toBeNull();
    expect(problemaDeCantidad("1.5", "Unidades")).toBeTruthy();
  });
});

describe("stepDeUnidad", () => {
  it("🔴 el input no deja escribir decimales donde no corresponden", () => {
    // Es la primera línea de defensa: antes el campo aceptaba 1,5 y fallaba al guardar.
    expect(stepDeUnidad("Unidades")).toBe("1");
    expect(stepDeUnidad("Kilogramos")).toBe("0.001");
  });
});

describe("cantidadConUnidad", () => {
  it("🔴 la unidad va SIEMPRE pegada al número", () => {
    // Un «1,5» a secas se lee como una pieza y media. Es la misma lección del 14-ago: un número
    // equivocado con una etiqueta segura es peor que uno en la unidad incorrecta.
    expect(cantidadConUnidad(1.5, "Kilogramos")).toBe("1,5 kg");
    expect(cantidadConUnidad(12, "Unidades")).toBe("12 un");
    expect(cantidadConUnidad(3, "Litros")).toBe("3 L");
  });

  it("no revienta con una cantidad ausente", () => {
    expect(cantidadConUnidad(null, "Kilogramos")).toBe("—");
    expect(cantidadConUnidad(undefined, "Unidades")).toBe("—");
  });
});

describe("formatearCantidad", () => {
  it("coma decimal, que es como se lee en Chile", () => {
    expect(formatearCantidad(2.75)).toBe("2,75");
    expect(formatearCantidad(1.5)).toBe("1,5");
  });

  it("miles con separador y sin decimales de relleno", () => {
    expect(formatearCantidad(2184)).toBe("2.184");
    expect(formatearCantidad(180)).toBe("180");
  });
});

describe("abreviaturaUnidad", () => {
  it("las tres, y un default para lo desconocido", () => {
    expect(abreviaturaUnidad("Unidades")).toBe("un");
    expect(abreviaturaUnidad("Kilogramos")).toBe("kg");
    expect(abreviaturaUnidad("Litros")).toBe("L");
    expect(abreviaturaUnidad("Cualquiera")).toBe("un");
  });
});
