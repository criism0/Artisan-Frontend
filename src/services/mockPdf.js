import { formatCLP } from './formatHelpers';

const TIPO_LABELS = {
  33: 'FACTURA ELECTRÓNICA',
  39: 'BOLETA ELECTRÓNICA',
  52: 'GUÍA DE DESPACHO',
  56: 'NOTA DE DÉBITO',
  61: 'NOTA DE CRÉDITO',
};

const DEFAULT_ITEMS = [
  { nombre: 'Queso Artisan Premium 500g', cantidad: 24, unidad: 'un', precioUnitario: 4500 },
  { nombre: 'Yogurt Natural Artisan 1L',  cantidad: 48, unidad: 'un', precioUnitario: 1800 },
];

/**
 * @param {object} opts
 * @param {number}   opts.tipoDte    - 33 | 52 | 56 | 61
 * @param {object}  [opts.receptor]  - { nombre, rut, giro, direccion, comuna }
 * @param {Array}   [opts.items]     - [{ nombre, cantidad, unidad, precioUnitario }]
 * @param {object}  [opts.extras]
 *   indTraslado: 1=Venta cliente, 5=Traslado interno (solo GD Tipo 52)
 *   refDoc: { tipo, folio, fecha }  (NC Tipo 61 y ND Tipo 56)
 *   codRef: 1|2|3                   (NC Tipo 61)
 *   razon:  string                  (NC y ND)
 */
