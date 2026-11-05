/**
 * Fase C del planificador semanal (2026-11-05): la semana contra el inventario y la planificación
 * rápida. Todo son funciones puras sobre lo que entrega `/rutas/semana`:
 *   ordenes:    [{ id, dia, fecha_entrega, fecha_original, ruta, id_sector, lineas: [{ id_nombre_facturacion, cantidad }] }]
 *   inventario: [{ id_nombre_facturacion, nombre, unidad_venta, id_bodega, qr, sin_qr, disponible }]
 * `dias` es la lista de fechas ISO de la semana, en orden (lunes a sábado).
 */

const EPS = 1e-9;
const r3 = (n) => Math.round(n * 1000) / 1000;

/** Lo disponible por producto en la bodega: mapa id_nombre_facturacion → fila de inventario. */
export function inventarioPorProducto(inventario, idBodega) {
  const mapa = new Map();
  for (const f of inventario ?? []) {
    if (idBodega && String(f.id_bodega) !== String(idBodega)) continue;
    const previa = mapa.get(f.id_nombre_facturacion);
    if (!previa) mapa.set(f.id_nombre_facturacion, { ...f });
    else {
      previa.qr = r3(previa.qr + f.qr);
      previa.sin_qr = r3(previa.sin_qr + f.sin_qr);
      previa.disponible = r3(previa.disponible + f.disponible);
    }
  }
  return mapa;
}

/** Cuánto pide cada producto cada día de la semana (sólo los pedidos que ya tienen día). */
export function demandaPorDia(ordenes, dias) {
  const demanda = new Map(); // nf → number[] (un valor por día)
  for (const o of ordenes) {
    const i = dias.indexOf(o.dia);
    if (i < 0) continue;
    for (const l of o.lineas ?? []) {
      const fila = demanda.get(l.id_nombre_facturacion) ?? dias.map(() => 0);
      fila[i] = r3(fila[i] + l.cantidad);
      demanda.set(l.id_nombre_facturacion, fila);
    }
  }
  return demanda;
}

/**
 * La tabla «Inventario de la semana»: por producto, lo disponible y lo que queda al cierre de cada
 * día. `pide` es lo que se pide ese día; `falta` es verdadero si ese día no alcanza.
 */
export function tablaInventario(ordenes, dias, inventario, idBodega) {
  const stock = inventarioPorProducto(inventario, idBodega);
  const demanda = demandaPorDia(ordenes, dias);
  const porPlanificar = new Map();
  for (const o of ordenes) {
    if (o.ruta || (o.dia && o.dia >= dias[0])) continue;
    for (const l of o.lineas ?? []) porPlanificar.set(l.id_nombre_facturacion, r3((porPlanificar.get(l.id_nombre_facturacion) ?? 0) + l.cantidad));
  }
  const ids = new Set([...demanda.keys()]);
  const filas = [...ids].map((id) => {
    const s = stock.get(id);
    const disponible = Math.max(s?.disponible ?? 0, 0);
    let queda = disponible;
    const celdas = demanda.get(id).map((pide) => {
      queda = r3(queda - pide);
      return { pide, queda, falta: pide > 0 && queda < -EPS };
    });
    return {
      id_nombre_facturacion: id,
      nombre: s?.nombre ?? `Producto #${id}`,
      unidad_venta: s?.unidad_venta ?? "Unidades",
      qr: s?.qr ?? 0,
      sin_qr: s?.sin_qr ?? 0,
      disponible,
      celdas,
      porPlanificar: porPlanificar.get(id) ?? 0,
    };
  });
  filas.sort((a, b) => Number(b.celdas.some((c) => c.falta)) - Number(a.celdas.some((c) => c.falta)) || a.nombre.localeCompare(b.nombre));
  return filas;
}

/** Los días en que no alcanza el stock de algún producto. */
export function diasSinStock(filas, dias) {
  const malos = new Set();
  for (const f of filas) f.celdas.forEach((c, i) => c.falta && malos.add(dias[i]));
  return malos;
}

/** Si un pedido ya puesto en un día pide algo que ese día no alcanza. */
export function pedidoSinAlcance(orden, filas, dias) {
  const i = dias.indexOf(orden.dia);
  if (i < 0) return false;
  return (orden.lineas ?? []).some((l) => filas.find((f) => f.id_nombre_facturacion === l.id_nombre_facturacion)?.celdas[i]?.falta);
}

/** «Alcanza» poniendo `orden` en el día `i` sin dejar sin stock ese día ni los siguientes. */
function alcanza(orden, i, stock, demanda, dias) {
  return (orden.lineas ?? []).every((l) => {
    let queda = Math.max(stock.get(l.id_nombre_facturacion)?.disponible ?? 0, 0);
    const fila = demanda.get(l.id_nombre_facturacion) ?? dias.map(() => 0);
    for (let k = 0; k < dias.length; k++) {
      queda -= fila[k] + (k === i ? l.cantidad : 0);
      if (k >= i && queda < -EPS) return false;
    }
    return true;
  });
}

/**
 * Planificación rápida: propone el día de cada pedido que espera ser planificado.
 *  - Sólo de lunes a viernes, y desde hoy; el sábado queda para ponerlo a mano.
 *  - Primero lo atrasado y lo de compromiso más temprano.
 *  - Junta cada sector en el mismo día, sin pasar el compromiso del pedido.
 *  - Si no alcanza el stock en ningún día de la semana, lo deja fuera.
 * Devuelve `{ propuestas: [{ id, dia }], fuera: [id] }`; no guarda nada.
 */
export function planificacionRapida({ ordenes, dias, inventario, idBodega, hoy }) {
  const stock = inventarioPorProducto(inventario, idBodega);
  const habiles = dias.slice(0, 5).filter((d) => d >= hoy);
  const pendientes = ordenes
    .filter((o) => !o.ruta && (!o.dia || o.dia < dias[0]))
    .sort((a, b) => compromiso(a).localeCompare(compromiso(b)) || a.id - b.id);

  // Se parte de lo que ya está puesto en la semana; cada propuesta suma a esa demanda.
  const puestas = ordenes.map((o) => ({ ...o }));
  const demanda = demandaPorDia(puestas, dias);
  const delSector = (dia, sector) => puestas.filter((o) => o.dia === dia && o.id_sector === sector).length;

  const propuestas = [];
  const fuera = [];
  for (const o of pendientes) {
    const tope = compromiso(o);
    const hastaTope = habiles.filter((d) => d <= tope).sort((a, b) => delSector(b, o.id_sector) - delSector(a, o.id_sector) || b.localeCompare(a));
    const despues = habiles.filter((d) => d > tope);
    const dia = [...hastaTope, ...despues].find((d) => alcanza(o, dias.indexOf(d), stock, demanda, dias));
    if (!dia) {
      fuera.push(o.id);
      continue;
    }
    propuestas.push({ id: o.id, dia });
    const i = dias.indexOf(dia);
    for (const l of o.lineas ?? []) {
      const fila = demanda.get(l.id_nombre_facturacion) ?? dias.map(() => 0);
      fila[i] = r3(fila[i] + l.cantidad);
      demanda.set(l.id_nombre_facturacion, fila);
    }
    puestas.find((x) => x.id === o.id).dia = dia;
  }
  return { propuestas, fuera };
}

/** El compromiso con el cliente: la fecha que tenía antes de moverla, o la actual; sin fecha, el final de la semana. */
function compromiso(o) {
  return o.fecha_original ?? o.fecha_entrega ?? "9999-12-31";
}
