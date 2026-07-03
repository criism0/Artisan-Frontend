import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../lib/apiextra1", () => ({
  apiExtra1: vi.fn(),
}));

import { procesarFacturaExtra1 } from "../facturasExtra";
import { apiExtra1 } from "../../lib/apiextra1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("procesarFacturaExtra1", () => {
  it("envía el archivo a /walmart-cencosud/factura_json con FormData y método POST", () => {
    const file = new File(["pdf-bytes"], "factura.pdf", { type: "application/pdf" });
    apiExtra1.mockResolvedValue({ id: 1 });

    procesarFacturaExtra1(file);

    expect(apiExtra1).toHaveBeenCalledTimes(1);
    const [path, options] = apiExtra1.mock.calls[0];
    expect(path).toBe("/walmart-cencosud/factura_json");
    expect(options.method).toBe("POST");
    expect(options.body).toBeInstanceOf(FormData);
    const sent = options.body.get("file");
    expect(sent).toBeInstanceOf(File);
    expect(sent.name).toBe("factura.pdf");
    expect(sent.type).toBe("application/pdf");
  });

  it("propaga el AbortSignal a apiExtra1", () => {
    const file = new File(["x"], "x.pdf", { type: "application/pdf" });
    const controller = new AbortController();
    apiExtra1.mockResolvedValue({});

    procesarFacturaExtra1(file, { signal: controller.signal });

    expect(apiExtra1.mock.calls[0][1].signal).toBe(controller.signal);
  });

  it("lanza error si 'file' no es una instancia de File", () => {
    expect(() => procesarFacturaExtra1("not-a-file")).toThrow(
      /'file' debe ser File/
    );
    expect(() => procesarFacturaExtra1(null)).toThrow();
    expect(() => procesarFacturaExtra1({ name: "fake.pdf" })).toThrow();
    expect(apiExtra1).not.toHaveBeenCalled();
  });

  it("retorna la promesa de apiExtra1 (no la resuelve)", async () => {
    const file = new File(["x"], "x.pdf");
    apiExtra1.mockResolvedValue({ extracted: "data" });

    const result = await procesarFacturaExtra1(file);
    expect(result).toEqual({ extracted: "data" });
  });
});
