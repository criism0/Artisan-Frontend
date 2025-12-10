const BASE = import.meta.env.VITE_EXTRA1_URL;
const PATH_SUMMARY      = '/summary';
const PATH_FORECAST     = '/forecast';
const PATH_PREDICT      = '/predict';
const PATH_FORECAST_ALL = '/forecast_all';

export async function obtenerResumen() {
  const r = await fetch(`${BASE}${PATH_SUMMARY}`);
  if (!r.ok) throw new Error(`GET ${PATH_SUMMARY} → ${r.status}`);
  return r.json();
}

export async function obtenerPrediccionProducto(producto) {
  if (!producto) throw new Error('Falta producto');
  const url = `${BASE}${PATH_FORECAST}/${encodeURIComponent(producto)}`;
  const r = await fetch(url);
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`GET ${PATH_FORECAST}/{producto} → ${r.status} ${t}`);
  }
  return r.json();
}

export async function ObtenerTodasPredicciones() {
  const r = await fetch(`${BASE}${PATH_FORECAST_ALL}`);
  if (!r.ok) throw new Error(`GET ${PATH_FORECAST_ALL} → ${r.status}`);
  return r.json();
}

export async function PredecirFuturo(body) {
    const r = await fetch(`${BASE}${PATH_PREDICT}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
    });
    if (!r.ok) {
        const t = await r.text().catch(() => '');
        throw new Error(`POST ${PATH_PREDICT} → ${r.status} ${t}`);
    }
    return r.json();
}
