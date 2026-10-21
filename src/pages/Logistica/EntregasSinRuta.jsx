import { useCallback, useEffect, useState } from "react";
import { Eye, PackageCheck } from "lucide-react";
import DataTable from "../../components/Tables/DataTable";
import { BackButton } from "../../components/Buttons/ActionButtons";
import Modal from "../../components/UI/Modal";
import EntregaParada from "../../components/Entregas/EntregaParada";
import ModalEntregaSinRuta from "../../components/Entregas/ModalEntregaSinRuta";
import { api } from "../../lib/api";
import { toast } from "../../lib/toast.js";
import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck.js";
import { formatearCLP } from "../../utils/rutas";

const fechaHora = (v) => (v ? new Date(v).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

/**
 * Logística → Entregas → Sin ruta: los retiros en bodega y los despachos por courier (plan §3 #13),
 * con sus respuestas y comprobantes, y el botón para registrar uno.
 */
export default function EntregasSinRuta() {
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [registrando, setRegistrando] = useState(false);
  const [abierta, setAbierta] = useState(null);
  const puedeEscribir = checkScope(ModelType.RUTA, ScopeType.WRITE);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await api("/rutas/entregas-sin-ruta");
      setFilas(Array.isArray(r) ? r : []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const columns = [
    { header: "Fecha", accessor: "fecha_hora", sortable: true, sortValue: (e) => e.fecha_hora ?? "", Cell: ({ value }) => fechaHora(value) },
    { header: "Cliente", accessor: "cliente", sortable: true },
    { header: "Modalidad", accessor: "modalidad", sortable: true },
    {
      header: "Resultado",
      accessor: "estado",
      sortable: true,
      Cell: ({ row }) => (row.anulada_en ? <span className="text-gray-400 line-through">{row.estado}</span> : row.estado),
    },
    {
      header: "Pedidos",
      accessor: "ovs",
      sortable: false,
      filtro: false,
      Cell: ({ row }) => [...new Set(row.documentos.map((d) => `OV #${d.id_orden_venta}`))].join(", "),
    },
    { header: "Costo", accessor: "costo_externo", align: "right", sortable: true, Cell: ({ value }) => (value != null ? formatearCLP(value) : "—") },
    { header: "Seguimiento", accessor: "seguimiento", sortable: true, Cell: ({ value }) => value ?? "—" },
  ];

  const actions = (row) => (
    <div className="flex gap-2 justify-center items-center">
      <button type="button" onClick={() => setAbierta(row)} className="text-gray-400 hover:text-blue-500" title="Ver el registro">
        <Eye className="w-5 h-5" />
      </button>
    </div>
  );

  return (
    <>
      <div className="px-6 pt-6"><BackButton to="/Logistica/entregas" /></div>
      <DataTable
        title="Entregas sin ruta"
        data={filas}
        columns={columns}
        actions={actions}
        stickyActions
        getSearchText={(e) => [e.cliente, e.modalidad, e.estado, e.seguimiento, e.comentario, ...e.documentos.map((d) => d.id_orden_venta)].join(" ")}
        initialSort={{ key: "fecha_hora", direction: "desc" }}
        loading={cargando}
        loadingMessage="Cargando entregas"
        emptyMessage="Todavía no hay retiros ni despachos externos."
        headerActions={
          puedeEscribir && (
            <button
              type="button"
              onClick={() => setRegistrando(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark"
            >
              <PackageCheck className="w-4 h-4" /> Registrar retiro o despacho
            </button>
          )
        }
      />
      {registrando && <ModalEntregaSinRuta onCerrar={() => setRegistrando(false)} onRegistrada={cargar} />}
      <Modal
        abierto={Boolean(abierta)}
        onCerrar={() => setAbierta(null)}
        ancho="max-w-3xl"
        titulo={abierta ? `${abierta.cliente} · ${abierta.modalidad}` : ""}
        descripcion={abierta?.seguimiento ? `Seguimiento: ${abierta.seguimiento}${abierta.costo_externo != null ? ` · costo ${formatearCLP(abierta.costo_externo)}` : ""}` : null}
      >
        {abierta && <EntregaParada entrega={abierta} />}
      </Modal>
    </>
  );
}
