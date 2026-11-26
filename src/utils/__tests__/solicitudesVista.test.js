import { describe, it, expect } from "vitest";
import { fechaDelPaso, diferencia, encargadosDe } from "../solicitudesVista.js";
import { marcasSolicitud, normalizeEstadoSolicitud, tienePerdida } from "../estadoSolicitud.jsx";

const AHORA = new Date("2026-11-26T12:00:00Z").getTime();

describe("fechaDelPaso", () => {
  it("usa la fecha del paso en que va", () => {
    const base = { createdAt: "2026-11-01T12:00:00Z", fecha_envio: "2026-11-02T12:00:00Z", fecha_recepcion: "2026-11-03T12:00:00Z" };
    expect(fechaDelPaso({ ...base, estado: "Validada" }, AHORA).etiqueta).toBe("creada");
    expect(fechaDelPaso({ ...base, estado: "En tránsito" }, AHORA)).toMatchObject({ etiqueta: "enviada", dias: 24 });
    expect(fechaDelPaso({ ...base, estado: "Recepcionada" }, AHORA).etiqueta).toBe("recibida");
  });

  it("sin fecha no inventa días", () => {
    expect(fechaDelPaso({ estado: "Creada" }, AHORA)).toEqual({ fecha: null, etiqueta: "creada", dias: null });
  });
});

describe("diferencia", () => {
  it("marca faltante y sobrante, e ignora redondeo y lo que aún no se envía", () => {
    expect(diferencia(75, 1875)).toBe(-1800);
    expect(diferencia(3, 2)).toBe(1);
    expect(diferencia("5.0004", 5)).toBe(0);
    expect(diferencia(null, 5)).toBe(0);
  });
});

describe("marcas de una solicitud", () => {
  it("separa envío y recepción", () => {
    const r = { envio: { menos: 1, mas: 0 }, recepcion: { menos: 0, mas: 0 } };
    expect(marcasSolicitud(r).map((m) => m.texto)).toEqual(["Envío ▼ 1 línea", "Recepción = enviado"]);
    expect(marcasSolicitud(r, { corto: true }).map((m) => m.texto)).toEqual(["▼ 1 línea", "= enviado"]);
    expect(tienePerdida(r)).toBe(false);
    expect(tienePerdida({ recepcion: { menos: 2, mas: 0 } })).toBe(true);
  });

  it("antes de enviar no hay marcas", () => {
    expect(marcasSolicitud({ envio: null, recepcion: null })).toEqual([]);
  });

  it("los estados antiguos de recepción se leen como Recepcionada", () => {
    expect(normalizeEstadoSolicitud("Recepción Parcial con Pérdida")).toBe("Recepcionada");
    expect(normalizeEstadoSolicitud("Recepcionada Completa")).toBe("Recepcionada");
    expect(normalizeEstadoSolicitud("En tránsito")).toBe("En tránsito");
  });
});

describe("encargadosDe", () => {
  it("junta los encargados de origen y destino sin repetir", () => {
    const bodegas = [
      { value: "1", label: "Santiago", encargados: [{ id_usuario: 10 }, { id_usuario: 11 }] },
      { value: "2", label: "San Felipe", encargados: [{ id_usuario: 11 }, { id_usuario: 12 }] },
    ];
    const usuarios = [10, 11, 12].map((id) => ({ id, label: `U${id}`, email: `u${id}@artisan.cl` }));
    expect(encargadosDe(bodegas, ["1", "2"], usuarios).map((u) => [u.id, u.bodega])).toEqual([
      [10, "Santiago"],
      [11, "Santiago"],
      [12, "San Felipe"],
    ]);
  });
});
