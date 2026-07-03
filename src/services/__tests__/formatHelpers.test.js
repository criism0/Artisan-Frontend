import { describe, it, expect } from "vitest";
import {
  formatRutDisplay,
  formatNumberCL,
  formatCLP,
  toTitle,
  formatPhone,
  formatEmail,
  fmt,
  formatPhoneDisplay,
  toTitleCaseES,
  validarRut,
} from "../formatHelpers";

// ─── formatRutDisplay ────────────────────────────────────────────────
describe("formatRutDisplay", () => {
  it("formatea 123456789 → 12.345.678-9", () => {
    expect(formatRutDisplay("123456789")).toBe("12.345.678-9");
  });

  it("normaliza K minúscula a mayúscula", () => {
    expect(formatRutDisplay("12345678k")).toBe("12.345.678-K");
  });

  it("re-formatea un RUT ya formateado (idempotente)", () => {
    expect(formatRutDisplay("12.345.678-9")).toBe("12.345.678-9");
  });

  it("RUT corto de 2 dígitos: cuerpo 1 dígito + DV", () => {
    // clean = "59", cuerpo = "5", dv = "9" => "5-9"
    expect(formatRutDisplay("59")).toBe("5-9");
  });

  it("RUT de 1 solo dígito devuelve el valor original (no formatea)", () => {
    expect(formatRutDisplay("5")).toBe("5");
  });

  it("retorna '—' para valores falsy: null, undefined, '', 0", () => {
    expect(formatRutDisplay(null)).toBe("—");
    expect(formatRutDisplay(undefined)).toBe("—");
    expect(formatRutDisplay("")).toBe("—");
    // 0 es falsy => "—"
    expect(formatRutDisplay(0)).toBe("—");
  });

  it("strippea letras que no sean K", () => {
    // "1A2B3C4D5" → limpia a "12345" → "1.234-5"
    expect(formatRutDisplay("1A2B3C4D5")).toBe("1.234-5");
  });
});

// ─── formatNumberCL ──────────────────────────────────────────────────
describe("formatNumberCL", () => {
  it("formatea entero con separador de miles", () => {
    expect(formatNumberCL(1234567)).toBe("1.234.567");
  });

  it("formatea decimal con coma", () => {
    expect(formatNumberCL(1234.56)).toBe("1.234,56");
  });

  it("redondea decimales según maxDecimals", () => {
    expect(formatNumberCL(1.2367, 3)).toBe("1,237");
    expect(formatNumberCL(1.5, 0)).toBe("2");
  });

  it("fuerza decimales mínimos con minDecimals", () => {
    expect(formatNumberCL(10, 2, 2)).toBe("10,00");
  });

  it("retorna '—' para NaN, Infinity, undefined", () => {
    expect(formatNumberCL(Number.NaN)).toBe("—");
    expect(formatNumberCL(Number.POSITIVE_INFINITY)).toBe("—");
    expect(formatNumberCL(Number.NEGATIVE_INFINITY)).toBe("—");
    expect(formatNumberCL("abc")).toBe("—");
    expect(formatNumberCL(undefined)).toBe("—");
  });

  // EDGE CASE: Number("") === 0 y Number(null) === 0 → NO retorna "—"
  it("string vacío y null se convierten a 0 (Number('') === 0)", () => {
    expect(formatNumberCL("")).toBe("0");
    expect(formatNumberCL(null)).toBe("0");
  });

  it("formatea negativos correctamente", () => {
    const result = formatNumberCL(-5000);
    expect(result).toBe("-5.000");
  });

  it("formatea cero", () => {
    expect(formatNumberCL(0)).toBe("0");
  });
});

// ─── formatCLP ───────────────────────────────────────────────────────
describe("formatCLP", () => {
  it("incluye símbolo de moneda CLP", () => {
    const result = formatCLP(1500);
    // El formato es-CL CLP puede ser "$1.500,00" o "CLP 1.500,00"
    expect(result).toMatch(/\$\s?1\.500,00/);
  });

  it("respeta el parámetro decimals", () => {
    const result = formatCLP(1500, 0);
    expect(result).not.toContain(",");
  });

  it("retorna '—' para valores no finitos", () => {
    expect(formatCLP("abc")).toBe("—");
    expect(formatCLP(Number.NaN)).toBe("—");
  });

  // EDGE CASE: mismo que formatNumberCL
  it("string vacío se convierte a $0", () => {
    const result = formatCLP("");
    expect(result).toMatch(/\$\s?0,00/);
  });
});

