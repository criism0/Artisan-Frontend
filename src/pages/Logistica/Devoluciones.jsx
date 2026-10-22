import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ScanLine, Undo2 } from "lucide-react";
import DataTable from "../../components/Tables/DataTable";
import { BackButton } from "../../components/Buttons/ActionButtons";
import Modal from "../../components/UI/Modal";
import Aviso from "../../components/UI/Aviso";
import FotosMini from "../../components/Entregas/FotosMini";
import { toast } from "../../lib/toast.js";
import * as rutasApi from "../../services/rutasService";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";
import { describirBulto, TONO_BULTO } from "../../utils/despacho";

const ACCIONES = [
  { accion: "Reintegrar", texto: "Reintegrar al stock", tono: "bg-green-600 hover:bg-green-700", detalle: "Vuelve al inventario con el lote y el costo de donde salió. Lo armado nace como bulto nuevo, con etiqueta por imprimir; la caja cerrada recupera sus unidades." },
  { accion: "Merma", texto: "Dar de merma", tono: "bg-red-600 hover:bg-red-700", detalle: "Vuelve marcado merma: no se ofrece como stock bueno." },
  { accion: "Re-despachar", texto: "Vuelve a salir", tono: "bg-primary hover:bg-primary-dark", detalle: "Queda listo para otra ruta, sin tocar el inventario." },
];
// Lo que no existía en el inventario tampoco entra como merma: queda registrado como pérdida.
const DETALLE_MERMA_SIN_TRAZABILIDAD = "Queda registrado como merma; no entra al inventario.";

/**
 * Logística → Entregas → Devoluciones (plan de rutas §17): lo que volvió de las rutas y espera
 * decisión, y lo que no volvió (faltante). Se busca escaneando la etiqueta de la caja armada
 * (DESP-…) o el QR de la caja cerrada (BULTO-…) — el lector USB escribe en el campo y da Enter.
 */
