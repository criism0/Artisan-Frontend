import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../lib/api", () => ({
  API_BASE: "http://localhost:3000",
  getToken: vi.fn(() => "fake-token"),
}));

vi.mock("../../lib/toast", () => ({
  toast: { error: vi.fn() },
}));

import {
  buildOcEmailItemsFromOrden,
  sendTransactionalEmail,
  notifyOrderChange,
} from "../emailService";
import { getToken } from "../../lib/api";
import { toast } from "../../lib/toast";

// Réplica del formatter usado por emailService: matchea byte-exacto el output
// (incluye NBSP que Intl inserta entre símbolo y número en es-CL).
const clpFmt = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
}).format;

// ─── buildOcEmailItemsFromOrden ──────────────────────────────────────
describe("buildOcEmailItemsFromOrden", () => {
  it("construye items con nombre, cantidad, precio y valor neto", () => {
    const orden = {
      materiasPrimas: [
        {
          proveedorMateriaPrima: {
            formato: "Saco 25kg",
            materiaPrima: { nombre: "Harina" },
          },
          cantidad_formato: 10,
          precio_unitario: 5000,
        },
      ],
    };

    const result = buildOcEmailItemsFromOrden(orden);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].nombreCompleto).toBe("Saco 25kg - Harina");
    expect(result.items[0].cantidad).toBe("10");
    expect(result.items[0].precioUnitario).toBe(clpFmt(5000));
    expect(result.items[0].valorNeto).toBe(clpFmt(50000));
  });

  it("calcula totalNeto, IVA (19%) y totalPago correctamente", () => {
    const orden = {
      materiasPrimas: [
        {
          proveedorMateriaPrima: {
            formato: "Unidad",
            materiaPrima: { nombre: "Sal" },
          },
          cantidad_formato: 2,
          precio_unitario: 1000,
        },
        {
          proveedorMateriaPrima: {
            formato: "Bolsa",
            materiaPrima: { nombre: "Azúcar" },
          },
          cantidad_formato: 3,
          precio_unitario: 2000,
        },
      ],
    };

    const result = buildOcEmailItemsFromOrden(orden);

    // totalNeto = (2*1000) + (3*2000) = 8000, IVA = 1520, totalPago = 9520
    expect(result.totalNeto).toBe(clpFmt(8000));
    expect(result.iva).toBe(clpFmt(1520));
    expect(result.totalPago).toBe(clpFmt(9520));
  });

  it("maneja un solo item y verifica aritmética exacta", () => {
    const orden = {
      materiasPrimas: [
        {
          proveedorMateriaPrima: {
            formato: "Caja",
            materiaPrima: { nombre: "Levadura" },
          },
          cantidad_formato: 100,
          precio_unitario: 350,
        },
      ],
    };

    const result = buildOcEmailItemsFromOrden(orden);

    // valorNeto = 100 * 350 = 35000, IVA = 6650, totalPago = 41650
    expect(result.items[0].valorNeto).toBe(clpFmt(35000));
    expect(result.totalNeto).toBe(clpFmt(35000));
    expect(result.iva).toBe(clpFmt(6650));
    expect(result.totalPago).toBe(clpFmt(41650));
  });

  // --- Fallbacks de nombre ---
  it("usa mp.formato como fallback si proveedorMateriaPrima.formato no existe", () => {
    const orden = {
      materiasPrimas: [
        {
          proveedorMateriaPrima: {
            materiaPrima: { nombre: "Aceite" },
            // sin formato aquí
          },
          formato: "Bidón 20L", // fallback
          cantidad_formato: 1,
          precio_unitario: 100,
        },
      ],
    };

    const result = buildOcEmailItemsFromOrden(orden);
    expect(result.items[0].nombreCompleto).toBe("Bidón 20L - Aceite");
  });

  it("usa '—' si no hay formato en ningún nivel", () => {
    const orden = {
      materiasPrimas: [
        {
          proveedorMateriaPrima: {
            materiaPrima: { nombre: "Test" },
          },
          cantidad_formato: 1,
          precio_unitario: 100,
        },
      ],
    };

    const result = buildOcEmailItemsFromOrden(orden);
    expect(result.items[0].nombreCompleto).toBe("— - Test");
  });

  it("usa MateriaPrima (M mayúscula) como fallback de nombre", () => {
    const orden = {
      materiasPrimas: [
        {
          proveedorMateriaPrima: {
            formato: "Caja",
            // materiaPrima no existe, pero MateriaPrima sí
            MateriaPrima: { nombre: "Colorante" },
          },
          cantidad_formato: 1,
          precio_unitario: 500,
        },
      ],
    };

    const result = buildOcEmailItemsFromOrden(orden);
    expect(result.items[0].nombreCompleto).toBe("Caja - Colorante");
  });

  it("usa fallback 'MP #ID' si no hay nombre en ninguna variante", () => {
    const orden = {
      materiasPrimas: [
        {
          proveedorMateriaPrima: {},
          id_proveedor_materia_prima: 42,
          cantidad_formato: 1,
          precio_unitario: 100,
        },
      ],
    };

    const result = buildOcEmailItemsFromOrden(orden);
    expect(result.items[0].nombreCompleto).toContain("MP #42");
  });

  it("usa 'Insumo' si no hay nombre ni id_proveedor_materia_prima", () => {
    const orden = {
      materiasPrimas: [
        {
          proveedorMateriaPrima: {},
          cantidad_formato: 1,
          precio_unitario: 100,
        },
      ],
    };

    const result = buildOcEmailItemsFromOrden(orden);
    expect(result.items[0].nombreCompleto).toContain("Insumo");
  });

  // --- Fallbacks de cantidad ---
  it("usa mp.cantidad como fallback si cantidad_formato no existe", () => {
    const orden = {
      materiasPrimas: [
        {
          proveedorMateriaPrima: {
            formato: "Unidad",
            materiaPrima: { nombre: "Test" },
          },
          cantidad: 7, // fallback
          precio_unitario: 1000,
        },
      ],
    };

    const result = buildOcEmailItemsFromOrden(orden);
    expect(result.items[0].cantidad).toBe("7");
    expect(result.items[0].valorNeto).toBe(clpFmt(7000));
  });

  it("usa 0 si no hay cantidad_formato ni cantidad", () => {
    const orden = {
      materiasPrimas: [
        {
          proveedorMateriaPrima: {
            formato: "Unidad",
            materiaPrima: { nombre: "Test" },
          },
          precio_unitario: 1000,
        },
      ],
    };

    const result = buildOcEmailItemsFromOrden(orden);
    expect(result.items[0].cantidad).toBe("0");
    expect(result.items[0].valorNeto).toBe(clpFmt(0));
  });

  // --- Inputs inválidos ---
  it("retorna items vacío y totales $0 si ordenData no tiene materiasPrimas", () => {
    const result = buildOcEmailItemsFromOrden({});
    expect(result.items).toEqual([]);
    expect(result.totalNeto).toBe(clpFmt(0));
    expect(result.iva).toBe(clpFmt(0));
    expect(result.totalPago).toBe(clpFmt(0));
  });

  it("maneja materiasPrimas como string (no array) → items vacío", () => {
    const result = buildOcEmailItemsFromOrden({ materiasPrimas: "invalid" });
    expect(result.items).toEqual([]);
  });

  it("maneja materiasPrimas como null → items vacío", () => {
    const result = buildOcEmailItemsFromOrden({ materiasPrimas: null });
    expect(result.items).toEqual([]);
  });

  it("precio_unitario faltante se trata como 0", () => {
    const orden = {
      materiasPrimas: [
        {
          proveedorMateriaPrima: {
            formato: "Kg",
            materiaPrima: { nombre: "Agua" },
          },
          cantidad_formato: 100,
          // sin precio_unitario
        },
      ],
    };

    const result = buildOcEmailItemsFromOrden(orden);
    expect(result.items[0].valorNeto).toBe(clpFmt(0));
    expect(result.totalNeto).toBe(clpFmt(0));
  });

  // --- Muchos items: verifica acumulación ---
  it("acumula totalNeto correctamente con múltiples items", () => {
    const orden = {
      materiasPrimas: [
        {
          proveedorMateriaPrima: { formato: "U", materiaPrima: { nombre: "A" } },
          cantidad_formato: 1,
          precio_unitario: 1000,
        },
        {
          proveedorMateriaPrima: { formato: "U", materiaPrima: { nombre: "B" } },
          cantidad_formato: 1,
          precio_unitario: 2000,
        },
        {
          proveedorMateriaPrima: { formato: "U", materiaPrima: { nombre: "C" } },
          cantidad_formato: 1,
          precio_unitario: 3000,
        },
      ],
    };

    const result = buildOcEmailItemsFromOrden(orden);
    expect(result.items).toHaveLength(3);
    // totalNeto = 6000, IVA = 1140, totalPago = 7140
    expect(result.totalNeto).toBe(clpFmt(6000));
    expect(result.iva).toBe(clpFmt(1140));
    expect(result.totalPago).toBe(clpFmt(7140));
  });
});

