import { describe, expect, it } from "vitest";
import { diasSinStock, pedidoSinAlcance, planificacionRapida, tablaInventario } from "../utils/planificacionSemana.js";

const DIAS = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07"];
const [LU, MA, MI, JU, VI, SA] = DIAS;

const inv = (nf, disponible, extra = {}) => ({ id_nombre_facturacion: nf, nombre: `P${nf}`, unidad_venta: "Unidades", id_bodega: 3, qr: disponible, sin_qr: 0, disponible, ...extra });
const ov = (id, dia, lineas, extra = {}) => ({ id, dia, fecha_entrega: dia, fecha_original: null, ruta: null, id_sector: 1, lineas, ...extra });
const lin = (nf, cantidad) => ({ id_nombre_facturacion: nf, cantidad });

describe("tablaInventario", () => {
  it("resta lo que piden los días en orden y marca el día en que no alcanza", () => {
    const filas = tablaInventario([ov(1, LU, [lin(7, 30)]), ov(2, MA, [lin(7, 30)])], DIAS, [inv(7, 50)], "3");
    const f = filas[0];
    expect(f.celdas[0]).toMatchObject({ pide: 30, queda: 20, falta: false });
    expect(f.celdas[1]).toMatchObject({ pide: 30, queda: -10, falta: true });
    expect(diasSinStock(filas, DIAS)).toEqual(new Set([MA]));
  });

  it("suma con QR y sin QR, y no cuenta lo de otra bodega", () => {
    const filas = tablaInventario(
      [ov(1, LU, [lin(7, 10)])],
      DIAS,
      [inv(7, 8, { qr: 5, sin_qr: 3 }), inv(7, 100, { id_bodega: 4 })],
      "3",
    );
    expect(filas[0].disponible).toBe(8);
    expect(filas[0].celdas[0].falta).toBe(true);
  });

  it("un stock negativo no se cuenta como crédito", () => {
    const filas = tablaInventario([ov(1, LU, [lin(7, 1)])], DIAS, [inv(7, -4)], "3");
    expect(filas[0].disponible).toBe(0);
    expect(filas[0].celdas[0].falta).toBe(true);
  });

  it("lo que espera planificación va aparte y no consume stock de ningún día", () => {
    const filas = tablaInventario([ov(1, null, [lin(7, 5)]), ov(2, "2026-10-28", [lin(7, 2)])], DIAS, [inv(7, 1)], "3");
    expect(filas).toHaveLength(0); // ningún día pide: la fila sólo aparece si algo ya está puesto
  });

  it("pedidoSinAlcance avisa del pedido puesto en un día que no alcanza", () => {
    const ordenes = [ov(1, MA, [lin(7, 30)])];
    const filas = tablaInventario(ordenes, DIAS, [inv(7, 10)], "3");
    expect(pedidoSinAlcance(ordenes[0], filas, DIAS)).toBe(true);
  });
});

describe("planificacionRapida", () => {
  const base = { dias: DIAS, idBodega: "3", hoy: LU };

  it("pone cada pedido hasta su compromiso, lo más tarde posible, y nunca el sábado", () => {
    const r = planificacionRapida({ ...base, inventario: [inv(7, 100)], ordenes: [ov(1, null, [lin(7, 5)], { fecha_entrega: JU })] });
    expect(r.propuestas).toEqual([{ id: 1, dia: JU }]);
    const sab = planificacionRapida({ ...base, inventario: [inv(7, 100)], ordenes: [ov(2, null, [lin(7, 5)], { fecha_entrega: SA })] });
    expect(sab.propuestas[0].dia).not.toBe(SA);
  });

  it("lo atrasado va al primer día disponible, y desde hoy", () => {
    const r = planificacionRapida({ ...base, hoy: MI, inventario: [inv(7, 100)], ordenes: [ov(1, "2026-10-28", [lin(7, 5)], { fecha_entrega: "2026-10-28" })] });
    expect(r.propuestas).toEqual([{ id: 1, dia: MI }]);
  });

  it("junta el sector en el mismo día", () => {
    const r = planificacionRapida({
      ...base,
      inventario: [inv(7, 100)],
      ordenes: [ov(1, MA, [lin(7, 5)]), ov(2, null, [lin(7, 5)], { fecha_entrega: JU })],
    });
    expect(r.propuestas).toEqual([{ id: 2, dia: MA }]);
  });

  it("respeta el stock: lo que no alcanza ningún día queda fuera", () => {
    const r = planificacionRapida({
      ...base,
      inventario: [inv(7, 10)],
      ordenes: [ov(1, null, [lin(7, 8)], { fecha_entrega: MA }), ov(2, null, [lin(7, 8)], { fecha_entrega: MA })],
    });
    expect(r.propuestas).toHaveLength(1);
    expect(r.fuera).toHaveLength(1);
  });

  it("primero el compromiso más temprano se queda con el stock", () => {
    const r = planificacionRapida({
      ...base,
      inventario: [inv(7, 10)],
      ordenes: [ov(1, null, [lin(7, 8)], { fecha_entrega: VI }), ov(2, null, [lin(7, 8)], { fecha_entrega: MA })],
    });
    expect(r.propuestas.map((p) => p.id)).toEqual([2]);
    expect(r.fuera).toEqual([1]);
  });

  it("no toca lo que ya va en una ruta ni lo ya puesto", () => {
    const r = planificacionRapida({
      ...base,
      inventario: [inv(7, 100)],
      ordenes: [ov(1, MA, [lin(7, 5)]), ov(2, MI, [lin(7, 5)], { ruta: { id: 9 } })],
    });
    expect(r.propuestas).toEqual([]);
  });
});
