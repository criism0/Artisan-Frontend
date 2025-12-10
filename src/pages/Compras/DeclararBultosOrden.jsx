import { useState, useEffect } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import Table from "../../components/Table";
import { BackButton } from "../../components/Buttons/ActionButtons";
import axiosInstance from "../../axiosInstance";
import { API_BASE, useApi } from "../../lib/api";
import { toast } from "../../lib/toast";

export default function DeclararBultosOrden() {
  const { ordenId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const api = useApi();

  const [bultos, setBultos] = useState([]);
  const [ordenData, setOrdenData] = useState(null);
  const [errors, setErrors] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

  useEffect(() => {
    const fetchBultos = async () => {
      setIsLoading(true);
      try {
        // Cargar la orden completa para obtener información de insumos
        const orden = await api(`/proceso-compra/ordenes/${ordenId}`, { method: "GET" });
        setOrdenData(orden);

        // Si vienen bultos en state (desde RecepcionarOrden), usarlos
        let bultosData = [];
        if (Array.isArray(state?.bultos) && state.bultos.length > 0) {
          bultosData = state.bultos;
        } else if (Array.isArray(orden?.bultos) && orden.bultos.length > 0) {
          bultosData = orden.bultos;
        } else {
          toast.error("No se encontraron bultos para esta orden.");
          navigate("/Ordenes");
          return;
        }

        // Crear un mapa de insumos por id_proveedor_materia_prima para calcular cantidad_unidades
        const insumosMap = {};
        if (Array.isArray(orden?.materiasPrimas)) {
          orden.materiasPrimas.forEach((mp) => {
            const idPMP = mp.id_proveedor_materia_prima;
            if (idPMP) {
              insumosMap[idPMP] = {
                cantidad_recepcionada: mp.cantidad_recepcionada || 0,
                cantidad_bultos: mp.cantidad_bultos || 0,
                cantidad_por_formato: mp.cantidad_por_formato ?? mp.proveedorMateriaPrima?.cantidad_por_formato ?? 1,
                nombre: mp.proveedorMateriaPrima?.materiaPrima?.nombre || mp.materiaPrima?.nombre || "—",
                formato: mp.proveedorMateriaPrima?.formato || mp.formato || "",
                unidad_medida: mp.proveedorMateriaPrima?.unidad_medida || mp.proveedorMateriaPrima?.materiaPrima?.unidad_medida || "",
              };
            }
          });
        }

        // Agrupar bultos por insumo para calcular cantidad_unidades sugerida
        const bultosPorInsumo = {};
        bultosData.forEach((b) => {
          const idPMP = b.id_proveedor_materia_prima || b.id_materia_prima;
          if (!bultosPorInsumo[idPMP]) {
            bultosPorInsumo[idPMP] = [];
          }
          bultosPorInsumo[idPMP].push(b);
        });

        // Mapear bultos con información calculada
        const bultosConInfo = bultosData.map((b, index) => {
          const idPMP = b.id_proveedor_materia_prima || b.id_materia_prima;
          const insumo = insumosMap[idPMP];
          
          // Calcular cantidad_formato sugerida: cantidad_recepcionada / cantidad_bultos (en formatos, no unidades)
          let cantidadFormatoSugerida = "";
          if (insumo && insumo.cantidad_recepcionada > 0) {
            const bultosDelInsumo = bultosPorInsumo[idPMP]?.length || insumo.cantidad_bultos || 1;
            if (bultosDelInsumo > 0) {
              // Dividir equitativamente la cantidad_recepcionada (en formatos) entre los bultos
              const cantidadPorBulto = Math.floor(insumo.cantidad_recepcionada / bultosDelInsumo);
              // Encontrar el índice de este bulto dentro de los bultos del mismo insumo
              const indiceEnInsumo = bultosPorInsumo[idPMP].findIndex((bulto) => bulto.id === b.id);
              cantidadFormatoSugerida = cantidadPorBulto;
              
              // Si hay resto, agregarlo al último bulto
              const resto = insumo.cantidad_recepcionada % bultosDelInsumo;
              if (indiceEnInsumo === bultosDelInsumo - 1 && resto > 0) {
                cantidadFormatoSugerida += resto;
              }
            }
          }

          // Si ya tiene cantidad_unidades guardada, calcular cantidad_formato desde ahí
          // Si no, usar la sugerida
          let cantidadFormato = "";
          if (b.cantidad_unidades && insumo?.cantidad_por_formato > 0) {
            // Convertir unidades guardadas a formatos para mostrar
            cantidadFormato = Number(b.cantidad_unidades) / insumo.cantidad_por_formato;
          } else {
            cantidadFormato = cantidadFormatoSugerida || "";
          }

          return {
            id: b.id,
            id_proveedor_materia_prima: idPMP,
            insumo_nombre: insumo?.nombre || "—",
            insumo_formato: insumo?.formato || "",
            insumo_unidad_medida: insumo?.unidad_medida || "",
            cantidad_por_formato: insumo?.cantidad_por_formato || 1,
            cantidad_recepcionada: insumo?.cantidad_recepcionada || 0,
            cantidad_formato: cantidadFormato, // Lo que el usuario edita (en formatos)
            cantidad_unidades: b.cantidad_unidades || "", // Se calcula al enviar
            identificador_proveedor: b.identificador_proveedor || "",
          };
        });

        setBultos(bultosConInfo);
      } catch (error) {
        toast.error("Error al cargar los bultos: " + error);
        navigate("/Ordenes");
      } finally {
        setIsLoading(false);
      }
    };

    if (ordenId) {
      fetchBultos();
    }
  }, [ordenId, state, api, navigate]);

  const handleChange = (index, field, value) => {
    setBultos((prev) =>
      prev.map((b, i) => {
        if (i === index) {
          return { ...b, [field]: value };
        }
        if (i > index) {
          // No propagar cantidad_formato para que cada fila mantenga su sugerencia
          if (field === "cantidad_formato") {
            return b;
          }
          return { ...b, [field]: value };
        }
        return b;
      })
    );
  };

  const handleSubmit = async () => {
    const hasInvalid = bultos.some(
      (b) =>
        !b.cantidad_formato ||
        !b.identificador_proveedor?.toString().trim()
    );

    if (hasInvalid) {
      setErrors("Todos los campos son obligatorios en cada bulto.");
      return;
    }

    setErrors("");
    try {
      const payload = {
        bultos: bultos.map((b) => {
          // Calcular cantidad_unidades: cantidad_formato × cantidad_por_formato
          const cantidadFormato = Number(b.cantidad_formato) || 0;
          const cantidadPorFormato = Number(b.cantidad_por_formato) || 1;
          const cantidadUnidades = cantidadFormato * cantidadPorFormato;
          
          return {
            id: Number(b.id),
            cantidad_unidades: cantidadUnidades,
            identificador_proveedor: b.identificador_proveedor.toString(),
          };
        }),
      };
      
      console.log("Enviando bultos al backend:", payload);
      
      await axiosInstance.put(
        `${API_BASE}/proceso-compra/ordenes/${ordenId}/declarar-bultos`,
        payload
      );
      toast.success("Bultos declarados correctamente.");
      navigate("/Ordenes");
    } catch (err) {
      toast.error("Error al declarar bultos: " + err);
    }
  };

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key) {
      direction = sortConfig.direction === "asc" ? "desc" : "asc";
    }
    setSortConfig({ key, direction });
    const sortedData = [...bultos].sort((a, b) => {
      let aVal = a[key];
      let bVal = b[key];
      
      // Manejar insumo_nombre que puede tener formato
      if (key === "insumo_nombre") {
        const nombreA = a.insumo_nombre?.trim() || "—";
        const nombreB = b.insumo_nombre?.trim() || "—";
        aVal = nombreA;
        bVal = nombreB;
      }
      
      if (aVal == null || aVal === "") return 1;
      if (bVal == null || bVal === "") return -1;
      
      // Convertir a número si es posible (para cantidad_formato, id)
      const aNum = Number(aVal);
      const bNum = Number(bVal);
      if (!isNaN(aNum) && !isNaN(bNum) && (aVal === "" || aVal.toString() === aNum.toString()) && (bVal === "" || bVal.toString() === bNum.toString())) {
        return direction === "asc" ? aNum - bNum : bNum - aNum;
      }
      
      // Ordenamiento por texto
      const aStr = aVal.toString().toLowerCase();
      const bStr = bVal.toString().toLowerCase();
      return direction === "asc"
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
    setBultos(sortedData);
  };

  const renderHeader = (col) => {
    if (!col.sortable) return col.header;
    const isActive = sortConfig.key === col.accessor;
    const ascActive = isActive && sortConfig.direction === "asc";
    const descActive = isActive && sortConfig.direction === "desc";
    
    return (
      <div
        className="flex items-center gap-1 cursor-pointer select-none"
        onClick={() => handleSort(col.accessor)}
      >
        <span>{col.header}</span>
        <div className="flex flex-col leading-none text-xs ml-1">
          <span className={ascActive ? "text-gray-900" : "text-gray-300"}>▲</span>
          <span className={descActive ? "text-gray-900" : "text-gray-300"}>▼</span>
        </div>
      </div>
    );
  };

  const columns = [
    { header: "ID Bulto", accessor: "id", sortable: true },
    {
      header: "Insumo",
      accessor: "insumo_nombre",
      sortable: true,
      Cell: ({ row }) => {
        const formato = row.insumo_formato?.trim() || "";
        const nombre = row.insumo_nombre?.trim() || "—";
        const unidad_medida = row.insumo_unidad_medida?.trim() || "";
        const cantidad_por_formato = row.cantidad_por_formato || 1;
        
        // Mostrar formato en negrita si existe y es distinto del nombre
        const mostrarFormato = formato && formato.toLowerCase() !== nombre.toLowerCase();
        
        return (
          <span>
            {mostrarFormato && <strong>({formato}) </strong>}
            {nombre}
            {cantidad_por_formato > 1 && (
              <span className="text-gray-500"> ({cantidad_por_formato} {unidad_medida})</span>
            )}
          </span>
        );
      },
    },
    {
      header: "Cantidad",
      accessor: "cantidad_formato",
      sortable: true,
      Cell: ({ row }) => {
        const formato = row.insumo_formato?.trim() || "formato";
        return (
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="0"
              step="0.01"
              value={row.cantidad_formato}
              onChange={(e) =>
                handleChange(
                  bultos.findIndex((b) => b.id === row.id),
                  "cantidad_formato",
                  e.target.value
                )
              }
              className="w-24 px-2 py-1 border rounded"
              placeholder="0"
            />
            <span className="text-xs text-gray-500">{formato}</span>
          </div>
        );
      },
    },
    {
      header: "Identificador lote",
      accessor: "identificador_proveedor",
      sortable: true,
      Cell: ({ row }) => (
        <input
          type="text"
          value={row.identificador_proveedor}
          onChange={(e) =>
            handleChange(
              bultos.findIndex((b) => b.id === row.id),
              "identificador_proveedor",
              e.target.value
            )
          }
          className="w-32 px-2 py-1 border rounded"
          placeholder="Lote proveedor"
        />
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="p-6 bg-background min-h-screen">
        <div className="flex justify-center items-center h-64">
          <span className="text-text">Cargando bultos...</span>
        </div>
      </div>
    );
  }

  if (bultos.length === 0) {
    return (
      <div className="p-6 bg-background min-h-screen">
        <BackButton to="/Ordenes" />
        <h1 className="text-2xl font-bold mb-4">Declarar Bultos</h1>
        <p className="text-gray-600">No hay bultos para declarar en esta orden.</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-background min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Declarar Bultos</h1>

      {errors && <p className="text-red-600 mb-4">{errors}</p>}

      <Table 
        columns={columns.map((col) => ({
          ...col,
          header: renderHeader(col),
        }))} 
        data={bultos} 
      />

      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSubmit}
          className="px-4 py-2 bg-primary text-white rounded hover:bg-hover"
        >
          Enviar Bultos
        </button>
      </div>
    </div>
  );
}
