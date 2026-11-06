import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import Modal from "../UI/Modal";
import MapaPin from "./MapaPin";
import UbicacionBadge from "./UbicacionBadge";
import { toast } from "../../lib/toast.js";

/**
 * Ver y corregir dónde queda una dirección. Sirve para una dirección del cliente y para la
 * dirección de entrega propia de una orden: quien lo abre pasa qué hacer al buscar y al guardar.
 *
 * - `actual`: { lat, lng, precision, formateada } — lo que hay guardado.
 * - `onBuscar()`: vuelve a ubicar con Google; devuelve { ok, motivo?, actual } con lo nuevo.
 * - `onGuardarPin(lat, lng)`: guarda el pin puesto a mano; devuelve el `actual` nuevo.
 *
 * El pin movido no se guarda hasta apretar «Guardar ubicación»: mover el mapa para mirar no
 * debería cambiar nada.
 */
export default function ModalUbicar({ abierto, onCerrar, titulo, texto, actual, onBuscar, onGuardarPin, onCambio }) {
  const [pin, setPin] = useState({ lat: actual?.lat ?? null, lng: actual?.lng ?? null });
  const [guardado, setGuardado] = useState(actual);
  const [ocupado, setOcupado] = useState(false);

  // Se lee lo guardado AL ABRIR, no en cada render: quien lo abre suele pasar `actual` como un
  // objeto nuevo cada vez, y reiniciar con él borraría el pin que el usuario está moviendo.
  useEffect(() => {
    if (!abierto) return;
    setPin({ lat: actual?.lat ?? null, lng: actual?.lng ?? null });
    setGuardado(actual);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  const movido =
    pin.lat != null && pin.lng != null &&
    (guardado?.lat == null || Math.abs(pin.lat - guardado.lat) > 1e-7 || Math.abs(pin.lng - guardado.lng) > 1e-7);

  const buscar = async () => {
    setOcupado(true);
    try {
      const r = await onBuscar();
      if (r.ok) {
        setGuardado(r.actual);
        setPin({ lat: r.actual.lat, lng: r.actual.lng });
        onCambio?.(r.actual);
        toast.success("Ubicada con Google. Revisa que el pin esté en la puerta correcta.");
      } else {
        toast.error(r.motivo || "No se pudo ubicar");
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setOcupado(false);
    }
  };

  const guardar = async () => {
    setOcupado(true);
    try {
      const nuevo = await onGuardarPin(pin.lat, pin.lng);
      setGuardado(nuevo);
      onCambio?.(nuevo);
      toast.success("Ubicación guardada");
      onCerrar();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={titulo}
      descripcion={texto}
      ancho="max-w-2xl"
      pie={
        <>
          <button type="button" onClick={onCerrar} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">
            Cerrar
          </button>
          <button
            type="button"
            onClick={guardar}
            disabled={!movido || ocupado}
            className="px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary-dark disabled:opacity-50"
          >
            Guardar ubicación
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <UbicacionBadge lat={guardado?.lat} lng={guardado?.lng} precision={guardado?.precision} />
          <button
            type="button"
            onClick={buscar}
            disabled={ocupado}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
            title="Vuelve a preguntarle a Google dónde queda la dirección escrita. Reemplaza un pin puesto a mano."
          >
            <Search className="w-4 h-4" /> Buscar con Google
          </button>
        </div>
        {guardado?.formateada && (
          <p className="text-xs text-gray-500">
            Google la entendió como: <span className="text-gray-700">{guardado.formateada}</span>
          </p>
        )}
        <MapaPin lat={pin.lat} lng={pin.lng} onMover={(la, ln) => setPin({ lat: la, lng: ln })} />
        <p className="text-xs text-gray-500">
          Arrastra el pin (o haz clic en el mapa) hasta la <strong>entrada donde se recibe</strong>: el portón del
          CD, el acceso de proveedores. Es donde llegará el chofer.
        </p>
      </div>
    </Modal>
  );
}
