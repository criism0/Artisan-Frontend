import { describe, it, expect } from "vitest";
import { mensajeError, mensajeDelBackend, estadoHttp } from "../mensajeError";

/**
 * 🔴 EL BUG QUE CIERRA. Media aplicación leía `err.response.data.error` —la forma de axios,
 * que **no es dependencia de este proyecto**— mientras `api()` lanza un `ApiError` con
 * `message` / `status` / `data`. Como `err.response` nunca existía, el usuario veía siempre un
 * mensaje genérico.
 *
 * El caso real, reportado el 2026-08-09: al facturar, el backend respondía
 * *"al cliente X le falta razón social, giro. Completa sus datos en Administración → Clientes"*
 * —exactamente lo que hay que hacer— y el toast decía *"Verifica tu conexión e intenta
 * nuevamente"*. Con el traspaso a LibreDTE a dos días, ese es el error que más se va a ver.
 */

/** Reproduce el `ApiError` que lanza `lib/api.js`. */
function apiError(mensaje, status, data) {
  const e = new Error(mensaje);
  e.name = "ApiError";
  e.status = status;
  e.data = data;
  return e;
}

const FALTA_DATOS =
  'No se puede emitir la factura: al cliente "Cliente Mobile S0M63399" le falta razón social, ' +
  "giro. Completa sus datos en Administración → Clientes y vuelve a intentar.";

describe("mensajeError", () => {
  it("🔴 muestra el mensaje del backend en el caso que originó el arreglo", () => {
    const err = apiError(FALTA_DATOS, 400, { error: FALTA_DATOS });

    expect(mensajeError(err, "facturar esta orden")).toBe(FALTA_DATOS);
    // Y sobre todo: NO el genérico que escondía el problema.
    expect(mensajeError(err, "facturar esta orden")).not.toMatch(/Verifica tu conexión/);
  });

  it("lee la forma real del ApiError (status y data, no response)", () => {
    const err = apiError("boom", 409, { error: "Ya existe una guía para esta solicitud" });
    expect(estadoHttp(err)).toBe(409);
    expect(mensajeDelBackend(err)).toBe("Ya existe una guía para esta solicitud");
  });

  it("tolera también la forma de axios, por si algún día entra", () => {
    const err = { response: { status: 400, data: { error: "desde axios" } } };
    expect(estadoHttp(err)).toBe(400);
    expect(mensajeError(err)).toBe("desde axios");
  });

  it("cae al genérico sólo cuando de verdad no hay nada que decir", () => {
    expect(mensajeError(new TypeError("Failed to fetch"), "facturar")).toMatch(
      /Error al facturar\. Verifica tu conexión/,
    );
  });

  it("no muestra como mensaje el relleno que arma el propio helper", () => {
    // `api()` usa `${status} ${statusText}` cuando el cuerpo no traía nada. Eso no es una
    // explicación: es ruido, y tapa el consejo de revisar la conexión.
    const err = apiError("500 Internal Server Error", 500, {});
    expect(mensajeDelBackend(err)).toBeNull();
    expect(mensajeError(err, "facturar")).toMatch(/Verifica tu conexión/);
  });

  it("un 403 sin explicación dice qué hacer; con explicación manda el backend", () => {
    expect(mensajeError(apiError("", 403, {}), "anular el documento")).toBe(
      "Sin permiso para anular el documento. Contacta al administrador.",
    );
    const conDetalle = apiError("x", 403, { error: "Tu rol no permite anular guías de despacho" });
    expect(mensajeError(conDetalle, "anular")).toBe("Tu rol no permite anular guías de despacho");
  });

  it("cuenta los ítems afectados sin desbordar el toast", () => {
    const err = apiError("x", 400, {
      error: "Faltan productos por pickear",
      details: [{ id: 1 }, { id: 2 }, { id: 3 }],
    });
    expect(mensajeError(err, "facturar")).toBe("Faltan productos por pickear (3 ítems)");
  });

  it("singular cuando es un solo ítem", () => {
    const err = apiError("x", 400, { error: "Falta un producto", details: [{ id: 1 }] });
    expect(mensajeError(err, "facturar")).toBe("Falta un producto (1 ítem)");
  });

  it("acepta `message` además de `error`, que es como responden algunos endpoints", () => {
    expect(mensajeDelBackend(apiError("x", 400, { message: "desde message" }))).toBe("desde message");
  });

  it("ignora un mensaje que viene en blanco", () => {
    expect(mensajeDelBackend(apiError("   ", 400, { error: "   " }))).toBeNull();
  });
});
