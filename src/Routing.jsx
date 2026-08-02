// src/Routing.jsx
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import RequireAuth from "./auth/RequireAuth";
import CargandoVista from "./components/UI/CargandoVista";

import Layout from "./components/Layout/Layout";
const ProduccionFinal = lazy(() => import("./pages/Orden_de_Manufactura/ProduccionFinal"));
const SubproductosDecision = lazy(() => import("./pages/Orden_de_Manufactura/SubproductosDecision"));
const RegistrarSubproductos = lazy(() => import("./pages/Orden_de_Manufactura/RegistrarSubproductos"));

// Páginas base
import LandingPage from "./pages/LandingPage";
const HomePage = lazy(() => import("./pages/HomePage"));
import Login from "./pages/Login.jsx";

// PAGINA DEMO

// ====== Proveedores ======
const Proveedores = lazy(() => import("./pages/Proveedores/Proveedores"));
const ProviderDetail = lazy(() => import("./pages/Proveedores/ProviderDetail"));
const ProviderEdit = lazy(() => import("./pages/Proveedores/ProviderEdit"));
const AddProvider = lazy(() => import("./pages/Proveedores/AddProvider"));

// ====== Bodegas ======
const Bodegas = lazy(() => import("./pages/Bodegas/Bodegas"));
const AddBodega = lazy(() => import("./pages/Bodegas/AddBodega"));
const BodegaDetail = lazy(() => import("./pages/Bodegas/BodegaDetail"));
const BodegaEdit = lazy(() => import("./pages/Bodegas/BodegaEdit"));
const BodegaAsignarEncargados = lazy(() => import("./pages/Bodegas/BodegaAsignarEncargados"));



// ====== Recetas ======
const Recetas = lazy(() => import("./pages/Recetas/Recetas"));
const RecetaDetail = lazy(() => import("./pages/Recetas/RecetaDetail"));
const RecetaEdit = lazy(() => import("./pages/Recetas/RecetaEdit"));
const AddReceta = lazy(() => import("./pages/Recetas/AddReceta"));

// ====== Pautas de Elaboración ======
const PautasElaboracion = lazy(() => import("./pages/PautasElaboracion/PautasElaboracion"));
const PautaElaboracionDetail = lazy(() => import("./pages/PautasElaboracion/PautaElaboracionDetail"));
const PautaElaboracionEdit = lazy(() => import("./pages/PautasElaboracion/PautaElaboracionEdit"));
const AddPautaElaboracion = lazy(() => import("./pages/PautasElaboracion/AddPautaElaboracion"));

// ====== Productos ======
const Productos = lazy(() => import("./pages/Productos/Productos"));
const ProductDetail = lazy(() => import("./pages/Productos/ProductDetail"));
const ProductoEdit = lazy(() => import("./pages/Productos/ProductoEdit"));

// ====== PIP ======
const PIPList = lazy(() => import("./pages/PIP/PIPList"));

// ====== Compras (Órdenes) ======
const Ordenes = lazy(() => import("./pages/Compras/Ordenes"));
const CrearOrden = lazy(() => import("./pages/Compras/CrearOrden"));
const EditOrden = lazy(() => import("./pages/Compras/EditarOrden"));
const RecepcionarOrden = lazy(() => import("./pages/Compras/RecepcionarOrden"));
const OrdenDetail = lazy(() => import("./pages/Compras/OrdenDetail"));
const AdquisicionesDashboard = lazy(() => import("./pages/Compras/AdquisicionesDashboard"));

// ====== Insumos ======
const Categorias = lazy(() => import("./pages/Insumos/Categorias"));
const EditCategoria = lazy(() => import("./pages/Insumos/EditCategoria"));
const AddCategoria = lazy(() => import("./pages/Insumos/AddCategoria"));
const Insumos = lazy(() => import("./pages/Insumos/Insumos"));
const AddInsumo = lazy(() => import("./pages/Insumos/AddInsumo"));
const InsumoEdit = lazy(() => import("./pages/Insumos/InsumoEdit"));
const InsumoDetail = lazy(() => import("./pages/Insumos/InsumoDetail"));
const AddAsociacion = lazy(() => import("./pages/Insumos/AddAsociacion.jsx"));
const EditAsociacion = lazy(() => import("./pages/Insumos/EditAsociacion"));

// ====== Usuarios / Roles ======
const Usuarios = lazy(() => import("./pages/Usuarios/Usuarios"));
const UsuarioById = lazy(() => import("./pages/Usuarios/UsuarioById.jsx"));
const AddUsuario = lazy(() => import("./pages/Usuarios/AddUsuario"));
const UsuarioAsignarBodega = lazy(() => import("./pages/Usuarios/UsuarioAsignarBodega.jsx"));
const RolManagement = lazy(() => import("./pages/Roles/RolManagement"));
const RolDetail = lazy(() => import("./pages/Roles/RolDetail"));
const AsignarRoles = lazy(() => import("./pages/Roles/AsignarRoles"));

