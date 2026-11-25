import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import logo from "../../assets/logo.png";
import { Dropdown, MenuGroup, MenuLink, ClockCompact } from "./NavbarFunction";
import {
  AlertTriangle, BookOpen, Bot, Box, BrainCircuit, Clipboard, ClipboardList, Factory, FileCheck2,
  FileText, FolderTree, Landmark, Layers, LayoutGrid, Link2, ListOrdered, LogOut, Package,
  Package2, PackageOpen, QrCode, Receipt, Scale, ScrollText, ShieldCheck, ShieldUser, Smile,
  Sparkles, Stamp, Tag, Truck, Users, Warehouse, Wrench,
} from "lucide-react";
import { ICONOS } from "../../iconos";

import { checkScope, ModelType, ScopeType } from "../../services/scopeCheck";

const puede = (modelo, scope = ScopeType.READ) => checkScope(modelo, scope);

/**
 * Menú de la web (Fase 2 de la revisión de UI, 2026-11-25): un desplegable por módulo, en el mismo
 * orden y con el mismo nombre que el primer tramo de la ruta (ver `src/rutas.js`), cada uno con su
 * ícono. Nombres con mayúscula sólo al inicio. Las vistas que antes sólo se alcanzaban por enlaces
 * internos (bandejas de facturación, recetas, categorías, aprobaciones, consumo de IA) están acá.
 */
