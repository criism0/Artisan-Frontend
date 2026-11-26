import { ESTILO_MARCA } from "../../utils/estadoSolicitud.jsx";

/** Marca corta (recepción o pago de una OC) con el mismo estilo que las de Solicitudes. */
export default function MarcaOC({ marca, vacio = false }) {
  if (!marca) return vacio ? <span className="text-gray-400">—</span> : null;
  return (
    <span title={marca.titulo} className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${ESTILO_MARCA[marca.tono]}`}>
      {marca.texto}
    </span>
  );
}
