import { useState, useEffect, useRef, useMemo } from 'react';
import { FiTrash } from 'react-icons/fi';
import Selector from './Selector';
import { useApi } from '../lib/api';

export default function InsumosTable({ onInsumosChange, disabled = false, bodegaId, addSignal = 0, onAvailabilityChange, bodegaSolicitanteId }) {
  const [articulos, setArticulos] = useState([]);
  const [opcionesInsumos, setOpcionesInsumos] = useState([]);
  // Stock actual en la bodega solicitante (Map id_materia_prima -> stock numérico)
  const [solicitanteStockMap, setSolicitanteStockMap] = useState(new Map());
  const isAddDisabled = disabled || opcionesInsumos.length === 0;
  const lastAddSignal = useRef(addSignal);
  const api = useApi();

  const normalizeInventario = (response) => {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.inventario)) return response.inventario;
    if (Array.isArray(response?.data)) return response.data;
    if (Array.isArray(response?.data?.inventario)) return response.data.inventario;
    return [];
  };

  const optionById = useMemo(() => {
    const m = new Map();
    for (const o of opcionesInsumos) m.set(o.value, o);
    return m;
  }, [opcionesInsumos]);

  // Utilidad compartida para parsear "unidades_disponibles"
  const parseStock = (str) => {
    if (!str) return 0;
    const m = String(str).match(/^\s*([0-9]+(?:[\.,][0-9]+)?)/);
    if (!m) return 0;
    const num = parseFloat(m[1].replace(',', '.'));
    return Number.isFinite(num) ? num : 0;
  };

  // Insumos filtrados por la bodega proveedora
  useEffect(() => {
    const fetchInsumos = async () => {
      try {
        if (!bodegaId) {
          setOpcionesInsumos([]);
          onAvailabilityChange?.(false);
          return;
        }
        const response = await api(`/inventario/${bodegaId}`);
        const inventario = normalizeInventario(response);
        const insumosData = inventario
          .map((item) => {
            const mp = item?.materiaPrima;
            if (!mp) return null;
            const unidad = mp?.unidad_medida ? String(mp.unidad_medida).toLowerCase() : null;
            const stock = parseStock(item?.unidades_disponibles);
            return { value: mp.id?.toString(), label: mp.nombre, stock, unidad };
          })
          .filter((x) => x && x.value);
        setOpcionesInsumos(insumosData);
        onAvailabilityChange?.(insumosData.length > 0);
      } catch (error) {
        console.error("Error fetching insumos por bodega:", error);
        setOpcionesInsumos([]);
        onAvailabilityChange?.(false);
      }
    };

    fetchInsumos();
  }, [bodegaId]);

  // Stock actual en la bodega solicitante
  useEffect(() => {
    const fetchSolicitante = async () => {
      try {
        if (!bodegaSolicitanteId) {
          setSolicitanteStockMap(new Map());
          return;
        }
        const response = await api(`/inventario/${bodegaSolicitanteId}`);
        const inventario = normalizeInventario(response);
        const map = new Map();
        inventario.forEach((item) => {
          const mp = item?.materiaPrima;
          if (!mp?.id) return;
          const stock = parseStock(item?.unidades_disponibles);
          map.set(mp.id.toString(), stock);
        });
        setSolicitanteStockMap(map);
      } catch (e) {
        console.error('Error fetching inventario bodega solicitante:', e);
        setSolicitanteStockMap(new Map());
      }
    };
    fetchSolicitante();
  }, [bodegaSolicitanteId]);

  // Limpiar artículos cuando cambia la bodega
  useEffect(() => {
    setArticulos([]);
  }, [bodegaId]);

  const validateArticulo = (articulo) => {
    const errors = [];
    if (!articulo.id_articulo) {
      errors.push('Debe seleccionar un insumo');
    }
    if (!articulo.cantidad_solicitada || Number(articulo.cantidad_solicitada) <= 0) {
      errors.push('La cantidad debe ser mayor a 0');
    }
    // Validar stock disponible
    const stock = optionById.get(articulo.id_articulo)?.stock ?? null;
    if (
      articulo.id_articulo &&
      stock != null &&
      articulo.cantidad_solicitada &&
      Number.isFinite(Number(articulo.cantidad_solicitada)) &&
      Number(articulo.cantidad_solicitada) > stock
    ) {
      errors.push('No puede superar el stock disponible');
    }
    return errors;
  };

  const getArticulosValidos = () => {
    return articulos.filter(articulo => {
      const errors = validateArticulo(articulo);
      return errors.length === 0;
    });
  };

  // Notificar cambios al componente padre
  useEffect(() => {
    const articulosValidos = getArticulosValidos();
    onInsumosChange(articulosValidos);
  }, [articulos, onInsumosChange]);

  const handleAddArticulo = () => {
    if (isAddDisabled) return;
    setArticulos([...articulos, { id_articulo: '', cantidad_solicitada: '', comentario: '' }]);
  };

  const handleRemoveArticulo = (index) => {
    setArticulos(articulos.filter((_, i) => i !== index));
  };

  const handleInputChange = (index, field, value) => {
    if (field === 'cantidad_solicitada') {
      // Permite números > 0. Si unidad es 'Unidades' aplica entero; en 'Litros'/'Kilogramos' permite decimales.
      if (value === '') {
        const newArticulos = [...articulos];
        newArticulos[index] = { ...newArticulos[index], [field]: '' };
        setArticulos(newArticulos);
        return;
      }
      const idSel = articulos[index]?.id_articulo;
      const unidad = optionById.get(idSel)?.unidad;
      let numValue = Number(String(value).replace(',', '.'));
      if (!Number.isFinite(numValue)) return; // ignorar
      if (unidad === 'unidades') {
        numValue = Math.floor(numValue);
      }
      if (numValue > 0) {
        const stock = optionById.get(idSel)?.stock ?? null;
        const clamped = stock != null ? Math.min(numValue, stock) : numValue;
        const newArticulos = [...articulos];
        const formatted = unidad === 'unidades' ? String(clamped) : String(Math.round(clamped * 100) / 100);
        newArticulos[index] = { ...newArticulos[index], [field]: formatted };
        setArticulos(newArticulos);
      }
    } else if (field === 'id_articulo') {
      // Al cambiar de insumo, ajustar la cantidad si se excede del stock
      const stock = optionById.get(value)?.stock ?? null;
      const prevCantidad = Number(articulos[index]?.cantidad_solicitada);
      const next = { ...articulos[index], id_articulo: value };
      if (Number.isFinite(prevCantidad) && stock != null && prevCantidad > stock) {
        next.cantidad_solicitada = stock.toString();
      }
      const newArticulos = [...articulos];
      newArticulos[index] = next;
      setArticulos(newArticulos);
    } else {
      const newArticulos = [...articulos];
      newArticulos[index] = { ...newArticulos[index], [field]: value };
      setArticulos(newArticulos);
    }
  };

  const getErroresArticulo = (index) => {
    return validateArticulo(articulos[index]);
  };

  // Responder a la señal externa para añadir una fila
  useEffect(() => {
    if (addSignal !== lastAddSignal.current) {
      lastAddSignal.current = addSignal;
      if (!isAddDisabled) {
        handleAddArticulo();
      }
    }
  }, [addSignal, isAddDisabled]);

  // Asegurar que las cantidades no queden por sobre el stock disponible
  useEffect(() => {
    setArticulos((prev) =>
      prev.map((a) => {
        const stock = optionById.get(a.id_articulo)?.stock ?? null;
        const cant = Number(a.cantidad_solicitada);
        if (a.id_articulo && stock != null && Number.isFinite(cant) && cant > stock) {
          return { ...a, cantidad_solicitada: stock.toString() };
        }
        return a;
      })
    );
  }, [opcionesInsumos, optionById]);

  // Informar disponibilidad considerando los ya seleccionados (para deshabilitar el botón externo si no quedan opciones únicas)
  useEffect(() => {
    const selectedIds = new Set(articulos.map(a => a.id_articulo).filter(Boolean));
    const remaining = opcionesInsumos.filter(opt => !selectedIds.has(opt.value)).length;
    onAvailabilityChange?.(remaining > 0);
  }, [articulos, opcionesInsumos]);

  return (
    <div className="w-full">
  <div className="bg-white rounded-lg shadow overflow-visible">
        <table className="w-full">
          {articulos.length > 0 && (
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-s font-medium text-text uppercase tracking-wider">
                  Insumo
                </th>
                <th scope="col" className="px-6 py-3 text-left text-s font-medium text-text uppercase tracking-wider">
                  Cantidad
                </th>
                <th scope="col" className="px-6 py-3 text-left text-s font-medium text-text uppercase tracking-wider">
                  Comentario
                </th>
                <th scope="col" className="pr-3 py-3 text-center text-s font-medium text-text uppercase tracking-wider">
                  Opciones
                </th>
              </tr>
            </thead>
          )}
          <tbody className="bg-white divide-y divide-border">
            {(() => {
              const selectedIds = new Set(articulos.map(a => a.id_articulo).filter(Boolean));
              return articulos.map((articulo, index) => {
              const errores = getErroresArticulo(index);
              const optSel = optionById.get(articulo.id_articulo);
              const availableStock = optSel?.stock ?? null;
              const optionsForRow = opcionesInsumos.filter(opt => opt.value === articulo.id_articulo || !selectedIds.has(opt.value));
              return (
                <tr key={index}>
                  <td className="px-6 py-2 whitespace-nowrap align-top">
                    <div>
                      <Selector
                        options={optionsForRow}
                        selectedValue={articulo.id_articulo}
                        onSelect={(value) => handleInputChange(index, 'id_articulo', value)}
                        disabled={disabled}
                        className={`w-full px-3 py-2 border ${errores.includes('Debe seleccionar un insumo') ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary`}
                      />
                      {articulo.id_articulo && bodegaSolicitanteId && (
                        <p className="mt-1 text-xs text-gray-500 leading-tight">
                          En destino: {solicitanteStockMap.get(articulo.id_articulo) ?? 0} {optSel?.unidad || ''}
                        </p>
                      )}
                      {errores.includes('Debe seleccionar un insumo') && (
                        <div className="mt-0.5">
                          <p className="text-xs text-red-500 leading-tight">Debe seleccionar un insumo</p>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap align-top">
                    <div>
                      <input
                        type="number"
                        min="1"
                        value={articulo.cantidad_solicitada}
                        onChange={(e) => handleInputChange(index, 'cantidad_solicitada', e.target.value)}
                        disabled={disabled}
                        max={availableStock != null ? availableStock : undefined}
                        step={optSel?.unidad === 'unidades' ? 1 : 0.01}
                        className={`w-full px-3 py-2 border ${errores.includes('La cantidad debe ser mayor a 0') ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary`}
                        placeholder="Ingrese cantidad"
                      />
                      {availableStock != null && (
                        <p className="mt-1 text-xs text-gray-500 leading-tight">Disponibles: {availableStock} {optSel?.unidad || ''}</p>
                      )}
                      {errores.includes('No puede superar el stock disponible') && (
                        <div className="mt-0.5">
                          <p className="text-xs text-red-500 leading-tight">No puede superar el stock disponible</p>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap align-top">
                    <input
                      type="text"
                      value={articulo.comentario}
                      onChange={(e) => handleInputChange(index, 'comentario', e.target.value)}
                      disabled={disabled}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                      placeholder="Ingrese comentario"
                    />
                    <div className="mt-0.5 h-4" />
                  </td>
                  <td className="pb-5 pr-3 whitespace-nowrap text-sm font-medium align-middle">
                    <div className="flex items-center justify-center">
                      <button
                        onClick={() => handleRemoveArticulo(index)}
                        disabled={disabled}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                        title="Eliminar artículo"
                      >
                        <FiTrash className="w-6 h-6" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            });})()}
          </tbody>
        </table>
      </div>
    </div>
  );
} 