// ====== Inventarios ======
const Inventario = lazy(() => import("./pages/Inventario/Inventario"));
const InventarioDashboard = lazy(() => import("./pages/Inventario/InventarioDashboard"));


// ====== Solicitudes ======
const Solicitudes = lazy(() => import("./pages/Solicitudes/Solicitudes"));
const AddSolicitud = lazy(() => import("./pages/Solicitudes/AddSolicitud"));
const EditSolicitud = lazy(() => import("./pages/Solicitudes/EditSolicitud"));
const SolicitudDetail = lazy(() => import("./pages/Solicitudes/SolicitudDetail"));

// ====== Orden de Manufactura ======
const AsignarInsumos = lazy(() => import("./pages/Orden_de_Manufactura/AsignarInsumos"));
const AsignarInsumosPVA = lazy(() => import("./pages/Orden_de_Manufactura/AsignarInsumosPVA"));
const EjecutarPasos = lazy(() => import("./pages/Orden_de_Manufactura/EjecutarPasos"));
const OMList = lazy(() => import("./pages/Orden_de_Manufactura/OMList"));
const ProduccionDashboard = lazy(() => import("./pages/Orden_de_Manufactura/ProduccionDashboard"));
const AddOM = lazy(() => import("./pages/Orden_de_Manufactura/AddOM"));
const OMDetail = lazy(() => import("./pages/Orden_de_Manufactura/OMDetail"));

// ====== Clientes ======
const ClientesPage = lazy(() => import("./pages/Clientes/Clientes.jsx"));
const AddClientes = lazy(() => import("./pages/Clientes/AddClientes.jsx"));
const ConsumoGeminiPage = lazy(() => import("./pages/Administracion/ConsumoGeminiPage.jsx"));
const EditClientes = lazy(() => import("./pages/Clientes/ClienteEdit.jsx"));
const ClienteDetail = lazy(() => import("./pages/Clientes/ClienteDetail.jsx"));

// ====== Ventas ======
const VentasDashboard = lazy(() => import("./pages/Ventas/VentasDashboard"));
const OrdenesVentaPage = lazy(() => import("./pages/Ventas/OrdenesVentaPage"));
const ColaIAPage = lazy(() => import("./pages/Ventas/ColaIAPage"));
const AddOrdenVenta = lazy(() => import("./pages/Ventas/AddOrdenVenta"));
const EditOrdenVenta = lazy(() => import("./pages/Ventas/EditOrdenVenta"));
const OrdenVentaDetail = lazy(() => import("./pages/Ventas/OrdenVentaDetail"));
const ListasPrecioPage = lazy(() => import("./pages/ListasPrecio/ListasPrecioPage"));
const AddListaPrecio = lazy(() => import("./pages/ListasPrecio/AddListaPrecio"));
const ListaPrecioDetail = lazy(() => import("./pages/ListasPrecio/ListaPrecioDetail"));
const ListaPrecioEdit = lazy(() => import("./pages/ListasPrecio/ListaPrecioEdit"));
const LotesList = lazy(() => import("./pages/Lotes/LotesList.jsx"));
const LoteDetail = lazy(() => import("./pages/Lotes/LotesDetail.jsx"));
const LoteProductoFinalDetail = lazy(() => import("./pages/Lotes/LoteProductoFinalDetail.jsx"));

const LogisticaDashboard = lazy(() => import("./pages/Logistica/LogisticaDashboard"));
const AsignarVenta = lazy(() => import("./pages/Ventas/AsignarVenta.jsx"));
const ResumenAsignacionVenta = lazy(() => import("./pages/Ventas/ResumenAsignacionVenta.jsx"));

const InventarioBultos = lazy(() => import("./pages/Inventario/InventarioBultos.jsx"));
const SesionesInventariado = lazy(() => import("./pages/Inventario/SesionesInventariado.jsx"));
const SesionInventariadoDetail = lazy(() => import("./pages/Inventario/SesionInventariadoDetail.jsx"));
const EditarBulto = lazy(() => import("./pages/Inventario/EditarBulto.jsx"));
const UsuariosEdit = lazy(() => import("./pages/Usuarios/UsuariosEdit.jsx"));
const CambiarContrasena = lazy(() => import("./pages/Usuarios/CambiarContrasena.jsx"));

// ====== Jumpseller ======
const OrdenVentaJumpseller = lazy(() => import("./pages/Jumpseller/AddOrdenJumpseller"));

