import { useState, useEffect, useRef} from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useApi } from "../lib/api";
import logo from "../assets/logo.png";
import { RiAdminFill } from "react-icons/ri";
import { MdEqualizer } from "react-icons/md";
import { SiPacker } from "react-icons/si";
import { Dropdown, MenuGroup, MenuLink, ClockCompact } from "./NavbarFunction";
import {
  FiUser,
  FiBox, FiTag, FiUsers as FiUsersOutline, FiUsers, FiClipboard, FiHome
} from "react-icons/fi";
import { FaTruck, FaWarehouse, FaRegSmile, FaList, FaBroom, FaUsers, FaQrcode
} from "react-icons/fa";
import ProcesosValorAgregado from "../pages/ProcesosValorAgregado/ProcesosValorAgregado";


import { checkScope, ModelType, ScopeType } from "../services/scopeCheck";

export default function Navbar() {
  const { user, logout } = useAuth();
  const apiFetch = useApi();

  const [bodegas, setBodegas] = useState([]);
  useEffect(() => {
    const fetchBodegas = async () => {
      try {
        const resp = await apiFetch("/bodegas");
        const lista = Array.isArray(resp?.bodegas) ? resp.bodegas : Array.isArray(resp) ? resp : [];
        const ordenadas = lista.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
        setBodegas(ordenadas);
      } catch (error) {
        console.error("Error fetching bodegas:", error);
      }
    };
    if (user) fetchBodegas();
  }, [apiFetch, user]);

  const leaveTimer = useRef();

  const handleOpen = (id) => {
    clearTimeout(leaveTimer.current);
    setOpenMenu(id);
  };
  const handleClose = () => {
    leaveTimer.current = setTimeout(() => setOpenMenu(null), 150);
  };

  const [openMenu, setOpenMenu] = useState(null);

  // TODO Ventas navbar

  /*
<Dropdown
            label="Ventas"
            icon={<MdEqualizer />}
            open={openMenu === "ventas"}
            onOpen={() => handleOpen("ventas")}
            onClose={handleClose}
          >
            <MenuGroup label="Ventas" icon={<FiBox />}>             
              <MenuLink to="/ventas/ordenes"  label="Órdenes de Venta" isAllowed={checkScope(ModelType.ORDEN_VENTA, ScopeType.READ)} />
              <MenuLink to="/ventas/facturas"  label="Facturas" />
            </MenuGroup>

          </Dropdown>
  */

  // TODO Ventas navbar

  /*
<Dropdown
            label="Ventas"
            icon={<MdEqualizer />}
            open={openMenu === "ventas"}
            onOpen={() => handleOpen("ventas")}
            onClose={handleClose}
          >
            <MenuGroup label="Ventas" icon={<FiBox />}>             
              <MenuLink to="/ventas/ordenes"  label="Órdenes de Venta" isAllowed={checkScope(ModelType.ORDEN_VENTA, ScopeType.READ)} />
              <MenuLink to="/ventas/facturas"  label="Facturas" />
            </MenuGroup>

          </Dropdown>
  */

  return (
    <div className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur shadow-sm border-b z-40">
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="block">
            <img
              src={logo}
              className="h-12 w-auto select-none"
            />
          </Link>
          <ClockCompact />
        </div>

        <div
          className="hidden sm:block h-8 w-px bg-gray-200"
        />

        <nav className="hidden md:flex items-center gap-3">
          <Dropdown
            label="Adquisiciones"
            icon={<FaUsers />}
            open={openMenu === "adq"}
            onOpen={() => handleOpen("adq")}
            onClose={handleClose}
          >
            <MenuGroup label="Adquisiciones" icon={<FiBox />}>
              <MenuLink to="/Ordenes" label=" Órdenes de Compra" isAllowed={checkScope(ModelType.ORDEN_COMPRA, ScopeType.READ)} />
              <MenuLink to="/Solicitudes" label="Solicitudes" />
            </MenuGroup>
          </Dropdown>

          <Dropdown
            label="Producción"
            icon={<SiPacker />}
            open={openMenu === "prod"}
            onOpen={() => handleOpen("prod")}
            onClose={handleClose}
          >
            <MenuGroup label="Producción" icon={<FiBox />}>
              <MenuLink to="/Orden_de_Manufactura" label="Lista de Elaboración" />
              <MenuLink to="/lotes-producto-en-proceso" label="Lista Lotes" />
              <MenuLink to="/Estimaciones" label="Estimaciones de demanda" />
            </MenuGroup>
          </Dropdown>

          <Dropdown
            label="Logística"
            icon={<FaTruck />}       
            open={openMenu === "log"}
            onOpen={() => handleOpen("log")}
            onClose={handleClose}
          >
            <MenuGroup label="Logística" icon={<FiBox />}>              
              <MenuLink to="/Envios" label="Envíos" />
              <MenuLink to="/Pallets" label="Pallets" />
            </MenuGroup>
          </Dropdown>

          <Dropdown
            label="Inventario"
            icon={<FaWarehouse />}
            open={openMenu === "inv"}
            onOpen={() => handleOpen("inv")}
            onClose={handleClose}
          >
            <MenuGroup label="Inventario" icon={<FiBox />}>

              <MenuLink to="/Inventario" label="Inventario" isAllowed={checkScope(ModelType.INVENTARIO, ScopeType.READ)} />
              <MenuLink to="/inventario/bultos" label="Bultos" />
            </MenuGroup>
          </Dropdown>

          <Dropdown
            label="Ventas"
            icon={<MdEqualizer />}
            open={openMenu === "ventas"}
            onOpen={() => handleOpen("ventas")}
            onClose={handleClose}
          >
            <MenuGroup label="Ventas" icon={<FiBox />}>             
              <MenuLink to="/ventas/ordenes"  label="Órdenes de Venta" isAllowed={checkScope(ModelType.ORDEN_VENTA, ScopeType.READ)} />
            </MenuGroup>

          </Dropdown>
      
          <Dropdown
            label="Administración"
            icon={<RiAdminFill />}
            open={openMenu === "admin"}
            onOpen={() => handleOpen("admin")}
            onClose={handleClose}
          >
            <MenuGroup label="Gestión Comercial">
              <MenuLink to="/Proveedores" icon={<FiUsersOutline />} label="Proveedores" isAllowed={checkScope(ModelType.PROVEEDOR, ScopeType.READ)} />
              <MenuLink to="/clientes" icon={<FaRegSmile />} label="Clientes" isAllowed={checkScope(ModelType.CLIENTE, ScopeType.READ)} />
              <MenuLink to="/lista-precio" icon={<FaList />} label="Listas de Precio" />
            </MenuGroup>

            <div role="separator" className="my-2 border-t border-gray-200" />

            <MenuGroup label="Catálogos y Productos">
              <MenuLink to="/Insumos" icon={<FiHome />} label="Insumos" />
              <MenuLink to="/Insumos/por-proveedor" icon={<FiHome />} label="Insumos por Proveedor" />
              <MenuLink to="/Productos" icon={<FiTag />} label="Categorías de Productos" />
              <MenuLink to="/PautasElaboracion" icon={<FiClipboard />} label="Pautas de Elaboración" />
              <MenuLink to="/Recetas" icon={<FiClipboard />} label="Recetas" />
              <MenuLink to="/Bodegas" icon={<FaWarehouse />} label="Bodegas" />
              <MenuLink to="/CostoMarginal" icon={<MdEqualizer />} label="Costo Marginal" />
              <MenuLink to="/ProcesosValorAgregado" icon={<FaBroom />} label="Procesos Valor Agregado" />
              <MenuLink to="/PVAPorProducto" icon={<FiTag />} label="PVA por Producto" />
            </MenuGroup>

            <div role="separator" className="my-2 border-t border-gray-200" />

            <MenuGroup label="Seguridad y Acceso">
              <MenuLink to="/Usuarios" icon={<FiUser />} label="Usuarios" isAllowed={checkScope(ModelType.USUARIO, ScopeType.READ)} />
              <MenuLink to="/Roles" icon={<FiUsers />} label="Roles" isAllowed={checkScope(ModelType.ROLE, ScopeType.READ)} />
              <MenuLink to="/AsignarRoles" icon={<FiUsers />} label="Asignar Roles" isAllowed={checkScope(ModelType.ROLE, ScopeType.WRITE)} />
              <MenuLink to="/GenerarQR" icon={<FaQrcode />} label="Generar QR" isAllowed={checkScope(ModelType.USUARIO, ScopeType.WRITE)} />
            </MenuGroup>
          </Dropdown>

          
        </nav>

        <div
          className="hidden sm:block h-8 w-px bg-gray-200"
        />

        <div className="flex items-center space-x-5">
          {user && (
            <div className="hidden sm:flex items-center space-x-3">
              <span className="text-sm text-gray-700 font-medium">
                {user.nombre || user.email}
              </span>
            </div>
          )}
          {user ? (
            <button
              onClick={logout}
                className="text-gray-500 hover:text-gray-700 hover:bg-gray-50 border border-transparent font-normal text-sm flex items-center gap-2 px-3 py-2 rounded-md transition"
              aria-label="Cerrar sesión"
            >
              Cerrar sesión
            </button>
          ) : (
            <Link
              to="/login"
              className="text-primary border border-primary hover:bg-gray-100 font-medium text-sm flex items-center gap-2 px-4 py-2 rounded-md transition"
            >
              Iniciar sesión
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}