// ─── sendTransactionalEmail ──────────────────────────────────────────
describe("sendTransactionalEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getToken.mockReturnValue("fake-token");
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("envía POST a /email/send-transactional con payload correcto", async () => {
    fetch.mockResolvedValue({ ok: true, text: async () => "" });

    await sendTransactionalEmail({
      to: [{ email: "a@b.cl" }],
      subject: "Asunto",
      params: { foo: "bar" },
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("http://localhost:3000/email/send-transactional");
    expect(init.method).toBe("POST");

    const body = JSON.parse(init.body);
    expect(body).toEqual({
      to: [{ email: "a@b.cl" }],
      subject: "Asunto",
      params: { foo: "bar" },
      templateId: 2,
    });
  });

  it("agrega Authorization Bearer cuando hay token", async () => {
    getToken.mockReturnValue("tok-abc");
    fetch.mockResolvedValue({ ok: true, text: async () => "" });

    await sendTransactionalEmail({ to: [], subject: "x", params: {} });

    const init = fetch.mock.calls[0][1];
    expect(init.headers.get("Authorization")).toBe("Bearer tok-abc");
    expect(init.headers.get("Content-Type")).toBe("application/json");
  });

  it("NO agrega Authorization cuando no hay token", async () => {
    getToken.mockReturnValue(null);
    fetch.mockResolvedValue({ ok: true, text: async () => "" });

    await sendTransactionalEmail({ to: [], subject: "x", params: {} });

    const init = fetch.mock.calls[0][1];
    expect(init.headers.get("Authorization")).toBeNull();
  });

  it("captura errores de respuesta no-ok y llama a toast.error (no throw)", async () => {
    fetch.mockResolvedValue({ ok: false, text: async () => "Server exploded" });

    await expect(
      sendTransactionalEmail({ to: [], subject: "x", params: {} })
    ).resolves.toBeUndefined();

    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.error.mock.calls[0][0]).toMatch(/Error al enviar correo/);
  });

  it("captura errores de red (fetch lanza) y llama a toast.error", async () => {
    fetch.mockRejectedValue(new Error("Network down"));

    await expect(
      sendTransactionalEmail({ to: [], subject: "x", params: {} })
    ).resolves.toBeUndefined();

    expect(toast.error).toHaveBeenCalledTimes(1);
  });
});

