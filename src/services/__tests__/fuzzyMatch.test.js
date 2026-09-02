import { describe, it, expect } from "vitest";
import { fuzzyMatch, insumoToSearchText } from "../fuzzyMatch";

// ─── fuzzyMatch ──────────────────────────────────────────────────────
// IMPORTANTE: fuzzyMatch NO normaliza `text`, solo normaliza `query`.
// El caller debe pasar `text` ya normalizado (output de insumoToSearchText).
describe("fuzzyMatch", () => {
  // --- Coincidencia exacta ---
  it("match directo por substring", () => {
    expect(fuzzyMatch("harina de trigo", "harina")).toBe(true);
  });

  it("normaliza el query: remueve tildes y pasa a minúsculas", () => {
    expect(fuzzyMatch("azucar", "Azúcar")).toBe(true);
    expect(fuzzyMatch("cafe molido", "CAFÉ")).toBe(true);
  });

  it("query vacío o solo espacios → siempre true", () => {
    expect(fuzzyMatch("cualquier texto", "")).toBe(true);
    expect(fuzzyMatch("cualquier texto", "   ")).toBe(true);
  });

  it("text vacío con query no vacío → false", () => {
    expect(fuzzyMatch("", "algo")).toBe(false);
  });

  // 🔴 Intercambiar dos letras vecinas es la errata más común al tipear, y para el Levenshtein
  // clásico cuesta 2 — o sea que quedaba fuera de la tolerancia de un token corto. Medido en
  // vivo el 2026-09-02: «FLOW-NCNIV» no encontraba «FLOW-NCINV».
  describe("transposición de letras vecinas", () => {
    it.each([
      ["cencosdu", "cencosud"],
      ["harnia", "harina"],
      ["flow ncniv", "flow ncinv o8mw6709"],
    ])("buscar %s encuentra %s", (consulta, texto) => {
      expect(fuzzyMatch(texto, consulta)).toBe(true);
    });

    it("sigue sin encontrar algo que de verdad no se parece", () => {
      expect(fuzzyMatch("harina de trigo", "zanahoria")).toBe(false);
    });
  });

  // --- Multi-token: todos deben matchear ---
  it("multi-token: todos los tokens deben estar presentes", () => {
    expect(fuzzyMatch("harina de trigo integral", "harina integral")).toBe(true);
  });

  it("multi-token: falla si un token no matchea", () => {
    expect(fuzzyMatch("harina de trigo", "harina maiz")).toBe(false);
  });

  // --- Tolerancia a typos ---
  // Token ≤4 chars → maxDist = 1
  // Token >4 chars → maxDist = floor(length * 0.25)
  describe("tolerancia a typos por largo de token", () => {
    it("token 3 chars: tolera 1 typo ('sel' ≈ 'sal')", () => {
      expect(fuzzyMatch("sal marina", "sel")).toBe(true);
    });

    it("token 3 chars: no tolera 2+ typos ('xyz' ≠ 'sal')", () => {
      expect(fuzzyMatch("sal marina", "xyz")).toBe(false);
    });

    it("token 4 chars: tolera 1 typo ('hola' ≈ 'holo')", () => {
      expect(fuzzyMatch("hola mundo", "holo")).toBe(true);
    });

    it("token 4 chars: no tolera 2 typos ('haaa' ≠ 'hola')", () => {
      expect(fuzzyMatch("hola mundo", "haaa")).toBe(false);
    });

    it("token 5 chars: maxDist=floor(5*0.25)=1, tolera 1 typo", () => {
      expect(fuzzyMatch("trigo integral", "trrgo")).toBe(true); // 1 edit
    });

    it("token 7 chars: maxDist=floor(7*0.25)=1, solo 1 typo", () => {
      expect(fuzzyMatch("harina de trigo", "harinaa")).toBe(true); // 1 edit (insert)
    });

    it("token 8 chars: maxDist=floor(8*0.25)=2, tolera 2 typos", () => {
      // "integral" (8) vs "integrol" → 1 edit, ok
      expect(fuzzyMatch("trigo integral", "integrol")).toBe(true);
      // "integral" (8) vs "integrxx" → 2 edits, ok (maxDist=2)
      expect(fuzzyMatch("trigo integral", "integrxx")).toBe(true);
    });

    it("descarta rápido si diferencia de largo > maxDist", () => {
      // "sal" (3) vs "salmuera" (8) → |3-8|=5 > maxDist=1 → skip
      expect(fuzzyMatch("salmuera marina", "sal")).toBe(true); // pero matchea por substring
      // Force only fuzzy: token que no es substring
      expect(fuzzyMatch("abcde fghij", "abcdefghij")).toBe(false); // largo 10 vs 5, skip
    });
  });

  // --- Normalización de query pero NO de text ---
  it("text sin normalizar: substring directo falla, pero fuzzy rescata por tolerancia", () => {
    // "Harina De Trigo".includes("harina") → false (case-sensitive)
    // PERO levenshtein("harina", "Harina") = 1, maxDist(6) = 1 → matchea por fuzzy
    // Esto es un efecto colateral: la tolerancia a typos compensa la diferencia de case
    expect(fuzzyMatch("Harina De Trigo", "harina")).toBe(true);

    // Para tokens cortos (≤4) con case diff + otro cambio, falla:
    // levenshtein("sal", "SAL") = 3, maxDist(3) = 1 → no matchea
    expect(fuzzyMatch("SAL marina", "sal")).toBe(false);
  });

  it("text ya normalizado matchea por substring directo", () => {
    expect(fuzzyMatch("harina de trigo", "harina")).toBe(true);
  });

  it("query con puntuación se limpia", () => {
    expect(fuzzyMatch("harina de trigo", "harina!")).toBe(true);
    expect(fuzzyMatch("item especial", "(especial)")).toBe(true);
  });
});

