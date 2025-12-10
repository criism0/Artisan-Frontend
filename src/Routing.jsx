// src/Routing.jsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import RequireAuth from "./auth/RequireAuth";

import Layout from "./components/Layout";
import ProtectedRouteMessage from "./components/ProtectedRouteMessage";
import ProduccionFinal from "./pages/Orden_de_Manufactura/ProduccionFinal";
import SubproductosDecision from "./pages/Orden_de_Manufactura/SubproductosDecision";
import RegistrarSubproductos from "./pages/Orden_de_Manufactura/RegistrarSubproductos";
import HistorialPasos from "./pages/Orden_de_Manufactura/HistorialPasos";

// Páginas base
import LandingPage from "./pages/LandingPage";
import HomePage from "./pages/HomePage";
import Login from "./pages/Login.jsx";

// ====== Proveedores ======
import Proveedores from "./pages/Proveedores/Proveedores";
import ProviderDetail from "./pages/Proveedores/ProviderDetail";
import ProviderEdit from "./pages/Proveedores/ProviderEdit";
import AddProvider from "./pages/Proveedores/AddProvider";

// ====== Bodegas ======
import Bodegas from "./pages/Bodegas/Bodegas";
import AddBodega from "./pages/Bodegas/AddBodega";
import BodegaDetail from "./pages/Bodegas/BodegaDetail";
import BodegaEdit from "./pages/Bodegas/BodegaEdit";
import BodegaAsignarEncargados from "./pages/Bodegas/BodegaAsignarEncargados";



// ====== Recetas ======
import Recetas from "./pages/Recetas/Recetas";
import RecetaDetail from "./pages/Recetas/RecetaDetail";
import RecetaEdit from "./pages/Recetas/RecetaEdit";
import AddReceta from "./pages/Recetas/AddReceta";

// ====== Pautas de Elaboración ======
import PautasElaboracion from "./pages/PautasElaboracion/PautasElaboracion";
import PautaElaboracionDetail from "./pages/PautasElaboracion/PautaElaboracionDetail";
import PautaElaboracionEdit from "./pages/PautasElaboracion/PautaElaboracionEdit";
import AddPautaElaboracion from "./pages/PautasElaboracion/AddPautaElaboracion";

// ====== Productos ======
import Productos from "./pages/Productos/Productos";
import ProductDetail from "./pages/Productos/ProductDetail";
import ProductoEdit from "./pages/Productos/ProductoEdit";
import AddProducto from "./pages/Productos/AddProducto";

// ====== PIP ======
import PIPList from "./pages/PIP/PIPList";

// ====== Compras (Órdenes) ======
import Ordenes from "./pages/Compras/Ordenes";
import CrearOrden from "./pages/Compras/CrearOrden";
import EditOrden from "./pages/Compras/EditarOrden";
import ValidarOrden from "./pages/Compras/ValidarOrden";
import EnviarOrden from "./pages/Compras/EnviarOrden";
import RecepcionarOrden from "./pages/Compras/RecepcionarOrden";
import DeclararBultosOrden from "./pages/Compras/DeclararBultosOrden.jsx";
import OrdenDetail from "./pages/Compras/OrdenDetail";

// ====== Insumos ======
import Categorias from "./pages/Insumos/Categorias";
import EditCategoria from "./pages/Insumos/EditCategoria";
import AddCategoria from "./pages/Insumos/AddCategoria";
import Insumos from "./pages/Insumos/Insumos";
import AddInsumo from "./pages/Insumos/AddInsumo";
import InsumoEdit from "./pages/Insumos/InsumoEdit";
import InsumoDetail from "./pages/Insumos/InsumoDetail";
import AddAsociacion from "./pages/Insumos/AddAsociacion.jsx";
import EditAsociacion from "./pages/Insumos/EditAsociacion";

// ====== Usuarios / Roles ======
import Usuarios from "./pages/Usuarios/Usuarios";
import UsuarioById from "./pages/Usuarios/UsuarioById.jsx";
import AddUsuario from "./pages/Usuarios/AddUsuario";
import RolManagement from "./pages/Roles/RolManagement";
import RolDetail from "./pages/Roles/RolDetail";
import AsignarRoles from "./pages/Roles/AsignarRoles";

// ====== Inventarios ======
import Inventario from "./pages/Inventario/Inventario";
import InventarioInsumos from "./pages/Inventario_Insumos/InventarioInsumos.jsx";
import InventarioProductosTerminados from "./pages/Orden_de_Manufactura/InventarioProductosTerminados";
import BultosPorBodega from "./pages/Inventario/BultosPorBodega";

