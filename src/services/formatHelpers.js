function puntearMiles(s) {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ".";
    out += s[i];
  }
  return out;
}

export function formatRutDisplay(value) {
  if (!value) return "—";
  const clean = String(value).replace(/[^0-9kK]/g, "").toUpperCase();
  if (clean.length < 2) return value;
  const cuerpo = clean.slice(0, -1);
  const dv = clean.slice(-1);
  const cuerpoFmt = puntearMiles(cuerpo);
  return `${cuerpoFmt}-${dv}`;
}

export function esEmailValido(email){
    if (/\s/.test(email)) return false;          
    const partes = email.split('@');
    if (partes.length !== 2) return false;       
    const [local, dominio] = partes;
    if (!local) return false;                     
    const punto = dominio.lastIndexOf('.');
    return punto > 0 && punto < dominio.length - 1; 
  };

/**
 * Formatea un número en estilo es-CL (miles con punto, decimales con coma).
 * Por defecto muestra hasta 2 decimales (sin forzar ceros a la derecha).
 */
export function formatNumberCL(value, maxDecimals = 2, minDecimals = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";

  return new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals,
  }).format(num);
}

/**
 * Formatea un número como moneda CLP con separadores de miles y coma decimal.
 */
export function formatCLP(value, decimals = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

export function formatCLPCompact(value) {
  const n = Number(value) || 0;
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

export function toTitle(str) {
  if (!str) return "—";
  return String(str)
    .toLowerCase()
    .replace(/\b([a-záéíóúñü])([a-záéíóúñü]*)/gi, (_, f, r) => f.toUpperCase() + r);
}

export function formatPhone(value) {
  if (!value) return "—";
  const digits = String(value).replace(/\D/g, "");
  if (digits.length < 8) return value;

  const country = "+56";
  if (digits.length === 9) {

    return `${country} ${digits[0]} ${digits.slice(1, 5)} ${digits.slice(5)}`;
  }
  if (digits.length === 8) {
    return `${country} ${digits.slice(0, 4)} ${digits.slice(4)}`;
  }
  if (digits.length === 11 && digits.startsWith("56")) {
    const local = digits.slice(2);
    return `${country} ${local[0]} ${local.slice(1, 5)} ${local.slice(5)}`;
  }
  return value;
}

/**
 * Formatea un teléfono chileno progresivamente mientras se escribe en un input:
 * "+56 9 1234 5678". Pensado para onChange de campos controlados (distinto de
 * formatPhone, que es solo para mostrar un valor ya guardado).
 */
export function formatPhoneInput(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  const sinPrefijo = digits.startsWith("56") ? digits.slice(2) : digits;
  let out = "+56";
  if (sinPrefijo.length === 0) return out;
  out += " " + sinPrefijo.slice(0, 1);
  if (sinPrefijo.length <= 1) return out;
  out += " " + sinPrefijo.slice(1, 5);
  if (sinPrefijo.length <= 5) return out;
  out += " " + sinPrefijo.slice(5, 9);
  return out.trim();
}

/**
 * Valida un teléfono chileno con el formato que produce formatPhoneInput:
 * "+56 9 1234 5678".
 */
export function validarTelefonoCL(value) {
  return /^\+56\s\d\s\d{4}\s\d{4}$/.test(value);
}

export function formatEmail(v) {
  return v ? String(v).toLowerCase() : "—";
}

export function fmt(v) {
  if (v === null || v === undefined || v === "") return "—";
  return v;
}

export function formatPhoneDisplay(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function toTitleCaseES(input = "") {
  if (!input) return "";
  const keepLower = new Set([
    "de","del","la","las","los","y","e","o","u","al","el","en","da","do","dos","das","para","por","con"
  ]);
  const keepUpper = new Set([
    "S.A.","SA","S.A","SPA","LTDA","EIRL","SRL","S.A.C.","U.","UC","UCH","UDP","UTFSM","UDEC"
  ]);

  const words = String(input).trim().toLowerCase().split(/\s+/);

  const titled = words.map((w, idx) => {
    const raw = w.normalize("NFKC");
    const upperCandidate = raw.replace(/[,.;:!?()]/g, "").toUpperCase();
    if (keepUpper.has(upperCandidate)) return upperCandidate;
    if (idx !== 0 && keepLower.has(raw)) return raw;

    return raw.replace(/(^[a-záéíóúñü])|([-'][a-záéíóúñü])/g, (m) => m.toUpperCase());
  });

  return titled.join(" ");
}

export function validarRut(rut) {
  const rutLimpio = rut.replace(/\./g, "").replace("-", "");
  if (rutLimpio.length < 8) return false;
  const cuerpo = rutLimpio.slice(0, -1);
  const dv = rutLimpio.slice(-1).toUpperCase();
  let suma = 0;
  let multiplicador = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i], 10) * multiplicador;
    multiplicador = multiplicador < 7 ? multiplicador + 1 : 2;
  }
  const dvEsperado = 11 - (suma % 11);
  const dvFinal =
    dvEsperado === 11 ? "0" : dvEsperado === 10 ? "K" : String(dvEsperado);
  return dv === dvFinal;
}