// ─── insumoToSearchText ──────────────────────────────────────────────
describe("insumoToSearchText", () => {
  it("concatena todos los campos y normaliza", () => {
    const insumo = {
      id: 42,
      nombre: "Harina Blanca",
      unidad_medida: "kg",
      categoria: { nombre: "Materias Primas" },
      stock_critico: 100,
      activo: true,
    };
    const result = insumoToSearchText(insumo);

    // Verifica que contiene todos los campos, normalizados a minúscula sin tildes
    expect(result).toContain("42");
    expect(result).toContain("harina blanca");
    expect(result).toContain("kg");
    expect(result).toContain("materias primas");
    expect(result).toContain("100");
    expect(result).toContain("si");
  });

  it("insumo inactivo incluye 'no' en vez de 'si'", () => {
    const result = insumoToSearchText({ nombre: "Sal", activo: false });
    expect(result).toContain("sal");
    expect(result).toContain("no");
    expect(result).not.toContain("si");
  });

  it("campos faltantes se omiten (filter(Boolean))", () => {
    const result = insumoToSearchText({ nombre: "Agua" });
    // activo es undefined → falsy → ternario da "no"
    expect(result).toBe("agua no");
  });

  it("null/undefined: activo es falsy → genera 'no'", () => {
    // insumo?.activo es undefined cuando insumo es null/undefined
    // undefined es falsy → ternario retorna "no"
    // parts = [undef, undef, undef, undef, undef, "no"]
    // filter(Boolean) → ["no"] → normalizeText("no") = "no"
    expect(insumoToSearchText(null)).toBe("no");
    expect(insumoToSearchText(undefined)).toBe("no");
  });

  it("remueve tildes en nombres", () => {
    const result = insumoToSearchText({ nombre: "Azúcar Morená", activo: true });
    expect(result).toContain("azucar morena");
  });

  it("resultado es usable directamente con fuzzyMatch", () => {
    const insumo = {
      id: 1,
      nombre: "Harina de Trigo",
      unidad_medida: "kg",
      activo: true,
    };
    const searchText = insumoToSearchText(insumo);
    // El searchText normalizado funciona con fuzzyMatch
    expect(fuzzyMatch(searchText, "harina trigo")).toBe(true);
    expect(fuzzyMatch(searchText, "HARINA")).toBe(true);
    expect(fuzzyMatch(searchText, "maíz")).toBe(false);
  });
});
