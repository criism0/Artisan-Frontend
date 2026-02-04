// src/pages/ventas/ClienteDetail.jsx
import { useParams, useNavigate } from "react-router-dom";
import {
  BackButton,
  EditButton,
  ViewDetailButton,
  DeleteButton
} from "../../components/Buttons/ActionButtons";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Table from "../../components/Table";
import DireccionesManager from "../../components/DireccionesManager";
import { api } from "../../lib/api.js";

/** Combobox liviano: input + lista en portal (fixed) debajo del input) */
function ProductCombobox({
  value,
  onChange,
  options,
  onSelect,
  placeholder = "Escribe para buscar producto..."
}) {
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  const filtered = (value || "").trim()
    ? options.filter((p) =>
        p.nombre.toLowerCase().includes(value.toLowerCase())
      )
    : options;

  const updatePosition = () => {
    if (!inputRef.current) return;
    const r = inputRef.current.getBoundingClientRect();
    setCoords({ top: r.bottom + 8, left: r.left, width: r.width });
  };

  useEffect(() => {
    updatePosition();
  }, [open, value]);

  useEffect(() => {
    const onScroll = () => open && updatePosition();
    const onResize = () => open && updatePosition();
    const onClick = (e) => {
      if (!inputRef.current) return;
      if (!open) return;
      const target = e.target;
      if (target === inputRef.current || inputRef.current.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    window.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("click", onClick, true);
    };
  }, [open]);

  return (
    <>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          if (!open) setOpen(true);
        }}
        onFocus={() => {
          updatePosition();
          setOpen(true);
        }}
        placeholder={placeholder}
        className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
      />

      {open && filtered.length > 0 &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              width: coords.width,
              zIndex: 2147483647
            }}
          >
            <ul className="bg-white border rounded-md shadow-lg max-h-56 overflow-auto">
              {filtered.map((prod) => (
                <li
                  key={prod.id}
                  className="px-3 py-2 hover:bg-primary/10 cursor-pointer"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelect(prod);
                    setOpen(false);
                  }}
                >
                  {prod.nombre}
                </li>
              ))}
            </ul>
          </div>,
          document.body
        )}
    </>
  );
}

