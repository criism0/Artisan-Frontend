import { describe, expect, it } from "vitest";
import { agruparConteo, conteoACsv } from "../tomaInventario.js";

const conteo = [
  { id_bulto: 1, identificador: "BULTO-I-A", item: "Leche en polvo", id_item: 59, es_producto: false, unidad_medida: "kilogramos", contado: 25, en_sistema: 25, bodega_original: "Santiago", escaneado_por: "Amaro", fecha_escaneo: null },
  { id_bulto: 2, identificador: "BULTO-I-B", item: "Leche en polvo", id_item: 59, es_producto: false, unidad_medida: "kilogramos", contado: 12.5, en_sistema: 25, bodega_original: "Santiago", escaneado_por: "Amaro", fecha_escaneo: null },
  { id_bulto: 3, identificador: "BULTO-I-C", item: "Azúcar; flor", id_item: 7, es_producto: false, unidad_medida: "kilogramos", contado: 1.25, en_sistema: 1.25, bodega_original: null, escaneado_por: null, fecha_escaneo: null },
];

describe("agruparConteo", () => {
  it("suma por ítem lo contado y lo que decía el sistema, y ordena por nombre", () => {
    const g = agruparConteo(conteo);
    expect(g.map((x) => x.item)).toEqual(["Azúcar; flor", "Leche en polvo"]);
    expect(g[1]).toMatchObject({ bultos: 2, contado: 37.5, en_sistema: 50, diferencia: -12.5 });
    expect(g[1].filas).toHaveLength(2);
  });

  it("una toma sin nada escaneado no inventa filas", () => {
    expect(agruparConteo([])).toEqual([]);
  });
});

describe("conteoACsv", () => {
  it("usa ; y coma decimal, como lo abre Excel en Chile, con BOM para los acentos", () => {
    const csv = conteoACsv(conteo);
    expect(csv.startsWith("﻿")).toBe(true);
    const lineas = csv.slice(1).split("\r\n");
    expect(lineas[0]).toBe("Ítem;Bulto;Contado;En sistema al escanear;Diferencia;Unidad;Bodega registrada;Escaneado por;Fecha de escaneo");
    expect(lineas[2]).toBe("Leche en polvo;BULTO-I-B;12,5;25;-12,5;kg;Santiago;Amaro;");
  });

  it("un texto con ; va entre comillas para no partir la columna", () => {
    expect(conteoACsv(conteo).split("\r\n")[3].startsWith('"Azúcar; flor";')).toBe(true);
  });
});
