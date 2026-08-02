import { Spinner } from "./Spinner";

/**
 * Lo que se ve mientras baja el trozo de una vista.
 *
 * Ocupa alto fijo y centra el spinner para que el cambio de página no salte: sin altura, el
 * layout colapsa por un instante y las vistas parecen parpadear al navegar.
 */
export default function CargandoVista() {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center">
      <Spinner size="lg" label="Cargando vista…" />
    </div>
  );
}
