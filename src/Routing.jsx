// src/Routing.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import RequireAuth from "./auth/RequireAuth";

import Layout from "./components/Layout/Layout";
import ProduccionFinal from "./pages/Orden_de_Manufactura/ProduccionFinal";
import SubproductosDecision from "./pages/Orden_de_Manufactura/SubproductosDecision";
import RegistrarSubproductos from "./pages/Orden_de_Manufactura/RegistrarSubproductos";

// Páginas base
import LandingPage from "./pages/LandingPage";
import HomePage from "./pages/HomePage";
import Login from "./pages/Login.jsx";

// PAGINA DEMO

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

// ====== PIP ======
import PIPList from "./pages/PIP/PIPList";

// ====== Compras (Órdenes) ======
import Ordenes from "./pages/Compras/Ordenes";
import CrearOrden from "./pages/Compras/CrearOrden";
import EditOrden from "./pages/Compras/EditarOrden";
import RecepcionarOrden from "./pages/Compras/RecepcionarOrden";
import OrdenDetail from "./pages/Compras/OrdenDetail";
import AdquisicionesDashboard from "./pages/Compras/AdquisicionesDashboard";

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
import UsuarioAsignarBodega from "./pages/Usuarios/UsuarioAsignarBodega.jsx";
import RolManagement from "./pages/Roles/RolManagement";
import RolDetail from "./pages/Roles/RolDetail";
import AsignarRoles from "./pages/Roles/AsignarRoles";

// ====== Inventarios ======
import Inventario from "./pages/Inventario/Inventario";
import InventarioDashboard from "./pages/Inventario/InventarioDashboard";


// ====== Solicitudes ======
import Solicitudes from "./pages/Solicitudes/Solicitudes";
import AddSolicitud from "./pages/Solicitudes/AddSolicitud";
import EditSolicitud from "./pages/Solicitudes/EditSolicitud";
import SolicitudDetail from "./pages/Solicitudes/SolicitudDetail";

// ====== Orden de Manufactura ======
import AsignarInsumos from "./pages/Orden_de_Manufactura/AsignarInsumos";
import AsignarInsumosPVA from "./pages/Orden_de_Manufactura/AsignarInsumosPVA";
import EjecutarPasos from "./pages/Orden_de_Manufactura/EjecutarPasos";
import OMList from "./pages/Orden_de_Manufactura/OMList";
import ProduccionDashboard from "./pages/Orden_de_Manufactura/ProduccionDashboard";
import AddOM from "./pages/Orden_de_Manufactura/AddOM";
import OMDetail from "./pages/Orden_de_Manufactura/OMDetail";

// ====== Clientes ======
import ClientesPage from "./pages/Clientes/Clientes.jsx";
import AddClientes from "./pages/Clientes/AddClientes.jsx";
import ConsumoGeminiPage from "./pages/Administracion/ConsumoGeminiPage.jsx";
import EditClientes from "./pages/Clientes/ClienteEdit.jsx";
import ClienteDetail from "./pages/Clientes/ClienteDetail.jsx";

// ====== Ventas ======
import VentasDashboard from "./pages/Ventas/VentasDashboard";
import OrdenesVentaPage from "./pages/Ventas/OrdenesVentaPage";
import ColaIAPage from "./pages/Ventas/ColaIAPage";
import AddOrdenVenta from "./pages/Ventas/AddOrdenVenta";
import EditOrdenVenta from "./pages/Ventas/EditOrdenVenta";
import OrdenVentaDetail from "./pages/Ventas/OrdenVentaDetail";
import ListasPrecioPage from "./pages/ListasPrecio/ListasPrecioPage";
import AddListaPrecio from "./pages/ListasPrecio/AddListaPrecio";
import ListaPrecioDetail from "./pages/ListasPrecio/ListaPrecioDetail";
import ListaPrecioEdit from "./pages/ListasPrecio/ListaPrecioEdit";
import LotesList from "./pages/Lotes/LotesList.jsx";
import LoteDetail from "./pages/Lotes/LotesDetail.jsx";
import LoteProductoFinalDetail from "./pages/Lotes/LoteProductoFinalDetail.jsx";

import Pallets from "./pages/Logistica/Pallets";
import LogisticaDashboard from "./pages/Logistica/LogisticaDashboard";
import AsignarVenta from "./pages/Ventas/AsignarVenta.jsx";
import ResumenAsignacionVenta from "./pages/Ventas/ResumenAsignacionVenta.jsx";

import InventarioBultos from "./pages/Inventario/InventarioBultos.jsx";
import SesionesInventariado from "./pages/Inventario/SesionesInventariado.jsx";
import SesionInventariadoDetail from "./pages/Inventario/SesionInventariadoDetail.jsx";
import EditarBulto from "./pages/Inventario/EditarBulto.jsx";
import UsuariosEdit from "./pages/Usuarios/UsuariosEdit.jsx";
import CambiarContrasena from "./pages/Usuarios/CambiarContrasena.jsx";

