import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api, apiBlob, ApiError, getToken, clearToken, API_BASE, buildApiUrl } from "../api";

// ─── Helpers de mock ─────────────────────────────────────────────────
function mockResponse({ ok = true, status = 200, statusText = "OK", json, text, blob } = {}) {
  return {
    ok,
    status,
    statusText,
    json: vi.fn(async () => {
      if (typeof json === "function") return json();
      return json;
    }),
    text: vi.fn(async () => text ?? ""),
    blob: vi.fn(async () => blob ?? new Blob([""])),
  };
}

function createStorageStub() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

function createWindowStub(pathname = "/dashboard") {
  return {
    location: { pathname, href: "" },
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", createStorageStub());
  vi.stubGlobal("window", createWindowStub());
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ─── getToken / clearToken ───────────────────────────────────────────
describe("getToken / clearToken", () => {
  it("getToken retorna lo guardado en localStorage", () => {
    localStorage.setItem("access_token", "abc-123");
    expect(getToken()).toBe("abc-123");
  });

  it("getToken retorna null si no hay token", () => {
    expect(getToken()).toBeNull();
  });

  it("clearToken elimina el token", () => {
    localStorage.setItem("access_token", "abc-123");
    clearToken();
    expect(getToken()).toBeNull();
  });
});

// ─── ApiError ────────────────────────────────────────────────────────
describe("ApiError", () => {
  it("conserva message, status, data y name", () => {
    const err = new ApiError("Algo falló", 500, { foo: "bar" });
    expect(err.message).toBe("Algo falló");
    expect(err.status).toBe(500);
    expect(err.data).toEqual({ foo: "bar" });
    expect(err.name).toBe("ApiError");
    expect(err).toBeInstanceOf(Error);
  });
});

// ─── api: request building ───────────────────────────────────────────
describe("api - construcción de request", () => {
  it("envía credentials: 'include' para que el browser mande las cookies httpOnly", async () => {
    fetch.mockResolvedValue(mockResponse({ json: { ok: true } }));

    await api("/users");

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(`${API_BASE}/users`);
    expect(init.credentials).toBe("include");
    expect(init.headers.get("Authorization")).toBeNull();
  });

  it("NO agrega Authorization si auth=false", async () => {
    localStorage.setItem("access_token", "tok-1");
    fetch.mockResolvedValue(mockResponse({ json: { ok: true } }));

    await api("/public", { auth: false });

    const init = fetch.mock.calls[0][1];
    expect(init.headers.get("Authorization")).toBeNull();
  });

  it("NO agrega Authorization si no hay token (incluso con auth=true)", async () => {
    fetch.mockResolvedValue(mockResponse({ json: {} }));

    await api("/public");

    const init = fetch.mock.calls[0][1];
    expect(init.headers.get("Authorization")).toBeNull();
  });

  it("serializa body de tipo objeto a JSON", async () => {
    fetch.mockResolvedValue(mockResponse({ json: {} }));

    await api("/items", { method: "POST", body: { name: "X", qty: 3 } });

    const init = fetch.mock.calls[0][1];
    expect(init.body).toBe(JSON.stringify({ name: "X", qty: 3 }));
    expect(init.headers.get("Content-Type")).toBe("application/json");
  });

  it("NO toca body de tipo FormData ni setea Content-Type (lo deja al navegador)", async () => {
    const fd = new FormData();
    fd.append("file", new Blob(["x"]), "x.txt");
    fetch.mockResolvedValue(mockResponse({ json: {} }));

    await api("/upload", { method: "POST", body: fd });

    const init = fetch.mock.calls[0][1];
    expect(init.body).toBe(fd); // misma referencia, no JSON.stringify
    expect(init.headers.get("Content-Type")).toBeNull();
  });

  it("respeta Content-Type explícito si lo pasa el caller", async () => {
    fetch.mockResolvedValue(mockResponse({ json: {} }));

    await api("/x", {
      method: "POST",
      body: { a: 1 },
      headers: { "Content-Type": "application/vnd.custom+json" },
    });

    const init = fetch.mock.calls[0][1];
    expect(init.headers.get("Content-Type")).toBe("application/vnd.custom+json");
  });

  it("preserva otros headers que pasa el caller", async () => {
    fetch.mockResolvedValue(mockResponse({ json: {} }));

    await api("/x", { headers: { "X-Custom": "hello" } });

    const init = fetch.mock.calls[0][1];
    expect(init.headers.get("X-Custom")).toBe("hello");
  });
});

// ─── api: response handling ──────────────────────────────────────────
describe("api - manejo de respuestas", () => {
  it("retorna JSON cuando la respuesta es 2xx", async () => {
    fetch.mockResolvedValue(mockResponse({ json: { id: 1, name: "A" } }));

    const result = await api("/x");
    expect(result).toEqual({ id: 1, name: "A" });
  });

  it("retorna null cuando status es 204", async () => {
    fetch.mockResolvedValue(mockResponse({ status: 204, json: { shouldNotRead: true } }));

    const result = await api("/x", { method: "DELETE" });
    expect(result).toBeNull();
  });
});

// ─── api: error handling ─────────────────────────────────────────────
describe("api - manejo de errores", () => {
  it("lanza ApiError con status y data en respuestas no-ok", async () => {
    fetch.mockResolvedValue(
      mockResponse({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: { detalles: "Falta el campo X" },
      })
    );

    await expect(api("/x")).rejects.toMatchObject({
      name: "ApiError",
      status: 400,
      message: "Falta el campo X",
      data: { detalles: "Falta el campo X" },
    });
  });

  it("usa data.message como fallback si no hay detalles", async () => {
    fetch.mockResolvedValue(
      mockResponse({ ok: false, status: 400, statusText: "Bad", json: { message: "msg-X" } })
    );

    await expect(api("/x")).rejects.toMatchObject({ message: "msg-X" });
  });

  it("usa data.error como fallback si no hay detalles ni message", async () => {
    fetch.mockResolvedValue(
      mockResponse({ ok: false, status: 400, statusText: "Bad", json: { error: "err-Y" } })
    );

    await expect(api("/x")).rejects.toMatchObject({ message: "err-Y" });
  });

  it("usa 'status statusText' si data está vacío", async () => {
    fetch.mockResolvedValue(
      mockResponse({ ok: false, status: 500, statusText: "Server Error", json: {} })
    );

    await expect(api("/x")).rejects.toMatchObject({ message: "500 Server Error" });
  });

  it("safeJson: si res.json() falla, data queda null y message cae al statusText", async () => {
    const res = mockResponse({ ok: false, status: 502, statusText: "Bad Gateway" });
    res.json = vi.fn(async () => {
      throw new Error("not json");
    });
    fetch.mockResolvedValue(res);

    await expect(api("/x")).rejects.toMatchObject({
      status: 502,
      message: "502 Bad Gateway",
      data: null,
    });
  });

  it("401 fuera de /login: limpia token y redirige a /login", async () => {
    localStorage.setItem("access_token", "tok-1");
    window.location.pathname = "/dashboard";

    fetch.mockResolvedValue(
      mockResponse({ ok: false, status: 401, statusText: "Unauthorized", json: {} })
    );

    await expect(api("/x")).rejects.toMatchObject({ status: 401 });
    expect(localStorage.getItem("access_token")).toBeNull();
    expect(window.location.href).toBe("/login");
  });

  it("401 estando ya en /login: NO redirige ni limpia token", async () => {
    localStorage.setItem("access_token", "tok-1");
    window.location.pathname = "/login";
    window.location.href = "/login";

    fetch.mockResolvedValue(
      mockResponse({ ok: false, status: 401, statusText: "Unauthorized", json: {} })
    );

    await expect(api("/login")).rejects.toMatchObject({ status: 401 });
    expect(localStorage.getItem("access_token")).toBe("tok-1");
    expect(window.location.href).toBe("/login");
  });
});

// ─── apiBlob ─────────────────────────────────────────────────────────
describe("apiBlob", () => {
  it("retorna un Blob cuando la respuesta es 2xx", async () => {
    const blob = new Blob(["hola"], { type: "text/plain" });
    fetch.mockResolvedValue(mockResponse({ blob }));

    const result = await apiBlob("/file");
    expect(result).toBe(blob);
  });

  it("envía credentials: 'include' igual que api()", async () => {
    fetch.mockResolvedValue(mockResponse({}));

    await apiBlob("/file");

    const init = fetch.mock.calls[0][1];
    expect(init.credentials).toBe("include");
    expect(init.headers.get("Authorization")).toBeNull();
  });

  it("lanza ApiError igual que api() cuando hay error", async () => {
    fetch.mockResolvedValue(
      mockResponse({ ok: false, status: 404, statusText: "Not Found", json: {} })
    );

    await expect(apiBlob("/file")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
    });
  });

  it("401 fuera de /login también limpia token y redirige", async () => {
    localStorage.setItem("access_token", "tok-1");
    window.location.pathname = "/x";

    fetch.mockResolvedValue(
      mockResponse({ ok: false, status: 401, statusText: "Unauthorized", json: {} })
    );

    await expect(apiBlob("/file")).rejects.toMatchObject({ status: 401 });
    expect(localStorage.getItem("access_token")).toBeNull();
    expect(window.location.href).toBe("/login");
  });
});

// ─── buildApiUrl ─────────────────────────────────────────────────────
describe("buildApiUrl", () => {
  it("retorna URL absoluta si ya viene completa", () => {
    expect(buildApiUrl("https://example.com/test")).toBe("https://example.com/test");
  });

  it("concatena correctamente con slash inicial", () => {
    expect(buildApiUrl("/users")).toBe(`${API_BASE.replace(/\/$/, "")}/users`);
  });

  it("concatena correctamente sin slash inicial", () => {
    expect(buildApiUrl("users")).toBe(`${API_BASE.replace(/\/$/, "")}/users`);
  });

  it("retorna string vacío si path es vacío", () => {
    expect(buildApiUrl("")).toBe("");
  });
});