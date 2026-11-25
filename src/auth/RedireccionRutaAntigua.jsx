import { Navigate, generatePath, useLocation, useParams } from "react-router-dom";

/**
 * Una ruta antigua (anterior a la Fase 1 de UI, ver `src/rutas.js`) lleva a la nueva con los mismos
 * parámetros, la búsqueda y el ancla: `/Ordenes/edit/12?x=1` → `/adquisiciones/ordenes-compra/12/editar?x=1`.
 */
export default function RedireccionRutaAntigua({ a }) {
  const params = useParams();
  const { search, hash, state } = useLocation();
  return <Navigate to={`${generatePath(a, params)}${search}${hash}`} state={state} replace />;
}
