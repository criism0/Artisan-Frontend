import { useState, useRef} from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import logo from "../../assets/logo.png";
import { RiAdminFill } from "react-icons/ri";
import { MdEqualizer } from "react-icons/md";
import { SiPacker } from "react-icons/si";
import { Dropdown, MenuGroup, MenuLink, ClockCompact } from "./NavbarFunction";
import {
  Box, Tag, Users, Clipboard,
  CheckCircle, AlertTriangle, LayoutGrid, FileText,
  ClipboardList, Inbox, Factory, Layers, Package, Boxes,
  ShoppingCart, Receipt,
  ShieldCheck,
  ShieldUser,
  Bot
} from "lucide-react";
import { FaTruck, FaWarehouse, FaRegSmile, FaList, FaBroom, FaUsers, FaQrcode, FaClipboardCheck
} from "react-icons/fa";


import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck";

export default function Navbar() {
  const { user, logout } = useAuth();

  const leaveTimer = useRef();

  const handleOpen = (id) => {
    clearTimeout(leaveTimer.current);
    setOpenMenu(id);
  };
  const handleClose = () => {
    leaveTimer.current = setTimeout(() => setOpenMenu(null), 150);
  };

  const [openMenu, setOpenMenu] = useState(null);

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
            <MenuGroup label="Adquisiciones" icon={<Box />}>
              <MenuLink to="/Ordenes/dashboard" icon={<LayoutGrid />} label="Dashboard" isAllowed={checkScope(ModelType.ORDEN_COMPRA, ScopeType.READ)} />
              <MenuLink to="/Ordenes" icon={<ClipboardList />} label=" Órdenes de Compra" isAllowed={checkScope(ModelType.ORDEN_COMPRA, ScopeType.READ)} />
            </MenuGroup>
          </Dropdown>

          <Dropdown
            label="Producción"
            icon={<SiPacker />}
            open={openMenu === "prod"}
            onOpen={() => handleOpen("prod")}
            onClose={handleClose}
          >
            <MenuGroup label="Producción" icon={<Box />}>
              <MenuLink to="/Produccion/dashboard" icon={<LayoutGrid />} label="Dashboard" isAllowed={checkScope(ModelType.INVENTARIO, ScopeType.READ)} />
              <MenuLink to="/Orden_de_Manufactura" icon={<Factory />} label="Elaboraciones" isAllowed={checkScope(ModelType.ORDEN_MANUFACTURA, ScopeType.READ)} />
              <MenuLink to="/lotes-producto-en-proceso" icon={<Layers />} label="Lotes" isAllowed={checkScope(ModelType.LOTE_PRODUCTO_EN_PROCESO, ScopeType.READ)} />
              {/* TODO: ruta /Estimaciones no existe en Routing.jsx — ocultar hasta implementar la página */}
              {/* <MenuLink to="/Estimaciones" label="Estimaciones de demanda" /> */}
            </MenuGroup>
          </Dropdown>

          <Dropdown
            label="Logística"
            icon={<FaTruck />}       
            open={openMenu === "log"}
            onOpen={() => handleOpen("log")}
            onClose={handleClose}
          >
            <MenuGroup label="Logística" icon={<Box />}>
              <MenuLink to="/Logistica/dashboard" icon={<LayoutGrid />} label="Dashboard" isAllowed={checkScope(ModelType.INVENTARIO, ScopeType.READ)} />
              <MenuLink to="/Solicitudes" icon={<Inbox />} label="Solicitudes" isAllowed={checkScope(ModelType.SOLICITUD_MERCADERIA, ScopeType.READ)} />
              <MenuLink to="/Pallets" icon={<Package />} label="Pallets" isAllowed={checkScope(ModelType.PALLET, ScopeType.READ)}/>
            </MenuGroup>
          </Dropdown>

          <Dropdown
            label="Inventario"
            icon={<FaWarehouse />}
            open={openMenu === "inv"}
            onOpen={() => handleOpen("inv")}
            onClose={handleClose}
          >
            <MenuGroup label="Inventario" icon={<Box />}>
              <MenuLink to="/Inventario/dashboard" icon={<LayoutGrid />} label="Dashboard" isAllowed={checkScope(ModelType.INVENTARIO, ScopeType.READ)} />
              <MenuLink to="/Inventario" icon={<Boxes />} label="Inventario" isAllowed={checkScope(ModelType.INVENTARIO, ScopeType.READ)} />
              <MenuLink to="/Inventario/bultos" icon={<Box />} label="Bultos" isAllowed={checkScope(ModelType.BULTO, ScopeType.READ)} />
              <MenuLink to="/Inventario/tomas" icon={<FaClipboardCheck />} label="Tomas de Inventario" isAllowed={checkScope(ModelType.SESION_INVENTARIADO, ScopeType.READ)} />
            </MenuGroup>
          </Dropdown>

          <Dropdown
            label="Ventas"
            icon={<MdEqualizer />}
            open={openMenu === "ventas"}
            onOpen={() => handleOpen("ventas")}
            onClose={handleClose}
          >
            <MenuGroup label="Ventas" icon={<Box />}>
              <MenuLink to="/ventas/dashboard" icon={<LayoutGrid />} label="Dashboard" isAllowed={checkScope(ModelType.ORDEN_VENTA, ScopeType.READ)} />
              <MenuLink to="/ventas/cola-ia" icon={<Bot />} label="Cola IA" isAllowed={checkScope(ModelType.ORDEN_VENTA, ScopeType.WRITE)} />
              <MenuLink to="/ventas/ordenes" icon={<ShoppingCart />} label="Órdenes de Venta" isAllowed={checkScope(ModelType.ORDEN_VENTA, ScopeType.READ)} />
              <MenuLink to="/ventas/facturas" icon={<Receipt />} label="Facturas" isAllowed={checkScope(ModelType.OCR_FACTURA, ScopeType.READ)} />
            </MenuGroup>

          </Dropdown>

          <Dropdown
            label="Calidad"
            icon={<FaClipboardCheck />}
            open={openMenu === "calidad"}
            onOpen={() => handleOpen("calidad")}
            onClose={handleClose}
          >
            <MenuGroup label="Control de Calidad" icon={<CheckCircle />}>
              <MenuLink to="/calidad/dashboard" icon={<LayoutGrid />} label="Dashboard" isAllowed={checkScope(ModelType.FORMULARIO_CALIDAD, ScopeType.READ)} />
              <MenuLink to="/calidad/no-conformidades" icon={<AlertTriangle />} label="No Conformidades" isAllowed={checkScope(ModelType.FORMULARIO_CALIDAD, ScopeType.READ)}/>
              <MenuLink to="/calidad/formularios" icon={<Clipboard />} label="Formularios" isAllowed={checkScope(ModelType.FORMULARIO_CALIDAD, ScopeType.READ)}/>
              <MenuLink to="/calidad/poes" icon={<FileText />} label="POES" isAllowed={checkScope(ModelType.POES, ScopeType.READ)}/>
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
              <MenuLink to="/Proveedores" icon={<Users />} label="Proveedores" isAllowed={checkScope(ModelType.PROVEEDOR, ScopeType.READ)} />
              <MenuLink to="/clientes" icon={<FaRegSmile />} label="Clientes" isAllowed={checkScope(ModelType.CLIENTE, ScopeType.READ)} />
              <MenuLink to="/lista-precio" icon={<FaList />} label="Listas de Precio" isAllowed={checkScope(ModelType.LISTA_PRECIO, ScopeType.READ)} />
              <MenuLink to="/NombresFacturacion" icon={<Receipt />} label="Nombres de Facturación" isAllowed={checkScope(ModelType.NOMBRE_FACTURACION, ScopeType.READ)} />
            </MenuGroup>

            <div role="separator" className="my-2 border-t border-gray-200" />

            <MenuGroup label="Catálogos y Productos">
              <MenuLink to="/InsumosPIPProductos" icon={<Tag />} label="Insumos / PIP / Productos" isAllowed={checkScope(ModelType.MATERIA_PRIMA, ScopeType.READ) || checkScope(ModelType.PRODUCTO_BASE, ScopeType.READ)} />
              <MenuLink to="/CostosIndirectos" icon={<MdEqualizer />} label="Costos Indirectos" isAllowed={checkScope(ModelType.COSTO_INDIRECTO, ScopeType.READ)} />
              <MenuLink to="/PautasElaboracion" icon={<Clipboard />} label="Pautas de Elaboración" isAllowed={checkScope(ModelType.PAUTA_ELABORACION, ScopeType.READ)} />
              <MenuLink to="/Bodegas" icon={<FaWarehouse />} label="Bodegas" isAllowed={checkScope(ModelType.BODEGA, ScopeType.READ)} />
              <MenuLink to="/ProcesosValorAgregado" icon={<FaBroom />} label="Procesos Valor Agregado" isAllowed={checkScope(ModelType.PROCESO_VALOR_AGREGADO, ScopeType.READ)} />
            </MenuGroup>

            <div role="separator" className="my-2 border-t border-gray-200" />

            <MenuGroup label="Seguridad y Acceso">
              <MenuLink to="/Usuarios" icon={<Users />} label="Usuarios" isAllowed={checkScope(ModelType.USUARIO, ScopeType.READ) && checkScope(ModelType.ROLE, ScopeType.READ)} />
              <MenuLink to="/Roles" icon={<ShieldCheck />} label="Roles" isAllowed={checkScope(ModelType.ROLE, ScopeType.READ)} />
              <MenuLink to="/AsignarRoles" icon={<ShieldUser />} label="Asignar Roles" isAllowed={checkScope(ModelType.ROLE, ScopeType.WRITE)} />
              <MenuLink to="/GenerarQR" icon={<FaQrcode />} label="Generar QR" isAllowed={checkScope(ModelType.USUARIO, ScopeType.WRITE)} />
            </MenuGroup>

            <div role="separator" className="my-2 border-t border-gray-200" />

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