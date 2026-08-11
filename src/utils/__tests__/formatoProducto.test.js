import { describe, it, expect } from "vitest";
import { medirFormato, compararFormato } from "../formatoProducto";

describe("medirFormato", () => {
  it("lee gramos", () => {
    expect(medirFormato("Queso Camembert 150 g").valor).toBe(150);
    expect(medirFormato("Queso Cabra Ciboulette 180 g").valor).toBe(180);
  });

  it("lee kilos con coma y con punto (las dos formas conviven en el catálogo)", () => {
    expect(medirFormato("Queso Cabra Ahumado Lingote 3.5 k").valor).toBe(3500);
    expect(medirFormato("TRADICIONAL NATURAL LINGOTE 2,2 KG").valor).toBe(2200);
  });

  it("lee litros y distingue peso de volumen", () => {
    expect(medirFormato("Yogurth Griego 1 Lt")).toEqual(
      expect.objectContaining({ valor: 1000, magnitud: "volumen" }),
    );
    expect(medirFormato("Queso Brie 120 g").magnitud).toBe("peso");
  });

  it("toma la ÚLTIMA medida: el formato va al final del nombre comercial", () => {
    expect(medirFormato("Pack 6 x Queso Camembert 150 g").valor).toBe(150);
  });

  it("devuelve null cuando no hay formato declarado", () => {
    expect(medirFormato("Queso Camembert")).toBeNull();
    expect(medirFormato("")).toBeNull();
    expect(medirFormato(null)).toBeNull();
  });

  it("no confunde palabras que empiezan con una unidad", () => {
    // "5 kilos" sí; "5 granos" no debe leerse como 5 gramos.
    expect(medirFormato("Caja 5 kilos").valor).toBe(5000);
    expect(medirFormato("Bolsa 5 granos")).toBeNull();
  });
});

describe("compararFormato", () => {
  // Los tres casos reales medidos en producción el 2026-08-11, todos sugeridos al 100%.
  it("detecta el Camembert de 100 g sugerido como 150 g", () => {
    const r = compararFormato("Queso Camembert 100 g", "Queso Camembert 150 g");
    expect(r.estado).toBe("difiere");
    expect(r.pedido.valor).toBe(100);
    expect(r.sugerido.valor).toBe(150);
  });

  it("detecta las Finas Hierbas de 100 g sugeridas como 180 g", () => {
    expect(
      compararFormato(
        "Queso de Cabra Ahumado Finas Hierbas 100 g",
        "Queso Cabra Ahumado Finas Hierbas 180 g",
      ).estado,
    ).toBe("difiere");
  });

  it("detecta el Lingote de 1 Kg sugerido como 3.5 k", () => {
    expect(
      compararFormato("Queso de Cabra Ahumado Lingote 1 Kg", "Queso Cabra Ahumado Lingote 3.5 k")
        .estado,
    ).toBe("difiere");
  });

  it("marca incompleto cuando el pedido no declara formato", () => {
    expect(compararFormato("Queso Camembert", "Queso Camembert 150 g").estado).toBe("incompleto");
  });

  it("acepta el formato equivalente aunque la unidad se escriba distinto", () => {
    expect(compararFormato("Lingote 1 Kg", "Lingote 1000 g").estado).toBe("coincide");
  });

  it("no da por bueno 150 g contra 150 ml", () => {
    expect(compararFormato("Yogur 150 g", "Yogur 150 ml").estado).toBe("difiere");
  });

  it("sin_datos cuando ninguno declara formato", () => {
    expect(compararFormato("Queso Camembert", "Queso Camembert").estado).toBe("sin_datos");
  });
});