// ====== Excel ======
const OrdenVentaExcel = lazy(() => import("./pages/Excel/AddExcel"));

const FacturasIA = lazy(() => import('./pages/Facturas_IA/facturas.jsx'));
const BandejaSII = lazy(() => import('./pages/Ventas/BandejaSII.jsx'));
const BandejaDTEEmitidos = lazy(() => import('./pages/Ventas/BandejaDTEEmitidos.jsx'));
// ====== PVA ======
const AddProcesoValorAgregado = lazy(() => import("./pages/ProcesosValorAgregado/AddProcesoValorAgregado.jsx"));
const ProcesosValorAgregado = lazy(() => import("./pages/ProcesosValorAgregado/ProcesosValorAgregado.jsx"));
const DetailProcesoValorAgregado = lazy(() => import("./pages/ProcesosValorAgregado/DetailProcesoValorAgregado.jsx"));
const EditProcesoValorAgregado = lazy(() => import("./pages/ProcesosValorAgregado/EditProcesoValorAgregado.jsx"));
const DeleteProcesoValorAgregado = lazy(() => import("./pages/ProcesosValorAgregado/DeleteProcesoValorAgregado.jsx"));
const PVAPorProducto = lazy(() => import("./pages/PVAProducto/PVAPorProducto.jsx"));
const AddPVAPorProducto = lazy(() => import("./pages/PVAProducto/AddPVAPorProducto.jsx"));
const EditPVAPorProducto = lazy(() => import("./pages/PVAProducto/EditPVAPorProducto.jsx"));
const EjecutarPasosPVA = lazy(() => import("./pages/Orden_de_Manufactura/EjecutarPasosPVA.jsx"));
const DetailPVAPorProducto = lazy(() => import("./pages/PVAProducto/DetailPVAPorProducto.jsx"));
const GenerarQR = lazy(() => import("./pages/GenerarQR/GenerarQR.jsx"));

// ====== Wizards (admin) ======
const CreatePipWizard = lazy(() => import("./pages/PIP/CreatePipWizard.jsx"));
const CreateProductoWizard = lazy(() => import("./pages/Productos/CreateProductoWizard.jsx"));
const CostosIndirectos = lazy(() => import("./pages/CostosIndirectos/CostosIndirectos.jsx"));
const NombresFacturacion = lazy(() => import("./pages/NombresFacturacion/NombresFacturacion.jsx"));

// ====== Calidad ======
const CalidadDashboard = lazy(() => import("./pages/calidad/CalidadDashboard.jsx"));
const NoConformidades = lazy(() => import("./pages/calidad/NoConformidades.jsx"));
const FormulariosList = lazy(() => import("./pages/calidad/FormulariosList.jsx"));
const FormularioBuilder = lazy(() => import("./pages/calidad/FormularioBuilder.jsx"));
const FormularioEdit = lazy(() => import("./pages/calidad/FormularioEdit.jsx"));
const CompletarFormulario = lazy(() => import("./pages/calidad/CompletarFormulario.jsx"));
const RespuestasList = lazy(() => import("./pages/calidad/RespuestasList.jsx"));
const RespuestaDetail = lazy(() => import("./pages/calidad/RespuestaDetail.jsx"));
const AprobacionFormularios = lazy(() => import("./pages/calidad/AprobacionFormularios.jsx"));
const AprobacionDetail = lazy(() => import("./pages/calidad/AprobacionDetail.jsx"));
const POEsList = lazy(() => import("./pages/calidad/POEsList.jsx"));

// ===== Olvidar Contraseña =====
const ForgotPassword = lazy(() => import("./pages/OlvidarContrasena/ForgotPassword.jsx"));
const VerifyResetCode = lazy(() => import("./pages/OlvidarContrasena/VerifyCode.jsx"));
const ResetPassword = lazy(() => import("./pages/OlvidarContrasena/ResetPassword.jsx"));

// ==== ProtectedRoute ====
import ProtectedRoute from "./components/ProtectedRoute/ProtectedRoute.jsx";
import { ModelType, ScopeType } from "./services/scopeCheck.js";

function Routing() {

  return (
    <BrowserRouter>
      {/* Cada vista baja en su propio trozo. Antes toda la app —jsPDF, html2canvas, el
          visor de PDF— viajaba antes de pintar el login. */}
      <Suspense fallback={<CargandoVista />}>
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

          {/* /Pallets y /Pallets/dashboard eliminadas el 2026-08-01. El seguimiento de
              pallets vive en el detalle de la solicitud, que es donde está el contexto: ahí
              se ven, se descargan sus etiquetas y se sabe qué llevan. */}

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
      </Suspense>
    </BrowserRouter>
  );
}

export default Routing;
