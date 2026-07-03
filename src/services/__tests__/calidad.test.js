import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../lib/api", () => ({
  api: vi.fn(),
}));

import {
  listarFormularios,
  obtenerFormulario,
  crearFormulario,
  actualizarFormulario,
  toggleActivoFormulario,
  eliminarFormulario,
  listarRespuestas,
  crearRespuesta,
  obtenerRespuesta,
  actualizarRespuesta,
  eliminarRespuesta,
} from "../calidad";
import { api } from "../../lib/api";

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Formularios ─────────────────────────────────────────────────────
describe("listarFormularios", () => {
  it("llama a /calidad/formularios y desempaqueta arrays directos", async () => {
    api.mockResolvedValue([{ id: 1 }, { id: 2 }]);

    const result = await listarFormularios();

    expect(api).toHaveBeenCalledWith("/calidad/formularios");
    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("desempaqueta { data: [...] } cuando el backend envuelve", async () => {
    api.mockResolvedValue({ data: [{ id: 1 }] });
    const result = await listarFormularios();
    expect(result).toEqual([{ id: 1 }]);
  });

  it("retorna [] cuando la respuesta no es array ni { data: [] }", async () => {
    api.mockResolvedValue({ otro: "shape" });
    expect(await listarFormularios()).toEqual([]);
  });

  it("retorna [] cuando la respuesta es null/undefined", async () => {
    api.mockResolvedValue(null);
    expect(await listarFormularios()).toEqual([]);
    api.mockResolvedValue(undefined);
    expect(await listarFormularios()).toEqual([]);
  });
});

describe("obtenerFormulario", () => {
  it("llama a /calidad/formularios/:id y desempaqueta { data: {...} }", async () => {
    api.mockResolvedValue({ data: { id: 5, nombre: "F" } });

    const result = await obtenerFormulario(5);

    expect(api).toHaveBeenCalledWith("/calidad/formularios/5");
    expect(result).toEqual({ id: 5, nombre: "F" });
  });

  it("retorna la respuesta directa cuando NO está envuelta en { data }", async () => {
    api.mockResolvedValue({ id: 5, nombre: "F" });
    expect(await obtenerFormulario(5)).toEqual({ id: 5, nombre: "F" });
  });

  it("NO desempaqueta si data es array (es lista, no objeto único)", async () => {
    const wrapped = { data: [{ id: 1 }] };
    api.mockResolvedValue(wrapped);
    // Como data es array, retorna el res entero
    expect(await obtenerFormulario(5)).toBe(wrapped);
  });
});

describe("crearFormulario", () => {
  it("POST /calidad/formularios con body", () => {
    api.mockResolvedValue({});
    const body = { nombre: "Nuevo" };

    crearFormulario(body);

    expect(api).toHaveBeenCalledWith("/calidad/formularios", {
      method: "POST",
      body,
    });
  });
});

describe("actualizarFormulario", () => {
  it("PUT /calidad/formularios/:id con body", () => {
    api.mockResolvedValue({});
    const body = { nombre: "Editado" };

    actualizarFormulario(7, body);

    expect(api).toHaveBeenCalledWith("/calidad/formularios/7", {
      method: "PUT",
      body,
    });
  });
});

describe("toggleActivoFormulario", () => {
  it("POST /calidad/formularios/:id/toggle-active sin body", () => {
    api.mockResolvedValue({});

    toggleActivoFormulario(7);

    expect(api).toHaveBeenCalledWith("/calidad/formularios/7/toggle-active", {
      method: "POST",
    });
  });
});

describe("eliminarFormulario", () => {
  it("DELETE /calidad/formularios/:id", () => {
    api.mockResolvedValue(null);

    eliminarFormulario(7);

    expect(api).toHaveBeenCalledWith("/calidad/formularios/7", {
      method: "DELETE",
    });
  });
});

// ─── Respuestas ──────────────────────────────────────────────────────
describe("listarRespuestas", () => {
  it("llama a /calidad/formularios/:id/respuestas y desempaqueta arreglo plano", async () => {
    api.mockResolvedValue([{ id: "r1" }]);

    const result = await listarRespuestas(7);

    expect(api).toHaveBeenCalledWith("/calidad/formularios/7/respuestas?limit=100");
    expect(result).toEqual([{ id: "r1" }]);
  });

  it("recorre páginas cuando el backend devuelve { data, meta }", async () => {
    api
      .mockResolvedValueOnce({
        data: [{ id: "r1" }],
        meta: { total: 2, totalPages: 2, currentPage: 1, pageSize: 1 },
      })
      .mockResolvedValueOnce({
        data: [{ id: "r2" }],
        meta: { total: 2, totalPages: 2, currentPage: 2, pageSize: 1 },
      });

    const result = await listarRespuestas(7);

    expect(api).toHaveBeenNthCalledWith(1, "/calidad/formularios/7/respuestas?limit=100");
    expect(api).toHaveBeenNthCalledWith(
      2,
      "/calidad/formularios/7/respuestas?limit=100&page=2"
    );
    expect(result).toEqual([{ id: "r1" }, { id: "r2" }]);
  });

  it("propaga el filtro de estado como query param", async () => {
    api.mockResolvedValue({
      data: [],
      meta: { total: 0, totalPages: 1, currentPage: 1, pageSize: 100 },
    });

    await listarRespuestas(7, { estado: "desvio" });

    expect(api).toHaveBeenCalledWith(
      "/calidad/formularios/7/respuestas?estado=desvio&limit=100"
    );
  });

  it("retorna [] cuando el shape es inesperado", async () => {
    api.mockResolvedValue("invalid");
    expect(await listarRespuestas(7)).toEqual([]);
  });
});

describe("crearRespuesta", () => {
  it("POST con estado/detalle top-level y embebidos en el JSONB", () => {
    api.mockResolvedValue({});
    const respuestas = { campo1: "valor" };

    crearRespuesta(7, { respuestas, estado: "no-conforme", detalle: "fuera de norma" });

    expect(api).toHaveBeenCalledWith("/calidad/formularios/7/respuestas", {
      method: "POST",
      body: {
        respuestas: {
          campo1: "valor",
          __estado: "no-conforme",
          __detalle: "fuera de norma",
        },
        estado: "no-conforme",
        detalle: "fuera de norma",
      },
    });
  });

  it("omite detalle top-level y lo embebe vacío cuando es conforme", () => {
    api.mockResolvedValue({});
    const respuestas = { campo1: "valor" };

    crearRespuesta(7, { respuestas, estado: "conforme", detalle: "" });

    expect(api).toHaveBeenCalledWith("/calidad/formularios/7/respuestas", {
      method: "POST",
      body: {
        respuestas: { campo1: "valor", __estado: "conforme", __detalle: "" },
        estado: "conforme",
        detalle: undefined,
      },
    });
  });
});

describe("obtenerRespuesta", () => {
  it("GET /calidad/respuestas/:id y desempaqueta", async () => {
    api.mockResolvedValue({ data: { id: "r1", valor: "x" } });

    const result = await obtenerRespuesta("r1");

    expect(api).toHaveBeenCalledWith("/calidad/respuestas/r1");
    expect(result).toEqual({ id: "r1", valor: "x" });
  });
});

describe("actualizarRespuesta", () => {
  it("PUT /calidad/respuestas/:id con sólo los campos provistos", () => {
    api.mockResolvedValue({});
    const respuestas = { campo1: "nuevo" };

    actualizarRespuesta("r1", { respuestas });

    expect(api).toHaveBeenCalledWith("/calidad/respuestas/r1", {
      method: "PUT",
      body: { respuestas },
    });
  });

  it("envía estado y detalle si se incluyen", () => {
    api.mockResolvedValue({});

    actualizarRespuesta("r1", { estado: "desvio", detalle: "temp alta" });

    expect(api).toHaveBeenCalledWith("/calidad/respuestas/r1", {
      method: "PUT",
      body: { estado: "desvio", detalle: "temp alta" },
    });
  });
});

describe("eliminarRespuesta", () => {
  it("DELETE /calidad/respuestas/:id", () => {
    api.mockResolvedValue(null);

    eliminarRespuesta("r1");

    expect(api).toHaveBeenCalledWith("/calidad/respuestas/r1", {
      method: "DELETE",
    });
  });
});