export default function Devoluciones() {
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [codigo, setCodigo] = useState("");
  const [abierta, setAbierta] = useState(null);
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);
  const campo = useRef(null);
  const puede = checkScope(ModelType.RUTA, ScopeType.WRITE) || checkScope(ModelType.BULTO, ScopeType.WRITE);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await rutasApi.listarDevoluciones();
      setFilas(Array.isArray(r) ? r : []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setCargando(false);
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const abrir = (b) => { setNota(""); setAbierta(b); };

  const buscar = async (e) => {
    e.preventDefault();
    const c = codigo.trim();
    if (!c) return;
    try {
      abrir(await rutasApi.buscarDevolucion(c));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCodigo("");
      campo.current?.focus();
    }
  };

  const resolver = async (accion) => {
    setEnviando(true);
    try {
      const r = await rutasApi.resolverDevolucion(abierta.id, { accion, nota: nota.trim() || null });
      const nuevos = (r.lineas ?? []).flatMap((l) => l.bultos_reintegro ?? []);
      toast.success(accion === "Re-despachar" ? "Listo para otra ruta" : accion === "Merma" ? "Dado de merma" : "Reintegrado al inventario");
      (r.avisos ?? []).forEach((a) => toast.warning(a));
      if (accion !== "Re-despachar" && abierta.tipo !== "Caja cerrada" && nuevos.length) {
        toast.info(`Imprime la etiqueta del bulto nuevo en Inventario → Bultos (${nuevos.map((n) => `#${n}`).join(", ")}).`);
      }
      setAbierta(null);
      await cargar();
      campo.current?.focus();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setEnviando(false);
    }
  };

  const columns = [
    { header: "OV", accessor: "id_orden_venta", sortable: true, Cell: ({ value }) => <Link to={`/ventas/ordenes/${value}`} className="text-primary hover:underline">#{value}</Link> },
    { header: "Cliente", accessor: "cliente", sortable: true },
    { header: "Bulto", accessor: "tipo", sortable: true, filtro: false, Cell: ({ row }) => (
        <span className="text-sm">
          {describirBulto(row)}
          {row.sin_trazabilidad && <span className="block text-xs text-amber-700" title="Pedido pickeado por cantidad: no se reintegra al inventario">Sin trazabilidad</span>}
        </span>
      ),
    },
    {
      header: "Estado",
      accessor: "estado",
      sortable: true,
      Cell: ({ value }) => <span className={`px-2 py-0.5 rounded-full border text-xs ${TONO_BULTO[value] ?? ""}`}>{value === "Faltante" ? "No volvió" : "Volvió"}</span>,
    },
    { header: "Motivo", accessor: "motivo", sortable: true, sortValue: (r) => r.entrega?.motivo ?? "", Cell: ({ row }) => row.entrega?.motivo ?? "—" },
    { header: "Etiqueta", accessor: "identificador", sortable: true, Cell: ({ value }) => (value ? <span className="font-mono text-xs">{value}</span> : "—") },
  ];

  const decidible = abierta && ["Devuelto", "Faltante"].includes(abierta.estado);

  return (
    <>
      <div className="px-6 pt-6"><BackButton to="/Logistica/entregas" /></div>
      <div className="px-6 pt-4">
        <form onSubmit={buscar} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-wrap items-center gap-3">
          <ScanLine className="w-5 h-5 text-primary" />
          <input
            ref={campo}
            autoFocus
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Escanea la etiqueta (DESP-…) o el QR de la caja (BULTO-…)"
            className="flex-1 min-w-[260px] h-10 px-3 border border-gray-300 rounded-lg text-sm font-mono"
          />
          <button type="submit" className="h-10 px-4 rounded-lg bg-primary text-white text-sm hover:bg-primary-dark">Buscar</button>
        </form>
      </div>
      <DataTable
        title="Devoluciones de las rutas"
        data={filas}
        columns={columns}
        actions={(row) => (
          <button type="button" onClick={() => abrir(row)} className="text-gray-400 hover:text-primary" title="Decidir">
            <Undo2 className="w-5 h-5" />
          </button>
        )}
        stickyActions
        getSearchText={(r) => [r.id_orden_venta, r.cliente, r.identificador, r.entrega?.motivo, ...(r.lineas ?? []).map((l) => l.nombre)].join(" ")}
        loading={cargando}
        loadingMessage="Cargando devoluciones"
        emptyMessage="No hay nada esperando: todo lo que volvió ya se resolvió."
      />

      <Modal
        abierto={Boolean(abierta)}
        onCerrar={() => setAbierta(null)}
        ancho="max-w-xl"
        titulo={abierta ? `OV #${abierta.id_orden_venta} · ${abierta.cliente}` : ""}
        descripcion={abierta ? describirBulto(abierta) : null}
      >
        {abierta && (
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex flex-wrap items-center gap-2 text-gray-600">
              <span className={`px-2 py-0.5 rounded-full border text-xs ${TONO_BULTO[abierta.estado] ?? ""}`}>{abierta.estado}</span>
              {abierta.identificador && <span className="font-mono text-xs">{abierta.identificador}</span>}
              {abierta.entrega && <span>Entrega {abierta.entrega.estado}{abierta.entrega.motivo ? ` · ${abierta.entrega.motivo}` : ""}{abierta.entrega.acuerdo ? ` · ${abierta.entrega.acuerdo}` : ""}</span>}
            </div>
            {abierta.entrega?.comentario && <p className="text-gray-600 italic">«{abierta.entrega.comentario}»</p>}
            {abierta.nota_resolucion && <p className="text-gray-600">{abierta.nota_resolucion}</p>}
            <div>
              <p className="text-xs text-gray-500 mb-1">Dónde lo dejó el chofer</p>
              <FotosMini fotos={abierta.fotos ?? []} tipo="DEVOLUCION" vacio="Sin foto de la vuelta" />
            </div>
            {abierta.sin_trazabilidad && (
              <Aviso
                tamano="xs"
                ayuda="El pedido se pickeó por cantidad, sin QR: estas unidades no existían en el inventario antes de preparar el despacho, así que no tienen lote ni costo de origen."
                tituloAyuda="Sin trazabilidad"
              >
                <strong>Sin trazabilidad:</strong> no se puede reintegrar al inventario. Resuélvelo como merma o vuelve a despacharlo.
              </Aviso>
            )}
            {decidible && puede ? (
              <>
                <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota (opcional): en qué estado volvió" className="h-9 px-3 border border-gray-300 rounded-lg" />
                {ACCIONES.filter((a) => !(a.accion === "Re-despachar" && abierta.tipo === "Suelto") && !(a.accion === "Reintegrar" && abierta.sin_trazabilidad)).map((a) => (
                  <button
                    key={a.accion}
                    type="button"
                    disabled={enviando}
                    onClick={() => resolver(a.accion)}
                    className={`text-left px-4 py-2.5 rounded-lg text-white ${a.tono} disabled:opacity-50`}
                  >
                    <span className="font-medium">{a.texto}</span>
                    <span className="block text-xs text-white/85">{a.accion === "Merma" && abierta.sin_trazabilidad ? DETALLE_MERMA_SIN_TRAZABILIDAD : a.detalle}</span>
                  </button>
                ))}
              </>
            ) : (
              <p className="text-gray-500">{decidible ? "No tienes permiso para resolver devoluciones." : `Este bulto está ${abierta.estado}: no hay nada que decidir.`}</p>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