// ====== Jumpseller ======
import OrdenVentaJumpseller from "./pages/Jumpseller/AddOrdenJumpseller";

// ====== Excel ======
import OrdenVentaExcel from "./pages/Excel/AddExcel";

import FacturasIA from './pages/Facturas_IA/facturas.jsx';
import BandejaSII from './pages/Ventas/BandejaSII.jsx';
import BandejaDTEEmitidos from './pages/Ventas/BandejaDTEEmitidos.jsx';
// ====== PVA ======
import AddProcesoValorAgregado from "./pages/ProcesosValorAgregado/AddProcesoValorAgregado.jsx";
import ProcesosValorAgregado from "./pages/ProcesosValorAgregado/ProcesosValorAgregado.jsx";
import DetailProcesoValorAgregado from "./pages/ProcesosValorAgregado/DetailProcesoValorAgregado.jsx";
import EditProcesoValorAgregado from "./pages/ProcesosValorAgregado/EditProcesoValorAgregado.jsx";
import DeleteProcesoValorAgregado from "./pages/ProcesosValorAgregado/DeleteProcesoValorAgregado.jsx";
import PVAPorProducto from "./pages/PVAProducto/PVAPorProducto.jsx";
import AddPVAPorProducto from "./pages/PVAProducto/AddPVAPorProducto.jsx";
import EditPVAPorProducto from "./pages/PVAProducto/EditPVAPorProducto.jsx";
import EjecutarPasosPVA from "./pages/Orden_de_Manufactura/EjecutarPasosPVA.jsx";
import DetailPVAPorProducto from "./pages/PVAProducto/DetailPVAPorProducto.jsx";
import GenerarQR from "./pages/GenerarQR/GenerarQR.jsx";
import PalletsDashboard from "./pages/Logistica/PalletsDashboard";

// ====== Wizards (admin) ======
import CreatePipWizard from "./pages/PIP/CreatePipWizard.jsx";
import CreateProductoWizard from "./pages/Productos/CreateProductoWizard.jsx";
import CostosIndirectos from "./pages/CostosIndirectos/CostosIndirectos.jsx";
import NombresFacturacion from "./pages/NombresFacturacion/NombresFacturacion.jsx";

// ====== Calidad ======
import CalidadDashboard from "./pages/calidad/CalidadDashboard.jsx";
import NoConformidades from "./pages/calidad/NoConformidades.jsx";
import FormulariosList from "./pages/calidad/FormulariosList.jsx";
import FormularioBuilder from "./pages/calidad/FormularioBuilder.jsx";
import FormularioEdit from "./pages/calidad/FormularioEdit.jsx";
import CompletarFormulario from "./pages/calidad/CompletarFormulario.jsx";
import RespuestasList from "./pages/calidad/RespuestasList.jsx";
import RespuestaDetail from "./pages/calidad/RespuestaDetail.jsx";
import AprobacionFormularios from "./pages/calidad/AprobacionFormularios.jsx";
import AprobacionDetail from "./pages/calidad/AprobacionDetail.jsx";
import POEsList from "./pages/calidad/POEsList.jsx";

// ===== Olvidar Contraseña =====
import ForgotPassword from "./pages/OlvidarContrasena/ForgotPassword.jsx";
import VerifyResetCode from "./pages/OlvidarContrasena/VerifyCode.jsx";
import ResetPassword from "./pages/OlvidarContrasena/ResetPassword.jsx";

// ==== ProtectedRoute ====
import ProtectedRoute from "./components/ProtectedRoute/ProtectedRoute.jsx";
import { ModelType, ScopeType } from "./services/scopeCheck.js";