export function abrirMockPDF({ tipoDte, receptor = {}, items = [], extras = {} }) {
  const label = TIPO_LABELS[tipoDte] ?? `DTE TIPO ${tipoDte}`;
  const fecha = new Date().toLocaleDateString('es-CL');
  const folio = Math.floor(Math.random() * 8000) + 1000;

  const effectiveItems = items.length ? items : DEFAULT_ITEMS;
  const neto  = effectiveItems.reduce((s, it) => s + Number(it.cantidad) * Number(it.precioUnitario), 0);
  const iva   = Math.round(neto * 0.19);
  const total = neto + iva;

  const itemRows = effectiveItems.map((it, i) => {
    const sub = Number(it.cantidad) * Number(it.precioUnitario);
    return `<tr>
      <td style="text-align:center;color:#9ca3af">${i + 1}</td>
      <td>${it.nombre}</td>
      <td style="text-align:center">${it.unidad ?? 'un'}</td>
      <td style="text-align:center">${Number(it.cantidad)}</td>
      <td style="text-align:right">${formatCLP(Number(it.precioUnitario) || 0, 0)}</td>
      <td style="text-align:right;font-weight:600">${formatCLP(Number(sub) || 0, 0)}</td>
    </tr>`;
  }).join('');

  const COD_REF_LABELS = { 1: '1 — Anulación total', 2: '2 — Corrección texto', 3: '3 — Rebaja parcial' };
  const IND_TRASLADO_LABELS = { 1: '1 — Venta a cliente', 5: '5 — Traslado interno' };

  const extraRows = [
    extras.indTraslado != null && `<div class="info-row">Ind. Traslado: <strong>${IND_TRASLADO_LABELS[extras.indTraslado] ?? extras.indTraslado}</strong></div>`,
    extras.refDoc       && `<div class="info-row">Referencia a: <strong>Tipo ${extras.refDoc.tipo} Folio N° ${extras.refDoc.folio}</strong></div>`,
    extras.codRef       && `<div class="info-row">Código ref.: <strong>${COD_REF_LABELS[extras.codRef] ?? extras.codRef}</strong></div>`,
    extras.razon        && `<div class="info-row">Razón: <strong>${extras.razon}</strong></div>`,
  ].filter(Boolean).join('');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>${label} N° ${folio} — DEMO</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Helvetica Neue',Arial,sans-serif;background:#f3f4f6;padding:40px 20px;color:#111827}
    .page{max-width:720px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.1)}
    .hdr{background:#1f2937;color:#fff;padding:28px 32px;display:flex;justify-content:space-between;align-items:flex-start}
    .hdr h1{font-size:22px;font-weight:800}
    .hdr p{font-size:12px;opacity:.8;margin-top:3px}
    .folio{font-size:30px;font-weight:900}
    .folio-lbl{font-size:11px;opacity:.8;text-transform:uppercase;text-align:right}
    .demo-banner{background:#fef3c7;border-bottom:2px solid #f59e0b;padding:10px 32px;text-align:center;font-size:13px;font-weight:700;color:#92400e;letter-spacing:.05em;text-transform:uppercase}
    .body{padding:28px 32px}
    .nota{background:#fef3c7;border:1px solid #fde68a;border-radius:6px;padding:10px 14px;font-size:12px;color:#92400e;margin-bottom:20px;line-height:1.5}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px}
    .section-title{font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #e5e7eb}
    .info-row{font-size:13px;margin-bottom:4px;color:#374151}
    .info-row strong{color:#111827}
    table{width:100%;border-collapse:collapse;margin-bottom:20px}
    th{font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;padding:8px 10px;background:#f9fafb;border:1px solid #e5e7eb}
    td{padding:9px 10px;border:1px solid #e5e7eb;font-size:13px}
    .totals{display:flex;flex-direction:column;align-items:flex-end;gap:5px;border-top:1px solid #e5e7eb;padding-top:16px}
    .t-row{display:flex;gap:40px;font-size:13px}
    .t-row span:first-child{color:#6b7280;min-width:100px;text-align:right}
    .t-row span:last-child{font-weight:500;min-width:110px;text-align:right}
    .t-row.grand span{font-size:15px;font-weight:700;color:#111827}
    .footer{background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px;font-size:11px;color:#9ca3af;text-align:center}
    .ted-box{border:2px dashed #d1d5db;padding:8px 14px;display:inline-block;font-size:9px;font-family:monospace;color:#6b7280;margin-top:10px;border-radius:4px}
  </style>
</head>
<body>
  <div class="page">
    <div class="hdr">
      <div>
        <h1>${label}</h1>
        <p>Elaboradora de Alimentos Gourmet Ltda. · RUT: 76.059.975-1</p>
        <p>Giro: Fabricación y venta de alimentos gourmet</p>
      </div>
      <div style="text-align:right">
        <div class="folio-lbl">Folio</div>
        <div class="folio">N° ${folio}</div>
        <div style="font-size:12px;opacity:.8;margin-top:4px">${fecha}</div>
      </div>
    </div>

    <div class="demo-banner">⚠ Documento de Prueba</div>

    <div class="body">
      <div class="nota">
        Al configurar LibreDTE con firma electrónica será reemplazado por el PDF oficial con Timbre Electrónico del SII.
      </div>

      <div class="grid">
        <div>
          <div class="section-title">Receptor</div>
          <div class="info-row"><strong>${receptor.nombre || 'Cliente Demo Ltda.'}</strong></div>
          <div class="info-row">RUT: ${receptor.rut || '—'}</div>
          <div class="info-row">${receptor.giro || ''}</div>
          <div class="info-row">${[receptor.direccion, receptor.comuna].filter(Boolean).join(', ') || ''}</div>
        </div>
        <div>
          <div class="section-title">Datos del documento</div>
          <div class="info-row">Tipo SII: <strong>${tipoDte}</strong></div>
          <div class="info-row">Fecha emisión: <strong>${fecha}</strong></div>
          ${extraRows}
        </div>
      </div>

      <div class="section-title" style="margin-bottom:10px">Detalle</div>
      <table>
        <thead>
          <tr>
            <th style="width:36px">#</th>
            <th>Descripción</th>
            <th style="width:70px">Unidad</th>
            <th style="width:80px">Cantidad</th>
            <th style="width:120px">Precio Unit.</th>
            <th style="width:120px">Subtotal</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <div class="totals">
        <div class="t-row"><span>Neto</span><span>${formatCLP(Number(neto) || 0, 0)}</span></div>
        <div class="t-row"><span>IVA (19%)</span><span>${formatCLP(Number(iva) || 0, 0)}</span></div>
        <div class="t-row grand"><span>Total</span><span>${formatCLP(Number(total) || 0, 0)}</span></div>
      </div>
    </div>

    <div class="footer">
      <div>Elaboradora de Alimentos Gourmet Ltda. · RUT 76.059.975-1 · oc@quesosartisan.cl</div>
      <div class="ted-box">
        TIMBRE ELECTRÓNICO SII<br/>
        [Se generará al conectar LibreDTE con firma electrónica]<br/>
      </div>
    </div>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url  = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 15_000);
}
