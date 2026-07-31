import { BackButton } from "../Buttons/ActionButtons";

/**
 * Cabecera estándar de una vista: volver, título, estado y el panel de acciones.
 *
 * El `<h1>` de la app tenía 16 combinaciones distintas de clases para decir lo mismo, y el
 * botón de volver faltaba en 7 vistas de detalle. Acá queda una sola forma.
 *
 * Las acciones se reciben ya armadas (normalmente un <PanelAcciones/>) y viven arriba,
 * junto al título: son lo primero que se ve al abrir la vista, sin scrollear.
 */
export default function PageHeader({ volverA, titulo, subtitulo, estado, acciones }) {
  return (
    <div className="mb-6">
      {volverA !== undefined && (
        <div className="mb-3">
          <BackButton to={volverA} />
        </div>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-text">{titulo}</h1>
            {estado}
          </div>
          {subtitulo && <p className="text-sm text-gray-500 mt-1">{subtitulo}</p>}
        </div>

        {acciones && <div className="shrink-0">{acciones}</div>}
      </div>
    </div>
  );
}
