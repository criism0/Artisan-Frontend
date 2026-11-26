// Lógica de la pantalla de recepción de una OC (`pages/Compras/RecepcionOC.jsx`), aparte para
// poder probarla: pasar del borrador del servidor al formulario y de vuelta, repartir bultos y
// decidir qué falta para confirmar.

const TOLERANCIA = 1e-4;
const fecha = (v) => (v ? String(v).slice(0, 10) : "");

/** Del borrador que manda el backend al estado del formulario (todo como texto, para los inputs). */
export function formularioDesdeRecepcion(rec) {
  return {
    id_bodega: rec.id_bodega != null ? String(rec.id_bodega) : "",
    fecha_recepcion: fecha(rec.fecha_recepcion) || new Date().toISOString().slice(0, 10),
    fecha_documento: fecha(rec.fecha_documento),
    numero_factura: (rec.numero_factura ?? []).join(", "),
    guia_despacho: rec.guia_despacho ?? "",
    lineas: Object.fromEntries(
      (rec.lineas ?? []).map((l) => [
        l.id_linea,
        {
          cantidad: l.cantidad ? String(l.cantidad) : "",
          precio: l.precio != null ? String(l.precio) : "",
          bultos: (l.bultos ?? []).map((b) => ({ unidades: String(b.unidades ?? ""), lote: b.lote ?? "" })),
        },
      ])
    ),
  };
}

/** Del formulario al cuerpo de `PUT /proceso-compra/recepciones/:id`. */
export function cuerpoDesdeFormulario(f) {
  return {
    id_bodega: f.id_bodega ? Number(f.id_bodega) : null,
    fecha_recepcion: f.fecha_recepcion || null,
    fecha_documento: f.fecha_documento || null,
    numero_factura: f.numero_factura,
    guia_despacho: f.guia_despacho,
    lineas: Object.entries(f.lineas).map(([id, l]) => ({
      id_linea: Number(id),
      cantidad: Number(l.cantidad) || 0,
      precio: Number(l.precio) || 0,
      bultos: (l.bultos ?? []).map((b) => ({ unidades: Number(b.unidades) || 0, lote: b.lote ?? "" })),
    })),
  };
}

/** `total` unidades en `n` bultos, parejo; enteros si se puede. Todos con el mismo lote. */
export function repartir(total, n, lote = "") {
  if (!n || n <= 0) return [];
  const t = Number(total) || 0;
  let partes;
  if (Number.isInteger(t)) {
    const base = Math.floor(t / n);
    const resto = t % n;
    partes = Array.from({ length: n }, (_, i) => base + (i < resto ? 1 : 0));
  } else {
    partes = Array.from({ length: n }, () => Number((t / n).toFixed(4)));
  }
  return partes.map((u) => ({ unidades: String(u), lote }));
}

/** El lote escrito en el bulto `i` pasa a ese bulto y a todos los de abajo. */
export function lotesDesde(bultos, i, lote) {
  return bultos.map((b, j) => (j >= i ? { ...b, lote } : b));
}

/** Si los bultos de una línea suman lo que llegó (en unidades base). */
export function cuadreDeLinea(f, linea) {
  const esperado = (Number(f?.cantidad) || 0) * (Number(linea.ratio) || 1);
  const suma = (f?.bultos ?? []).reduce((s, b) => s + (Number(b.unidades) || 0), 0);
  const diferencia = suma - esperado;
  if (!(f?.bultos?.length > 0)) return { ok: false, esperado, suma, texto: "sin bultos" };
  if (Math.abs(diferencia) <= TOLERANCIA * Math.max(1, esperado)) return { ok: true, esperado, suma, texto: "✓ cuadra" };
  const cuanto = Math.round(Math.abs(diferencia) * 1000) / 1000;
  return { ok: false, esperado, suma, texto: diferencia < 0 ? `faltan ${cuanto}` : `sobran ${cuanto}` };
}

/** Lo que impide confirmar, en el orden en que conviene arreglarlo. Vacío = se puede. */
export function problemasParaConfirmar(f, lineasOC) {
  const p = [];
  if (!f.id_bodega) p.push("Elige la bodega de recepción.");
  if (!f.numero_factura.trim() && !f.guia_despacho.trim()) p.push("Indica el N° de factura o de guía.");
  if (!f.fecha_documento) p.push("Indica la fecha de la factura o guía.");
  const recibidas = lineasOC.filter((l) => Number(f.lineas[l.id_linea]?.cantidad) > 0);
  if (recibidas.length === 0) p.push("Indica cuánto llegó de al menos un insumo.");
  for (const l of recibidas) {
    const linea = f.lineas[l.id_linea];
    const cuadre = cuadreDeLinea(linea, l);
    if (!linea.bultos?.length) p.push(`Declara los bultos de ${l.nombre}.`);
    else if (linea.bultos.some((b) => !(Number(b.unidades) > 0) || !String(b.lote ?? "").trim())) p.push(`Completa cantidad y lote de cada bulto de ${l.nombre}.`);
    else if (!cuadre.ok) p.push(`Los bultos de ${l.nombre} no cuadran (${cuadre.texto}).`);
  }
  return p;
}
