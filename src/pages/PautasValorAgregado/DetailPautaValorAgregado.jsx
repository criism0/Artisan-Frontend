import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Dialog } from "@headlessui/react";
import { jwtDecode } from "jwt-decode";
import { toast } from "../../lib/toast";
import { api } from "../../lib/api";
import jsPDF from "jspdf";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import 'svg2pdf.js';

export default function DetailPautaValorAgregado() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [pauta, setPauta] = useState(null);
  const [lote, setLote] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showCompletarModal, setShowCompletarModal] = useState(false);
  const [bultosDisponibles, setBultosDisponibles] = useState({});
  const [insumosPVA, setInsumosPVA] = useState([]);
  const [seleccionados, setSeleccionados] = useState({});
  const [nombresInsumos, setNombresInsumos] = useState({});
  const [formCompletar, setFormCompletar] = useState({
    peso_retirado: "",
    fecha_vencimiento: "",
    unidades_de_salida: "",
    cant_nuevas_unidades: "",
  });

  const elaboradorId = useMemo(() => {
    try {
      const token =
        localStorage.getItem("access_token") || localStorage.getItem("token");
      if (!token) return undefined;
      const decoded = jwtDecode(token);
      return Number(decoded?.id ?? decoded?.sub);
    } catch {
      return undefined;
    }
  }, []);

  const fetchPauta = async () => {
    try {
      const data = await api(`/pautas-valor-agregado/${id}`, { method: "GET" });
      setPauta(data);
      const insumos = data?.pvaPorProducto?.insumosPVAProductos || [];
      setInsumosPVA(insumos);
    } catch {
      toast.error("Error al cargar la pauta.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBultosPorInsumo = async (idBodega, idMateriaPrima) => {
    try {
      const data = await api(
        `/bultos/disponibles?id_bodega=${idBodega}&id_materia_prima=${idMateriaPrima}`,
        { method: "GET" }
      );
      setBultosDisponibles((prev) => ({
        ...prev,
        [idMateriaPrima]: Array.isArray(data) ? data : [],
      }));
    } catch {
      toast.error(`Error al obtener bultos del insumo ${idMateriaPrima}`);
    }
  };

  const fetchNombreInsumo = async (idMateriaPrima) => {
    if (nombresInsumos[idMateriaPrima]) return;
    try {
      const data = await api(`/materias-primas/${idMateriaPrima}`, { method: "GET" });
      setNombresInsumos((prev) => ({
        ...prev,
        [idMateriaPrima]: data.nombre || data.descripcion || "Sin Nombre",
      }));
    } catch { }
  };

  useEffect(() => {
    fetchPauta();
  }, [id]);

  const handleAbrirModal = async () => {
    const utilizaInsumos = pauta?.procesoValorAgregado?.utiliza_insumos || false;

    if (!utilizaInsumos) {
      toast.info("Este proceso no utiliza insumos. Comenzando pauta directamente...");
      await handleComenzarPautaSinInsumos();
      return;
    }

    if (insumosPVA.length === 0) {
      toast.info("Este proceso no tiene insumos asignados. Comenzando pauta directamente...");
      await handleComenzarPautaSinInsumos();
      return;
    }

    if (!pauta?.id_bodega) {
      toast.error("No se encontró la bodega del lote.");
      return;
    }

    for (const insumo of insumosPVA) {
      await fetchBultosPorInsumo(pauta.id_bodega, insumo.id_materia_prima);
      await fetchNombreInsumo(insumo.id_materia_prima);
    }

    setShowModal(true);
  };

  const handleComenzarPautaSinInsumos = async () => {
    try {
      setSaving(true);

      if (!elaboradorId) {
        toast.error("No se pudo identificar al usuario. Inicia sesión nuevamente.");
        return;
      }

      await api(`/pautas-valor-agregado/${id}/comenzar`, {
        method: "PUT",
        body: JSON.stringify({
          id_usuario: elaboradorId,
        }),
      });

      toast.success("Pauta comenzada correctamente.");
      await fetchPauta();
      navigate(`/PautasValorAgregado/ejecutar/${id}`);
    } catch (err) {
      toast.error(err?.message || "Error al comenzar la pauta.");
    } finally {
      setSaving(false);
    }
  };

  const handleSeleccion = (idMateriaPrima, idSeleccionado) => {
    setSeleccionados((prev) => ({ ...prev, [idMateriaPrima]: idSeleccionado }));
  };

  const handleComenzarPauta = async () => {
    try {
      setSaving(true);

      const bultos = Object.entries(seleccionados)
        .filter(([_, idBulto]) => idBulto)
        .map(([id_materia_prima, id_bulto]) => ({
          id_materia_prima: Number(id_materia_prima),
          id_bulto: Number(id_bulto),
        }));

      if (bultos.length === 0) {
        toast.error("Debes seleccionar al menos un bulto para cada insumo.");
        setSaving(false);
        return;
      }

      await api(`/pautas-valor-agregado/${id}/comenzar`, {
        method: "PUT",
        body: JSON.stringify({
          bultos,
          id_usuario: elaboradorId,
        }),
      });

      toast.success("Pauta comenzada correctamente.");
      setShowModal(false);
      await fetchPauta();
    } catch {
      toast.error("Error al comenzar la pauta.");
    } finally {
      setSaving(false);
    }
  };

  const handleAbrirCompletar = () => {
    const cantBultosActuales = lote?.cant_bultos ?? 0;

    setFormCompletar({
      peso_retirado: "",
      fecha_vencimiento: "",
      unidades_de_salida: cantBultosActuales,
      cant_nuevas_unidades: "",
    });

    setShowCompletarModal(true);
  };

  const loadLote = async (pautaData) => {
    try {
      let loteData = null;
      if (pautaData.id_lote_producto_final) {
        loteData = await api(`/lotes-producto-final/${pautaData.id_lote_producto_final}`);
      }
      setLote(loteData);
    } catch {
      toast.error("Error al cargar lote asociado.");
    }
  };

  useEffect(() => {
    if (pauta) loadLote(pauta);
  }, [pauta]);


  if (isLoading)
    return <div className="p-6 text-center text-gray-600">Cargando pauta...</div>;

  if (!pauta)
    return (
      <div className="p-6 text-center text-gray-600">
        No se encontró la pauta.
      </div>
    );

  const proceso = pauta.procesoValorAgregado?.descripcion || "Sin descripción";
  const estado = pauta.estado || "Desconocido";
  const generaBultos = pauta.procesoValorAgregado?.genera_bultos_nuevos === true;

  const descripcion = pauta?.procesoValorAgregado?.descripcion?.toLowerCase() || "";
  const esEmpaque = /(empa|empaquet|empac)/i.test(descripcion);
  const esProductoFinal = !!pauta?.id_lote_producto_final;
  const esPIP = Boolean(pauta?.id_lote_producto_en_proceso);
  const mostrarCantNuevasUnidades = generaBultos && (!esEmpaque || esPIP);

  const handleCompletarPauta = async () => {
    try {
      setSaving(true);

      const body = {
        peso_retirado: Number(formCompletar.peso_retirado),
        fecha_vencimiento: formCompletar.fecha_vencimiento,
        unidades_de_salida: Number(formCompletar.unidades_de_salida),
      };

      if (mostrarCantNuevasUnidades) {
        const unidades = Number(formCompletar.cant_nuevas_unidades || 0);
        if (unidades <= 0) {
          toast.error("Este PVA genera nuevos bultos; la cantidad de bultos obtenidos debe ser un número mayor a 0");
          setSaving(false);
          return;
        }
        body.cant_nuevas_unidades = unidades;

      } else if (formCompletar.cant_nuevas_unidades && Number(formCompletar.cant_nuevas_unidades) > 0) {
        toast.error("El proceso no permite declarar unidades nuevas.");
        setSaving(false);
        return;
      }

      await api(`/pautas-valor-agregado/${id}/completar`, {
        method: "PUT",
        body: JSON.stringify(body),
      });

      toast.success("Pauta completada correctamente.");
      setShowCompletarModal(false);
      await fetchPauta();
    } catch (err) {
      const errorMsg = err.message || "Error al completar la pauta.";
      toast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const puedeDescargarEtiquetas =
    esEmpaque &&
    esProductoFinal &&
    (estado === "Completado");

  const handleDescargarEtiquetas = async () => {
    try {
      setSaving(true);
      const bultos = lote.LoteProductoFinalBultos;
      if (!bultos.length) {
        toast.error("No hay bultos asociados al lote.");
        return;
      }

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: [100, 80],
      });

      let isFirstPage = true;

      for (const box of bultos) {

        if (!isFirstPage) {
          pdf.addPage();
        }
        isFirstPage = false;

        const nombreProducto = lote.productoBase.nombre ?? "Producto";
        const peso = lote.productoBase.peso_unitario
        const unidadesPorCaja = lote.productoBase.unidades_por_caja ?? 1;
        const codigoSAP = lote.productoBase.codigo_sap ?? "—";
        const codigoEAN = lote.productoBase.codigo_ean ?? "0000000000000";
        const unidades = box.cantidad_unidades ?? 0;
        const fechaVenc = lote.fecha_vencimiento
          ? new Date(lote.fecha_vencimiento).toLocaleDateString("es-CL")
          : "N/A";

        const qrData = await QRCode.toDataURL(
          `BOX:${box.id} LOTE:${box.id_lote_producto_final || box.id_lote_producto_en_proceso}`,
          { width: 90 }
        );

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.text("ELABORADORA DE ALIMENTOS GOURMET LTDA.", 50, 6, { align: "center" });

        pdf.setFontSize(12);
        pdf.text(`${nombreProducto.toUpperCase()} (${peso} KG)`, 50, 14, { align: "center" });

        if (unidades < unidadesPorCaja) {
          pdf.setFontSize(30);
          pdf.text("CAJA ABIERTA", 50, 40, { align: "center" });

          pdf.addImage(qrData, "PNG", 6, 60, 20, 20);
          pdf.setFontSize(8);
          pdf.text("Código Interno", 6, 59);

        } else {
          const barcodeSVG = document.createElementNS("http://www.w3.org/2000/svg", "svg");

          JsBarcode(barcodeSVG, codigoEAN, {
            format: "ean13",
            lineColor: "#000",
            margin: 0,
            width: 2,
            height: 45,
            displayValue: true,
          });

          await pdf.svg(barcodeSVG, {
            x: 5,
            y: 22,
            width: 80,
            height: 30
          })

          pdf.addImage(qrData, "PNG", 6, 61, 20, 20, { align: "center" });
          pdf.setFontSize(8);
          pdf.text("Código Interno", 6, 60);
        }

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        pdf.text(`${unidades} unds. por caja`, 94, 60, { align: "right" });
        pdf.text(`FECHA DE VENC: ${fechaVenc}`, 94, 66, { align: "right" });
        pdf.text(`SAP ${codigoSAP}`, 94, 72, { align: "right" });
      }

      pdf.save(`etiquetas_pauta_${id}.pdf`);
      toast.success("Etiquetas generadas correctamente.");

    } catch (err) {
      console.error(err);
      toast.error("Error generando etiquetas");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="mb-4 flex flex-wrap justify-between items-center gap-3">
        <button
          onClick={() => navigate("/Orden_de_Manufactura")}
          className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-5 py-2 rounded"
        >
          ← Volver a Órdenes
        </button>

        <div className="flex flex-wrap gap-2">
          {estado === "Pendiente" && (
            <button
              onClick={handleAbrirModal}
              disabled={saving}
              className="bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-2 rounded"
            >
              {saving ? "Preparando..." : "Comenzar Pauta"}
            </button>
          )}

          {estado === "En Proceso" && (
            <>
              <button
                onClick={() => navigate(`/PautasValorAgregado/ejecutar/${id}`)}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded"
              >
                Ejecutar Pasos
              </button>
              <button
                onClick={handleAbrirCompletar}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded"
              >
                Completar Pauta
              </button>
            </>
          )}

          {estado === "Completado" && (
            <button
              disabled
              className="bg-gray-400 text-white px-6 py-2 rounded cursor-not-allowed"
            >
              Pauta Finalizada
            </button>
          )}

          {puedeDescargarEtiquetas && (
            <button
              onClick={handleDescargarEtiquetas}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded"
            >
              Descargar Etiquetas de Cajas
            </button>
          )}
        </div>
      </div>

      <h1 className="text-2xl font-bold text-text mb-6">
        Detalle de Pauta de Valor Agregado
      </h1>

      <div className="bg-white p-6 rounded-lg shadow space-y-5">
        <div className="flex flex-col md:flex-row md:justify-between">
          <p>
            <strong>Proceso:</strong> {proceso}
          </p>
          <p>
            <strong>Estado:</strong> {estado}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <p>
            <strong>Peso ingresado:</strong> {pauta.peso_ingresado ?? "—"} kg
          </p>
          <p>
            <strong>Bodega:</strong> {pauta.bodega?.nombre ?? "—"}
          </p>
        </div>
      </div>

      <Dialog
        open={showModal}
        onClose={() => setShowModal(false)}
        className="fixed inset-0 flex items-center justify-center z-50 bg-black/40"
      >
        <div className="bg-white rounded-lg p-6 shadow-xl w-full max-w-2xl space-y-4">
          <h2 className="text-xl font-bold text-gray-800 mb-3">
            Seleccionar Bultos de Insumos
          </h2>

          {insumosPVA.length === 0 ? (
            <p className="text-gray-600 text-sm">
              No se encontraron insumos asociados a este PVA.
            </p>
          ) : (
            insumosPVA.map((insumo) => {
              const bultos = bultosDisponibles[insumo.id_materia_prima] || [];
              return (
                <div key={insumo.id} className="border rounded-md p-4 mb-3">
                  <p className="font-semibold text-gray-700 mb-2">
                    MP #{insumo.id_materia_prima}
                    {" - "}
                    {nombresInsumos[insumo.id_materia_prima] || insumo.nombre || insumo.materiaPrima?.nombre || "Cargando..."}
                    —{" "}
                    <span className="text-sm text-gray-600 ml-1">
                      {insumo.cantidad_por_bulto} por bulto
                    </span>
                  </p>

                  {bultos.length > 0 ? (
                    <select
                      value={seleccionados[insumo.id_materia_prima] || ""}
                      onChange={(e) =>
                        handleSeleccion(insumo.id_materia_prima, e.target.value)
                      }
                      className="w-full border rounded px-3 py-2"
                    >
                      <option value="">Seleccionar bulto...</option>
                      {bultos.map((bulto) => (
                        <option key={bulto.id} value={bulto.id}>
                          {bulto.identificador} — {bulto.materiaPrima.nombre} —{" "}
                          {bulto.unidades_disponibles} unidades
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-sm text-gray-500">
                      No hay bultos disponibles de este insumo en la bodega.
                    </p>
                  )}
                </div>
              );
            })
          )}

          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setShowModal(false)}
              className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
            >
              Cancelar
            </button>
            <button
              onClick={handleComenzarPauta}
              disabled={saving}
              className="px-4 py-2 rounded bg-primary text-white hover:bg-primary-dark"
            >
              {saving ? "Iniciando..." : "Confirmar y Comenzar"}
            </button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={showCompletarModal}
        onClose={() => setShowCompletarModal(false)}
        className="fixed inset-0 flex items-center justify-center z-50 bg-black/40"
      >
        <div className="bg-white rounded-lg p-6 shadow-xl w-full max-w-lg space-y-4">
          <h2 className="text-xl font-bold text-gray-800 mb-3">
            Completar Pauta
          </h2>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Peso retirado (kg)
              </label>
              <input
                type="number"
                value={formCompletar.peso_retirado}
                onChange={(e) =>
                  setFormCompletar((prev) => ({
                    ...prev,
                    peso_retirado: e.target.value,
                  }))
                }
                className="border w-full rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Fecha de vencimiento
              </label>
              <input
                type="date"
                value={formCompletar.fecha_vencimiento}
                onChange={(e) =>
                  setFormCompletar((prev) => ({
                    ...prev,
                    fecha_vencimiento: e.target.value,
                  }))
                }
                className="border w-full rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Unidades de salida
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={formCompletar.unidades_de_salida}
                onChange={(e) =>
                  setFormCompletar((prev) => ({
                    ...prev,
                    unidades_de_salida: e.target.value,
                  }))
                }
                className="border w-full rounded px-3 py-2"
              />
            </div>

            {mostrarCantNuevasUnidades && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Cantidad de nuevos bultos
                </label>
                <input
                  className="border p-2 w-full rounded"
                  type="number"
                  min="1"
                  placeholder="Cantidad de nuevos bultos"
                  value={formCompletar.cant_nuevas_unidades}
                  onChange={(e) =>
                    setFormCompletar((prev) => ({
                      ...prev,
                      cant_nuevas_unidades: e.target.value,
                    }))
                  }
                />
              </div>
            )}
            {!mostrarCantNuevasUnidades && (
              <p className="text-xs text-gray-500 pt-2">Este proceso no genera bultos nuevos.</p>
            )}

          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setShowCompletarModal(false)}
              className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
            >
              Cancelar
            </button>
            <button
              onClick={handleCompletarPauta}
              disabled={saving}
              className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              {saving ? "Guardando..." : "Completar"}
            </button>
          </div>
        </div>
      </Dialog >
    </div >
  );
}