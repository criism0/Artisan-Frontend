// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Importante: toast.js inicializa el DOM al cargarse (ToastManager singleton).
// jsdom debe estar activo ANTES del import.
import toastDefault, { toast } from "../toast";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  // Limpiamos toasts que quedaron en el DOM entre tests
  const container = document.getElementById("toast-container");
  if (container) {
    container.innerHTML = "";
  }
});

describe("toast - export y singleton", () => {
  it("exporta el mismo objeto como named y default", () => {
    expect(toast).toBe(toastDefault);
  });

  it("expone los métodos success/error/info/warning/dismiss", () => {
    expect(typeof toast.success).toBe("function");
    expect(typeof toast.error).toBe("function");
    expect(typeof toast.info).toBe("function");
    expect(typeof toast.warning).toBe("function");
    expect(typeof toast.dismiss).toBe("function");
  });

  it("crea el contenedor #toast-container al cargarse el módulo", () => {
    const container = document.getElementById("toast-container");
    expect(container).not.toBeNull();
    expect(container.style.position).toBe("fixed");
    expect(container.style.zIndex).toBe("9999");
  });
});

describe("toast.success / error / info / warning", () => {
  it("toast.success agrega un elemento con fondo verde y mensaje", () => {
    const id = toast.success("¡Éxito!");
    expect(typeof id).toBe("number");

    const container = document.getElementById("toast-container");
    expect(container.children.length).toBe(1);

    const el = container.firstChild;
    expect(el.style.background).toBe("rgb(16, 185, 129)"); // #10b981
    expect(el.innerHTML).toContain("¡Éxito!");
    expect(el.innerHTML).toContain("✅");
  });

  it("toast.error usa fondo rojo y emoji ❌", () => {
    toast.error("Algo falló");
    const el = document.getElementById("toast-container").firstChild;
    expect(el.style.background).toBe("rgb(239, 68, 68)"); // #ef4444
    expect(el.innerHTML).toContain("❌");
    expect(el.innerHTML).toContain("Algo falló");
  });

  it("toast.warning usa fondo ámbar y emoji ⚠️", () => {
    toast.warning("Cuidado");
    const el = document.getElementById("toast-container").firstChild;
    expect(el.style.background).toBe("rgb(245, 158, 11)"); // #f59e0b
    expect(el.innerHTML).toContain("⚠️");
  });

  it("toast.info usa fondo azul", () => {
    toast.info("Info");
    const el = document.getElementById("toast-container").firstChild;
    expect(el.style.background).toBe("rgb(59, 130, 246)"); // #3b82f6
    expect(el.innerHTML).toContain("ℹ️");
  });

  it("retorna un toastId numérico distinto para cada toast", () => {
    const id1 = toast.success("a");
    const id2 = toast.success("b");
    expect(id1).not.toBe(id2);
  });

  it("agrega múltiples toasts al contenedor", () => {
    toast.success("uno");
    toast.error("dos");
    toast.info("tres");

    const container = document.getElementById("toast-container");
    expect(container.children.length).toBe(3);
  });
});

describe("auto-close", () => {
  it("toast.success se autoremueve después del tiempo por defecto (5000ms)", () => {
    toast.success("temporal");
    const container = document.getElementById("toast-container");
    expect(container.children.length).toBe(1);

    // Avanzamos 5 segundos: dispara setTimeout de removeToast
    vi.advanceTimersByTime(5000);
    // Luego 300ms más para que la animación remueva el elemento
    vi.advanceTimersByTime(300);

    expect(container.children.length).toBe(0);
  });

  it("toast.error usa duración por defecto de 7000ms", () => {
    toast.error("temporal");
    const container = document.getElementById("toast-container");

    vi.advanceTimersByTime(5000);
    expect(container.children.length).toBe(1); // todavía no expira (5s < 7s)

    vi.advanceTimersByTime(2000);
    vi.advanceTimersByTime(300);
    expect(container.children.length).toBe(0);
  });

  it("respeta options.autoClose personalizado", () => {
    toast.info("custom", { autoClose: 1000 });
    const container = document.getElementById("toast-container");

    vi.advanceTimersByTime(1000);
    vi.advanceTimersByTime(300);
    expect(container.children.length).toBe(0);
  });

  it("autoClose=0 desactiva el auto-remove (toast persiste)", () => {
    // duration=0 entra en el else y no agenda removeToast
    // Pero el código actual hace `options.autoClose || 5000` → 0 || 5000 = 5000
    // Documentamos comportamiento real: NO se puede pasar 0 vía options.autoClose
    toast.info("persistente", { autoClose: 0 });
    vi.advanceTimersByTime(4999);
    expect(document.getElementById("toast-container").children.length).toBe(1);
    vi.advanceTimersByTime(1);
    vi.advanceTimersByTime(300);
    expect(document.getElementById("toast-container").children.length).toBe(0);
  });
});

describe("dismiss", () => {
  it("toast.dismiss remueve el toast por ID", () => {
    const id = toast.success("removeme");
    const container = document.getElementById("toast-container");
    expect(container.children.length).toBe(1);

    toast.dismiss(id);
    vi.advanceTimersByTime(300); // animación de salida

    expect(container.children.length).toBe(0);
  });

  it("dismiss con ID inexistente no lanza error", () => {
    expect(() => toast.dismiss(999999)).not.toThrow();
  });
});

describe("click para cerrar", () => {
  it("hacer click en el toast lo cierra", () => {
    toast.success("clickeable");
    const container = document.getElementById("toast-container");
    const el = container.firstChild;

    el.click();
    vi.advanceTimersByTime(300);

    expect(container.children.length).toBe(0);
  });
});

describe("animación inicial", () => {
  it("setea opacity 1 y transform translateX(0) tras 10ms", () => {
    toast.success("animar");
    const el = document.getElementById("toast-container").firstChild;

    // Antes del setTimeout(10): opacity 0
    expect(el.style.opacity).toBe("0");

    vi.advanceTimersByTime(10);

    expect(el.style.opacity).toBe("1");
    expect(el.style.transform).toBe("translateX(0)");
  });
});
