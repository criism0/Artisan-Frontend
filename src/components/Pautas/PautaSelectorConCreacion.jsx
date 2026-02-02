import { useState } from "react";
import { toast } from "../../lib/toast";
import PautaEditor from "./PautaEditor";
import { Edit, X } from "lucide-react";

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
  const [camposAnalisisSensorial, setCamposAnalisisSensorial] = useState([]);
  const [pautaErrors, setPautaErrors] = useState({});

  const [editandoPauta, setEditandoPauta] = useState(false);
  const [pautaEditData, setPautaEditData] = useState(null);
  const [pautaEditPasos, setPautaEditPasos] = useState([]);
  const [pautaEditCamposAnalisis, setPautaEditCamposAnalisis] = useState([]);
  const [pautaEditErrors, setPautaEditErrors] = useState({});
  const [analisisDefinicionExiste, setAnalisisDefinicionExiste] = useState(false);

  const handleAbrirEdicionPauta = async () => {
    if (!selectedPautaId) return;

    try {
      const idPauta = selectedPautaId;
      const [pautaRes, pasosRes] = await Promise.all([
        api(`/pautas-elaboracion/${idPauta}`),
        api(`/pasos-pauta-elaboracion/pauta/${idPauta}`),
      ]);

      setPautaEditData({
        name: pautaRes.name,
        description: pautaRes.description,
        is_active: pautaRes.is_active,
      });
      setPautaEditPasos(Array.isArray(pasosRes) ? pasosRes : []);

      try {
        const analisisRes = await api(`/analisis-sensorial/definicion/${idPauta}`);
        setPautaEditCamposAnalisis(Array.isArray(analisisRes?.campos_definicion) ? analisisRes.campos_definicion : []);
        setAnalisisDefinicionExiste(true);
      } catch (err) {
        setPautaEditCamposAnalisis([]);
        setAnalisisDefinicionExiste(false);
      }

      setPautaEditErrors({});
      setEditandoPauta(true);
    } catch (err) {
      console.error("Error cargando pauta:", err);
      toast.error("No se pudo cargar la pauta para editar");
    }
  };

  const handleCancelarEdicionPauta = () => {
    setEditandoPauta(false);
    setPautaEditData(null);
    setPautaEditPasos([]);
    setPautaEditCamposAnalisis([]);
    setPautaEditErrors({});
    setAnalisisDefinicionExiste(false);
  };

  const handleGuardarEdicionPauta = async () => {
    if (!selectedPautaId) return;

    const name = String(pautaEditData?.name || "").trim();
    const description = String(pautaEditData?.description || "").trim();

    const nextErrors = {};
    if (!name) nextErrors.name = "Nombre es obligatorio";
    if (!description) nextErrors.description = "Descripción es obligatoria";
    setPautaEditErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      const idPauta = selectedPautaId;

      await api(`/pautas-elaboracion/${idPauta}`, {
        method: "PUT",
        body: JSON.stringify({
          name,
          description,
          is_active: !!pautaEditData?.is_active,
        }),
      });

      // Reemplazo simple de pasos (borra y recrea)
      const pasosActuales = await api(`/pasos-pauta-elaboracion/pauta/${idPauta}`);
      for (const paso of Array.isArray(pasosActuales) ? pasosActuales : []) {
        await api(`/pasos-pauta-elaboracion/${paso.id}`, { method: "DELETE" });
      }

      for (let i = 0; i < (pautaEditPasos || []).length; i++) {
        const paso = pautaEditPasos[i];
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

      // Guardar/actualizar definición de análisis sensorial solo si existe o el usuario configuró campos.
      if (analisisDefinicionExiste || (pautaEditCamposAnalisis || []).length > 0) {
        await api("/analisis-sensorial/definicion", {
          method: "POST",
          body: JSON.stringify({
            id_pauta_elaboracion: idPauta,
            campos_definicion: Array.isArray(pautaEditCamposAnalisis) ? pautaEditCamposAnalisis : [],
          }),
        });
      }

      const pautasRes = await api("/pautas-elaboracion");
      setPautas(Array.isArray(pautasRes) ? pautasRes : []);

      toast.success("Pauta actualizada");
      handleCancelarEdicionPauta();
    } catch (err) {
      console.error("Error guardando pauta:", err);
      toast.error("No se pudo guardar la pauta");
    }
  };

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

      // Guardar análisis sensorial si hay campos definidos
      if (camposAnalisisSensorial.length > 0) {
        await api("/analisis-sensorial/definicion", {
          method: "POST",
          body: JSON.stringify({
            id_pauta_elaboracion: idPauta,
            campos_definicion: camposAnalisisSensorial
          })
        });
      }

      const pautasRes = await api("/pautas-elaboracion");
      setPautas(Array.isArray(pautasRes) ? pautasRes : []);
      setSelectedPautaId(String(idPauta));

      setCrearPautaOpen(false);
      setCamposAnalisisSensorial([]);
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
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium">Pauta</label>
          {selectedPautaId ? (
            <button
              type="button"
              onClick={handleAbrirEdicionPauta}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <Edit className="w-4 h-4" />
              Editar pauta
            </button>
          ) : null}
        </div>
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
        <div className="border rounded-lg p-4 bg-gray-50 space-y-4">
          <div className="text-sm font-semibold text-gray-800 mb-3">Nueva Pauta de Elaboración</div>

          <PautaEditor
            pautaData={nuevaPauta}
            onPautaDataChange={setNuevaPauta}
            pasos={pautaPasos}
            setPasos={setPautaPasos}
            camposAnalisisSensorial={camposAnalisisSensorial}
            setCamposAnalisisSensorial={setCamposAnalisisSensorial}
            errors={pautaErrors}
            showTitle={false}
            compactMode={true}
          />

          <div className="flex justify-between items-center pt-4 border-t">
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
              + Agregar Paso
            </button>

            <button
              type="button"
              className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded"
              onClick={handleCrearPautaInline}
            >
              Crear y Seleccionar
            </button>
          </div>
        </div>
      ) : null}

      {editandoPauta && pautaEditData ? (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">Editar pauta y Análisis Sensorial</h2>
              <button
                type="button"
                onClick={handleCancelarEdicionPauta}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <PautaEditor
                pautaData={pautaEditData}
                onPautaDataChange={setPautaEditData}
                pasos={pautaEditPasos}
                setPasos={setPautaEditPasos}
                camposAnalisisSensorial={pautaEditCamposAnalisis}
                setCamposAnalisisSensorial={setPautaEditCamposAnalisis}
                errors={pautaEditErrors}
                showTitle={false}
              />

              <div className="flex justify-between items-center pt-4 border-t">
                <button
                  type="button"
                  onClick={() =>
                    setPautaEditPasos((prev) => [
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
                >
                  + Agregar Paso
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCancelarEdicionPauta}
                    className="px-4 py-2 rounded border border-gray-300 text-text hover:bg-gray-100"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleGuardarEdicionPauta}
                    className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