function Routing() {

  return (
    <BrowserRouter>
      <Routes>
        {/* PÚBLICAS */}
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<LandingPage />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-code" element={<VerifyResetCode />} />
        <Route path="/reset-password" element={<ResetPassword />} />


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
          <Route 
            path="/Inventario/dashboard" 
            element={
              <ProtectedRoute permissions={[[ModelType.INVENTARIO, ScopeType.READ]]}>
                <InventarioDashboard />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/Inventario" 
            element={
              <ProtectedRoute permissions={[[ModelType.INVENTARIO, ScopeType.READ]]}>
                <Inventario />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/Inventario/bultos" 
            element={
              <ProtectedRoute permissions={[
                [ModelType.INVENTARIO, ScopeType.READ], 
                [ModelType.BULTO, ScopeType.READ]
              ]}>
                <InventarioBultos />
              </ProtectedRoute>
            } 
          />
          <Route
            path="/Inventario/tomas"
            element={
              <ProtectedRoute permissions={[[ModelType.SESION_INVENTARIADO, ScopeType.READ]]}>
                <SesionesInventariado />
              </ProtectedRoute>
            }
          />
          <Route
            path="/Inventario/tomas/:id"
            element={
              <ProtectedRoute permissions={[[ModelType.SESION_INVENTARIADO, ScopeType.READ]]}>
                <SesionInventariadoDetail />
              </ProtectedRoute>
            }
          />
          <Route 
            path="/Inventario/bultos/editar/:id" 
            element={
              <ProtectedRoute permissions={[
                [ModelType.INVENTARIO, ScopeType.READ],
                [ModelType.BULTO, ScopeType.WRITE]
              ]}>
                <EditarBulto />
              </ProtectedRoute>
            } 
          />

          {/* Compras / Órdenes */}
          <Route 
            path="/Ordenes/dashboard" 
            element={
              <ProtectedRoute permissions={[[ModelType.ORDEN_COMPRA, ScopeType.READ]]}>
                <AdquisicionesDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/Ordenes" 
            element={
              <ProtectedRoute permissions={[[ModelType.ORDEN_COMPRA, ScopeType.READ]]}>
                <Ordenes />
              </ProtectedRoute>
            }
          />
          <Route 
            path="/Ordenes/add" 
            element={
              <ProtectedRoute permissions={[[ModelType.ORDEN_COMPRA, ScopeType.WRITE]]}>
                <CrearOrden />
              </ProtectedRoute>
            } 
          />
          <Route
            path="/Ordenes/edit/:ordenId"
            element={
              <ProtectedRoute permissions={[[ModelType.ORDEN_COMPRA, ScopeType.WRITE]]}>
                <EditOrden />
              </ProtectedRoute>
            }
          />
          <Route
            path="/Ordenes/recepcionar/:ordenId"
            element={
              <ProtectedRoute permissions={[[ModelType.ORDEN_COMPRA, ScopeType.WRITE]]}>
                <RecepcionarOrden />
              </ProtectedRoute>
            }
          />
          <Route 
            path="/Ordenes/:ordenId" 
            element={
              <ProtectedRoute permissions={[[ModelType.ORDEN_COMPRA, ScopeType.READ]]}>
                <OrdenDetail />
              </ProtectedRoute>
            } 
          />

          {/* Solicitudes */}
          <Route 
            path="/Solicitudes" 
            element={
              <ProtectedRoute permissions={[[ModelType.SOLICITUD_MERCADERIA, ScopeType.READ]]}>
                <Solicitudes />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/Solicitudes/add" 
            element={
              <ProtectedRoute permissions={[[ModelType.SOLICITUD_MERCADERIA, ScopeType.WRITE]]}>
                <AddSolicitud />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/Solicitudes/:solicitudId/edit" 
            element={
              <ProtectedRoute permissions={[[ModelType.SOLICITUD_MERCADERIA, ScopeType.WRITE]]}>
                <EditSolicitud />
              </ProtectedRoute>
            }
          />
          <Route 
            path="/Solicitudes/:solicitudId" 
            element={
              <ProtectedRoute permissions={[[ModelType.SOLICITUD_MERCADERIA, ScopeType.READ]]}>
                <SolicitudDetail />
              </ProtectedRoute>
            } 
          />

          {/* Jumpseller */}
          <Route 
            path="/jumpseller/products" 
            element={
              <ProtectedRoute permissions={[[ModelType.ORDEN_VENTA, ScopeType.READ]]}>
                <OrdenVentaJumpseller />
              </ProtectedRoute>
            } 
          />

          {/* Excel */}
          <Route 
            path="/Excel/products" 
            element={
              <ProtectedRoute permissions={[[ModelType.ORDEN_VENTA, ScopeType.READ]]}>
                <OrdenVentaExcel />
              </ProtectedRoute>
            } 
          />

          {/* Bodegas */}
          <Route
            path="/Bodegas"
            element={
              <ProtectedRoute permissions={[[ModelType.BODEGA, ScopeType.READ]]}>
                <Bodegas />
              </ProtectedRoute>
            }
          />
          <Route
            path="/Bodegas/add"
            element={
              <ProtectedRoute permissions={[[ModelType.BODEGA, ScopeType.WRITE]]}>
                <AddBodega />
              </ProtectedRoute>
            }
          />
          <Route 
            path="/Bodegas/:id/encargados" 
            element={
              <ProtectedRoute permissions={[[ModelType.BODEGA, ScopeType.READ]]}>
                <BodegaAsignarEncargados />
              </ProtectedRoute>
            } 
          />
          <Route
            path="/Bodegas/:id"
            element={
              <ProtectedRoute permissions={[[ModelType.BODEGA, ScopeType.READ]]}>
                <BodegaDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/Bodegas/:id/edit"
            element={
              <ProtectedRoute permissions={[[ModelType.BODEGA, ScopeType.WRITE]]}>
                <BodegaEdit />
              </ProtectedRoute>
            }
          />

          <Route
            path="/Pallets"
            element={
              <ProtectedRoute permissions={[[ModelType.PALLET, ScopeType.READ]]}>
                <Pallets />
              </ProtectedRoute>
            }
          />
          <Route 
            path="/Pallets/dashboard" 
            element={
              <ProtectedRoute permissions={[[ModelType.PALLET, ScopeType.READ]]}>
                <PalletsDashboard />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/Logistica/dashboard" 
            element={
              <ProtectedRoute permissions={[
                [ModelType.SOLICITUD_MERCADERIA, ScopeType.READ],
                [ModelType.PALLET, ScopeType.READ]
              ]}>
                <LogisticaDashboard />
              </ProtectedRoute>
            } 
          />
          <Route
            path="/Logistica"
            element={
              <ProtectedRoute permissions={[[ModelType.INVENTARIO, ScopeType.READ]]}>
                <Navigate to="/Logistica/dashboard" replace />
              </ProtectedRoute>
            }
          />



          {/* ======= Sección ADMIN (protección per-route) ======= */}


          <Route
            path="/GenerarQR"
            element={
              <ProtectedRoute permissions={[[ModelType.USUARIO, ScopeType.READ]]}>
                <GenerarQR />
              </ProtectedRoute>
            }
          />
          {/* Proveedores (admin) */}
          <Route
            path="/Proveedores"
            element={
              <ProtectedRoute permissions={[[ModelType.PROVEEDOR, ScopeType.READ]]}>
                <Proveedores />
              </ProtectedRoute>
            }
          />
          <Route
            path="/Proveedores/add"
            element={
              <ProtectedRoute permissions={[[ModelType.PROVEEDOR, ScopeType.WRITE]]}>
                <AddProvider />
              </ProtectedRoute>
            }
          />
          <Route
            path="/Proveedores/:id"
            element={
              <ProtectedRoute permissions={[[ModelType.PROVEEDOR, ScopeType.READ]]}>
                <ProviderDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/Proveedores/:id/edit"
            element={
              <ProtectedRoute permissions={[[ModelType.PROVEEDOR, ScopeType.WRITE]]}>
                <ProviderEdit />
              </ProtectedRoute>
            }
          />

          {/* Recetas (admin) */}
          <Route
            path="/Recetas"
            element={
              <ProtectedRoute permissions={[[ModelType.RECETA, ScopeType.READ]]}>
                <Recetas />
              </ProtectedRoute>
            }
          />
          <Route
            path="/Recetas/add"
            element={
              <ProtectedRoute permissions={[[ModelType.RECETA, ScopeType.WRITE]]}>
                <AddReceta />
              </ProtectedRoute>
            }
          />
          <Route
            path="/Recetas/:id"
            element={
              <ProtectedRoute permissions={[[ModelType.RECETA, ScopeType.READ]]}>
                <RecetaDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/Recetas/:id/edit"
            element={
              <ProtectedRoute permissions={[[ModelType.RECETA, ScopeType.WRITE]]}>
                <RecetaEdit />
              </ProtectedRoute>
            }
          />

          {/* Pautas de Elaboración (admin) */}
          <Route
            path="/PautasElaboracion"
            element={
              <ProtectedRoute permissions={[[ModelType.PAUTA_ELABORACION, ScopeType.READ]]}>
                <PautasElaboracion />
              </ProtectedRoute>
            }
          />
          <Route
            path="/PautasElaboracion/add"
            element={
              <ProtectedRoute permissions={[[ModelType.PAUTA_ELABORACION, ScopeType.WRITE]]}>
                <AddPautaElaboracion />
              </ProtectedRoute>
            }
          />
          <Route
            path="/PautasElaboracion/:id"
            element={
              <ProtectedRoute permissions={[[ModelType.PAUTA_ELABORACION, ScopeType.READ]]}>
                <PautaElaboracionDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/PautasElaboracion/:id/edit"
            element={
              <ProtectedRoute permissions={[[ModelType.PAUTA_ELABORACION, ScopeType.WRITE]]}>
                <PautaElaboracionEdit />
              </ProtectedRoute>
            }
          />

          {/* Costos Indirectos (admin) */}
          <Route
            path="/CostosIndirectos"
            element={
              <ProtectedRoute permissions={[[ModelType.COSTO_INDIRECTO, ScopeType.READ]]}>
                <CostosIndirectos />
              </ProtectedRoute>
            }
          />

          {/* Consumo API Gemini (admin) */}
          <Route
            path="/ConsumoGemini"
            element={
              <ProtectedRoute permissions={[[ModelType.COSTO_MARGINAL, ScopeType.READ]]}>
                <ConsumoGeminiPage />
              </ProtectedRoute>
            }
          />

          {/* Nombres de Facturación (admin) */}
          <Route
            path="/NombresFacturacion"
            element={
              <ProtectedRoute permissions={[[ModelType.NOMBRE_FACTURACION, ScopeType.READ]]}>
                <NombresFacturacion />
              </ProtectedRoute>
            }
          />

          {/* Productos (admin) */}
          <Route
            path="/Productos"
            element={
              <ProtectedRoute permissions={[[ModelType.PRODUCTO_BASE, ScopeType.READ]]}>
                <Productos />
              </ProtectedRoute>
            }
          />
          <Route 
            path="/Productos/crear" 
            element={
              <ProtectedRoute permissions={[[ModelType.PRODUCTO_BASE, ScopeType.WRITE]]}>
                <CreateProductoWizard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/Productos/:id"
            element={
              <ProtectedRoute permissions={[[ModelType.PRODUCTO_BASE, ScopeType.READ]]}>
                <ProductDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/Productos/:id/edit"
            element={
              <ProtectedRoute permissions={[[ModelType.PRODUCTO_BASE, ScopeType.WRITE]]}>
                <ProductoEdit />
              </ProtectedRoute>
            }
          />

          {/* PIP (admin) */}
          <Route 
            path="/PIP" 
            element={
              <ProtectedRoute permissions={[[ModelType.MATERIA_PRIMA, ScopeType.READ]]}>
                <PIPList />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/PIP/crear" 
            element={
              <ProtectedRoute permissions={[[ModelType.MATERIA_PRIMA, ScopeType.WRITE]]}>
                <CreatePipWizard />
              </ProtectedRoute>
            } 
          />

          {/* Insumos (admin) */}
          <Route
            path="/Insumos"
            element={
              <ProtectedRoute permissions={[[ModelType.MATERIA_PRIMA, ScopeType.READ]]}>
                <Insumos />
              </ProtectedRoute>
            }
          />
          <Route
            path="/Insumos/add"
            element={
              <ProtectedRoute permissions={[[ModelType.MATERIA_PRIMA, ScopeType.WRITE]]}>
                <AddInsumo />
              </ProtectedRoute>
            }
          />
          <Route
            path="/Insumos/:id"
            element={
              <ProtectedRoute permissions={[[ModelType.MATERIA_PRIMA, ScopeType.READ]]}>
                <InsumoDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/Insumos/:id/edit"
            element={
              <ProtectedRoute permissions={[[ModelType.MATERIA_PRIMA, ScopeType.WRITE]]}>
                <InsumoEdit />
              </ProtectedRoute>
            }
          />
          <Route
            path="/Insumos/Categorias"
            element={
              <ProtectedRoute permissions={[[ModelType.CATEGORIA_MATERIA_PRIMA, ScopeType.READ]]}>
                <Categorias />
              </ProtectedRoute>
            }
          />
          <Route
            path="/Insumos/Categorias/add"
            element={
              <ProtectedRoute permissions={[[ModelType.CATEGORIA_MATERIA_PRIMA, ScopeType.WRITE]]}>
                <AddCategoria />
              </ProtectedRoute>
            }
          />
          <Route
            path="/Insumos/Categorias/edit/:id"
            element={
              <ProtectedRoute permissions={[[ModelType.CATEGORIA_MATERIA_PRIMA, ScopeType.WRITE]]}>
                <EditCategoria />
              </ProtectedRoute>
            }
          />
          <Route
            path="/Insumos/asociar"
            element={
              <ProtectedRoute permissions={[[ModelType.PROVEEDOR_MATERIA_PRIMA, ScopeType.WRITE]]}>
                <AddAsociacion />
              </ProtectedRoute>
            }
          />
          <Route
            path="/Insumos/asociar/:id"
            element={
              <ProtectedRoute permissions={[[ModelType.PROVEEDOR_MATERIA_PRIMA, ScopeType.WRITE]]}>
                <AddAsociacion />
              </ProtectedRoute>
            }
          />
          <Route
            path="/Insumos/asociar/edit/:id"
            element={
              <ProtectedRoute permissions={[[ModelType.PROVEEDOR_MATERIA_PRIMA, ScopeType.WRITE]]}>
                <EditAsociacion />
              </ProtectedRoute>
            }
          />
          <Route
            path="/Orden_de_Manufactura/:id/subproductos-decision"
            element={
              <ProtectedRoute permissions={[[ModelType.ORDEN_MANUFACTURA, ScopeType.READ]]}>
                <SubproductosDecision />
              </ProtectedRoute>
            }
          />
          <Route
            path="/Orden_de_Manufactura/:id/registrar-subproductos"
            element={
              <ProtectedRoute permissions={[
                [ModelType.ORDEN_MANUFACTURA, ScopeType.READ],
                [ModelType.REGISTRO_SUBPRODUCTO, ScopeType.WRITE]
              ]}>
                <RegistrarSubproductos />
              </ProtectedRoute>
            }
          />
          <Route
            path="/Orden_de_Manufactura/:id/produccion-final"
            element={
              <ProtectedRoute permissions={[[ModelType.ORDEN_MANUFACTURA, ScopeType.WRITE]]}>
                <ProduccionFinal />
              </ProtectedRoute>
            }
          />

          <Route 
            path="/lotes-producto-en-proceso" 
            element={
              <ProtectedRoute permissions={[[ModelType.LOTE_PRODUCTO_EN_PROCESO, ScopeType.READ]]}>
                <LotesList />
              </ProtectedRoute>
            } 
          />
          <Route
            path="/lotes-producto-en-proceso/:id"
            element={
              <ProtectedRoute permissions={[[ModelType.LOTE_PRODUCTO_EN_PROCESO, ScopeType.READ]]}>
                <LoteDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lotes-producto-final/:id"
            element={
              <ProtectedRoute permissions={[[ModelType.LOTE_PRODUCTO_FINAL, ScopeType.READ]]}>
                <LoteProductoFinalDetail />
              </ProtectedRoute>
            }
          />
          {/* Usuarios / Roles (admin) */}
          <Route
            path="/Usuarios"
            element={
              <ProtectedRoute permissions={[
                [ModelType.USUARIO, ScopeType.READ],
                [ModelType.ROLE, ScopeType.READ]
              ]}>
                <Usuarios />
              </ProtectedRoute>
            }
          />
          <Route
            path="/Usuarios/:id"
            element={
              <ProtectedRoute permissions={[[ModelType.USUARIO, ScopeType.READ]]}>
                <UsuarioById />
              </ProtectedRoute>
            }
          />
          <Route
            path="/Usuarios/:id/edit"
            element={
              <ProtectedRoute permissions={[[ModelType.USUARIO, ScopeType.WRITE]]}>
                <UsuariosEdit />
              </ProtectedRoute>
            }
          />
          <Route
            path="/Usuarios/:id/Contrasena"
            element={
              <ProtectedRoute permissions={[[ModelType.USUARIO, ScopeType.WRITE]]}>
                <CambiarContrasena />
              </ProtectedRoute>
            }
          />
          <Route
            path="/Usuarios/add"
            element={<AddUsuario />}
          />
          <Route
            path="/Usuarios/:id/asignar-bodega"
            element={
              <ProtectedRoute permissions={[
                [ModelType.USUARIO, ScopeType.WRITE],
                [ModelType.BODEGA, ScopeType.READ]
              ]}>
                <UsuarioAsignarBodega />
              </ProtectedRoute>
            }
          />
          <Route
            path="/Roles"
            element={
              <ProtectedRoute permissions={[[ModelType.ROLE, ScopeType.READ]]}>
                <RolManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/Roles/add"
            element={
              <ProtectedRoute permissions={[[ModelType.ROLE, ScopeType.WRITE]]}>
                <RolManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/Roles/:id"
            element={
              <ProtectedRoute permissions={[[ModelType.ROLE, ScopeType.READ]]}>
                <RolDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/Roles/:id/edit"
            element={
              <ProtectedRoute permissions={[[ModelType.ROLE, ScopeType.WRITE]]}>
                <RolManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/AsignarRoles"
            element={
              <ProtectedRoute permissions={[
                [ModelType.ROLE, ScopeType.READ],
                [ModelType.USUARIO, ScopeType.WRITE]
              ]}>
                <AsignarRoles />
              </ProtectedRoute>
            }
          />

          {/* OM (admin) */}
          <Route 
            path="/Produccion/dashboard" 
            element={
              <ProtectedRoute permissions={[
                [ModelType.ORDEN_MANUFACTURA, ScopeType.READ],
                [ModelType.LOTE_PRODUCTO_EN_PROCESO, ScopeType.READ]
              ]}>
                <ProduccionDashboard />
              </ProtectedRoute>
            } 
          />
          <Route
            path="/Orden_de_Manufactura"
            element={
              <ProtectedRoute permissions={[[ModelType.ORDEN_MANUFACTURA, ScopeType.READ]]}>
                <OMList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/Orden_de_Manufactura/add"
            element={
              <ProtectedRoute permissions={[[ModelType.ORDEN_MANUFACTURA, ScopeType.WRITE]]}>
                <AddOM />
              </ProtectedRoute>
            }
          />
          <Route
            path="/Orden_de_Manufactura/:id"
            element={
              <ProtectedRoute permissions={[[ModelType.ORDEN_MANUFACTURA, ScopeType.READ]]}>
                <OMDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/Orden_de_Manufactura/:id/pasos"
            element={
              <ProtectedRoute permissions={[
                [ModelType.ORDEN_MANUFACTURA, ScopeType.READ],
                [ModelType.REGISTRO_PASO_PRODUCCION, ScopeType.READ]
              ]}>
                <EjecutarPasos />
              </ProtectedRoute>
            }
          />
          <Route
            path="/Orden_de_Manufactura/:id/insumos"
            element={
              <ProtectedRoute permissions={[
                [ModelType.ORDEN_MANUFACTURA, ScopeType.READ],
                [ModelType.REGISTRO_INSUMOS_PRODUCCION, ScopeType.READ]
              ]}>
                <AsignarInsumos />
              </ProtectedRoute>
            }
          />

          <Route
            path="/PautasValorAgregado/asignar-insumos/:idPauta"
            element={
              <ProtectedRoute permissions={[[ModelType.PAUTA_VALOR_AGREGADO, ScopeType.READ]]}>
                <AsignarInsumosPVA />
              </ProtectedRoute>
            }
          />


          {/* Clientes (admin) */}
          <Route
            path="/clientes"
            element={
              <ProtectedRoute permissions={[[ModelType.CLIENTE, ScopeType.READ]]}>
                <ClientesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/clientes/add"
            element={
              <ProtectedRoute permissions={[[ModelType.CLIENTE, ScopeType.WRITE]]}>
                <AddClientes />
              </ProtectedRoute>
            }
          />
          <Route
            path="/clientes/:clienteId"
            element={
              <ProtectedRoute permissions={[[ModelType.CLIENTE, ScopeType.READ]]}>
                <ClienteDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/clientes/:clienteId/edit"
            element={
              <ProtectedRoute permissions={[[ModelType.CLIENTE, ScopeType.WRITE]]}>
                <EditClientes />
              </ProtectedRoute>
            }
          />


          {/* Facturas IA */}
          <Route 
            path="/ventas/facturas" 
            element={
              <ProtectedRoute permissions={[[ModelType.OCR_FACTURA, ScopeType.READ]]}>
                <FacturasIA />
              </ProtectedRoute>
            } 
          />

          {/* Bandeja SII — documentos recibidos de proveedores vía LibreDTE */}
          <Route path="/ventas/bandeja-sii" element={<BandejaSII />} />

          {/* Bandeja DTE Emitidos — documentos emitidos a clientes vía LibreDTE */}
          <Route path="/ventas/bandeja-dte-emitidos" element={<BandejaDTEEmitidos />} />

          {/* Ventas */}
          <Route
            path="/ventas/dashboard"
            element={
              <ProtectedRoute permissions={[[ModelType.ORDEN_VENTA, ScopeType.READ]]}>
                <VentasDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ventas/cola-ia"
            element={
              <ProtectedRoute permissions={[[ModelType.ORDEN_VENTA, ScopeType.WRITE]]}>
                <ColaIAPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ventas/ordenes"
            element={
              <ProtectedRoute permissions={[[ModelType.ORDEN_VENTA, ScopeType.READ]]}>
                <OrdenesVentaPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ventas/ordenes/:ordenId/asignar"
            element={
              <ProtectedRoute permissions={[[ModelType.ORDEN_VENTA, ScopeType.WRITE]]}>
                <AsignarVenta />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ventas/ordenes/:ordenId/resumen-asignacion"
            element={
              <ProtectedRoute permissions={[[ModelType.ORDEN_VENTA, ScopeType.READ]]}>
                <ResumenAsignacionVenta />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ventas/ordenes/add"
            element={
              <ProtectedRoute permissions={[[ModelType.ORDEN_VENTA, ScopeType.WRITE]]}>
                <AddOrdenVenta />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ventas/ordenes/:id"
            element={
              <ProtectedRoute permissions={[[ModelType.ORDEN_VENTA, ScopeType.READ]]}>
                <OrdenVentaDetail />
              </ProtectedRoute>
            }
          />
          <Route 
            path="/ventas/ordenes/:id/edit" 
            element={
              <ProtectedRoute permissions={[[ModelType.ORDEN_VENTA, ScopeType.WRITE]]}>
                <EditOrdenVenta />
              </ProtectedRoute>
            } 
          />
          <Route
            path="/lista-precio"
            element={
              <ProtectedRoute permissions={[[ModelType.LISTA_PRECIO, ScopeType.READ]]}>
                <ListasPrecioPage />
              </ProtectedRoute> 
            }
          />
          <Route
            path="/lista-precio/add"
            element={ 
              <ProtectedRoute permissions={[[ModelType.LISTA_PRECIO, ScopeType.WRITE]]}>
                <AddListaPrecio /> 
              </ProtectedRoute>
            }
          />
          <Route
            path="/lista-precio/:id"
            element={ 
              <ProtectedRoute permissions={[[ModelType.LISTA_PRECIO, ScopeType.READ]]}>
                <ListaPrecioDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lista-precio/:id/edit"
            element={
              <ProtectedRoute permissions={[[ModelType.LISTA_PRECIO, ScopeType.WRITE]]}>
                <ListaPrecioEdit />
              </ProtectedRoute>
            }
           />

          {/* PVA (admin) */}
          <Route 
            path="/ProcesosValorAgregado/add" 
            element={
              <ProtectedRoute permissions={[[ModelType.PROCESO_VALOR_AGREGADO, ScopeType.WRITE]]}>
                <AddProcesoValorAgregado />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/ProcesosValorAgregado" 
            element={
              <ProtectedRoute permissions={[[ModelType.PROCESO_VALOR_AGREGADO, ScopeType.READ]]}>
                <ProcesosValorAgregado />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/ProcesosValorAgregado/:id" 
            element={
              <ProtectedRoute permissions={[[ModelType.PROCESO_VALOR_AGREGADO, ScopeType.READ]]}>
                <DetailProcesoValorAgregado />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/ProcesosValorAgregado/:id/edit" 
            element={
              <ProtectedRoute permissions={[[ModelType.PROCESO_VALOR_AGREGADO, ScopeType.WRITE]]}>
                <EditProcesoValorAgregado />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/ProcesosValorAgregado/:id/delete" 
            element={
              <ProtectedRoute permissions={[[ModelType.PROCESO_VALOR_AGREGADO, ScopeType.DELETE]]}>
                <DeleteProcesoValorAgregado />
              </ProtectedRoute>
            }
          />


          {/* Pauta PVA a productos */}
          <Route 
            path="/PVAPorProducto/agregar" 
            element={
              <ProtectedRoute permissions={[[ModelType.PVA_PRODUCTO, ScopeType.WRITE]]}>
                <AddPVAPorProducto />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/PVAPorProducto" 
            element={
              <ProtectedRoute permissions={[[ModelType.PVA_PRODUCTO, ScopeType.READ]]}>
                <PVAPorProducto />
              </ProtectedRoute>
            } 
          />
          <Route
            path="/PVAPorProducto/editar/:id"
            element={
              <ProtectedRoute permissions={[[ModelType.PVA_PRODUCTO, ScopeType.WRITE]]}>
                <EditPVAPorProducto />
              </ProtectedRoute>
            }
          />

          <Route
            path="/PautasValorAgregado/ejecutar/:id"
            element={
              <ProtectedRoute permissions={[
                [ModelType.PAUTA_VALOR_AGREGADO, ScopeType.READ],
                [ModelType.PASO_VALOR_AGREGADO, ScopeType.READ]
              ]}>
                <EjecutarPasosPVA />
              </ProtectedRoute>
            }
          />
          <Route
            path="/PVAPorProducto/:id" 
            element={
              <ProtectedRoute permissions={[[ModelType.PVA_PRODUCTO, ScopeType.READ]]}>
                <DetailPVAPorProducto />
              </ProtectedRoute>
            } 
          />

          {/* Calidad */}
          <Route 
            path="/calidad/dashboard" 
            element={
              <ProtectedRoute permissions={[[ModelType.FORMULARIO_CALIDAD, ScopeType.READ]]}>
                <CalidadDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/calidad/no-conformidades" 
            element={
              <ProtectedRoute permissions={[[ModelType.FORMULARIO_CALIDAD, ScopeType.READ]]}>
                <NoConformidades />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/calidad/formularios" 
            element={
              <ProtectedRoute permissions={[[ModelType.FORMULARIO_CALIDAD, ScopeType.READ]]}>
                <FormulariosList />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/calidad/formularios/nuevo" 
            element={
              <ProtectedRoute permissions={[[ModelType.FORMULARIO_CALIDAD, ScopeType.WRITE]]}>
                <FormularioBuilder />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/calidad/formularios/:id/edit" 
            element={
              <ProtectedRoute permissions={[[ModelType.FORMULARIO_CALIDAD, ScopeType.WRITE]]}>
                <FormularioEdit />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/calidad/formularios/aprobaciones" 
            element={
              <ProtectedRoute permissions={[[ModelType.FORMULARIO_CALIDAD, ScopeType.READ]]}>
                <AprobacionFormularios />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/calidad/formularios/aprobaciones/:id" 
            element={
              <ProtectedRoute permissions={[[ModelType.FORMULARIO_CALIDAD, ScopeType.READ]]}>
                <AprobacionDetail />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/calidad/formularios/:id/completar" 
            element={
              <ProtectedRoute permissions={[
                [ModelType.FORMULARIO_CALIDAD, ScopeType.READ],
                [ModelType.RESPUESTA_FORMULARIO_CALIDAD, ScopeType.WRITE]
              ]}>
                <CompletarFormulario />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/calidad/formularios/:id/respuestas" 
            element={
              <ProtectedRoute permissions={[
                [ModelType.FORMULARIO_CALIDAD, ScopeType.READ],
                [ModelType.RESPUESTA_FORMULARIO_CALIDAD, ScopeType.READ]
              ]}>
                <RespuestasList />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/calidad/respuestas/:id" 
            element={
              <ProtectedRoute permissions={[[ModelType.RESPUESTA_FORMULARIO_CALIDAD, ScopeType.READ]]}>
                <RespuestaDetail />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/calidad/poes" 
            element={
              <ProtectedRoute permissions={[[ModelType.POES, ScopeType.READ]]}>
                <POEsList />
              </ProtectedRoute>
            } 
          />

        </Route>

        {/* 404 */}
        <Route path="*" element={<div style={{ padding: 24 }}>404 — ruta no encontrada</div>} />
      </Routes>
    </BrowserRouter>
  );
}

export default Routing;