// ─── toTitle ─────────────────────────────────────────────────────────
describe("toTitle", () => {
  it("capitaliza primera letra de cada palabra", () => {
    expect(toTitle("hola mundo")).toBe("Hola Mundo");
  });

  it("pasa todo a minúscula primero y luego capitaliza", () => {
    expect(toTitle("HOLA MUNDO")).toBe("Hola Mundo");
  });

  it("maneja palabras con tilde", () => {
    expect(toTitle("josé maría")).toBe("José María");
  });

  it("maneja ñ", () => {
    expect(toTitle("año nuevo")).toBe("Año Nuevo");
  });

  it("retorna '—' para valores falsy", () => {
    expect(toTitle("")).toBe("—");
    expect(toTitle(null)).toBe("—");
    expect(toTitle(undefined)).toBe("—");
    // 0 es falsy
    expect(toTitle(0)).toBe("—");
  });

  it("convierte número a string si es truthy", () => {
    // toTitle(123) → String(123) = "123", no hay letras → "123" sin cambios
    expect(toTitle(123)).toBe("123");
  });
});

// ─── formatPhone ─────────────────────────────────────────────────────
describe("formatPhone", () => {
  it("celular 9 dígitos: +56 9 XXXX XXXX", () => {
    expect(formatPhone("912345678")).toBe("+56 9 1234 5678");
  });

  it("fijo 8 dígitos: +56 XXXX XXXX", () => {
    expect(formatPhone("22345678")).toBe("+56 2234 5678");
  });

  it("con prefijo 56 (11 dígitos): normaliza a +56", () => {
    expect(formatPhone("56912345678")).toBe("+56 9 1234 5678");
  });

  it("retorna '—' para valores falsy", () => {
    expect(formatPhone("")).toBe("—");
    expect(formatPhone(null)).toBe("—");
    expect(formatPhone(undefined)).toBe("—");
  });

  it("retorna valor original si < 8 dígitos", () => {
    expect(formatPhone("1234")).toBe("1234");
    expect(formatPhone("1234567")).toBe("1234567");
  });

  it("retorna valor original para 10 dígitos (no matchea ningún formato)", () => {
    expect(formatPhone("1234567890")).toBe("1234567890");
  });

  it("retorna valor original para 11 dígitos que NO empiecen con 56", () => {
    expect(formatPhone("12345678901")).toBe("12345678901");
  });

  it("stripea caracteres no-numéricos antes de formatear", () => {
    expect(formatPhone("+56 9 1234 5678")).toBe("+56 9 1234 5678");
  });
});

// ─── formatEmail ─────────────────────────────────────────────────────
describe("formatEmail", () => {
  it("convierte a minúsculas", () => {
    expect(formatEmail("USER@Mail.Com")).toBe("user@mail.com");
  });

  it("retorna '—' para falsy", () => {
    expect(formatEmail("")).toBe("—");
    expect(formatEmail(null)).toBe("—");
    expect(formatEmail(undefined)).toBe("—");
  });

  // EDGE CASE: 0 es falsy → "—"
  it("0 es falsy → retorna '—'", () => {
    expect(formatEmail(0)).toBe("—");
  });
});

// ─── fmt ─────────────────────────────────────────────────────────────
describe("fmt", () => {
  it("retorna el valor para cualquier truthy o 0 o false", () => {
    expect(fmt("hola")).toBe("hola");
    expect(fmt(123)).toBe(123);
    expect(fmt(0)).toBe(0);
    expect(fmt(false)).toBe(false);
  });

  it("retorna '—' solo para null, undefined, string vacío", () => {
    expect(fmt(null)).toBe("—");
    expect(fmt(undefined)).toBe("—");
    expect(fmt("")).toBe("—");
  });

  // EDGE CASE: NaN pasa porque no es null/undefined/""
  it("NaN pasa (no es null ni undefined ni '')", () => {
    expect(fmt(Number.NaN)).toBeNaN();
  });
});

// ─── formatPhoneDisplay ──────────────────────────────────────────────
describe("formatPhoneDisplay", () => {
  it("colapsa espacios múltiples", () => {
    expect(formatPhoneDisplay("+56  9  1234  5678")).toBe("+56 9 1234 5678");
  });

  it("trim al inicio y final", () => {
    expect(formatPhoneDisplay("  +56 9  ")).toBe("+56 9");
  });

  it("retorna '' para vacío o sin argumento", () => {
    expect(formatPhoneDisplay("")).toBe("");
    expect(formatPhoneDisplay()).toBe("");
  });

  it("convierte null a ''", () => {
    expect(formatPhoneDisplay(null)).toBe("");
  });
});

