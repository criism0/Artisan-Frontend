import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  loadRolePermissions,
  translateScopeType,
  translateModelType,
} from "../permissionUtils";

// ─── localStorage stub ───────────────────────────────────────────────
function createStorageStub() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    _store: store,
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", createStorageStub());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ─── hasPermission ───────────────────────────────────────────────────
describe("hasPermission", () => {
  it("admin tiene todos los permisos sin consultar localStorage", () => {
    expect(hasPermission("admin", "cualquier_cosa")).toBe(true);
    expect(hasPermission("admin", "borrar_universo")).toBe(true);
  });

  it("retorna true si el rol tiene el permiso en localStorage", () => {
    localStorage.setItem("role_operador", "leer,escribir,aprobar");
    expect(hasPermission("operador", "leer")).toBe(true);
    expect(hasPermission("operador", "aprobar")).toBe(true);
  });

  it("retorna false si el permiso no está en la lista del rol", () => {
    localStorage.setItem("role_operador", "leer,escribir");
    expect(hasPermission("operador", "borrar")).toBe(false);
  });

  it("retorna false si el rol no existe en localStorage", () => {
    expect(hasPermission("rol_inexistente", "leer")).toBe(false);
  });

  it("trimea espacios alrededor de los permisos almacenados", () => {
    localStorage.setItem("role_operador", " leer , escribir , aprobar ");
    expect(hasPermission("operador", "leer")).toBe(true);
    expect(hasPermission("operador", "escribir")).toBe(true);
    expect(hasPermission("operador", "aprobar")).toBe(true);
  });

  it("comparación de permisos es case-sensitive", () => {
    localStorage.setItem("role_operador", "Leer");
    expect(hasPermission("operador", "leer")).toBe(false);
    expect(hasPermission("operador", "Leer")).toBe(true);
  });
});

// ─── hasAnyPermission ────────────────────────────────────────────────
describe("hasAnyPermission", () => {
  it("true si tiene al menos uno de los permisos solicitados", () => {
    localStorage.setItem("role_operador", "leer,escribir");
    expect(hasAnyPermission("operador", ["borrar", "leer"])).toBe(true);
  });

  it("false si no tiene ninguno", () => {
    localStorage.setItem("role_operador", "leer");
    expect(hasAnyPermission("operador", ["borrar", "aprobar"])).toBe(false);
  });

  it("admin siempre retorna true", () => {
    expect(hasAnyPermission("admin", ["x", "y", "z"])).toBe(true);
  });

  it("array vacío de permisos → false (some([]) es false)", () => {
    localStorage.setItem("role_operador", "leer");
    expect(hasAnyPermission("operador", [])).toBe(false);
  });
});

// ─── hasAllPermissions ───────────────────────────────────────────────
describe("hasAllPermissions", () => {
  it("true si tiene todos los permisos solicitados", () => {
    localStorage.setItem("role_operador", "leer,escribir,aprobar");
    expect(hasAllPermissions("operador", ["leer", "escribir"])).toBe(true);
  });

  it("false si falta alguno", () => {
    localStorage.setItem("role_operador", "leer,escribir");
    expect(hasAllPermissions("operador", ["leer", "borrar"])).toBe(false);
  });

  it("admin siempre retorna true", () => {
    expect(hasAllPermissions("admin", ["x", "y", "z"])).toBe(true);
  });

  it("array vacío de permisos → true (every([]) es true)", () => {
    expect(hasAllPermissions("operador", [])).toBe(true);
  });
});

// ─── loadRolePermissions ─────────────────────────────────────────────
describe("loadRolePermissions", () => {
  it("guarda permisos en localStorage y retorna array", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => [
          { name: "operador", description: "leer,escribir,aprobar" },
          { name: "viewer", description: "leer" },
        ],
      }))
    );

    const result = await loadRolePermissions("operador");
    expect(result).toEqual(["leer", "escribir", "aprobar"]);
    expect(localStorage.getItem("role_operador")).toBe("leer,escribir,aprobar");
  });

  it("retorna [] si el rol no existe en la respuesta", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => [{ name: "viewer", description: "leer" }],
      }))
    );

    const result = await loadRolePermissions("rol_no_existe");
    expect(result).toEqual([]);
    expect(localStorage.getItem("role_rol_no_existe")).toBeNull();
  });

  it("captura errores de fetch y retorna [] sin crashear", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("Network down");
      })
    );

    const result = await loadRolePermissions("operador");
    expect(result).toEqual([]);
    expect(errSpy).toHaveBeenCalled();
  });

  it("trimea cada permiso de la descripción", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => [{ name: "operador", description: " leer , escribir " }],
      }))
    );

    const result = await loadRolePermissions("operador");
    expect(result).toEqual(["leer", "escribir"]);
  });
});

// ─── translateScopeType ──────────────────────────────────────────────
describe("translateScopeType", () => {
  it("traduce los 3 tipos canónicos al español", () => {
    expect(translateScopeType("read")).toBe("Leer");
    expect(translateScopeType("write")).toBe("Crear");
    expect(translateScopeType("delete")).toBe("Borrar");
  });

  it("normaliza a minúscula antes de buscar", () => {
    expect(translateScopeType("READ")).toBe("Leer");
    expect(translateScopeType("Write")).toBe("Crear");
  });

  it("retorna el valor original si no hay traducción", () => {
    expect(translateScopeType("custom")).toBe("custom");
    expect(translateScopeType("create")).toBe("create");
  });

  it("maneja null/undefined sin crashear", () => {
    expect(translateScopeType(null)).toBeNull();
    expect(translateScopeType(undefined)).toBeUndefined();
  });
});

// ─── translateModelType ──────────────────────────────────────────────
describe("translateModelType", () => {
  it("traduce 'role' a 'Rol'", () => {
    expect(translateModelType("role")).toBe("Rol");
    expect(translateModelType("ROLE")).toBe("Rol");
    expect(translateModelType("Role")).toBe("Rol");
  });

  it("retorna el valor original si no hay traducción", () => {
    expect(translateModelType("Usuario")).toBe("Usuario");
    expect(translateModelType("OrdenCompra")).toBe("OrdenCompra");
  });

  it("maneja null/undefined sin crashear", () => {
    expect(translateModelType(null)).toBeNull();
    expect(translateModelType(undefined)).toBeUndefined();
  });
});
