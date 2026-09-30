import { describe, it, expect } from "vitest";
import {
  contarPorFiltro,
  decodificarPolilinea,
  etiquetaFecha,
  filtrarPendientes,
  formatearMinutos,
  ordenarPendientes,
  paradasDeRutaGuardada,
} from "../rutas";

const ov = (id, fecha_entrega, extra = {}) => ({
  id,
  fecha_entrega,
  numero_oc: `OC-${id}`,
  cliente: { nombre: `Cliente ${id}` },
  estado_direccion: "ok",
  ruta: null,
  punto: { texto: "Moneda 1901, Santiago" },
  ...extra,
});

describe("orden de la lista para planificar un día", () => {
  it("el día primero, después lo próximo, después lo atrasado reciente, al final sin fecha", () => {
    const lista = [ov(1, null), ov(2, "2026-06-15"), ov(3, "2026-10-03"), ov(4, "2026-10-01"), ov(5, "2026-09-29"), ov(6, "2026-10-02")];
    expect(ordenarPendientes(lista, "2026-10-01").map((o) => o.id)).toEqual([4, 6, 3, 5, 2, 1]);
  });

  it("no muta la lista original", () => {
    const lista = [ov(1, null), ov(2, "2026-10-01")];
    ordenarPendientes(lista, "2026-10-01");
    expect(lista.map((o) => o.id)).toEqual([1, 2]);
  });
});

describe("etiqueta de la fecha", () => {
  it("dice si es del día, atrasada o sin fecha", () => {
    expect(etiquetaFecha("2026-10-01", "2026-10-01")).toEqual({ texto: "Para este día", tono: "dia" });
    expect(etiquetaFecha("2026-09-28", "2026-10-01")).toEqual({ texto: "Atrasada · 28-09", tono: "atrasada" });
    expect(etiquetaFecha(null, "2026-10-01").texto).toBe("Sin fecha");
  });
});

describe("filtros", () => {
  const lista = [
    ov(1, null, { estado_direccion: "falta", punto: null }),
    ov(2, null, { estado_direccion: "revisar" }),
    ov(3, null, { ruta: { id: 9 } }),
  ];

  it("falta / con dirección / en ruta", () => {
    expect(filtrarPendientes(lista, { filtro: "falta" }).map((o) => o.id)).toEqual([1]);
    expect(filtrarPendientes(lista, { filtro: "con_direccion" }).map((o) => o.id)).toEqual([2, 3]);
    expect(filtrarPendientes(lista, { filtro: "en_ruta" }).map((o) => o.id)).toEqual([3]);
    expect(contarPorFiltro(lista)).toEqual({ todas: 3, falta: 1, con_direccion: 2, en_ruta: 1 });
  });

  it("busca por OV, OC, cliente o dirección, sin tildes ni mayúsculas", () => {
    expect(filtrarPendientes(lista, { texto: "cliente 2" }).map((o) => o.id)).toEqual([2]);
    expect(filtrarPendientes(lista, { texto: "MONEDA" }).map((o) => o.id)).toEqual([2, 3]);
    expect(filtrarPendientes(lista, { texto: "3" }).map((o) => o.id)).toEqual([3]);
  });
});

describe("línea de la ruta", () => {
  it("decodifica la polilínea de ejemplo de la documentación de Google", () => {
    const p = decodificarPolilinea("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
    expect(p).toHaveLength(3);
    expect(p[0]).toEqual({ lat: 38.5, lng: -120.2 });
    expect(p[2]).toEqual({ lat: 43.252, lng: -126.453 });
  });

  it("sin polilínea no hay puntos", () => {
    expect(decodificarPolilinea(null)).toEqual([]);
  });
});

describe("paradas de una ruta guardada", () => {
  it("quedan con la forma de las recomendadas", () => {
    const r = paradasDeRutaGuardada({
      paradas: [{ id: 5, id_cliente: 2, cliente: { nombre_empresa: "Jumbo" }, lat: 1, lng: 2, etiqueta: "CD", ordenes: [{ id_orden_venta: 77, orden: { numero_oc: "X" } }] }],
    });
    expect(r[0]).toMatchObject({ cliente: "Jumbo", ordenes: [{ id: 77, numero_oc: "X" }] });
  });
});

it("minutos legibles", () => {
  expect(formatearMinutos(135)).toBe("2 h 15 min");
  expect(formatearMinutos(40)).toBe("40 min");
});