// ─── toTitleCaseES ───────────────────────────────────────────────────
describe("toTitleCaseES", () => {
  it("capitaliza palabras normales", () => {
    expect(toTitleCaseES("empresa grande")).toBe("Empresa Grande");
  });

  it("artículos en minúscula en posición no-inicial", () => {
    expect(toTitleCaseES("casa de la playa")).toBe("Casa de la Playa");
    expect(toTitleCaseES("viña del mar")).toBe("Viña del Mar");
  });

  it("primera palabra siempre capitalizada, incluso si es artículo", () => {
    expect(toTitleCaseES("de la empresa")).toBe("De la Empresa");
    expect(toTitleCaseES("el mundo")).toBe("El Mundo");
  });

  it("siglas se mantienen en mayúscula", () => {
    // keepUpper busca el token sin puntuación → "s.a." → strip → "SA" → match
    expect(toTitleCaseES("empresa sa")).toBe("Empresa SA");
    expect(toTitleCaseES("empresa ltda")).toBe("Empresa LTDA");
    expect(toTitleCaseES("tech spa")).toBe("Tech SPA");
    expect(toTitleCaseES("empresa eirl")).toBe("Empresa EIRL");
  });

  it("maneja palabras con guión: capitaliza tras el guión", () => {
    expect(toTitleCaseES("jean-pierre")).toBe("Jean-Pierre");
  });

  it("retorna '' para input vacío", () => {
    expect(toTitleCaseES("")).toBe("");
    expect(toTitleCaseES()).toBe("");
  });

  it("preserva todos los artículos del set keepLower", () => {
    // Todos estos deben quedar en minúscula en posición no-inicial
    expect(toTitleCaseES("casa de los sueños")).toBe("Casa de los Sueños");
    expect(toTitleCaseES("pan con queso y sal")).toBe("Pan con Queso y Sal");
    expect(toTitleCaseES("vino para la mesa")).toBe("Vino para la Mesa");
  });
});

// ─── validarRut ──────────────────────────────────────────────────────
describe("validarRut", () => {
  // RUTs reales conocidos
  it("valida 12.345.678-5 (DV=5 correcto)", () => {
    // cuerpo: 12345678, suma = 8*2+7*3+6*4+5*5+4*6+3*7+2*2+1*3 = 138
    // 11-(138%11) = 11-6 = 5 ✓
    expect(validarRut("12.345.678-5")).toBe(true);
  });

  it("valida 11.111.111-1 (DV=1 correcto)", () => {
    // suma = 1*(2+3+4+5+6+7+2+3) = 32 → 11-(32%11) = 11-10 = 1 ✓
    expect(validarRut("11.111.111-1")).toBe(true);
  });

  it("valida RUT real (76.086.428-5)", () => {
    expect(validarRut("76.086.428-5")).toBe(true);
  });

  it("valida RUT con DV=K (40.000.000-K)", () => {
    // cuerpo "40000000": 0+0+0+0+0+0+0+4*3 = 12, 12%11=1 → dvEsperado=10 → "K"
    expect(validarRut("40.000.000-K")).toBe(true);
    expect(validarRut("40000000-k")).toBe(true);
  });

  it("valida RUT sin formato (solo dígitos)", () => {
    expect(validarRut("123456785")).toBe(true);
  });

  it("rechaza RUT con DV incorrecto", () => {
    expect(validarRut("12.345.678-0")).toBe(false);
    expect(validarRut("12.345.678-K")).toBe(false);
    expect(validarRut("12.345.678-1")).toBe(false);
  });

  it("rechaza RUT con menos de 8 caracteres (sin puntos/guión)", () => {
    expect(validarRut("1234567")).toBe(false);
    expect(validarRut("123456")).toBe(false);
  });

  it("acepta RUT con exactamente 8 caracteres limpios", () => {
    // "7654321-X" → limpio "7654321X" → length 8, cuerpo "7654321"
    // 1*2+2*3+3*4+4*5+5*6+6*7+7*2 = 2+6+12+20+30+42+14 = 126
    // 126%11 = 126-121 = 5 → 11-5 = 6 → dvFinal="6"
    expect(validarRut("7654321-6")).toBe(true);
    expect(validarRut("7654321-7")).toBe(false);
  });

  it("DV=0 cuando dvEsperado=11 (suma%11===0)", () => {
    // cuerpo "10000200": 0*2+0*3+2*4+0*5+0*6+0*7+0*2+1*3 = 11
    // 11%11=0 → dvEsperado=11 → dvFinal="0"
    expect(validarRut("10.000.200-0")).toBe(true);
    expect(validarRut("10000200-0")).toBe(true);
    expect(validarRut("10.000.200-1")).toBe(false);
  });
});
