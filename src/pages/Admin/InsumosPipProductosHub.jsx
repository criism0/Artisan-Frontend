import { useNavigate } from "react-router-dom";
import {
  FiBox,
  FiPlus,
  FiClipboard,
  FiTag,
  FiHome,
} from "react-icons/fi";

function Card({ title, description, icon, onClick, tone = "default" }) {
  const toneClasses =
    tone === "primary"
      ? "border-primary bg-white hover:bg-primary/5"
      : "border-gray-200 bg-white hover:bg-gray-50";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left border rounded-xl p-4 shadow-sm transition ${toneClasses}`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-gray-700">{icon}</div>
        <div className="min-w-0">
          <div className="font-semibold text-gray-900">{title}</div>
          <div className="text-sm text-gray-600 mt-1">{description}</div>
        </div>
      </div>
    </button>
  );
}

export default function InsumosPipProductosHub() {
  const navigate = useNavigate();

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text">Insumos, PIP y Productos</h1>
        <p className="text-sm text-gray-600 mt-1">
          Punto central para ver y crear Insumos, Productos en Proceso (PIP) y Productos Base.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <FiHome size={18} className="text-gray-700" />
            <div className="font-semibold text-gray-900">Insumos</div>
          </div>
          <div className="text-sm text-gray-600 mt-1">Materias primas compradas.</div>

          <div className="mt-4 grid grid-cols-1 gap-3">
            <Card
              title="Ver Insumos"
              description="Listado y gestión de insumos."
              icon={<FiBox size={18} />}
              onClick={() => navigate("/Insumos")}
            />
            <Card
              title="Crear Insumo"
              description="Formulario para agregar un nuevo insumo."
              icon={<FiPlus size={18} />}
              tone="primary"
              onClick={() => navigate("/Insumos/add")}
            />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <FiClipboard size={18} className="text-gray-700" />
            <div className="font-semibold text-gray-900">PIP</div>
          </div>
          <div className="text-sm text-gray-600 mt-1">Productos en proceso (insumos con categoría PIP).</div>

          <div className="mt-4 grid grid-cols-1 gap-3">
            <Card
              title="Ver PIP"
              description="Listado de PIP."
              icon={<FiBox size={18} />}
              onClick={() => navigate("/PIP")}
            />
            <Card
              title="Crear PIP"
              description="Formulario para agregar un nuevo PIP."
              icon={<FiPlus size={18} />}
              tone="primary"
              onClick={() => navigate("/PIP/crear")}
            />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <FiTag size={18} className="text-gray-700" />
            <div className="font-semibold text-gray-900">Productos</div>
          </div>
          <div className="text-sm text-gray-600 mt-1">Productos base comercializables.</div>

          <div className="mt-4 grid grid-cols-1 gap-3">
            <Card
              title="Ver Productos Base"
              description="Listado de productos base."
              icon={<FiBox size={18} />}
              onClick={() => navigate("/Productos")}
            />
            <Card
              title="Crear Producto Base"
              description="Formulario para agregar un nuevo producto base."
              icon={<FiPlus size={18} />}
              tone="primary"
              onClick={() => navigate("/Productos/crear")}
            />
          </div>
        </div>
      </div>

      <div className="mt-8 p-4 bg-white rounded-xl border border-gray-200">
        <div className="font-semibold text-gray-900">Accesos relacionados</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            className="px-3 py-2 border rounded-lg hover:bg-gray-50"
            onClick={() => navigate("/PautasElaboracion")}
          >
            Pautas de Elaboración
          </button>
          <button
            type="button"
            className="px-3 py-2 border rounded-lg hover:bg-gray-50"
            onClick={() => navigate("/Recetas")}
          >
            Recetas
          </button>
          <button
            type="button"
            className="px-3 py-2 border rounded-lg hover:bg-gray-50"
            onClick={() => navigate("/CostosIndirectos")}
          >
            Costos Indirectos
          </button>
          <button
            type="button"
            className="px-3 py-2 border rounded-lg hover:bg-gray-50"
            onClick={() => navigate("/CostoMarginal")}
          >
            Costo Marginal
          </button>
        </div>
      </div>
    </div>
  );
}