export default function ClienteDetail() {
  const { clienteId } = useParams();
  const navigate = useNavigate();

  const [cliente, setCliente] = useState(null);
  const [direcciones, setDirecciones] = useState([]);
  const [precios, setPrecios] = useState([]);
  const [productos, setProductos] = useState([]);
  const [showPrecios, setShowPrecios] = useState(false);
  const [inputValues, setInputValues] = useState({});
  const [nuevos, setNuevos] = useState([]);
  const [errores, setErrores] = useState({});
  const [listasPrecio, setListasPrecio] = useState([]);

  useEffect(() => {
    api(`/clientes/${clienteId}`)
      .then((data) => setCliente(data))
      .catch(() => {});
  }, [clienteId]);

  useEffect(() => {
    api(`/lista-precio`)
      .then((data) => setListasPrecio(data))
      .catch(() => {});

    api(`/direcciones/cliente/${clienteId}`)
      .then((data) => setDirecciones(data))
      .catch((error) => {
        
        api(`/direcciones?clienteId=${clienteId}`)
          .then((data) => setDirecciones(data))
          .catch(() => {});
      });

    api(`/precio-clientes?clienteId=${clienteId}`)
      .then((data) => {
        setPrecios(data);
        const init = {};
        data.forEach((p) => {
          init[p.id] = p.precio_unitario;
        });
        setInputValues(init);
      })
      .catch(() => {});

    api("/productos-base")
      .then((data) => setProductos(data))
      .catch(() => {});
  }, [clienteId]);

  const preciosConNombre = precios.map((p) => {
    const producto = productos.find((prod) => prod.id === p.id_producto);
    return {
      ...p,
      nombre_producto: producto ? producto.nombre : `Producto #${p.id_producto}`
    };
  });

  const handleDeleteCliente = async () => {
    if (!window.confirm("¿Seguro que deseas eliminar este cliente?")) return;
    try {
      await api(`/clientes/${clienteId}`, { method: "DELETE" });
      navigate("/clientes");
    } catch (err) {
      alert("Error al eliminar cliente");
    }
  };

  const validarPrecios = () => {
    const nuevosErrores = {};
    preciosConNombre.forEach((p) => {
      const val = inputValues[p.id];
      if (val === "" || val == null) {
        nuevosErrores[p.id] = "El precio no puede estar vacío.";
      } else if (Number(val) < 0) {
        nuevosErrores[p.id] = "El precio no puede ser negativo.";
      }
    });
    nuevos.forEach((n, i) => {
      if (!n.id_producto) {
        nuevosErrores[`nuevo-${i}-id_producto`] = "Debe seleccionar un producto.";
      }
      if (!n.precio_unitario) {
        nuevosErrores[`nuevo-${i}-precio`] = "Debe ingresar un precio.";
      } else if (Number(n.precio_unitario) < 0) {
        nuevosErrores[`nuevo-${i}-precio`] = "El precio no puede ser negativo.";
      }
    });
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const handleGuardarCambios = async () => {
    if (!validarPrecios()) return;
    try {
      const updates = preciosConNombre.map((p) =>
        api(`/precio-clientes/${p.id}`, {
          method: "PUT",
          body: JSON.stringify({ precio_unitario: Number(inputValues[p.id]) || 0 })
        })
      );
      const creaciones = nuevos.map((n) =>
        api("/precio-clientes", {
          method: "POST",
          body: JSON.stringify({
            id_cliente: Number(clienteId),
            id_producto: Number(n.id_producto),
            precio_unitario: Number(n.precio_unitario)
          })
        })
      );
      await Promise.all([...updates, ...creaciones]);
      alert("Cambios guardados correctamente.");
      const data = await api(`/precio-clientes?clienteId=${clienteId}`);
      setPrecios(data);
      setNuevos([]);
      setErrores({});
    } catch (err) {
      alert("Error al guardar cambios.");
    }
  };

  if (!cliente) {
    return (
      <div className="p-6 bg-background min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text">Cargando cliente...</p>
        </div>
      </div>
    );
  }

  const listaPrecioNombre = (() => {
    const idLista = cliente.id_lista_precio;
    if (!idLista) return "-";
    const encontrada = listasPrecio.find((l) => l.id === idLista);
    return encontrada?.nombre || `Lista #${idLista}`;
  })();

  const formatoCompra = (
    cliente.formato_compra_predeterminado ||
    cliente.tipo_precio ||
    cliente.tipoPrecio ||
    cliente.formato_compra ||
    cliente.formatoCompra ||
    "-"
  );

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="mb-4">
        <BackButton to="/clientes" />
      </div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-text">Detalle del Cliente</h1>
        <div className="flex gap-2">
          <EditButton
            onClick={() => navigate(`/clientes/${clienteId}/edit`)}
            tooltipText="Editar Cliente"
          />
          <DeleteButton
            onConfirmDelete={handleDeleteCliente}
            tooltipText="Eliminar Cliente"
            entityName="cliente"
          />
        </div>
      </div>

      {/* Sección 1: Clasificación Comercial */}
      <div className="bg-white shadow rounded-xl border border-border p-6 mb-6">
        <h2 className="text-lg font-semibold text-text mb-4 flex items-center">
          <span className="bg-primary/10 text-primary rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">1</span>
          Clasificación Comercial
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-gray-500 text-sm mb-1">Canal</p>
            <p className="font-medium">{cliente.canalInfo?.nombre || "-"}</p>
          </div>
          <div>
            <p className="text-gray-500 text-sm mb-1">Lista de Precios Asignada</p>
            <p className="font-medium">{listaPrecioNombre}</p>
          </div>
          <div>
            <p className="text-gray-500 text-sm mb-1">Formato de Compra Predeterminado</p>
            <p className="font-medium">{formatoCompra}</p>
          </div>
        </div>
      </div>

      {/* Sección 2: Información Fiscal y de Facturación */}
      <div className="bg-white shadow rounded-xl border border-border p-6 mb-6">
        <h2 className="text-lg font-semibold text-text mb-4 flex items-center">
          <span className="bg-primary/10 text-primary rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">2</span>
          Información Fiscal y de Facturación
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-gray-500 text-sm mb-1">Nombre Comercial</p>
            <p className="font-medium">{cliente.nombre_empresa || "-"}</p>
          </div>
          <div>
            <p className="text-gray-500 text-sm mb-1">Razón Social</p>
            <p className="font-medium">{cliente.razon_social || "-"}</p>
          </div>
          <div>
            <p className="text-gray-500 text-sm mb-1">RUT</p>
            <p className="font-medium">{cliente.rut || "-"}</p>
          </div>
          <div>
            <p className="text-gray-500 text-sm mb-1">Giro</p>
            <p className="font-medium">{cliente.giro || "-"}</p>
          </div>
          <div>
            <p className="text-gray-500 text-sm mb-1">Condición de Pago</p>
            <p className="font-medium">{cliente.condicion_pago || "-"}</p>
          </div>
        </div>
      </div>

      {/* Sección 3: Puntos de Contacto */}
      <div className="bg-white shadow rounded-xl border border-border p-6 mb-6">
        <h2 className="text-lg font-semibold text-text mb-4 flex items-center">
          <span className="bg-primary/10 text-primary rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">3</span>
          Puntos de Contacto
        </h2>
        <div className="space-y-6">
          <div className="border-l-4 border-primary/60 pl-4">
            <h3 className="text-base font-semibold text-text mb-3">Contacto Comercial</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-gray-500 text-sm mb-1">Nombre</p>
                <p className="font-medium">{cliente.contacto_comercial || "-"}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm mb-1">Teléfono</p>
                <p className="font-medium">{cliente.telefono_comercial || "-"}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm mb-1">E-mail</p>
                <p className="font-medium">{cliente.email_comercial || "-"}</p>
              </div>
            </div>
          </div>

          <div className="border-l-4 border-primary/30 pl-4">
            <h3 className="text-base font-semibold text-text mb-3">Contacto Finanzas (Opcional)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-gray-500 text-sm mb-1">Nombre</p>
                <p className="font-medium">{cliente.contacto_finanzas || "-"}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm mb-1">Teléfono</p>
                <p className="font-medium">{cliente.telefono_finanzas || "-"}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm mb-1">E-mail</p>
                <p className="font-medium">{cliente.email_finanzas || "-"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Direcciones Asociadas */}
      <div className="mb-4 mt-8">
        <DireccionesManager 
          clienteId={clienteId}
          direcciones={direcciones}
          onDireccionesChange={setDirecciones}
          isEditing={false}
        />
      </div>

    </div>
  );
}
