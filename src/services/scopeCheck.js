import { getToken } from "../lib/api.js";
import { jwtDecode } from "jwt-decode";

// Para usar esta utilidad, se debe:

// Importarlo:
// import { checkScope, ModelType, ScopeType } from "../services/scopeCheck";

// Llamarlo usando:
// checkScope(ModelType.TO_AFFECT, ScopeType.PERMITS);
// Donde TO_AFFECT es aquello que se quiere modificar/eliminar/crear/leer
// Y PERMITS es aquello que se quiere realizar especificamente

/**
 * Enum for Model Types (resources/entities)
 * These correspond to the entities in the system
 * Note: Model type names must match exactly what's in the JWT token scopes object
 */
export const ModelType = {
  USUARIO: "Usuario",
  ROLE: "Role",
  CANAL: "Canal",
  INVENTARIO: "Inventario",
  BODEGA: "Bodega",
  BULTO: "Bulto",
  PALLET: "Pallet",
  REGISTRO_INSUMOS_PRODUCCION: "RegistroInsumosProduccion",
  REGISTRO_MERMAS: "RegistroMermas", // RUTA: /registro-mermas
  REGISTRO_PASO_PRODUCCION: "RegistroPasoProduccion",
  REGISTRO_SUBPRODUCTO: "RegistroSubproducto",
  ORDEN_MANUFACTURA: "OrdenManufactura",
  ORDEN_COMPRA: "OrdenCompra",
  ORDEN_VENTA: "OrdenVenta",
  PRODUCTO_ORDEN: "ProductoDeOrden",
  CLIENTE: "Cliente",
  LOCAL_CLIENTE: "LocalCliente",
  PROVEEDOR: "Proveedor",
  DIRECCION: "Direccion",
  LOTE_PRODUCTO_FINAL: "LoteProductoFinal",
  LOTE_PRODUCTO_EN_PROCESO: "LoteProductoEnProceso",
  RECETA: "Receta",
  INGREDIENTE_RECETA: "IngredienteReceta",
  PAUTA_ELABORACION: "PautaElaboracion",
  VALIDAR_ORDEN_VENTA: "ValidarOrdenVenta",
  SESION_INVENTARIADO: "SesionInventariado",
  PASO_PAUTA_ELABORACION: "PasoPautaElaboracion",
  MATERIA_PRIMA: "MateriaPrima",
  PROVEEDOR_MATERIA_PRIMA: "ProveedorMateriaPrima",
  CATEGORIA_MATERIA_PRIMA: "CategoriaMateriaPrima",
  LOTE_MATERIA_PRIMA: "LoteMateriaPrima",
  FORMULARIO_CALIDAD: "FormularioCalidad",
  RESPUESTA_FORMULARIO_CALIDAD: "RespuestaFormularioCalidad",
  COSTO_INDIRECTO: "CostoIndirecto",
  COSTO_MARGINAL: "CostoMarginal",
  DETALLE_SOLICITUD: "DetalleSolicitud", // RUTA: /detalles-solicitudes
  SOLICITUD_MERCADERIA: "SolicitudMercaderia",
  INSUMO_PVA_PRODUCTO: "InsumoPVAProducto",
  PAUTA_VALOR_AGREGADO: "PautaValorAgregado",
  PROCESO_VALOR_AGREGADO: "ProcesoValorAgregado",
  PASO_VALOR_AGREGADO: "PasoValorAgregado",
  PVA_PRODUCTO: "PVAPorProducto",
  REGISTRO_PASO_VALOR_AGREGADO: "RegistroPasoValorAgregado",
  ETIQUETA_MODELO: "EtiquetaModelo", // RUTA: /etiquetas-modelo
  LISTA_PRECIO: "ListaPrecio",
  PRODUCTO_BASE_LISTA_PRECIO: "ProductoBaseListaPrecio",
  PRODUCTO_BASE: "ProductoBase",
  NOMBRE_FACTURACION: "NombreFacturacion",
  POES: "Poes",
  OCR_FACTURA: "OCRFactura",
};
// Nota: Los ModelType para los cuales las rutas asociadas no estan siendo usadas
//       fueron marcados con un comentario, el cual contiene esa ruta