export default function Navbar() {
  const { user, logout } = useAuth();
  const leaveTimer = useRef();
  const [openMenu, setOpenMenu] = useState(null);

  const handleOpen = (id) => {
    clearTimeout(leaveTimer.current);
    setOpenMenu(id);
  };
  const handleClose = () => {
    leaveTimer.current = setTimeout(() => setOpenMenu(null), 150);
  };
  const menu = (id, label, icon, children, alinear) => (
    <Dropdown label={label} icon={icon} alinear={alinear} open={openMenu === id} onOpen={() => handleOpen(id)} onClose={handleClose}>
      {children}
    </Dropdown>
  );

  return (
    <div className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur shadow-sm border-b z-40">
      <div className="px-4 xl:px-6 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 shrink-0">
          <Link to="/" className="block shrink-0">
            <img src={logo} alt="Artisan" className="h-12 w-auto max-w-none select-none" />
          </Link>
          <div className="hidden xl:block"><ClockCompact /></div>
        </div>

        <div className="hidden xl:block h-8 w-px bg-gray-200" />

        <nav className="hidden md:flex items-center gap-0.5 xl:gap-1">
          {menu("adq", "Adquisiciones", <ICONOS.adquisiciones size={16} />, (
            <MenuGroup>
              <MenuLink to="/adquisiciones" icon={<LayoutGrid />} label="Dashboard" isAllowed={puede(ModelType.ORDEN_COMPRA)} />
              <MenuLink to="/adquisiciones/ordenes-compra" icon={<ClipboardList />} label="Órdenes de compra" isAllowed={puede(ModelType.ORDEN_COMPRA)} />
              <MenuLink to="/adquisiciones/facturas-por-vincular" icon={<Link2 />} label="Facturas por vincular" isAllowed={puede(ModelType.ORDEN_COMPRA)} />
            </MenuGroup>
          ))}

          {menu("prod", "Producción", <ICONOS.produccion size={16} />, (
            <MenuGroup>
              <MenuLink to="/produccion" icon={<LayoutGrid />} label="Dashboard" isAllowed={puede(ModelType.INVENTARIO)} />
              <MenuLink to="/produccion/elaboraciones" icon={<Factory />} label="Elaboraciones" isAllowed={puede(ModelType.ORDEN_MANUFACTURA)} />
              <MenuLink to="/produccion/lotes" icon={<Layers />} label="Lotes" isAllowed={puede(ModelType.LOTE_PRODUCTO_EN_PROCESO)} />
            </MenuGroup>
          ))}

          {menu("log", "Logística", <ICONOS.logistica size={16} />, (
            <MenuGroup>
              <MenuLink to="/logistica" icon={<LayoutGrid />} label="Dashboard" isAllowed={puede(ModelType.INVENTARIO)} />
              <MenuLink to="/logistica/solicitudes" icon={<ICONOS.solicitudes />} label="Solicitudes" isAllowed={puede(ModelType.SOLICITUD_MERCADERIA)} />
              <MenuLink to="/logistica/entregas" icon={<ICONOS.entregas />} label="Entregas" isAllowed={puede(ModelType.RUTA)} />
              <MenuLink to="/logistica/transporte" icon={<Truck />} label="Transporte" isAllowed={puede(ModelType.BODEGA)} />
            </MenuGroup>
          ))}

          {menu("inv", "Inventario", <ICONOS.inventario size={16} />, (
            <MenuGroup>
              <MenuLink to="/inventario" icon={<LayoutGrid />} label="Dashboard" isAllowed={puede(ModelType.INVENTARIO)} />
              <MenuLink to="/inventario/stock" icon={<ICONOS.stock />} label="Stock" isAllowed={puede(ModelType.INVENTARIO)} />
              <MenuLink to="/inventario/bultos" icon={<Package />} label="Bultos" isAllowed={puede(ModelType.BULTO)} />
              <MenuLink to="/inventario/sin-qr" icon={<PackageOpen />} label="Productos sin QR" isAllowed={puede(ModelType.BULTO)} />
              <MenuLink to="/inventario/tomas" icon={<ICONOS.tomas />} label="Tomas de inventario" isAllowed={puede(ModelType.SESION_INVENTARIADO)} />
              <MenuLink to="/inventario/consumo-interno" icon={<ICONOS.consumoInterno />} label="Consumo interno" isAllowed={puede(ModelType.BULTO)} />
            </MenuGroup>
          ))}

          {menu("ventas", "Ventas", <ICONOS.ventas size={16} />, (
            <>
              <MenuGroup>
                <MenuLink to="/ventas" icon={<LayoutGrid />} label="Dashboard" isAllowed={puede(ModelType.ORDEN_VENTA)} />
              </MenuGroup>
              <MenuGroup label="Pedidos">
                <MenuLink to="/ventas/cola-ia" icon={<Bot />} label="Cola IA" isAllowed={puede(ModelType.ORDEN_VENTA, ScopeType.WRITE)} />
                <MenuLink to="/ventas/ordenes" icon={<ICONOS.ordenesVenta />} label="Órdenes de venta" isAllowed={puede(ModelType.ORDEN_VENTA)} />
              </MenuGroup>
              <MenuGroup label="Facturación">
                <MenuLink to="/ventas/bandeja-sii" icon={<Landmark />} label="Bandeja SII" isAllowed={puede(ModelType.DOCUMENTO_TRIBUTARIO)} />
                <MenuLink to="/ventas/dte-emitidos" icon={<Receipt />} label="DTE emitidos" isAllowed={puede(ModelType.DOCUMENTO_TRIBUTARIO)} />
                <MenuLink to="/ventas/conciliacion" icon={<Scale />} label="Conciliación LibreDTE" isAllowed={puede(ModelType.DOCUMENTO_TRIBUTARIO)} />
              </MenuGroup>
            </>
          ))}

          {menu("calidad", "Calidad", <ICONOS.calidad size={16} />, (
            <>
              <MenuGroup>
                <MenuLink to="/calidad" icon={<LayoutGrid />} label="Dashboard" isAllowed={puede(ModelType.FORMULARIO_CALIDAD)} />
                <MenuLink to="/calidad/no-conformidades" icon={<AlertTriangle />} label="No conformidades" isAllowed={puede(ModelType.FORMULARIO_CALIDAD)} />
                <MenuLink to="/calidad/formularios" icon={<Clipboard />} label="Formularios" isAllowed={puede(ModelType.FORMULARIO_CALIDAD)} />
                <MenuLink to="/calidad/formularios/aprobaciones" icon={<FileCheck2 />} label="Aprobaciones" isAllowed={puede(ModelType.FORMULARIO_CALIDAD)} />
              </MenuGroup>
              <MenuGroup label="Documentos">
                <MenuLink to="/calidad/poes" icon={<FileText />} label="POES" isAllowed={puede(ModelType.POES)} />
                <MenuLink to="/calidad/poe" icon={<FileText />} label="POE" isAllowed={puede(ModelType.POES)} />
                <MenuLink to="/calidad/instructivos" icon={<ScrollText />} label="Instructivos" isAllowed={puede(ModelType.POES)} />
                <MenuLink to="/calidad/programas" icon={<Stamp />} label="Programas" isAllowed={puede(ModelType.POES)} />
              </MenuGroup>
            </>
          ))}

          {menu("com", "Comercial", <ICONOS.comercial size={16} />, (
            <MenuGroup>
              <MenuLink to="/comercial/clientes" icon={<Smile />} label="Clientes" isAllowed={puede(ModelType.CLIENTE)} />
              <MenuLink to="/comercial/proveedores" icon={<Users />} label="Proveedores" isAllowed={puede(ModelType.PROVEEDOR)} />
              <MenuLink to="/comercial/listas-precio" icon={<ListOrdered />} label="Listas de precio" isAllowed={puede(ModelType.LISTA_PRECIO)} />
              <MenuLink to="/comercial/nombres-facturacion" icon={<Receipt />} label="Nombres de facturación" isAllowed={puede(ModelType.NOMBRE_FACTURACION)} />
            </MenuGroup>
          ), "derecha")}

          {menu("cat", "Catálogo", <ICONOS.catalogo size={16} />, (
            <>
              <MenuGroup label="Productos">
                <MenuLink to="/catalogo/productos" icon={<Tag />} label="Productos" isAllowed={puede(ModelType.PRODUCTO_BASE)} />
                <MenuLink to="/catalogo/pip" icon={<Package2 />} label="PIP" isAllowed={puede(ModelType.MATERIA_PRIMA)} />
                <MenuLink to="/catalogo/recetas" icon={<BookOpen />} label="Recetas" isAllowed={puede(ModelType.RECETA)} />
                <MenuLink to="/catalogo/pautas-elaboracion" icon={<Clipboard />} label="Pautas de elaboración" isAllowed={puede(ModelType.PAUTA_ELABORACION)} />
              </MenuGroup>
              <MenuGroup label="Insumos">
                <MenuLink to="/catalogo/insumos" icon={<Box />} label="Insumos" isAllowed={puede(ModelType.MATERIA_PRIMA)} />
                <MenuLink to="/catalogo/categorias-insumo" icon={<FolderTree />} label="Categorías de insumo" isAllowed={puede(ModelType.CATEGORIA_MATERIA_PRIMA)} />
                <MenuLink to="/catalogo/insumos/proveedores" icon={<Link2 />} label="Insumos por proveedor" isAllowed={puede(ModelType.PROVEEDOR_MATERIA_PRIMA, ScopeType.WRITE)} />
              </MenuGroup>
              <MenuGroup label="Valor agregado y costos">
                <MenuLink to="/catalogo/procesos-valor-agregado" icon={<Sparkles />} label="Procesos de valor agregado" isAllowed={puede(ModelType.PROCESO_VALOR_AGREGADO)} />
                <MenuLink to="/catalogo/pva-por-producto" icon={<Wrench />} label="PVA por producto" isAllowed={puede(ModelType.PVA_PRODUCTO)} />
                <MenuLink to="/catalogo/costos-indirectos" icon={<Scale />} label="Costos indirectos" isAllowed={puede(ModelType.COSTO_INDIRECTO)} />
                <MenuLink to="/catalogo/bodegas" icon={<Warehouse />} label="Bodegas" isAllowed={puede(ModelType.BODEGA)} />
              </MenuGroup>
            </>
          ), "derecha")}

          {menu("admin", "Admin", <ICONOS.admin size={16} />, (
            <MenuGroup>
              <MenuLink to="/admin/usuarios" icon={<Users />} label="Usuarios" isAllowed={puede(ModelType.USUARIO) && puede(ModelType.ROLE)} />
              <MenuLink to="/admin/roles" icon={<ShieldCheck />} label="Roles" isAllowed={puede(ModelType.ROLE)} />
              <MenuLink to="/admin/asignar-roles" icon={<ShieldUser />} label="Asignar roles" isAllowed={puede(ModelType.ROLE, ScopeType.WRITE)} />
              <MenuLink to="/admin/generar-qr" icon={<QrCode />} label="Generar QR" isAllowed={puede(ModelType.USUARIO, ScopeType.WRITE)} />
              <MenuLink to="/admin/consumo-ia" icon={<BrainCircuit />} label="Consumo de IA" isAllowed={puede(ModelType.COSTO_MARGINAL)} />
            </MenuGroup>
          ), "derecha")}
        </nav>

        <div className="hidden xl:block h-8 w-px bg-gray-200" />

        <div className="flex items-center gap-4 shrink-0">
          {user && (
            <span className="hidden 2xl:inline text-sm text-gray-700 font-medium truncate max-w-[180px]">
              {user.nombre || user.email}
            </span>
          )}
          {user ? (
            <button
              onClick={logout}
              className="text-gray-500 hover:text-gray-700 hover:bg-gray-50 border border-transparent font-normal text-sm flex items-center gap-2 px-3 py-2 rounded-md transition whitespace-nowrap"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
            >
              <LogOut size={16} className="2xl:hidden" />
              <span className="hidden 2xl:inline">Cerrar sesión</span>
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
