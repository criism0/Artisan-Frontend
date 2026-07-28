import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiExtra1, EXTRA1_BASE } from "../apiextra1";

function mockResponse({ ok = true, status = 200, statusText = "OK", json, text, headers = {} } = {}) {
  const headersStub = {
    get: (k) => headers[k.toLowerCase()] ?? headers[k] ?? null,
  };
  return {
    ok,
    status,
    statusText,
    headers: headersStub,
    json: vi.fn(async () => {
      if (typeof json === "function") return json();
      return json;
    }),
    text: vi.fn(async () => text ?? ""),
  };
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("apiExtra1 - URL building", () => {
  it("path relativo se concatena a EXTRA1_BASE", async () => {
    fetch.mockResolvedValue(
      mockResponse({ json: { ok: true }, headers: { "content-type": "application/json" } })
    );

    await apiExtra1("/test");

    expect(fetch.mock.calls[0][0]).toBe(`${EXTRA1_BASE}/test`);
  });

  it("path absoluto (http://...) se usa tal cual", async () => {
    fetch.mockResolvedValue(
      mockResponse({ json: {}, headers: { "content-type": "application/json" } })
    );

    await apiExtra1("http://other-server.com/x");

    expect(fetch.mock.calls[0][0]).toBe("http://other-server.com/x");
  });
});

describe("apiExtra1 - headers", () => {
  it("setea Content-Type application/json por defecto si body no es FormData", async () => {
    fetch.mockResolvedValue(
      mockResponse({ json: {}, headers: { "content-type": "application/json" } })
    );

    await apiExtra1("/x", { body: "{}" });

    const init = fetch.mock.calls[0][1];
    expect(init.headers.get("Content-Type")).toBe("application/json");
  });

  it("NO setea Content-Type si body es FormData", async () => {
    fetch.mockResolvedValue(
      mockResponse({ json: {}, headers: { "content-type": "application/json" } })
    );

    const fd = new FormData();
    fd.append("k", "v");
    await apiExtra1("/x", { body: fd });

    const init = fetch.mock.calls[0][1];
    expect(init.headers.get("Content-Type")).toBeNull();
  });

  it("respeta Content-Type explícito", async () => {
    fetch.mockResolvedValue(
      mockResponse({ json: {}, headers: { "content-type": "application/json" } })
    );

    await apiExtra1("/x", {
      body: "raw",
      headers: { "Content-Type": "text/plain" },
    });

    expect(fetch.mock.calls[0][1].headers.get("Content-Type")).toBe("text/plain");
  });
});

describe("apiExtra1 - response handling", () => {
  it("parsea JSON cuando content-type incluye application/json", async () => {
    fetch.mockResolvedValue(
      mockResponse({
        json: { id: 1 },
        headers: { "content-type": "application/json; charset=utf-8" },
      })
    );

    const result = await apiExtra1("/x");
    expect(result).toEqual({ id: 1 });
  });

  it("parsea JSON desde texto si content-type no es JSON pero el body sí lo es", async () => {
    fetch.mockResolvedValue(
      mockResponse({
        text: '{"foo":"bar"}',
        headers: { "content-type": "text/plain" },
      })
    );

    const result = await apiExtra1("/x");
    expect(result).toEqual({ foo: "bar" });
  });

  it("retorna { raw: text } cuando el body no es JSON parseable", async () => {
    fetch.mockResolvedValue(
      mockResponse({
        text: "hola mundo",
        headers: { "content-type": "text/plain" },
      })
    );

    const result = await apiExtra1("/x");
    expect(result).toEqual({ raw: "hola mundo" });
  });
});

describe("apiExtra1 - error handling", () => {
  it("lanza Error con status y detail desde data.detail", async () => {
    fetch.mockResolvedValue(
      mockResponse({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: { detail: "Falta campo X" },
        headers: {},
      })
    );

    await expect(apiExtra1("/x")).rejects.toThrow(/400.*Falta campo X/);
  });

  it("usa data.error como fallback si no hay detail", async () => {
    fetch.mockResolvedValue(
      mockResponse({ ok: false, status: 500, json: { error: "boom" } })
    );

    await expect(apiExtra1("/x")).rejects.toThrow(/500.*boom/);
  });

  it("usa JSON.stringify(data) como fallback si no hay detail ni error", async () => {
    fetch.mockResolvedValue(
      mockResponse({ ok: false, status: 422, json: { foo: "bar" } })
    );

    await expect(apiExtra1("/x")).rejects.toThrow(/422.*foo/);
  });

  it("usa res.text() si res.json() falla", async () => {
    const res = mockResponse({ ok: false, status: 502, text: "Bad Gateway plain text" });
    res.json = vi.fn(async () => {
      throw new Error("not json");
    });
    fetch.mockResolvedValue(res);

    await expect(apiExtra1("/x")).rejects.toThrow(/502.*Bad Gateway plain text/);
  });

  it("lanza solo 'Error N' cuando ni json ni text aportan detalle", async () => {
    const res = mockResponse({ ok: false, status: 503 });
    res.json = vi.fn(async () => {
      throw new Error("nope");
    });
    res.text = vi.fn(async () => {
      throw new Error("nope");
    });
    fetch.mockResolvedValue(res);

    await expect(apiExtra1("/x")).rejects.toThrow(/^Error 503$/);
  });
});

describe("EXTRA1_BASE", () => {
  it("se exporta como string sin trailing slash", () => {
    expect(typeof EXTRA1_BASE).toBe("string");
    expect(EXTRA1_BASE).not.toMatch(/\/$/);
  });
});