/**
 * Enum for Scope Types (actions)
 * These correspond to the actions that can be performed on resources
 * Note: Scope type names must match exactly what's in the JWT token scopes arrays
 */
export const ScopeType = {
  READ: "Read",
  WRITE: "Write",
  DELETE: "Delete",
};

// Fuente de verdad del usuario actual cuando la sesión vive en cookie httpOnly
// (el frontend no puede leer el JWT). AuthContext la sincroniza desde /auth/me.
let currentUser = null;

export function setCurrentUser(user) {
  currentUser = user || null;
}

/**
 * Decodes JWT token and returns user scopes
 * @param {string} token - JWT token
 * @returns {Object} Object where keys are model types and values are arrays of scope types
 * Example: { "Role": ["Read", "Write", "Delete"], "Usuario": ["Read"] }
 */
function getUserScopesFromToken(token) {
  try {
    if (!token) return {};
    const decoded = jwtDecode(token);
    // The JWT has scopes as an object: { "Role": ["Read", "Write"], ... }
    return decoded?.scopes ?? {};
  } catch (error) {
    console.error("Error decoding JWT token:", error);
    return {};
  }
}

/**
 * Gets the current user's scopes. Prefiere el usuario inyectado por AuthContext
 * (cookie httpOnly); cae al JWT en localStorage como compatibilidad / tests.
 */
export function getCurrentUserScopes() {
  if (currentUser?.scopes) return currentUser.scopes;
  const token = getToken();
  if (!token) return {};
  return getUserScopesFromToken(token);
}

export function getCurrentUserRole() {
  if (currentUser?.role) return currentUser.role;
  try {
    const token = getToken();
    if (!token) return null;
    const decoded = jwtDecode(token);
    return decoded?.role ?? null;
  } catch (error) {
    console.error("Error decoding JWT token role:", error);
    return null;
  }
}

export function isAdminOrSuperAdmin() {
  const role = getCurrentUserRole();
  return role === "Super Admin" || role === "Administrador";
}

/**
 * Checks if a user has a specific scope
 * @param {Object} userScopes - Object where keys are model types and values are arrays of scope types
 *                              Example: { "Role": ["Read", "Write"], "Usuario": ["Read"] }
 * @param {string} modelType - The model type (e.g., "Role", "Usuario", "OrdenCompra")
 * @param {string} scopeType - The scope type (e.g., "Read", "Write", "Create", "Delete")
 * @returns {boolean} True if user has the required scope
 */
export function hasScope(userScopes, modelType, scopeType) {
  // Handle null/undefined
  if (!userScopes || typeof userScopes !== "object") {
    return false;
  }

  const modelTypeKeys = Object.keys(userScopes);
  // Find matching model type
  const matchingModelType = modelTypeKeys.find(
    (key) => key.trim().toLowerCase() === modelType.toLowerCase()
  );

  if (!matchingModelType) {
    return false;
  }

  // Get the scope types array for this model type
  const scopeTypes = userScopes[matchingModelType];

  // Check if the required scope type is in the array
  return scopeTypes.some(
    (st) => st?.trim().toLowerCase() === scopeType.toLowerCase()
  );
}

/**
 * Checks if the current user has a specific scope
 * @param {string} modelType - The model type (e.g., ModelType.ROLE)
 * @param {string} scopeType - The scope type (e.g., ScopeType.READ)
 * @returns {boolean} True if user has the required scope
 */
export function checkScope(modelType, scopeType) {
  if (isAdminOrSuperAdmin()) return true; // Si es que es admin, se tienen todos los permisos

  const userScopes = getCurrentUserScopes();
  return hasScope(userScopes, modelType, scopeType);
}

/**
 * Checks if the current user has a group of scopes
 * @param {Array} permissions - The models and scopes to check (e.g, [[ModelType.ROLE, ScopeType.READ],])
 */
export default function checkScopes(permissions) {
  let isAllowed = true;
  for (let i = 0; i < permissions.length; i++) {
    isAllowed = checkScope(permissions[i][0], permissions[i][1]) && isAllowed;
  }
  return isAllowed;
}
