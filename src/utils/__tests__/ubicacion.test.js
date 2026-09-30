import { describe, it, expect } from "vitest";
import {
  describirUbicacion,
  esUbicacionConfiable,
  leerCoordenada,
  leerParCoordenadas,
} from "../ubicacion";
import { entregaDeOrden, entregaVacia, ubicacionDeDireccion, ubicacionDeEntrega } from "../../services/ubicacionService";

describe("qué ubicación sirve para rutear (espejo del backend)", () => {
  it("sólo la puerta, la cuadra o el pin manual", () => {
    for (const p of ["ROOFTOP", "RANGE_INTERPOLATED", "MANUAL"]) expect(esUbicacionConfiable(-33, -70, p)).toBe(true);
    for (const p of ["GEOMETRIC_CENTER", "APPROXIMATE", "PARCIAL", "COMUNA_DISTINTA", null]) {
      expect(esUbicacionConfiable(-33, -70, p)).toBe(false);
    }
    expect(esUbicacionConfiable(null, null, "MANUAL")).toBe(false);
  });

  it("dice en palabras qué pasa y con qué tono", () => {
    expect(describirUbicacion(null, null, null)).toEqual({ texto: "Sin ubicar", tono: "falta" });
    expect(describirUbicacion(-33, -70, "COMUNA_DISTINTA").tono).toBe("duda");
    expect(describirUbicacion(-33, -70, "MANUAL").tono).toBe("ok");
  });
});

describe("coordenadas escritas a mano", () => {
  it("acepta coma decimal y rechaza texto", () => {
    expect(leerCoordenada("-33,4428")).toBe(-33.4428);
    expect(leerCoordenada("")).toBeNull();
    expect(leerCoordenada("abc")).toBeNull();
  });

  it("lee el par tal como lo copia Google Maps", () => {
    expect(leerParCoordenadas("-33.4428, -70.6536")).toEqual({ lat: -33.4428, lng: -70.6536 });
    expect(leerParCoordenadas("-33.4428 -70.6536")).toEqual({ lat: -33.4428, lng: -70.6536 });
    expect(leerParCoordenadas("Moneda 1901")).toBeNull();
  });
});

describe("adaptadores de la API", () => {
  it("dirección y entrega propia a la misma forma", () => {
    expect(ubicacionDeDireccion({ lat: 1, lng: 2, geo_precision: "ROOFTOP", geo_direccion_formateada: "x" }))
      .toEqual({ lat: 1, lng: 2, precision: "ROOFTOP", formateada: "x" });
    expect(ubicacionDeEntrega({ entrega_lat: 1, entrega_lng: 2, entrega_geo_precision: "MANUAL" }))
      .toEqual({ lat: 1, lng: 2, precision: "MANUAL", formateada: null });
  });

  it("el formulario de entrega nunca recibe null (inputs controlados)", () => {
    expect(Object.values(entregaVacia()).every((v) => v === "")).toBe(true);
    expect(entregaDeOrden({ entrega_direccion: "MONEDA 1901", entrega_comuna: null }))
      .toMatchObject({ entrega_direccion: "MONEDA 1901", entrega_comuna: "" });
  });
});
