
const normalizeText = (value) => {
  if (value == null) return "";
  return value
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar tildes/diacríticos
    .replace(/[^a-z0-9\s]/g, " ") // quitar signos/puntuación
    .replace(/\s+/g, " ")
    .trim();
};

// Levenshtein clásico (distancia de edición)
const levenshtein = (a, b) => {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    const ai = a.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      const cost = ai === b.charCodeAt(j - 1) ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // borrar
        dp[i][j - 1] + 1, // insertar
        dp[i - 1][j - 1] + cost // sustituir
      );
    }
  }
  return dp[m][n];
};

const insumoToSearchText = (insumo) => {
  const parts = [
    insumo?.id,
    insumo?.nombre,
    insumo?.unidad_medida,
    insumo?.categoria?.nombre,
    insumo?.stock_critico,
    insumo?.activo ? "si" : "no",
  ];
  return normalizeText(parts.filter(Boolean).join(" "));
};

const fuzzyMatch = (text, query) => {
  const q = normalizeText(query);
  if (!q) return true;

  // Coincidencia directa (rápida)
  if (text.includes(q)) return true;

  const tokens = q.split(" ").filter(Boolean);
  const words = text.split(/\s+/).filter(Boolean);

  // Cada token del query debe encontrar coincidencia (directa o por typo)
  return tokens.every((token) => {
    if (text.includes(token)) return true;

    // Tolerancia de typos proporcional al largo del token
    // (tokens cortos no deben ser demasiado permisivos)
    const maxDist = token.length <= 4 ? 1 : Math.floor(token.length * 0.25);

    return words.some((w) => {
      if (!w) return false;
      if (Math.abs(w.length - token.length) > maxDist) return false;
      return levenshtein(token, w) <= maxDist;
    });
  });
};

export { insumoToSearchText, fuzzyMatch };