import { describe, it, expect, vi, afterEach } from "vitest";
import { encodeCredentials, decodeCredentials } from "../qrCredentialsUtils";

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── encodeCredentials ───────────────────────────────────────────────
describe("encodeCredentials", () => {
  it("codifica user+password como base64 de un JSON", () => {
    const encoded = encodeCredentials("alice", "secret123");
    // El resultado debe ser base64 válido y decodificarse a un JSON con los datos
    expect(typeof encoded).toBe("string");
    expect(encoded.length).toBeGreaterThan(0);

    const decoded = JSON.parse(atob(encoded));
    expect(decoded).toEqual({ user: "alice", password: "secret123" });
  });

  it("strings vacíos se codifican igual (no valida input)", () => {
    const encoded = encodeCredentials("", "");
    const decoded = JSON.parse(atob(encoded));
    expect(decoded).toEqual({ user: "", password: "" });
  });
});

// ─── decodeCredentials ───────────────────────────────────────────────
describe("decodeCredentials", () => {
  it("roundtrip: encodeCredentials → decodeCredentials retorna lo mismo", () => {
    const encoded = encodeCredentials("bob", "password!@#");
    expect(decodeCredentials(encoded)).toEqual({ user: "bob", password: "password!@#" });
  });

  it("retorna null si el input no es base64 válido", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(decodeCredentials("###no-es-base64###")).toBeNull();
    expect(errSpy).toHaveBeenCalled();
  });

  it("retorna null si el JSON decodificado no tiene shape {user, password}", () => {
    // Codificamos manualmente un JSON sin los campos esperados
    const malformed = btoa(JSON.stringify({ otro: "campo" }));
    expect(decodeCredentials(malformed)).toBeNull();
  });

  it("retorna null si user no es string", () => {
    const malformed = btoa(JSON.stringify({ user: 123, password: "x" }));
    expect(decodeCredentials(malformed)).toBeNull();
  });

  it("retorna null si password no es string", () => {
    const malformed = btoa(JSON.stringify({ user: "x", password: null }));
    expect(decodeCredentials(malformed)).toBeNull();
  });

  it("retorna null si el contenido base64 no es JSON parseable", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const notJson = btoa("este texto no es json");
    expect(decodeCredentials(notJson)).toBeNull();
    expect(errSpy).toHaveBeenCalled();
  });
});