// ====== Solicitudes ======
import Solicitudes from "./pages/Solicitudes/Solicitudes";
import AddSolicitud from "./pages/Solicitudes/AddSolicitud";
import CargarPallets from "./pages/Solicitudes/CargarPallet.jsx";
import SolicitudDetail from "./pages/Solicitudes/SolicitudDetail";
import PrepararPedido from "./pages/Solicitudes/PrepararPedido";
import RecepcionarSolicitud from "./pages/Solicitudes/RecepcionarSolicitud";

// ====== Orden de Manufactura ======
import AsignarInsumos from "./pages/Orden_de_Manufactura/AsignarInsumos";
import AsignarInsumosPVA from "./pages/Orden_de_Manufactura/AsignarInsumosPVA";
import EjecutarPasos from "./pages/Orden_de_Manufactura/EjecutarPasos";
import OMList from "./pages/Orden_de_Manufactura/OMList";
import AddOM from "./pages/Orden_de_Manufactura/AddOM";
import OMDetail from "./pages/Orden_de_Manufactura/OMDetail";

// ====== Clientes ======
import ClientesPage from "./pages/Clientes/Clientes.jsx";
import AddClientes from "./pages/Clientes/AddClientes.jsx";
import EditClientes from "./pages/Clientes/ClienteEdit.jsx";
import ClienteDetail from "./pages/Clientes/ClienteDetail.jsx";
import AddLocalCliente from "./pages/Locales/AddLocalCliente.jsx";
import EditLocalCliente from "./pages/Locales/EditLocalCliente.jsx";
import LocalClienteDetail from "./pages/Locales/LocalClienteDetail.jsx";

// ====== Ventas ======
import OrdenesVentaPage from "./pages/Ventas/OrdenesVentaPage";
import AddOrdenVenta from "./pages/Ventas/AddOrdenVenta";
import EditOrdenVenta from "./pages/Ventas/EditOrdenVenta";
import OrdenVentaDetail from "./pages/Ventas/OrdenVentaDetail";
import ListasPrecioPage from "./pages/ListasPrecio/ListasPrecioPage";
import AddListaPrecio from "./pages/ListasPrecio/AddListaPrecio";
import ListaPrecioDetail from "./pages/ListasPrecio/ListaPrecioDetail";
import ListaPrecioEdit from "./pages/ListasPrecio/ListaPrecioEdit";
import LotesList from "./pages/Lotes/LotesList.jsx";
import LoteDetail from "./pages/Lotes/LotesDetail.jsx";
import CostoMarginalList from "./pages/CostoMarginal/CostoMarginalList";
import CostoMarginalDetail from "./pages/CostoMarginal/CostoMarginalDetail";

import Envios from "./pages/Logistica/Envios";
import Pallets from "./pages/Logistica/Pallets";
import Rutas from "./pages/Logistica/Rutas";
import AsignarVenta from "./pages/Ventas/AsignarVenta.jsx";
import ResumenAsignacionVenta from "./pages/Ventas/ResumenAsignacionVenta.jsx";

import InventarioBultos from "./pages/Inventario/InventarioBultos.jsx";
import EnviosDetail from "./pages/Logistica/EnviosDetail.jsx";
import UsuariosEdit from "./pages/Usuarios/UsuariosEdit.jsx";
import CambiarContrasena from "./pages/Usuarios/CambiarContrasena.jsx";

// ====== Jumpseller ======
import OrdenVentaJumpseller from "./pages/Jumpseller/AddOrdenJumpseller";

// ====== Excel ======
import OrdenVentaExcel from "./pages/Excel/AddExcel";

import FacturasIA from './pages/Facturas_IA/facturas.jsx';
// ====== PVA ======
import AddProcesoValorAgregado from "./pages/ProcesosValorAgregado/AddProcesoValorAgregado.jsx";
import ProcesosValorAgregado from "./pages/ProcesosValorAgregado/ProcesosValorAgregado.jsx";
import DetailProcesoValorAgregado from "./pages/ProcesosValorAgregado/DetailProcesoValorAgregado.jsx";
import EditProcesoValorAgregado from "./pages/ProcesosValorAgregado/EditProcesoValorAgregado.jsx";
import DeleteProcesoValorAgregado from "./pages/ProcesosValorAgregado/DeleteProcesoValorAgregado.jsx";
import AddPautaValorAgregado from "./pages/PautasValorAgregado/AddPautaValorAgregado.jsx";
import PautasValorAgregado from "./pages/PautasValorAgregado/PautasValorAgregado.jsx";
import DetailPautaValorAgregado from "./pages/PautasValorAgregado/DetailPautaValorAgregado.jsx";
import EditPautaValorAgregado from "./pages/PautasValorAgregado/EditPautaValorAgregado.jsx";
import DeletePautaValorAgregado from "./pages/PautasValorAgregado/DeletePautaValorAgregado.jsx";
import PVAPorProducto from "./pages/PVAProducto/PVAPorProducto.jsx";
import AddPVAPorProducto from "./pages/PVAProducto/AddPVAPorProducto.jsx";
import EditPVAPorProducto from "./pages/PVAProducto/EditPVAPorProducto.jsx";
import DeletePVAPorProducto from "./pages/PVAProducto/DeletePVAPorProducto.jsx";
import EjecutarPasosPVA from "./pages/Orden_de_Manufactura/EjecutarPasosPVA.jsx";
import DetailPVAPorProducto from "./pages/PVAProducto/DetailPVAPorProducto.jsx";
import GenerarQR from "./pages/GenerarQR/GenerarQR.jsx";
import PalletsDashboard from "./pages/Logistica/PalletsDashboard";


