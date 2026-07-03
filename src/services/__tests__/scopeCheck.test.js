import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../lib/api.js", () => ({
  getToken: vi.fn(),
}));

import { getToken } from "../../lib/api.js";
import {
  ModelType,
  ScopeType,
  hasScope,
  getCurrentUserScopes,
  getCurrentUserRole,
  isAdminOrSuperAdmin,
  checkScope,
} from "../scopeCheck";

// Helper: crea un JWT fake (header.payload.signature)
function fakeJwt(payload) {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fakesig`;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Enums ───────────────────────────────────────────────────────────
describe("ModelType y ScopeType", () => {
  it("ModelType contiene todos los modelos del sistema", () => {
    expect(ModelType.USUARIO).toBe("Usuario");
    expect(ModelType.ROLE).toBe("Role");
    expect(ModelType.CANAL).toBe("Canal");
    expect(ModelType.INVENTARIO).toBe("Inventario");
    expect(ModelType.BODEGA).toBe("Bodega");
    expect(ModelType.BULTO).toBe("Bulto");
    expect(ModelType.PALLET).toBe("Pallet");
    expect(ModelType.REGISTRO_INSUMOS_PRODUCCION).toBe("RegistroInsumosProduccion");
    expect(ModelType.REGISTRO_MERMAS).toBe("RegistroMermas");
    expect(ModelType.REGISTRO_PASO_PRODUCCION).toBe("RegistroPasoProduccion");
    expect(ModelType.REGISTRO_SUBPRODUCTO).toBe("RegistroSubproducto");
    expect(ModelType.ORDEN_MANUFACTURA).toBe("OrdenManufactura");
    expect(ModelType.ORDEN_COMPRA).toBe("OrdenCompra");
    expect(ModelType.ORDEN_VENTA).toBe("OrdenVenta");
    expect(ModelType.PRODUCTO_ORDEN).toBe("ProductoDeOrden");
    expect(ModelType.CLIENTE).toBe("Cliente");
    expect(ModelType.LOCAL_CLIENTE).toBe("LocalCliente");
    expect(ModelType.PRECIO_CLIENTE).toBe("PrecioCliente");
    expect(ModelType.PROVEEDOR).toBe("Proveedor");
    expect(ModelType.DIRECCION).toBe("Direccion");
    expect(ModelType.LOTE_PRODUCTO_FINAL).toBe("LoteProductoFinal");
    expect(ModelType.LOTE_PRODUCTO_EN_PROCESO).toBe("LoteProductoEnProceso");
    expect(ModelType.RECETA).toBe("Receta");
    expect(ModelType.INGREDIENTE_RECETA).toBe("IngredienteReceta");
    expect(ModelType.PAUTA_ELABORACION).toBe("PautaElaboracion");
    expect(ModelType.PASO_PAUTA_ELABORACION).toBe("PasoPautaElaboracion");
    expect(ModelType.MATERIA_PRIMA).toBe("MateriaPrima");
    expect(ModelType.PROVEEDOR_MATERIA_PRIMA).toBe("ProveedorMateriaPrima");
    expect(ModelType.CATEGORIA_MATERIA_PRIMA).toBe("CategoriaMateriaPrima");
    expect(ModelType.LOTE_MATERIA_PRIMA).toBe("LoteMateriaPrima");
    expect(ModelType.FORMULARIO_CALIDAD).toBe("FormularioCalidad");
    expect(ModelType.RESPUESTA_FORMULARIO_CALIDAD).toBe("RespuestaFormularioCalidad");
    expect(ModelType.COSTO_INDIRECTO).toBe("CostoIndirecto");
    expect(ModelType.COSTO_MARGINAL).toBe("CostoMarginal");
    expect(ModelType.DETALLE_SOLICITUD).toBe("DetalleSolicitud");
    expect(ModelType.SOLICITUD_MERCADERIA).toBe("SolicitudMercaderia");
    expect(ModelType.INSUMO_PVA_PRODUCTO).toBe("InsumoPVAProducto");
    expect(ModelType.PAUTA_VALOR_AGREGADO).toBe("PautaValorAgregado");
    expect(ModelType.PROCESO_VALOR_AGREGADO).toBe("ProcesoValorAgregado");
    expect(ModelType.PASO_VALOR_AGREGADO).toBe("PasoValorAgregado");
    expect(ModelType.PVA_PRODUCTO).toBe("PVAPorProducto");
    expect(ModelType.REGISTRO_PASO_VALOR_AGREGADO).toBe("RegistroPasoValorAgregado");
    expect(ModelType.ETIQUETA_MODELO).toBe("EtiquetaModelo");
    expect(ModelType.LISTA_PRECIO).toBe("ListaPrecio");
    expect(ModelType.PRODUCTO_BASE_LISTA_PRECIO).toBe("ProductoBaseListaPrecio");
    expect(ModelType.PRODUCTO_BASE).toBe("ProductoBase");
    expect(ModelType.PREDICCION).toBe("Prediccion");
    expect(ModelType.OCR_FACTURA).toBe("OCRFactura");
  });

  it("ScopeType contiene las 3 acciones CRUD", () => {
    expect(ModelType.POES).toBe("Poes");
  });

  it("ScopeType contiene las 4 acciones CRUD", () => {
    expect(ScopeType.READ).toBe("Read");
    expect(ScopeType.WRITE).toBe("Write");
    expect(ScopeType.DELETE).toBe("Delete");
  });

  it("ModelType tiene exactamente 49 modelos", () => {
    expect(Object.keys(ModelType)).toHaveLength(49);
  });

  it("ScopeType tiene exactamente 3 acciones", () => {
    expect(Object.keys(ScopeType)).toHaveLength(3);
  });
});

// ─── hasScope ────────────────────────────────────────────────────────
describe("hasScope", () => {
  const scopes = {
    Role: ["Read", "Write", "Delete"],
    Usuario: ["Read"],
    OrdenCompra: ["Read"],
  };

  it("retorna true cuando modelo+acción existen", () => {
    expect(hasScope(scopes, "Role", "Read")).toBe(true);
    expect(hasScope(scopes, "Role", "Write")).toBe(true);
    expect(hasScope(scopes, "Role", "Delete")).toBe(true);
    expect(hasScope(scopes, "OrdenCompra", "Read")).toBe(true);
  });

  it("retorna false cuando la acción no existe para el modelo", () => {
    expect(hasScope(scopes, "Usuario", "Write")).toBe(false);
    expect(hasScope(scopes, "Usuario", "Delete")).toBe(false);
    expect(hasScope(scopes, "Inventario", "Read")).toBe(false);
  });

  it("retorna false para modelo inexistente", () => {
    expect(hasScope(scopes, "Inexistente", "Read")).toBe(false);
    expect(hasScope(scopes, "", "Read")).toBe(false);
  });

  // Inputs inválidos
  it("retorna false para null, undefined, y no-objetos", () => {
    expect(hasScope(null, "Role", "Read")).toBe(false);
    expect(hasScope(undefined, "Role", "Read")).toBe(false);
    expect(hasScope("string", "Role", "Read")).toBe(false);
    expect(hasScope(123, "Role", "Read")).toBe(false);
    expect(hasScope(true, "Role", "Read")).toBe(false);
  });

  // Case-insensitive
  it("comparación case-insensitive en modelo y acción", () => {
    expect(hasScope(scopes, "role", "read")).toBe(true);
    expect(hasScope(scopes, "ROLE", "WRITE")).toBe(true);
    expect(hasScope(scopes, "usuario", "READ")).toBe(true);
    expect(hasScope(scopes, "ordencompra", "ReaD")).toBe(true);
  });

  // Whitespace tolerance
  it("tolera espacios en blanco en las keys del JWT", () => {
    const scopesConEspacios = { " Role ": ["Read"] };
    expect(hasScope(scopesConEspacios, "Role", "Read")).toBe(true);
  });

  it("tolera espacios en los scope types del JWT", () => {
    const scopesConEspacios = { Role: [" Read "] };
    expect(hasScope(scopesConEspacios, "Role", "Read")).toBe(true);
  });

  // Edge case: array como userScopes (typeof [] === "object")
  it("array pasa el typeof check pero no matchea modelos", () => {
    // Un array es typeof "object", pero Object.keys devuelve índices
    const resultado = hasScope(["Read"], "Role", "Read");
    expect(resultado).toBe(false);
  });

  // Edge case: scopes vacío
  it("objeto vacío retorna false para cualquier scope", () => {
    expect(hasScope({}, "Role", "Read")).toBe(false);
  });

  // Edge case: array de scopes vacío para un modelo
  it("array de scopes vacío para un modelo → false", () => {
    expect(hasScope({ Role: [] }, "Role", "Read")).toBe(false);
  });
});

// ─── getCurrentUserScopes ────────────────────────────────────────────
describe("getCurrentUserScopes", () => {
  it("decodifica scopes del JWT almacenado", () => {
    const token = fakeJwt({
      scopes: { Role: ["Read", "Write"], Usuario: ["Read"] },
    });
    getToken.mockReturnValue(token);

    const scopes = getCurrentUserScopes();
    expect(scopes).toEqual({
      Role: ["Read", "Write"],
      Usuario: ["Read"],
    });
  });

  it("retorna {} si no hay token", () => {
    getToken.mockReturnValue(null);
    expect(getCurrentUserScopes()).toEqual({});
  });

  it("retorna {} si token es string vacío", () => {
    getToken.mockReturnValue("");
    expect(getCurrentUserScopes()).toEqual({});
  });

  it("retorna {} si JWT no tiene campo scopes", () => {
    getToken.mockReturnValue(fakeJwt({ role: "Admin" }));
    expect(getCurrentUserScopes()).toEqual({});
  });

  it("retorna {} si JWT es malformado (no crashea)", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    getToken.mockReturnValue("no-es-un-jwt-valido");
    expect(getCurrentUserScopes()).toEqual({});
    errSpy.mockRestore();
  });
});

// ─── getCurrentUserRole ──────────────────────────────────────────────
describe("getCurrentUserRole", () => {
  it("extrae el rol del JWT", () => {
    getToken.mockReturnValue(fakeJwt({ role: "Administrador" }));
    expect(getCurrentUserRole()).toBe("Administrador");
  });

  it("retorna null si no hay token", () => {
    getToken.mockReturnValue(null);
    expect(getCurrentUserRole()).toBeNull();
  });

  it("retorna null si JWT no tiene role", () => {
    getToken.mockReturnValue(fakeJwt({ scopes: {} }));
    expect(getCurrentUserRole()).toBeNull();
  });

  it("retorna null si JWT es malformado (no crashea)", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    getToken.mockReturnValue("basura.total");
    expect(getCurrentUserRole()).toBeNull();
    errSpy.mockRestore();
  });
});

// ─── isAdminOrSuperAdmin ─────────────────────────────────────────────
describe("isAdminOrSuperAdmin", () => {
  it("true para 'Administrador'", () => {
    getToken.mockReturnValue(fakeJwt({ role: "Administrador" }));
    expect(isAdminOrSuperAdmin()).toBe(true);
  });

  it("true para 'Super Admin'", () => {
    getToken.mockReturnValue(fakeJwt({ role: "Super Admin" }));
    expect(isAdminOrSuperAdmin()).toBe(true);
  });

  it("false para 'Operador'", () => {
    getToken.mockReturnValue(fakeJwt({ role: "Operador" }));
    expect(isAdminOrSuperAdmin()).toBe(false);
  });

  it("false para 'administrador' (case-sensitive)", () => {
    // La función compara con ===, no es case-insensitive
    getToken.mockReturnValue(fakeJwt({ role: "administrador" }));
    expect(isAdminOrSuperAdmin()).toBe(false);
  });

  it("false si no hay token", () => {
    getToken.mockReturnValue(null);
    expect(isAdminOrSuperAdmin()).toBe(false);
  });

  it("false para role vacío", () => {
    getToken.mockReturnValue(fakeJwt({ role: "" }));
    expect(isAdminOrSuperAdmin()).toBe(false);
  });
});

// ─── checkScope (integración con getCurrentUserScopes + hasScope) ────
describe("checkScope", () => {
  it("verifica scope completo del usuario actual", () => {
    const token = fakeJwt({
      scopes: {
        Role: ["Read", "Write"],
        Usuario: ["Read"],
      },
    });
    getToken.mockReturnValue(token);

    expect(checkScope(ModelType.ROLE, ScopeType.READ)).toBe(true);
    expect(checkScope(ModelType.ROLE, ScopeType.WRITE)).toBe(true);
    expect(checkScope(ModelType.ROLE, ScopeType.DELETE)).toBe(false);
    expect(checkScope(ModelType.USUARIO, ScopeType.READ)).toBe(true);
    expect(checkScope(ModelType.USUARIO, ScopeType.WRITE)).toBe(false);
    expect(checkScope(ModelType.ORDEN_COMPRA, ScopeType.READ)).toBe(false);
  });

  it("retorna false si no hay token", () => {
    getToken.mockReturnValue(null);
    expect(checkScope(ModelType.ROLE, ScopeType.READ)).toBe(false);
  });

  it("funciona con todos los ModelType del enum", () => {
    const allScopes = {};
    Object.values(ModelType).forEach((model) => {
      allScopes[model] = ["Read"];
    });
    getToken.mockReturnValue(fakeJwt({ scopes: allScopes }));

    // Todos deberían tener Read
    Object.values(ModelType).forEach((model) => {
      expect(checkScope(model, ScopeType.READ)).toBe(true);
      expect(checkScope(model, ScopeType.DELETE)).toBe(false);
    });
  });
});

// ─── checkScope para Administradores ──────────────────────────────────
describe("checkScope para administradores", () => {
  it("devuelve true si el usuario es Administrador aunque no tenga scopes", () => {
    getToken.mockReturnValue(
      fakeJwt({
        role: "Administrador",
        scopes: {
          Role: [],
          Usuario: [],
        },
      })
    );

    expect(checkScope(ModelType.ROLE, ScopeType.DELETE)).toBe(true);
    expect(checkScope(ModelType.USUARIO, ScopeType.WRITE)).toBe(true);
  });

  it("devuelve true si el usuario es Super Admin aunque no tenga scopes", () => {
    getToken.mockReturnValue(
      fakeJwt({
        role: "Super Admin",
        scopes: {
          Role: [],
          Usuario: [],
        },
      })
    );

    expect(checkScope(ModelType.ROLE, ScopeType.DELETE)).toBe(true);
    expect(checkScope(ModelType.USUARIO, ScopeType.WRITE)).toBe(true);
  });
});
