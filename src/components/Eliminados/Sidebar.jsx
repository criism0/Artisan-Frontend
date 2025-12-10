// src/components/Sidebar.jsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import logo from "../assets/logo.png";
import { useApi } from "../lib/api.js";
import {
  FiSidebar, FiHome, FiDollarSign, FiUsers, FiBox, FiClipboard,
  FiUser, FiTag
} from "react-icons/fi";
import {
  FaHandHolding, FaWarehouse, FaIndustry, FaBookmark, FaFlask, FaRegSmile,
  FaList, FaTruck, FaRoute, FaPallet, FaBoxOpen, FaBroom, FaUsers as FaUsers2,
  FaClipboardList
} from "react-icons/fa";

import SidebarDropdown from "./SidebarDropdown";
import { useAuth } from "../auth/AuthContext.jsx";

export default function Sidebar({ isExpanded, toggleSidebar, isPinned, togglePinned }) {
  const { user } = useAuth();

  // nuestro hook devuelve la función fetch con Authorization adjunta
  const apiFetch = useApi();

  const [bodegas, setBodegas] = useState([]);

  // const userRole = user?.rol || (user?.scope?.includes("admin") ? "admin" : undefined);

  useEffect(() => {
    const fetchBodegas = async () => {
      try {
        const resp = await apiFetch("/bodegas");
        // backend puede devolver { bodegas: [...] } o lista directa
        const lista = Array.isArray(resp?.bodegas) ? resp.bodegas : Array.isArray(resp) ? resp : [];
        const ordenadas = lista.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
        setBodegas(ordenadas);
      } catch (error) {
        console.error("Error fetching bodegas:", error);
      }
    };
    if (user) fetchBodegas();
  }, [apiFetch, user]);

  return (
    <div
      className={`bg-background text-text h-screen overflow-y-auto transition-all duration-300 border-r border-border ${
        isExpanded ? "w-64" : "w-18"
      } fixed`}
      onMouseEnter={() => !isExpanded && !isPinned && toggleSidebar(true)}
      onMouseLeave={() => isExpanded && !isPinned && toggleSidebar(false)}
    >
      <div className="flex items-center justify-between p-4">
        {isExpanded ? (
          <span className="text-xl font-bold text-primary">Artisan</span>
        ) : (
          <img src={logo} alt="Logo" className="h-8" />
        )}
        {isExpanded && (
          <button
            onClick={togglePinned}
            className={`w-6 h-6 rounded-full border border-border flex items-center justify-center ml-2
              ${isPinned ? "bg-gray-200" : "bg-white text-gray-400 hover:bg-gray-100"}`}
            title="Fijar barra lateral"
          >
            <FiSidebar className="text-base" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mt-6 flex flex-col gap-4 px-2">
          {/* Inicio */}
          <div className="flex flex-col gap-1">
            <SidebarItem to="/Home" icon={<FiHome />} label="Inicio" expanded={isExpanded} />
          </div>

          {/* Adquisiciones */}
          {isExpanded && (
            <h3 className="text-xs text-gray-400 font-semibold px-2 tracking-wide uppercase mt-4">
              Adquisiciones
            </h3>
          )}
          <div className="flex flex-col gap-1">
            <SidebarItem to="/Ordenes" icon={<FiDollarSign />} label="Órdenes de Compra" expanded={isExpanded} />
            <SidebarDropdown icon={<FiBox />} label="Inventario Insumos" expanded={isExpanded}>
              <SidebarItem to="/Inventario/general" label="Insumo General" expanded={isExpanded} />
              {bodegas.map((b) => (
                <SidebarItem key={b.id} to={`/Inventario/${b.id}`} label={b.nombre} expanded={isExpanded} />
              ))}
              {isExpanded && userRole === "admin" && (
                <SidebarItem to="/Bodegas/add" label="Añadir Bodega" expanded />
              )}
            </SidebarDropdown>
            <SidebarItem to="/Solicitudes" icon={<FaHandHolding />} label="Solicitudes" expanded={isExpanded} />
          </div>

          {/* Producción */}
          {isExpanded && (
            <h3 className="text-xs text-gray-400 font-semibold px-2 tracking-wide uppercase mt-4">
              Producción
            </h3>
          )}
          <div className="flex flex-col gap-1">
            <SidebarItem to="/Orden_de_Manufactura" icon={<FaIndustry />} label="Lista de Elaboración" expanded={isExpanded} />
            <SidebarDropdown icon={<FaBoxOpen />} label="Inventario Productos Terminados" expanded={isExpanded}>
              <SidebarItem key="global" to="/InventarioProductosTerminados/global" label="Global" expanded={isExpanded} />
              {bodegas.map((b) => (
                <SidebarItem key={b.id} to={`/InventarioProductosTerminados/${b.id}`} label={b.nombre} expanded={isExpanded} />
              ))}
            </SidebarDropdown>
          </div>

          {/* Logística */}
          {isExpanded && (
            <h3 className="text-xs text-gray-400 font-semibold px-2 tracking-wide uppercase mt-4">
              Logística
            </h3>
          )}
          <div className="flex flex-col gap-1">
            <SidebarItem to="/Envios" icon={<FaTruck />} label="Envíos" expanded={isExpanded} />
            <SidebarItem to="/Rutas" icon={<FaRoute />} label="Rutas" expanded={isExpanded} />
            <SidebarItem to="/Pallets" icon={<FaPallet />} label="Pallets" expanded={isExpanded} />
          </div>

          {/* Ventas */}
          {isExpanded && (
            <h3 className="text-xs text-gray-400 font-semibold px-2 tracking-wide uppercase mt-4">
              Ventas
            </h3>
          )}
          <div className="flex flex-col gap-1">
            <SidebarItem to="/ventas/ordenes" icon={<FaBookmark />} label="Órdenes de Venta" expanded={isExpanded} />
            <SidebarItem to="/Forecast" icon={<FaFlask />} label="Forecast de Órdenes" expanded={isExpanded} />
          </div>

          {/* Costeo */}
          {isExpanded && (
            <h3 className="text-xs text-gray-400 font-semibold px-2 tracking-wide uppercase mt-4">
              Costeo
            </h3>
          )}
          <div className="flex flex-col gap-1">
            <SidebarItem to="#" icon={<FiTag />} label="Margen" expanded={isExpanded} />
          </div>

          {/* Calidad */}
          {isExpanded && (
            <h3 className="text-xs text-gray-400 font-semibold px-2 tracking-wide uppercase mt-4">
              Calidad
            </h3>
          )}
          <div className="flex flex-col gap-1">
            <SidebarItem to="#" icon={<FaUsers2 />} label="Grupos" expanded={isExpanded} />
            <SidebarItem to="#" icon={<FaClipboardList />} label="Registro Equipos" expanded={isExpanded} />
            <SidebarItem to="#" icon={<FaBroom />} label="Artículos de limpieza" expanded={isExpanded} />
          </div>

          {/* Administración (solo admin) */}
          {userRole === "admin" && (
            <>
              {isExpanded && (
                <h3 className="text-xs text-gray-400 font-semibold px-2 tracking-wide uppercase mt-4">
                  Administración
                </h3>
              )}
              <div className="flex flex-col gap-1">
                <SidebarItem to="/Proveedores" icon={<FiUsers />} label="Proveedores" expanded={isExpanded} />
                <SidebarItem to="/Bodegas" icon={<FaWarehouse />} label="Bodegas" expanded={isExpanded} />
                <SidebarItem to="/clientes" icon={<FaRegSmile />} label="Clientes" expanded={isExpanded} />
                <SidebarItem to="/listas-precio" icon={<FaList />} label="Listas de Precio" expanded={isExpanded} />
                <SidebarItem to="/Recetas" icon={<FiClipboard />} label="Recetas" expanded={isExpanded} />
                <SidebarDropdown icon={<FiTag />} label="Productos" expanded={isExpanded}>
                  <SidebarItem to="/Productos" label="Productos Terminados" expanded={isExpanded} />
                  <SidebarItem to="/PIP" label="Productos en Proceso (PIP)" expanded={isExpanded} />
                </SidebarDropdown>
                <SidebarItem to="/Insumos" icon={<FiHome />} label="Insumos" expanded={isExpanded} />
                <SidebarItem to="/Usuarios" icon={<FiUser />} label="Usuarios" expanded={isExpanded} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SidebarItem({ to, icon, label, expanded }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 px-4 py-2 rounded transition hover:bg-gray-100 text-text"
    >
      {icon && <span className="text-xl">{icon}</span>}
      {expanded && <span className="text-sm">{label}</span>}
    </Link>
  );
}
