import { describe, it, expect } from "vitest";
import { formatValorCambio } from "../formatValorCambio";

describe("formatValorCambio", () => {
  // El caso que dejaba la página en blanco: React no acepta un array como hijo.
  it("nunca devuelve un array ni un objeto", () => {
    const casos = [
      [1, 2, 3],
      [{ id: 1 }, { id: 2 }],
      { cualquier: "cosa" },
      [],
      null,
      undefined,
      "texto",
      42,
      true,
    ];
    for (const caso of casos) {
      expect(typeof formatValorCambio(caso)).toBe("string");
    }
  });

  it("lista los arrays de escalares separados por coma", () => {
    expect(formatValorCambio(["F-001", "F-002"])).toBe("F-001, F-002");
    expect(formatValorCambio([12, 34])).toBe("12, 34");
  });

  it("resume los arrays de objetos en vez de volcarlos", () => {
    // `recepciones` guarda registros completos: desplegarlos no aporta nada en una celda.
    expect(formatValorCambio([{ id: 1 }, { id: 2 }, { id: 3 }])).toBe("3 elementos");
    expect(formatValorCambio([{ id: 1 }])).toBe("1 elemento");
  });

  it("de un objeto con nombre muestra el nombre", () => {
    expect(formatValorCambio({ id: 4, nombre: "Cristóbal" })).toBe("Cristóbal");
  });

  it("serializa un objeto cualquiera en vez de romper", () => {
    expect(formatValorCambio({ a: 1 })).toBe('{"a":1}');
  });

  it("traduce los booleanos", () => {
    expect(formatValorCambio(true)).toBe("Sí");
    expect(formatValorCambio(false)).toBe("No");
  });

  it("usa el texto de vacío para nulos, indefinidos y listas vacías", () => {
    expect(formatValorCambio(null)).toBe("—");
    expect(formatValorCambio(undefined)).toBe("—");
    expect(formatValorCambio("")).toBe("—");
    expect(formatValorCambio([])).toBe("—");
    expect(formatValorCambio(null, "sin dato")).toBe("sin dato");
  });

  it("deja intactos los valores escalares normales", () => {
    expect(formatValorCambio("Pendiente")).toBe("Pendiente");
    expect(formatValorCambio(0)).toBe("0");
  });
});
