import { useState } from "react";
import { toast } from "../../lib/toast";
import StepsEditor from "./StepsEditor";

export default function PautaSelectorConCreacion({
  api,
  pautas,
  setPautas,
  selectedPautaId,
  setSelectedPautaId,
}) {
  const [crearPautaOpen, setCrearPautaOpen] = useState(false);
  const [nuevaPauta, setNuevaPauta] = useState({ name: "", description: "", is_active: true });
  const [pautaPasos, setPautaPasos] = useState([
    {
      descripcion: "",
      orden: 1,
      requires_ph: false,
      requires_temperature: false,
      requires_obtained_quantity: false,
      extra_input_data: [],
    },
  ]);
  const [pautaErrors, setPautaErrors] = useState({});

  const handleCrearPautaInline = async () => {
    const name = String(nuevaPauta.name || "").trim();
    const description = String(nuevaPauta.description || "").trim();
    const PASO_MIN_LEN = 5;

    if (!name) return toast.error("Nombre de la pauta es obligatorio");
    if (!description) return toast.error("Descripción de la pauta es obligatoria");

    const nextErrors = {};
    if (!Array.isArray(pautaPasos) || pautaPasos.length === 0) {
      nextErrors.pasos = "Debe agregar al menos un paso.";
    }
    (pautaPasos || []).forEach((paso, index) => {
      const desc = String(paso?.descripcion || "").trim();
      if (!desc) nextErrors[`paso_${index}`] = "La descripción del paso es obligatoria.";
      else if (desc.length < PASO_MIN_LEN)
        nextErrors[`paso_${index}`] = `La descripción debe tener al menos ${PASO_MIN_LEN} caracteres.`;
    });
    setPautaErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return toast.error("Revisa los pasos antes de crear la pauta");

    try {
      const pautaRes = await api("/pautas-elaboracion", {
        method: "POST",
        body: JSON.stringify({ name, description, is_active: !!nuevaPauta.is_active }),
      });
      const idPauta = pautaRes?.id;

      for (let i = 0; i < pautaPasos.length; i++) {
        const paso = pautaPasos[i];
        const descripcion = String(paso?.descripcion || "").trim();
        if (!descripcion) continue;
        await api("/pasos-pauta-elaboracion", {
          method: "POST",
          body: JSON.stringify({
            id_pauta_elaboracion: idPauta,
            orden: i + 1,
            descripcion,
            requires_ph: !!paso?.requires_ph,
            requires_temperature: !!paso?.requires_temperature,
            requires_obtained_quantity: !!paso?.requires_obtained_quantity,
            extra_input_data: paso?.extra_input_data || null,
          }),
        });
      }

      const pautasRes = await api("/pautas-elaboracion");
      setPautas(Array.isArray(pautasRes) ? pautasRes : []);
      setSelectedPautaId(String(idPauta));

      setCrearPautaOpen(false);
      setNuevaPauta({ name: "", description: "", is_active: true });
      setPautaPasos([
        {
          descripcion: "",
          orden: 1,
          requires_ph: false,
          requires_temperature: false,
          requires_obtained_quantity: false,
          extra_input_data: [],
        },
      ]);
      setPautaErrors({});
      toast.success("Pauta creada y seleccionada");
    } catch (e) {
      console.error(e);
      toast.error(`Error creando pauta: ${e?.message || e}`);
    }
  };

  return (
    <>
      <div>
        <label className="block text-sm font-medium mb-1">Pauta</label>
        <select
          className="w-full border rounded-lg px-3 py-2"
          value={selectedPautaId}
          onChange={(e) => setSelectedPautaId(e.target.value)}
        >
          <option value="">Seleccionar</option>
          {(pautas || []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} {p.is_active === false ? "(inactiva)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="pt-2">
        <button
          type="button"
          className="text-sm text-primary hover:underline"
          onClick={() => setCrearPautaOpen((v) => !v)}
        >
          {crearPautaOpen ? "Cerrar creación rápida" : "+ Crear nueva pauta"}
        </button>
      </div>

      {crearPautaOpen ? (
        <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
          <div className="text-sm font-semibold text-gray-800">Nueva pauta</div>
          <div>
            <label className="block text-sm font-medium mb-1">Nombre *</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={nuevaPauta.name}
              onChange={(e) => setNuevaPauta((p) => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Descripción *</label>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={nuevaPauta.description}
              onChange={(e) => setNuevaPauta((p) => ({ ...p, description: e.target.value }))}
            />
          </div>

          <div className="pt-2">
            <div className="text-sm font-semibold text-gray-800 mb-2">Pasos de elaboración</div>
            <StepsEditor pasos={pautaPasos} setPasos={setPautaPasos} errors={pautaErrors} />
            {pautaErrors?.pasos ? (
              <p className="text-red-500 text-sm mt-2">{pautaErrors.pasos}</p>
            ) : null}
          </div>

          <div className="flex justify-between items-center">
            <button
              onClick={() =>
                setPautaPasos((prev) => [
                  ...(Array.isArray(prev) ? prev : []),
                  {
                    descripcion: "",
                    orden: (Array.isArray(prev) ? prev.length : 0) + 1,
                    requires_ph: false,
                    requires_temperature: false,
                    requires_obtained_quantity: false,
                    extra_input_data: [],
                  },
                ])
              }
              className="px-4 py-2 rounded border border-gray-300 text-text hover:bg-gray-100"
              type="button"
            >
              Agregar Paso
            </button>

            <button
              type="button"
              className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded"
              onClick={handleCrearPautaInline}
            >
              Crear y seleccionar
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
