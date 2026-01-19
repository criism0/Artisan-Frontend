import React from "react";

/**
 * Resumen visual y operacional de una Orden de Manufactura para el operario
 * Muestra: Estado, Receta, Progreso de Ingredientes, Costos, etc.
 */
export default function ResumenOMOperario({
  om,
  consumoInsumos = [],
  showDetailed = false,
}) {
  if (!om) return null;

  const totalInsumos = consumoInsumos.length || 0;
  const insumosConsumidos = consumoInsumos.filter(
    (r) => Number(r.peso_utilizado || 0) > 0
  ).length || 0;
  const porcentajeInsumos =
    totalInsumos > 0 ? Math.round((insumosConsumidos / totalInsumos) * 100) : 0;

  const getEstadoBadge = (estado) => {
    if (!estado) return "";
    const normalized = estado.toLowerCase();
    const base = "px-3 py-1 rounded-full text-xs font-medium";
    switch (normalized) {
      case "borrador":
        return <span className={`${base} bg-gray-200 text-gray-700`}>Borrador</span>;
      case "insumos asignados":
        return (
          <span className={`${base} bg-blue-100 text-blue-700`}>
            Insumos asignados
          </span>
        );
      case "en ejecución":
        return (
          <span className={`${base} bg-cyan-100 text-cyan-700`}>
            En ejecución
          </span>
        );
      case "esperando salidas":
        return (
          <span className={`${base} bg-orange-100 text-orange-700`}>
            Esperando salidas
          </span>
        );
      case "cerrada":
        return (
          <span className={`${base} bg-green-100 text-green-700`}>Cerrada</span>
        );
      default:
        return (
          <span className={`${base} bg-gray-100 text-gray-600`}>{estado}</span>
        );
    }
  };

  return (
    <div className="space-y-3">
      {/* 4 Tarjetas de resumen rápido */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Receta */}
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-primary">
          <div className="text-xs text-gray-500 font-medium">RECETA</div>
          <div className="font-bold text-text mt-1 truncate">
            {om.receta?.nombre || "—"}
          </div>
          <div className="text-xs text-gray-600 mt-2">
            Ref: ${Number(om.receta?.costo_referencial_produccion || 0).toFixed(2)}
          </div>
        </div>

        {/* Progreso de ingredientes */}
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="text-xs text-gray-500 font-medium">INGREDIENTES</div>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${porcentajeInsumos}%` }}
                ></div>
              </div>
            </div>
            <span className="text-sm font-bold">{porcentajeInsumos}%</span>
          </div>
          <div className="text-xs text-gray-600 mt-2">
            {insumosConsumidos}/{totalInsumos} consumidos
          </div>
        </div>

        {/* Costos */}
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="text-xs text-gray-500 font-medium">COSTO TOTAL</div>
          <div className="text-lg font-bold text-text mt-1">
            ${Number(om.costo_total || 0).toFixed(2)}
          </div>
          <div className="text-xs text-gray-600 mt-2">
            Obj: {om.peso_objetivo || 0} kg
          </div>
        </div>

        {/* Estado */}
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
          <div className="text-xs text-gray-500 font-medium">ESTADO</div>
          <div className="mt-2">{getEstadoBadge(om.estado)}</div>
          <div className="text-xs text-gray-600 mt-2">
            {om.elaboradorEncargado?.nombre || "Sin asignar"}
          </div>
        </div>
      </div>

      {/* Detalle de ingredientes si showDetailed = true */}
      {showDetailed && consumoInsumos.length > 0 ? (
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-semibold text-text mb-3">
            📊 Consumo de Ingredientes
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {consumoInsumos.slice(0, 6).map((insumo, idx) => {
              const pesoNecesario = Number(insumo.peso_necesario || 0);
              const pesoUtilizado = Number(insumo.peso_utilizado || 0);
              const porcentaje =
                pesoNecesario > 0
                  ? ((pesoUtilizado / pesoNecesario) * 100).toFixed(0)
                  : 0;
              const estado =
                pesoUtilizado >= pesoNecesario * 0.99
                  ? "✓ OK"
                  : pesoUtilizado > 0
                  ? "⚠ Parcial"
                  : "○ Pendiente";
              const colorBarra =
                pesoUtilizado >= pesoNecesario * 0.99
                  ? "bg-green-400"
                  : pesoUtilizado > 0
                  ? "bg-yellow-400"
                  : "bg-gray-300";

              return (
                <div key={idx} className="border border-border rounded-lg p-3 bg-gray-50">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-text truncate">
                      {insumo.ingrediente?.nombre || "—"}
                    </span>
                    <span
                      className={`text-xs font-bold ${
                        pesoUtilizado >= pesoNecesario * 0.99
                          ? "text-green-600"
                          : pesoUtilizado > 0
                          ? "text-yellow-600"
                          : "text-gray-600"
                      }`}
                    >
                      {estado}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                    <div
                      className={`${colorBarra} h-2 rounded-full`}
                      style={{ width: `${Math.min(porcentaje, 100)}%` }}
                    ></div>
                  </div>
                  <div className="text-xs text-gray-600 flex justify-between">
                    <span>
                      {pesoUtilizado.toFixed(2)} / {pesoNecesario.toFixed(2)} kg
                    </span>
                    <span>{porcentaje}%</span>
                  </div>
                </div>
              );
            })}
          </div>
          {consumoInsumos.length > 6 && (
            <div className="text-xs text-gray-500 mt-2 italic">
              y {consumoInsumos.length - 6} ingrediente(s) más…
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