function Routing() {
  const { user, isAuth } = useAuth();

  // Ajusta si tu JWT trae role/scope de otra forma:
  // TODO: (DANKO O TOM): CAMMBIAR ESTE CHECK
  /*const isAdmin =
    !!user &&
    (Array.isArray(user.scope) ? user.scope.includes("admin") : false ||
     user.rol === "admin" ||
     user?.raw?.role === "admin");*/

  return (
    <BrowserRouter>
      <Routes>
        {/* PÚBLICAS */}
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<LandingPage />} />

        {/* PRIVADAS: dentro de Layout y RequireAuth */}
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          {/* Home */}
          <Route path="/Home" element={<HomePage />} />

          {/* Inventarios */}
          <Route path="/Inventario" element={<Inventario />} />

          <Route path="/Inventario/bultos" element={<InventarioBultos />} />

          <Route path="/Inventario/:id_bodega" element={<InventarioInsumos />} />
          <Route
            path="/InventarioProductosTerminados/:idBodega"
            element={<InventarioProductosTerminados />}
          />


          {/* Compras / Órdenes */}
          <Route path="/Ordenes" element={<Ordenes />} />
          <Route path="/Ordenes/add" element={<CrearOrden />} />
          <Route path="/Ordenes/validar/:ordenId" element={<ValidarOrden />} />
          <Route path="/Ordenes/edit/:ordenId" element={<EditOrden />} />
          <Route path="/Ordenes/enviar/:ordenId" element={<EnviarOrden />} />
          <Route path="/Ordenes/recepcionar/:ordenId" element={<RecepcionarOrden />} />
          <Route path="/Ordenes/declarar-bultos/:ordenId" element={<DeclararBultosOrden />} />
          <Route path="/Ordenes/:ordenId" element={<OrdenDetail />} />

          {/* Solicitudes */}
          <Route path="/Solicitudes" element={<Solicitudes />} />
          <Route path="/Solicitudes/add" element={<AddSolicitud />} />
          <Route path="/Solicitudes/cargar-pallets" element={<CargarPallets />} />
          <Route
            path="/Solicitudes/:solicitudId/preparar-pedido"
            element={<PrepararPedido />}
          />
          <Route
            path="/Solicitudes/:solicitudId/recepcionar-solicitud"
            element={<RecepcionarSolicitud />}
          />
          <Route path="/Solicitudes/:solicitudId" element={<SolicitudDetail />} />

          {/* Jumpseller */}
          <Route path="/jumpseller/products" element={<OrdenVentaJumpseller />} />

          {/* Excel */}
          <Route path="/Excel/products" element={<OrdenVentaExcel />} />

          {/* Bodegas */}
          <Route
            path="/Bodegas"
            element={<Bodegas />}
          />
          <Route
            path="/Bodegas/add"
            element={<AddBodega />}
          />
          <Route path="/Bodegas/:id/encargados" element={<BodegaAsignarEncargados />} />
          <Route
            path="/Bodegas/:id"
            element={<BodegaDetail />}
          />
          <Route
            path="/Bodegas/:id/edit"
            element={<BodegaEdit />}
          />

          <Route
            path="/Envios"
            element={<Envios />}
          />
          <Route path="/envios/:id" element={<EnviosDetail />} />


          <Route
            path="/Rutas"
            element={<Rutas />}
          />

          <Route
            path="/Pallets"
            element={<Pallets />}
          />
          <Route path="/Pallets/dashboard" element={<PalletsDashboard />} />

          <Route path="/Logistica" element={<Navigate to="/Envios" replace />} />



          {/* ======= Sección ADMIN (protección per-route) ======= */}


          <Route
            path="/GenerarQR"
            element={<GenerarQR />}
          />
          {/* Proveedores (admin) */}
          <Route
            path="/Proveedores"
            element={<Proveedores />}
          />
          <Route
            path="/Proveedores/add"
            element={<AddProvider />}
          />
          <Route
            path="/Proveedores/:id"
            element={<ProviderDetail />}
          />
          <Route
            path="/Proveedores/:id/edit"
            element={<ProviderEdit />}
          />

          {/* Recetas (admin) */}
          <Route
            path="/Recetas"
            element={<Recetas />}
          />
          <Route
            path="/Recetas/add"
            element={<AddReceta />}
          />
          <Route
            path="/Recetas/:id"
            element={<RecetaDetail />}
          />
          <Route
            path="/Recetas/:id/edit"
            element={<RecetaEdit />}
          />

          {/* Pautas de Elaboración (admin) */}
          <Route
            path="/PautasElaboracion"
            element={<PautasElaboracion />}
          />
          <Route
            path="/PautasElaboracion/add"
            element={<AddPautaElaboracion />}
          />
          <Route
            path="/PautasElaboracion/:id"
            element={<PautaElaboracionDetail />}
          />
          <Route
            path="/PautasElaboracion/:id/edit"
            element={<PautaElaboracionEdit />}
          />

          {/* Productos (admin) */}
          <Route path="/productos-terminados" element={<InventarioProductosTerminados />} />
          <Route
            path="/Productos"
            element={<Productos />}
          />
          <Route
            path="/Productos/add"
            element={<AddProducto />}
          />
          <Route
            path="/Productos/:id"
            element={<ProductDetail />}
          />
          <Route
            path="/Productos/:id/edit"
            element={<ProductoEdit />}
          />

          {/* PIP (admin) */}
          <Route path="/PIP" element={<PIPList />} />

          {/* Insumos (admin) */}
          <Route
            path="/Insumos"
            element={<Insumos />}
          />
          <Route
            path="/Insumos/add"
            element={<AddInsumo />}
          />
          <Route
            path="/Insumos/:id"
            element={<InsumoDetail />}
          />
          <Route
            path="/Insumos/:id/edit"
            element={<InsumoEdit />}
          />
          <Route
            path="/Insumos/Categorias"
            element={<Categorias />}
          />
          <Route
            path="/Insumos/Categorias/add"
            element={<AddCategoria />}
          />
          <Route
            path="/Insumos/Categorias/add"
            element={<AddCategoria />}
          />
          <Route
            path="/Insumos/Categorias/edit/:id"
            element={<EditCategoria />}
          />
          <Route
            path="/Insumos/asociar"
            element={<AddAsociacion />}
          />
          <Route
            path="/Insumos/asociar/:id"
            element={<AddAsociacion />}
          />
          <Route
            path="/Insumos/asociar/edit/:id"
            element={<EditAsociacion />}
          />
          <Route

            path="/Orden_de_Manufactura/:id/subproductos-decision"
            element={<SubproductosDecision />}
          />
          <Route
            path="/Orden_de_Manufactura/:id/registrar-subproductos"
            element={<RegistrarSubproductos />}
          />
          <Route
            path="/Orden_de_Manufactura/:id/produccion-final"
            element={<ProduccionFinal />}
          />
          <Route
            path="/Orden_de_Manufactura/:id/historial-pasos"
            element={<HistorialPasos />}
          />

          <Route path="/lotes-producto-en-proceso" element={<LotesList />} />
          <Route path="/lotes-producto-en-proceso/:id" element={<LoteDetail />} />

          <Route path="/CostoMarginal" element={<CostoMarginalList />} />
          <Route path="/CostoMarginal/:tipo/:id" element={<CostoMarginalDetail />} />


          {/* Usuarios / Roles (admin) */}
          <Route
            path="/Usuarios"
            element={<Usuarios />}
          />
          <Route
            path="/Usuarios/:id"
            element={<UsuarioById />}
          />
          <Route
            path="/Usuarios/:id/edit"
            element={<UsuariosEdit />}
          />
          <Route
            path="/Usuarios/:id/Contrasena"
            element={ <CambiarContrasena /> }
          />
          <Route
            path="/Usuarios/add"
            element={<AddUsuario />}
          />
          <Route
            path="/Roles"
            element={<RolManagement />}
          />
          <Route
            path="/Roles/add"
            element={<RolManagement />}
          />
          <Route
            path="/Roles/:id"
            element={<RolDetail />}
          />
          <Route
            path="/Roles/:id/edit"
            element={<RolManagement />}
          />
          <Route
            path="/AsignarRoles"
            element={<AsignarRoles />}
          />

          {/* OM (admin) */}

          {/* OM (admin) */}
          <Route
            path="/Orden_de_Manufactura"
            element={<OMList />}
          />
          <Route
            path="/Orden_de_Manufactura/add"
            element={<AddOM />}
          />
          <Route
            path="/Orden_de_Manufactura/:id"
            element={<OMDetail />}
          />
          <Route
            path="/Orden_de_Manufactura/:id/pasos"
            element={<EjecutarPasos />}
          />
          <Route
            path="/Orden_de_Manufactura/:id/insumos"
            element={<AsignarInsumos />}
          />

                    <Route
            path="/PautasValorAgregado/asignar-insumos/:idPauta"
            element={<AsignarInsumosPVA />}
          />


          {/* Clientes (admin) */}
          <Route
            path="/clientes"
            element={<ClientesPage />}
          />
          <Route
            path="/clientes/add"
            element={<AddClientes />}
          />
          <Route
            path="/clientes/:clienteId"
            element={<ClienteDetail />}
          />
          <Route
            path="/clientes/:clienteId/edit"
            element={<EditClientes />}
          />
          <Route
            path="/clientes/:clienteId/locales/add"
            element={<AddLocalCliente />}
          />
          <Route
            path="/clientes/:clienteId/locales/:id"
            element={<LocalClienteDetail />}
          />
          <Route
            path="/clientes/:clienteId/locales/:id/edit"
            element={<EditLocalCliente />}
          />


          {/* Facturas IA */}
          <Route path="/ventas/facturas" element={<FacturasIA />} />

          {/* Ventas */}
          <Route path="/ventas/ordenes" element={<OrdenesVentaPage />} />
          <Route path="/ventas/ordenes/:ordenId/asignar" element={<AsignarVenta />} />
          <Route path="/ventas/ordenes/:ordenId/resumen-asignacion" element={<ResumenAsignacionVenta />} />
          <Route path="/ventas/ordenes/add" element={<AddOrdenVenta />} />
          <Route
            path="/ventas/ordenes/:id"
            element={<OrdenVentaDetail />}
          />
          <Route path="/ventas/ordenes/:id/edit" element={<EditOrdenVenta />} />
          <Route
            path="/lista-precio"
            element={ <ListasPrecioPage /> }
          />
          <Route
            path="/lista-precio/add"
            element={ <AddListaPrecio /> }
          />
          <Route
            path="/lista-precio/:id"
            element={ <ListaPrecioDetail /> }
          />
          <Route
            path="/lista-precio/:id/edit"
            element={ <ListaPrecioEdit /> }
           />




          {/* PVA (admin) */}
          <Route path="/ProcesosValorAgregado/add" element={<AddProcesoValorAgregado />} />
          <Route path="/ProcesosValorAgregado" element={<ProcesosValorAgregado />} />
          <Route path="/ProcesosValorAgregado/:id" element={<DetailProcesoValorAgregado />} />
          <Route path="/ProcesosValorAgregado/:id/edit" element={<EditProcesoValorAgregado />} />
          <Route path="/ProcesosValorAgregado/:id/delete" element={<DeleteProcesoValorAgregado />} />

          {/* Pauta PVA (admin) */}
          <Route path="/PautasValorAgregado/add" element={<AddPautaValorAgregado />} />
          <Route path="/PautasValorAgregado" element={<PautasValorAgregado />} />
          <Route path="/PautasValorAgregado/:id" element={<DetailPautaValorAgregado />} />
          <Route path="/PautasValorAgregado/:id/edit" element={<EditPautaValorAgregado />} />
          <Route path="/PautasValorAgregado/:id/delete" element={<DeletePautaValorAgregado />} />

          {/* Pauta PVA a productos */}
          <Route path="/PVAPorProducto/agregar" element={<AddPVAPorProducto />} />
          <Route path="/PVAPorProducto" element={<PVAPorProducto />} />
          <Route path="/PVAPorProducto/editar/:id" element={<EditPVAPorProducto />} />
          <Route path="/PVAPorProducto/:id/delete" element={<DeletePVAPorProducto/>} />

                  <Route
          path="/PautasValorAgregado/ejecutar/:id"
          element={<EjecutarPasosPVA />}
          
        />
        <Route path="/PVAPorProducto/:id" element={<DetailPVAPorProducto />} />


        </Route>

        {/* 404 */}
        <Route path="*" element={<div style={{ padding: 24 }}>404 — ruta no encontrada</div>} />
      </Routes>
    </BrowserRouter>
  );
}

export default Routing;
