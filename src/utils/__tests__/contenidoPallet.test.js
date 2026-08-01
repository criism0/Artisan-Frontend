import { describe, it, expect } from "vitest";
import { agruparBultosPorProducto, resumirPallet } from "../contenidoPallet";

const bultoInsumo = (id, unidades, peso) => ({
  id,
  identificador: `BULTO-I-260722-${id}`,
  MateriaPrima: { nombre: "Cuajo líquido", unidad_medida: "Litros" },
  unidades_disponibles: unidades,
  peso_unitario: peso,
});

describe("agruparBultosPorProducto", () => {
  it("junta los bultos del mismo producto y suma unidades y peso", () => {
    const grupos = agruparBultosPorProducto([
      bultoInsumo("A", 2, 5),
      bultoInsumo("B", 3, 5),
    ]);

    expect(grupos).toHaveLength(1);
    expect(grupos[0]).toMatchObject({
      nombre: "Cuajo líquido",
      unidad: "Litros",
      bultos: 2,
      unidades: 5,
      peso: 25,
    });
    expect(grupos[0].identificadores).toEqual(["BULTO-I-260722-A", "BULTO-I-260722-B"]);
  });

  it("ordena de mayor a menor cantidad de bultos", () => {
    const grupos = agruparBultosPorProducto([
      { id: 1, MateriaPrima: { nombre: "Sal" }, unidades_disponibles: 1 },
      { id: 2, MateriaPrima: { nombre: "Cuajo" }, unidades_disponibles: 1 },
      { id: 3, MateriaPrima: { nombre: "Cuajo" }, unidades_disponibles: 1 },
    ]);

    expect(grupos.map((g) => g.nombre)).toEqual(["Cuajo", "Sal"]);
  });

  it("prefiere el nombre de facturación del PT sobre el producto físico", () => {
    const grupos = agruparBultosPorProducto([
      {
        id: 1,
        loteProductoFinal: {
          nombreFacturacion: { nombre: "Yogurt Griego Litro Artisan" },
          productoBase: { nombre: "Yogurt Griego Litro Valdivia" },
        },
        unidades_disponibles: 12,
      },
    ]);

    expect(grupos[0].nombre).toBe("Yogurt Griego Litro Artisan");
  });

  it("cae al producto base cuando el PT no tiene nombre de facturación", () => {
    const grupos = agruparBultosPorProducto([
      { id: 1, loteProductoFinal: { productoBase: { nombre: "Cottage 250g SF" } } },
    ]);
    expect(grupos[0].nombre).toBe("Cottage 250g SF");
  });

  it("no descarta un bulto que no se puede identificar", () => {
    const grupos = agruparBultosPorProducto([{ id: 7, unidades_disponibles: 1 }]);
    expect(grupos[0].nombre).toBe("Sin identificar");
    expect(grupos[0].bultos).toBe(1);
  });

  it("recupera la unidad desde un bulto posterior del mismo producto", () => {
    const grupos = agruparBultosPorProducto([
      { id: 1, MateriaPrima: { nombre: "Sal" }, unidades_disponibles: 1 },
      { id: 2, MateriaPrima: { nombre: "Sal", unidad_medida: "Kilogramos" }, unidades_disponibles: 1 },
    ]);
    expect(grupos[0].unidad).toBe("Kilogramos");
  });

  it("tolera valores en texto y ausentes", () => {
    const grupos = agruparBultosPorProducto([
      { id: 1, MateriaPrima: { nombre: "Sal" }, unidades_disponibles: "4", peso_unitario: "2.5" },
      { id: 2, MateriaPrima: { nombre: "Sal" } },
    ]);
    expect(grupos[0].unidades).toBe(4);
    expect(grupos[0].peso).toBe(10);
  });

  it("devuelve vacío si no hay bultos", () => {
    expect(agruparBultosPorProducto(undefined)).toEqual([]);
  });
});

describe("resumirPallet", () => {
  it("lee los bultos vengan como Bultos o bultos", () => {
    expect(resumirPallet({ id: 1, Bultos: [bultoInsumo("A", 1, 1)] }).totalBultos).toBe(1);
    expect(resumirPallet({ id: 1, bultos: [bultoInsumo("A", 1, 1)] }).totalBultos).toBe(1);
  });

  it("arma un identificador legible cuando el pallet no lo trae", () => {
    expect(resumirPallet({ id: 42 }).identificador).toBe("Pallet #42");
  });

  it("no revienta con un pallet vacío", () => {
    const resumen = resumirPallet({ id: 3, estado: "Preparando" });
    expect(resumen.totalBultos).toBe(0);
    expect(resumen.productos).toEqual([]);
  });
});
