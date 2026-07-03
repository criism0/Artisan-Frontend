import { describe, it, expect, vi, afterEach } from "vitest";
import { getTodayDate } from "../dateUtils";

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