// ─── notifyOrderChange ───────────────────────────────────────────────
describe("notifyOrderChange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getToken.mockReturnValue("fake-token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => "" }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("construye subject 'Orden ID - Estado: STATE' y mapea emails a [{email}]", async () => {
    await notifyOrderChange({
      emails: ["a@b.cl", "c@d.cl"],
      ordenId: 42,
      operador: "Sergio",
      state: "Validada",
      bodega: "Bodega Norte",
      proveedor: "Proveedor X",
      clientNames: "Cliente A",
      items: [{ nombreCompleto: "Saco - Harina" }],
      totalNeto: "$10.000",
      iva: "$1.900",
      totalPago: "$11.900",
    });

    const init = fetch.mock.calls[0][1];
    const body = JSON.parse(init.body);

    expect(body.subject).toBe("Orden 42 - Estado: Validada");
    expect(body.to).toEqual([{ email: "a@b.cl" }, { email: "c@d.cl" }]);
    expect(body.params.oc_id).toBe(42);
    expect(body.params.operador).toBe("Sergio");
    expect(body.params.state).toBe("Validada");
    expect(body.params.name).toBe("Bodega Norte");
    expect(body.params.prov).toBe("Proveedor X");
    expect(body.params.clientNames).toBe("Cliente A");
    expect(body.params.items).toEqual([{ nombreCompleto: "Saco - Harina" }]);
    expect(body.params.totalNeto).toBe("$10.000");
    expect(body.params.iva).toBe("$1.900");
    expect(body.params.totalPago).toBe("$11.900");
    expect(typeof body.params.date).toBe("string");
  });

  it("usa 'No especificado' cuando proveedor es falsy", async () => {
    await notifyOrderChange({
      emails: ["a@b.cl"],
      ordenId: 1,
      state: "x",
      proveedor: null,
    });

    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.params.prov).toBe("No especificado");
  });

  it("usa items=[] cuando items no es array", async () => {
    await notifyOrderChange({
      emails: ["a@b.cl"],
      ordenId: 1,
      state: "x",
      items: "not-an-array",
    });

    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.params.items).toEqual([]);
  });

  it("usa fallback '$0' para totalNeto/iva/totalPago si vienen falsy", async () => {
    await notifyOrderChange({
      emails: ["a@b.cl"],
      ordenId: 1,
      state: "x",
    });

    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.params.totalNeto).toBe("$0");
    expect(body.params.iva).toBe("$0");
    expect(body.params.totalPago).toBe("$0");
  });

  it("captura errores y los loguea con console.error sin propagar", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // Forzamos error desde dentro: emails no es array → emails.map lanza
    await expect(
      notifyOrderChange({
        emails: null,
        ordenId: 1,
        state: "x",
      })
    ).resolves.toBeUndefined();

    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
