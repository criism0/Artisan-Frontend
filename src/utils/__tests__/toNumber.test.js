import { describe, it, expect } from "vitest";
import { toNumber } from "../toNumber";

describe("toNumber", () => {
  it("retorna el número directo cuando recibe un number", () => {
    expect(toNumber(42)).toBe(42);
    expect(toNumber(0)).toBe(0);
    expect(toNumber(-3.14)).toBe(-3.14);
  });

  it("parsea strings con punto decimal", () => {
    expect(toNumber("3.14")).toBe(3.14);
    expect(toNumber("100")).toBe(100);
  });

  it("parsea strings con coma decimal (formato es-CL)", () => {
    expect(toNumber("1,5")).toBe(1.5);
    expect(toNumber("1234,56")).toBe(1234.56);
  });

  it("solo reemplaza la PRIMERA coma — strings con miles+decimales fallan", () => {
    // "1,234,56" => "1.234,56" => Number("1.234,56") = NaN → 0
    // Caso conocido: la función NO está pensada para strings con separadores de miles
    expect(toNumber("1,234,56")).toBe(0);
  });

  it("retorna 0 cuando el string no es parseable", () => {
    expect(toNumber("abc")).toBe(0);
    expect(toNumber("12abc")).toBe(0);
    expect(toNumber("")).toBe(0);
  });

  it("retorna 0 para null y undefined", () => {
    // String(null) === "null" → Number("null") = NaN → 0
    expect(toNumber(null)).toBe(0);
    // String(undefined) === "undefined" → NaN → 0
    expect(toNumber(undefined)).toBe(0);
  });

  it("retorna 0 para NaN, Infinity y -Infinity (no son finitos)", () => {
    expect(toNumber(Number.NaN)).toBe(0);
    expect(toNumber(Number.POSITIVE_INFINITY)).toBe(0);
    expect(toNumber(Number.NEGATIVE_INFINITY)).toBe(0);
  });

  it("convierte boolean a 0 (String(true)='true' → NaN)", () => {
    // typeof true !== "number" => cae al else => Number(String(true).replace) = Number("true") = NaN => 0
    expect(toNumber(true)).toBe(0);
    expect(toNumber(false)).toBe(0);
  });

  it("strings con espacios al rededor: Number() los trimea", () => {
    expect(toNumber("  10  ")).toBe(10);
    expect(toNumber("  3,5  ")).toBe(3.5);
  });
});
