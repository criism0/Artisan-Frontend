import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../lib/api", () => ({
  api: vi.fn(),
}));

import {
  crear_factura,
  lista_de_facturas,
  buscar_factura,
  editar_factura,
  eliminar_factura,
} from "../ocrfacturas";
import { api } from "../../lib/api";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ocrfacturas - wrappers de endpoints", () => {
  it("crear_factura → POST /ocr-facturas con body JSON-serializado", () => {
    api.mockResolvedValue({ id: 1 });
    const payload = { proveedor: "X", monto: 5000 };

    crear_factura(payload);

    expect(api).toHaveBeenCalledWith("/ocr-facturas", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  });

  it("lista_de_facturas → GET /ocr-facturas", () => {
    api.mockResolvedValue([]);

    lista_de_facturas();

    expect(api).toHaveBeenCalledWith("/ocr-facturas", { method: "GET" });
  });

  it("buscar_factura → GET /ocr-facturas/:id", () => {
    api.mockResolvedValue({ id: 7 });

    buscar_factura(7);

    expect(api).toHaveBeenCalledWith("/ocr-facturas/7", { method: "GET" });
  });

  it("editar_factura → PUT /ocr-facturas/:id con body JSON", () => {
    api.mockResolvedValue({ id: 7 });
    const payload = { monto: 9999 };

    editar_factura(7, payload);

    expect(api).toHaveBeenCalledWith("/ocr-facturas/7", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  });

  it("eliminar_factura → DELETE /ocr-facturas/:id", () => {
    api.mockResolvedValue(null);

    eliminar_factura(7);

    expect(api).toHaveBeenCalledWith("/ocr-facturas/7", { method: "DELETE" });
  });

  it("propaga errores del api()", async () => {
    api.mockRejectedValue(new Error("500"));
    await expect(crear_factura({})).rejects.toThrow("500");
  });
});
