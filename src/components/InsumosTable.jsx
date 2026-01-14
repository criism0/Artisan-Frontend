import { useState, useEffect, useRef, useMemo } from 'react';
import { FiTrash } from 'react-icons/fi';
import Selector from './Selector';
import { useApi } from '../lib/api';
import { insumoToSearchText } from '../services/fuzzyMatch';

export default function InsumosTable({ onInsumosChange, disabled = false, bodegaId, addSignal = 0, onAvailabilityChange, bodegaSolicitanteId }) {
  const [articulos, setArticulos] = useState([]);
  const [opcionesInsumos, setOpcionesInsumos] = useState([]);
  const [materiasPrimas, setMateriasPrimas] = useState([]);
  const [formatosByMateriaPrimaId, setFormatosByMateriaPrimaId] = useState({});
  // Stock actual en la bodega solicitante (Map id_materia_prima -> stock numérico)
  const [solicitanteStockMap, setSolicitanteStockMap] = useState(new Map());
  const [proveedoraStockMap, setProveedoraStockMap] = useState(new Map());
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

  const getUnidadLabel = (unidadLower) => {
    if (!unidadLower) return '';
    if (unidadLower === 'unidades') return 'unidades';
    if (unidadLower === 'kilogramos') return 'kg';
    if (unidadLower === 'gramos') return 'g';
    if (unidadLower === 'litros') return 'L';
    return unidadLower;
  };

  const coerceNumber = (value) => {
    if (value === '' || value == null) return null;
    const num = Number(String(value).replace(',', '.'));
    return Number.isFinite(num) ? num : null;
  };

  const fetchFormatosIfNeeded = async (idMateriaPrima) => {
    const idStr = String(idMateriaPrima);
    if (!idStr) return;
    if (Object.prototype.hasOwnProperty.call(formatosByMateriaPrimaId, idStr)) return;

    try {
      const data = await api(
        `/proveedor-materia-prima/por-materia-prima?id_materia_prima=${encodeURIComponent(idStr)}`
      );
      const rows = Array.isArray(data) ? data : [];
      const unidadLower = optionById.get(idStr)?.unidad;
      const unidadLabel = getUnidadLabel(unidadLower);

      const options = rows
        .map((r) => {
          const cantidadPorFormato =
            coerceNumber(r?.cantidad_por_formato) ?? coerceNumber(r?.peso_unitario) ?? null;

          if (!cantidadPorFormato || cantidadPorFormato <= 0) return null;

          const formatoNombre = String(r?.formato ?? 'Formato');
          const label = `${formatoNombre} (${cantidadPorFormato} ${unidadLabel || ''})`.trim();

          return {
            value: String(r?.id),
            label,
            formatoNombre,
            multiplier: cantidadPorFormato,
            es_unidad_consumo: !!r?.es_unidad_consumo,
          };
        })
        .filter(Boolean)
        .sort((a, b) => {
          if (a.es_unidad_consumo !== b.es_unidad_consumo) {
            return a.es_unidad_consumo ? -1 : 1;
          }
          return (a.multiplier ?? 0) - (b.multiplier ?? 0);
        });

      setFormatosByMateriaPrimaId((prev) => ({ ...prev, [idStr]: options }));

      if (options.length > 0) {
        setArticulos((prev) =>
          prev.map((a) => {
            if (a?.id_articulo !== idStr) return a;
            if (a?.id_formato) return a;
            return { ...a, id_formato: options[0].value };
          })
        );
      }
    } catch (e) {
      console.error('Error fetching formatos por materia prima:', e);
      setFormatosByMateriaPrimaId((prev) => ({ ...prev, [idStr]: [] }));
    }
  };

  // Utilidad compartida para parsear "unidades_disponibles"
  const parseStock = (str) => {
    if (!str) return 0;
    const m = String(str).match(/^\s*([0-9]+(?:[\.,][0-9]+)?)/);
    if (!m) return 0;
    const num = parseFloat(m[1].replace(',', '.'));
    return Number.isFinite(num) ? num : 0;
  };

  // Cargar catálogo completo de materias primas (para mostrar TODOS los insumos)
  useEffect(() => {
    const fetchCatalogo = async () => {
      try {
        const res = await api('/materias-primas');
        const list = Array.isArray(res) ? res : [];
        setMateriasPrimas(list);
      } catch (e) {
        console.error('Error fetching materias primas:', e);
        setMateriasPrimas([]);
      }
    };
    fetchCatalogo();
  }, []);

  // Stock de la bodega proveedora (mapa)
  useEffect(() => {
    const fetchProveedora = async () => {
      try {
        if (!bodegaId) {
          setProveedoraStockMap(new Map());
          return;
        }
        const response = await api(`/inventario/${bodegaId}`);
        const inventario = normalizeInventario(response);
        const map = new Map();
        inventario.forEach((item) => {
          const mp = item?.materiaPrima;
          if (!mp?.id) return;
          const stock = parseStock(item?.unidades_disponibles);
          map.set(String(mp.id), stock);
        });
        setProveedoraStockMap(map);
      } catch (error) {
        console.error("Error fetching insumos por bodega:", error);
        setProveedoraStockMap(new Map());
      }
    };

    fetchProveedora();
  }, [bodegaId]);

  // Construir opciones del selector (todos los insumos, con stock según bodega)
  useEffect(() => {
    const list = Array.isArray(materiasPrimas) ? materiasPrimas : [];
    const options = list
      .filter((mp) => mp && mp.id)
      .filter((mp) => mp?.activo !== false)
      .map((mp) => {
        const id = String(mp.id);
        const unidad = mp?.unidad_medida ? String(mp.unidad_medida).toLowerCase() : null;
        const stock = proveedoraStockMap.has(id) ? proveedoraStockMap.get(id) : 0;
        const categoria = mp?.categoria?.nombre || 'Sin categoría';
        return {
          value: id,
          label: mp.nombre,
          unidad,
          stock,
          category: categoria,
          searchText: insumoToSearchText(mp),
        };
      });
    setOpcionesInsumos(options);
  }, [materiasPrimas, proveedoraStockMap]);

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
    setFormatosByMateriaPrimaId({});
  }, [bodegaId]);

  const validateArticulo = (articulo) => {
    const errors = [];
    if (!articulo.id_articulo) {
      errors.push('Debe seleccionar un insumo');
    }

    // Bloqueante: no permitir solicitar insumos sin disponibilidad en la bodega proveedora.
    const stock = optionById.get(articulo.id_articulo)?.stock;
    if (articulo.id_articulo && (stock == null || Number(stock) <= 0)) {
      errors.push('No hay disponibilidad en la bodega proveedora');
    }

    const cantidadFormato = Number(articulo.cantidad_formato);
    if (!cantidadFormato || cantidadFormato <= 0) {
      errors.push('La cantidad debe ser mayor a 0');
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
    const articulosValidos = getArticulosValidos().map((a) => {
      const unidadLower = optionById.get(a.id_articulo)?.unidad;
      const formatos = formatosByMateriaPrimaId[a.id_articulo] || [];
      const fmt = formatos.find((f) => f.value === a.id_formato);
      const multiplier = Number(fmt?.multiplier) || 1;
      const cantidadFormato = Number(a.cantidad_formato) || 0;
      const cantidadBase = cantidadFormato * multiplier;
      const cantidadBaseFinal =
        unidadLower === 'unidades'
          ? Math.round(cantidadBase)
          : Math.round(cantidadBase * 100) / 100;
      return { ...a, cantidad_solicitada: cantidadBaseFinal };
    });
    onInsumosChange(articulosValidos);
  }, [articulos, onInsumosChange]);

  const handleAddArticulo = () => {
    if (isAddDisabled) return;
    setArticulos([...articulos, { id_articulo: '', id_formato: '', cantidad_formato: '', comentario: '' }]);
  };

  const handleRemoveArticulo = (index) => {
    setArticulos(articulos.filter((_, i) => i !== index));
  };

  const handleInputChange = (index, field, value) => {
    if (field === 'cantidad_formato') {
      if (value === '') {
        const newArticulos = [...articulos];
        newArticulos[index] = { ...newArticulos[index], cantidad_formato: '' };
        setArticulos(newArticulos);
        return;
      }

      const numValue = coerceNumber(value);
      if (numValue == null) return;

      const floored = Math.floor(numValue);
      if (floored <= 0) return;

      const newArticulos = [...articulos];
      newArticulos[index] = { ...newArticulos[index], cantidad_formato: String(floored) };
      setArticulos(newArticulos);
    } else if (field === 'id_articulo') {
      const next = { ...articulos[index], id_articulo: value, id_formato: '', cantidad_formato: '' };
      const newArticulos = [...articulos];
      newArticulos[index] = next;
      setArticulos(newArticulos);

      fetchFormatosIfNeeded(value);
    } else if (field === 'id_formato') {
      const newArticulos = [...articulos];
      newArticulos[index] = { ...newArticulos[index], id_formato: value };
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

  // Cargar formatos para las filas existentes
  useEffect(() => {
    const uniqueIds = Array.from(
      new Set(articulos.map((a) => a?.id_articulo).filter(Boolean))
    );
    uniqueIds.forEach((id) => {
      fetchFormatosIfNeeded(id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articulos, opcionesInsumos]);

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
                  Formatow
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
              const unidadLower = optSel?.unidad;
              const unidadLabel = getUnidadLabel(unidadLower);
              const formatos = formatosByMateriaPrimaId[articulo.id_articulo] || [];
              const fmt = formatos.find((f) => f.value === articulo.id_formato);
              const multiplier = Number(fmt?.multiplier) || 1;
              const cantidadFormato = Number(articulo.cantidad_formato) || 0;
              const cantidadBase = cantidadFormato * multiplier;
              const cantidadBaseText =
                unidadLower === 'unidades'
                  ? String(Math.round(cantidadBase))
                  : String(Math.round(cantidadBase * 100) / 100);
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
                        useFuzzy
                        groupBy="category"
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
                        step={1}
                        value={articulo.cantidad_formato}
                        onChange={(e) => handleInputChange(index, 'cantidad_formato', e.target.value)}
                        disabled={disabled}
                        className={`w-full px-3 py-2 border ${errores.includes('La cantidad debe ser mayor a 0') ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary`}
                        placeholder={`Cantidad de ${fmt ? fmt.formatoNombre : 'formato'}`}
                      />

                      {errores.includes('No hay disponibilidad en la bodega proveedora') && (
                        <p className="mt-0.5 text-xs text-red-600 leading-tight">
                          No hay disponibilidad en la bodega proveedora. Quita este insumo para continuar.
                        </p>
                      )}

                      {articulo.id_articulo && fmt && (
                        <p className="mt-1 text-xs text-gray-600 leading-tight">
                          Equivalente: {cantidadBaseText} {unidadLabel}
                        </p>
                      )}

                      {availableStock != null && articulo.id_articulo && (
                        <p className="mt-1 text-xs text-gray-500 leading-tight">
                          Disponibles: {availableStock} {unidadLabel}
                        </p>
                      )}

                      {articulo.id_articulo && availableStock != null && availableStock > 0 && cantidadFormato > 0 && cantidadBase > availableStock && (
                        <p className="mt-0.5 text-xs text-red-600 leading-tight">
                          Solicitas {cantidadBaseText} {unidadLabel}, pero hay {availableStock} disponibles.
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap align-top">
                                        <div className="mb-1">
                        <Selector
                          options={formatos}
                          selectedValue={articulo.id_formato}
                          onSelect={(value) => handleInputChange(index, 'id_formato', value)}
                          disabled={disabled || !articulo.id_articulo}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                        />
                        {articulo.id_articulo && formatos.length === 0 && (
                          <p className="mt-1 text-xs text-gray-500 leading-tight">
                            No hay formatos configurados para este insumo.
                          </p>
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