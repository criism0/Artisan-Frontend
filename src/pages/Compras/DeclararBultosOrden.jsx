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

  const clp = new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  });

  useEffect(() => {
    const fetchBultos = async () => {
      setIsLoading(true);
      try {
        // Cargar la orden completa
        const orden = await api(`/proceso-compra/ordenes/${ordenId}`, { method: "GET" });
        setOrdenData(orden);

        // Cargar datos del proveedor para obtener info de las materias primas base
        const proveedor = await api(`/proveedores/${orden.id_proveedor}`, { method: "GET" });
        const pmpMap = {};
        if (proveedor && proveedor.materiasPrimas) {
          proveedor.materiasPrimas.forEach(pmp => {
            pmpMap[pmp.id] = pmp;
          });
        }

        // Mapas de lo que se compró (Purchase Info)
        const purchaseByMpId = {};
        const purchaseByMpocId = {};
        if (Array.isArray(orden?.materiasPrimas)) {
          orden.materiasPrimas.forEach((mp) => {
            // mp is MateriaPrimaOrdenDeCompra
            // mp.proveedorMateriaPrima is the purchased format
            const pmp = mp.proveedorMateriaPrima;
            const mpId = pmp?.id_materia_prima || pmp?.materiaPrima?.id;
            
            const purchaseInfo = pmp ? {
                id: pmp.id,
                formato: pmp.formato, // "Caja 6 un"
                cantidadPorFormato: Number(pmp.cantidad_por_formato) || 1,
                unidadMedida: pmp.unidad_medida,
                nombre: pmp.materiaPrima?.nombre,
                precioUnitarioCompra: Number(mp.precio_unitario) || 0,
                mpocId: mp.id,
              } : null;

            if (purchaseInfo && mpId) {
              purchaseByMpId[mpId] = purchaseInfo;
            }
            if (purchaseInfo && mp.id) {
              purchaseByMpocId[mp.id] = purchaseInfo;
            }
          });
        }

        // Obtener bultos (ya vienen creados desde el backend con la lógica de base)
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

        // Mapear bultos con información del PMP base
        const bultosConInfo = bultosData.map((b) => {
          const idPMP = b.id_proveedor_materia_prima;
          const pmp = pmpMap[idPMP]; // Base PMP
          const mpId = pmp?.id_materia_prima || pmp?.materiaPrima?.id;
          const mpocId = b.id_materia_prima_orden_de_compra;
          const purchaseInfo = purchaseByMpocId[mpocId] || purchaseByMpId[mpId];

          // Calcular ratio de conversión (Cuántas unidades base caben en el formato de compra)
           const baseQty = Number(pmp?.cantidad_por_formato) || 1;
           const purchaseQty = Number(purchaseInfo?.cantidadPorFormato) || 1;
           const ratio = baseQty > 0 ? (purchaseQty / baseQty) : 1;

           const unitCostBase = (purchaseInfo?.precioUnitarioCompra && purchaseQty > 0)
            ? ((Number(purchaseInfo.precioUnitarioCompra) / purchaseQty) * baseQty)
            : 0;
          
          return {
            id: b.id,
            id_proveedor_materia_prima: idPMP,
            id_materia_prima_orden_de_compra: mpocId,
            insumo_nombre: pmp?.materiaPrima?.nombre || "—",
            insumo_formato: pmp?.formato || "", // Ej: Botella 0.25L
            insumo_unidad_medida: pmp?.unidad_medida || pmp?.materiaPrima?.unidad_medida || "",
            
            // Info de compra para referencia visual
            purchaseInfo,
            ratio,
            groupKey: mpocId || mpId || "unknown",

            // Cantidad de unidades base (ya calculada por backend)
            cantidad_unidades: b.cantidad_unidades || 0,
            
            identificador_proveedor: b.identificador_proveedor || "",
            
            unitCostBase,

            // UX: cuando el usuario edita un lote, ese bulto se vuelve "corte".
            // Los bultos autocompletados NO marcan este flag.
            loteEdited: false,
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

  const handleChange = (id, field, value) => {
    setBultos((prev) => prev.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
  };

  const handleLoteChange = (id, value) => {
    setBultos((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx === -1) return prev;

      const groupKey = prev[idx].groupKey;
      const groupIndices = [];
      for (let i = 0; i < prev.length; i++) {
        if (prev[i].groupKey === groupKey) groupIndices.push(i);
      }

      const pos = groupIndices.indexOf(idx);
      if (pos === -1) {
        return prev.map((b) => (b.id === id ? { ...b, identificador_proveedor: value, loteEdited: true } : b));
      }

      // Propagar desde este bulto hacia adelante hasta el próximo bulto editado manualmente.
      let stopPosExclusive = groupIndices.length;
      for (let p = pos + 1; p < groupIndices.length; p++) {
        const nextIdx = groupIndices[p];
        if (prev[nextIdx].loteEdited) {
          stopPosExclusive = p;
          break;
        }
      }

      return prev.map((b, i) => {
        if (i === idx) {
          return { ...b, identificador_proveedor: value, loteEdited: true };
        }

        const p = groupIndices.indexOf(i);
        if (p > pos && p < stopPosExclusive && !b.loteEdited) {
          return { ...b, identificador_proveedor: value };
        }
        return b;
      });
    });
  };

  const handleSubmit = async () => {
    const hasInvalid = bultos.some(
      (b) =>
        !b.cantidad_unidades ||
        !b.identificador_proveedor?.toString().trim()
    );

    if (hasInvalid) {
      setErrors("Todos los campos son obligatorios en cada bulto.");
      return;
    }

    setErrors("");
    try {
      const payload = {
        bultos: bultos.map((b) => ({
          id: b.id,
          id_proveedor_materia_prima: b.id_proveedor_materia_prima,
          cantidad_unidades: Number(b.cantidad_unidades),
          identificador_proveedor: b.identificador_proveedor,
        })),
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
        const purchaseFormato = row.purchaseInfo?.formato;
        
        return (
          <div className="flex flex-col">
            <span>
              <strong>{nombre}</strong> {formato && `(${formato})`}
            </span>
            {purchaseFormato && purchaseFormato !== formato && (
               <span className="text-xs text-gray-500">
                 Viene de: {purchaseFormato}
               </span>
            )}
          </div>
        );
      },
    },
    {
      header: "Unidades Contenidas",
      accessor: "cantidad_unidades",
      sortable: true,
      Cell: ({ row }) => {
        const equivalencia = (row.cantidad_unidades && row.ratio && row.ratio > 0) 
          ? (row.cantidad_unidades / row.ratio).toFixed(2) 
          : "";
        const purchaseFormato = row.purchaseInfo?.formato || "Origen";

        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                step="0.01"
                value={row.cantidad_unidades}
                onChange={(e) =>
                  handleChange(row.id, "cantidad_unidades", e.target.value)
                }
                className="w-24 px-2 py-1 border rounded"
                placeholder="0"
              />
            </div>
            {row.ratio > 1.01 && equivalencia && (
                <span className="text-xs text-blue-600">
                    ≈ {equivalencia} {purchaseFormato}
                </span>
            )}
          </div>
        );
      },
    },
    {
      header: "Costo (estimado)",
      accessor: "unitCostBase",
      sortable: true,
      Cell: ({ row }) => {
        const unidades = Number(row.cantidad_unidades) || 0;
        const unitCost = Number(row.unitCostBase) || 0;
        const total = unidades * unitCost;
        return (
          <div className="flex flex-col">
            <span className="font-medium">{clp.format(total || 0)}</span>
            {unitCost > 0 && (
              <span className="text-xs text-gray-500">
                {clp.format(unitCost)} / un.
              </span>
            )}
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
            handleLoteChange(row.id, e.target.value)
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

  // Agrupar bultos por Materia Prima (Solicitud)
  const groupedBultos = bultos.reduce((acc, bulto) => {
    const key = bulto.groupKey || "unknown";
    if (!acc[key]) {
      acc[key] = {
        purchaseInfo: bulto.purchaseInfo,
        bultos: []
      };
    }
    acc[key].bultos.push(bulto);
    return acc;
  }, {});

  return (
    <div className="p-6 bg-background min-h-screen">
      <h1 className="text-2xl font-bold mb-6">Declarar Bultos</h1>

      {errors && <p className="text-red-600 mb-4 p-3 bg-red-50 rounded border border-red-200">{errors}</p>}

      {Object.entries(groupedBultos).map(([key, group]) => {
        const totalBaseUnits = group.bultos.reduce((sum, b) => sum + (Number(b.cantidad_unidades) || 0), 0);
        const purchaseFormatName = group.purchaseInfo?.formato || "Formato Base";
        const ratio = group.bultos[0]?.ratio || 1;
        const totalPurchaseUnits = (ratio > 0) ? (totalBaseUnits / ratio).toFixed(2) : 0;

        return (
        <div key={key} className="mb-8 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                {group.purchaseInfo?.nombre || "Insumo Desconocido"}
                <span className="text-sm font-normal text-gray-500 bg-white px-2 py-0.5 rounded border">
                  {purchaseFormatName}
                </span>
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                 Viene de: <strong>{purchaseFormatName}</strong> &rarr; {group.bultos.length} bultos
                 {ratio > 1.01 && (
                    <span className="ml-2">
                       (Total: {totalBaseUnits} un. base &asymp; {totalPurchaseUnits} {purchaseFormatName})
                    </span>
                 )}
              </p>
            </div>
            <div className="text-right text-sm text-gray-600">
              <span className="font-medium text-lg">{group.bultos.length}</span> bultos
            </div>
          </div>
          
          <div className="p-0">
            <Table 
                columns={columns.map((col) => ({
                ...col,
                header: renderHeader(col),
                }))} 
                data={group.bultos} 
            />
          </div>
        </div>
      )})}

      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSubmit}
          className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-hover shadow-sm font-medium"
        >
          Confirmar y Enviar Bultos
        </button>
      </div>
    </div>
  );
}
