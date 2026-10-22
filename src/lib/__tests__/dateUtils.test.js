import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from "vitest";
import { getTodayDate, formatFecha, aFechaLocal } from "../dateUtils";

afterEach(() => {
  vi.useRealTimers();
});

describe("getTodayDate", () => {
  it("formatea fecha normal con padding en mes y día", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 5, 12, 0, 0)); // 5 abril 2026 (mes 3 = abril)
    expect(getTodayDate()).toBe("2026-04-05");
  });

  it("padea correctamente meses y días < 10", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0, 0)); // 1 enero 2026
    expect(getTodayDate()).toBe("2026-01-01");
  });

  it("maneja correctamente fin de año (diciembre)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 11, 31, 12, 0, 0)); // 31 diciembre 2026
    expect(getTodayDate()).toBe("2026-12-31");
  });

  it("maneja año bisiesto (29 de febrero)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 1, 29, 12, 0, 0)); // 29 febrero 2024 (bisiesto)
    expect(getTodayDate()).toBe("2024-02-29");
  });

  it("retorna string en formato YYYY-MM-DD", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 15, 12, 0, 0));
    const result = getTodayDate();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("formatFecha: un día de calendario no se corre al de antes", () => {
  // Chile está detrás de UTC: la medianoche UTC del 21 es el 20 a las 21:00 (o 20:00).
  const tzOriginal = globalThis.process.env.TZ;
  beforeAll(() => {
    globalThis.process.env.TZ = "America/Santiago";
  });
  afterAll(() => {
    globalThis.process.env.TZ = tzOriginal;
  });

  it("una columna DATEONLY («2026-10-21») se muestra el 21, no el 20", () => {
    expect(new Date("2026-10-21").toLocaleDateString("es-CL")).toBe("20-10-2026"); // el bug
    expect(formatFecha("2026-10-21")).toBe("21-10-2026");
  });

  it("una DATE guardada a medianoche UTC también es un día de calendario", () => {
    expect(formatFecha("2026-10-21T00:00:00.000Z")).toBe("21-10-2026");
    expect(formatFecha("2026-10-21T00:00:00Z")).toBe("21-10-2026");
    expect(formatFecha(new Date("2026-10-21"))).toBe("21-10-2026");
  });

  it("un instante con hora se muestra en la hora de Chile", () => {
    // 01:30 UTC del 22 = 22:30 del 21 en Chile
    expect(formatFecha("2026-10-22T01:30:00.000Z")).toBe("21-10-2026");
    expect(formatFecha("2026-10-21T15:00:00.000Z")).toBe("21-10-2026");
  });

  it("vacío o ilegible da un guion, no «Invalid Date»", () => {
    expect(formatFecha(null)).toBe("—");
    expect(formatFecha(undefined)).toBe("—");
    expect(formatFecha("")).toBe("—");
    expect(formatFecha("no es fecha")).toBe("—");
  });

  it("acepta las opciones de toLocaleDateString sin perder el día", () => {
    expect(formatFecha("2026-10-21", { day: "2-digit", month: "2-digit", year: "numeric" })).toBe("21-10-2026");
    expect(formatFecha("2026-10-21", { day: "numeric", month: "short" })).toMatch(/^21 /);
  });

  it("aFechaLocal deja el día de calendario al mediodía local", () => {
    const d = aFechaLocal("2026-10-21");
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 9, 21, 12]);
    expect(aFechaLocal(null)).toBeNull();
  });
});
