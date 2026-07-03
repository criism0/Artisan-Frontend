// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { downloadBlob } from "../downloadBlob";

let createObjectURLSpy;
let revokeObjectURLSpy;

beforeEach(() => {
  // jsdom no implementa createObjectURL/revokeObjectURL — los stubeamos
  createObjectURLSpy = vi.fn(() => "blob:fake-url");
  revokeObjectURLSpy = vi.fn();
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: createObjectURLSpy,
    revokeObjectURL: revokeObjectURLSpy,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("downloadBlob", () => {
  it("crea un anchor con href=blob URL y download=filename", () => {
    const blob = new Blob(["hola"], { type: "text/plain" });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    downloadBlob(blob, "documento.pdf");

    expect(createObjectURLSpy).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("agrega el anchor al body y lo remueve después del click", () => {
    const blob = new Blob(["x"]);
    const appendSpy = vi.spyOn(document.body, "appendChild");
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    downloadBlob(blob, "x.txt");

    expect(appendSpy).toHaveBeenCalled();
    const anchor = appendSpy.mock.calls[0][0];
    expect(anchor.tagName).toBe("A");
    expect(anchor.download).toBe("x.txt");
    expect(anchor.href).toBe("blob:fake-url");
    // Tras el click, el anchor ya no debe estar en el body
    expect(document.body.contains(anchor)).toBe(false);
  });

  it("usa nombre por defecto 'archivo' si no se pasa filename", () => {
    const blob = new Blob(["x"]);
    const appendSpy = vi.spyOn(document.body, "appendChild");
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    downloadBlob(blob);

    const anchor = appendSpy.mock.calls[0][0];
    expect(anchor.download).toBe("archivo");
  });

  it("revoca la URL del blob después del click (limpieza)", () => {
    const blob = new Blob(["x"]);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    downloadBlob(blob, "x.txt");

    expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:fake-url");
  });

  it("lanza error si blob es null/undefined", () => {
    expect(() => downloadBlob(null, "x.txt")).toThrow(/Blob inválido/);
    expect(() => downloadBlob(undefined)).toThrow(/Blob inválido/);
  });

  it("revoca URL incluso si el click falla (try/finally)", () => {
    const blob = new Blob(["x"]);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      throw new Error("click failed");
    });

    expect(() => downloadBlob(blob, "x.txt")).toThrow("click failed");
    expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:fake-url");
  });
});
