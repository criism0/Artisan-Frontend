import { getToken } from "../lib/api.js";
import { jwtDecode } from "jwt-decode";

/**
 * Enum for Model Types (resources/entities)
 * These correspond to the entities in the system
 * Note: Model type names must match exactly what's in the JWT token scopes object
 */
export const ModelType = {
  USUARIO: "Usuario",
  ROLE: "Role",
  INVENTARIO: "Inventario",
  BULTO: "Bulto",
  ORDEN_COMPRA: "OrdenCompra",
  ORDEN_VENTA: "OrdenVenta",
  CLIENTE: "Cliente",
  PROVEEDOR: "Proveedor",
  LOTE_PRODUCTO_FINAL: "LoteProductoFinal",
  PAUTA_ELABORACION: "PautaElaboracion",
  PASO_PAUTA_ELABORACION: "PasoPautaElaboracion",
};

/**
 * Enum for Scope Types (actions)
 * These correspond to the actions that can be performed on resources
 * Note: Scope type names must match exactly what's in the JWT token scopes arrays
 */
export const ScopeType = {
  READ: "Read",
  WRITE: "Write",
  CREATE: "Create",
  DELETE: "Delete",
};

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
 * Gets the current user's scopes from the stored token
 * @returns {Object} Object where keys are model types and values are arrays of scope types
 */
export function getCurrentUserScopes() {
  const token = getToken();
  if (!token) return {};
  return getUserScopesFromToken(token);
}

export function getCurrentUserRole() {
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
  const userScopes = getCurrentUserScopes();
  return hasScope(userScopes, modelType, scopeType);
}
