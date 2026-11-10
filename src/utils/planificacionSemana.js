/**
 * Fase C del planificador semanal (2026-11-05): la semana contra el inventario y la planificación
 * rápida. Todo son funciones puras sobre lo que entrega `/rutas/semana`:
 *   ordenes:    [{ id, dia, fecha_entrega, fecha_original, ruta, id_sector, lineas: [{ id_nombre_facturacion, cantidad }] }]
 *   inventario: [{ id_nombre_facturacion, nombre, unidad_venta, id_bodega, qr, sin_qr, disponible }]
 * `dias` es la lista de fechas ISO de la semana, en orden (lunes a sábado).
 */

const EPS = 1e-9;
const r3 = (n) => Math.round(n * 1000) / 1000;

/**
 * Desde cuándo un pedido «espera ser planificado»: sin fecha, o con una fecha ya pasada. Mirando la
 * semana que viene, lo de esta semana (desde hoy) NO está atrasado: sigue en su día de esta semana.
 */
export function inicioDeLoPendiente(dias, hoy) {
  return hoy && hoy < dias[0] ? hoy : dias[0];
}

/** Lo que piden, antes del primer día mostrado, los pedidos ya puestos desde hoy: consume stock de la semana. */
function demandaPrevia(ordenes, dias, hoy) {
  const previa = new Map();
  if (!hoy || hoy >= dias[0]) return previa;
  for (const o of ordenes) {
    if (!o.dia || o.dia < hoy || o.dia >= dias[0]) continue;
    for (const l of o.lineas ?? []) previa.set(l.id_nombre_facturacion, r3((previa.get(l.id_nombre_facturacion) ?? 0) + l.cantidad));
  }
  return previa;
}

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
export function tablaInventario(ordenes, dias, inventario, idBodega, hoy) {
  const stock = inventarioPorProducto(inventario, idBodega);
  const demanda = demandaPorDia(ordenes, dias);
  const previa = demandaPrevia(ordenes, dias, hoy);
  const desde = inicioDeLoPendiente(dias, hoy);
  const porPlanificar = new Map();
  for (const o of ordenes) {
    if (o.ruta || (o.dia && o.dia >= desde)) continue;
    for (const l of o.lineas ?? []) porPlanificar.set(l.id_nombre_facturacion, r3((porPlanificar.get(l.id_nombre_facturacion) ?? 0) + l.cantidad));
  }
  const ids = new Set([...demanda.keys(), ...porPlanificar.keys()]);
  const filas = [...ids].map((id) => {
    const s = stock.get(id);
    const disponible = Math.max(s?.disponible ?? 0, 0);
    const comprometido = previa.get(id) ?? 0;
    let queda = r3(disponible - comprometido);
    const celdas = (demanda.get(id) ?? dias.map(() => 0)).map((pide) => {
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
      comprometido,
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
function alcanza(orden, i, stock, demanda, dias, previa) {
  return (orden.lineas ?? []).every((l) => {
    let queda = Math.max(stock.get(l.id_nombre_facturacion)?.disponible ?? 0, 0) - (previa.get(l.id_nombre_facturacion) ?? 0);
    const fila = demanda.get(l.id_nombre_facturacion) ?? dias.map(() => 0);
    for (let k = 0; k < dias.length; k++) {
      queda -= fila[k] + (k === i ? l.cantidad : 0);
      if (k >= i && queda < -EPS) return false;
    }
    return true;
  });
}

/**
 * Planificación rápida: propone el día de cada pedido que espera ser planificado. Las prioridades,
 * de mayor a menor (Cristóbal, 2026-11-10):
 *  1. El sector: cada día se dedica a un sector y todo un sector va junto el mismo día. Un día que
 *     ya trae pedidos de otro sector es el último recurso.
 *  2. El compromiso con el cliente: el día del sector es el más tarde que no pasa el compromiso más
 *     temprano de sus pedidos (si ninguno lo cumple, el más cercano).
 *  3. El stock: si un pedido no alcanza en el día de su sector, se prueba el siguiente día del
 *     ranking; si no alcanza en ningún día de la semana, queda fuera.
 * Sólo de lunes a viernes y desde hoy; el sábado queda para ponerlo a mano. Los pedidos que ya van
 * en una ruta o ya tienen día no se tocan, pero cuentan: un día con otro sector ya puesto no se
 * mezcla si hay otro libre. Devuelve `{ propuestas: [{ id, dia }], fuera: [id] }`; no guarda nada.
 */
export function planificacionRapida({ ordenes, dias, inventario, idBodega, hoy }) {
  const stock = inventarioPorProducto(inventario, idBodega);
  const habiles = dias.slice(0, 5).filter((d) => d >= hoy);
  const desde = inicioDeLoPendiente(dias, hoy);
  const previa = demandaPrevia(ordenes, dias, hoy);
  const pendientes = ordenes.filter((o) => !o.ruta && (!o.dia || o.dia < desde));

  // Se parte de lo que ya está puesto en la semana; cada propuesta suma a esa demanda.
  const puestas = ordenes.map((o) => ({ ...o }));
  const demanda = demandaPorDia(puestas, dias);
  const sectorDe = (o) => o.id_sector ?? "sin";
  const ajenosEn = (dia, sector) => new Set(puestas.filter((o) => o.dia === dia && sectorDe(o) !== sector).map(sectorDe)).size;
  const delSectorEn = (dia, sector) => puestas.filter((o) => o.dia === dia && sectorDe(o) === sector).length;

  // Un grupo por sector, el de compromiso más urgente primero (y, a igual urgencia, el más grande).
  const grupos = new Map();
  for (const o of pendientes) grupos.set(sectorDe(o), [...(grupos.get(sectorDe(o)) ?? []), o]);
  const ordenados = [...grupos].map(([sector, os]) => {
    const lista = os.sort((a, b) => compromiso(a).localeCompare(compromiso(b)) || a.id - b.id);
    return { sector, os: lista, tope: compromiso(lista[0]) };
  }).sort((a, b) => a.tope.localeCompare(b.tope) || b.os.length - a.os.length);

  const propuestas = [];
  const fuera = [];
  for (const g of ordenados) {
    const ranking = [...habiles].sort((a, b) => {
      const ma = ajenosEn(a, g.sector);
      const mb = ajenosEn(b, g.sector);
      if (ma !== mb) return ma - mb; // 1. sin mezclar sectores
      const ca = delSectorEn(a, g.sector) > 0;
      const cb = delSectorEn(b, g.sector) > 0;
      if (ca !== cb) return ca ? -1 : 1; // 1. donde ya está el sector
      const ta = a <= g.tope;
      const tb = b <= g.tope;
      if (ta !== tb) return ta ? -1 : 1; // 2. sin pasar el compromiso
      return ta ? b.localeCompare(a) : a.localeCompare(b); // lo más tarde que no lo pase; si no, lo más cerca
    });
    for (const o of g.os) {
      const dia = ranking.find((d) => alcanza(o, dias.indexOf(d), stock, demanda, dias, previa)); // 3. stock
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
  }
  return { propuestas, fuera };
}

/** El compromiso con el cliente: la fecha que tenía antes de moverla, o la actual; sin fecha, el final de la semana. */
function compromiso(o) {
  return o.fecha_original ?? o.fecha_entrega ?? "9999-12-31";
}
