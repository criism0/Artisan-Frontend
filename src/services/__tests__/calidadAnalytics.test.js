import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────
vi.mock("../calidad", () => ({
  listarFormularios: vi.fn(),
  listarRespuestas: vi.fn(),
  META_ESTADO: "__estado",
  META_DETALLE: "__detalle",
}));

vi.mock("../usuarios", () => ({
  listarUsuarios: vi.fn(() => Promise.resolve([])),
}));

vi.mock("../scopeCheck", () => ({
  checkScope: vi.fn(() => true),
  ModelType: {
    FORMULARIO_CALIDAD: "FormularioCalidad",
    RESPUESTA_FORMULARIO_CALIDAD: "RespuestaFormularioCalidad",
  },
  ScopeType: { READ: "Read" },
}));

vi.mock("../../lib/toast", () => ({
  default: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn(), permissionError: vi.fn() },
}));

import {
  cargarDatosCalidad,
  derivarAlertas,
  calcularKpis,
  topFormulariosPorRespuestas,
  actividadReciente,
  desviosYNoConformidades,
  derivarEstadoRespuesta,
  derivarDetalleRespuesta,
  enriquecerRespuesta,
} from "../calidadAnalytics";
import { listarFormularios, listarRespuestas } from "../calidad";
import { listarUsuarios } from "../usuarios";
import { checkScope } from "../scopeCheck";
import toast from "../../lib/toast";

// ─── Helpers de fixtures ─────────────────────────────────────────────
function buildForm({ id = 1, codigo = "F1", nombre = "Form 1", aprobado = true, activo = true, secciones = [] } = {}) {
  return { id, codigo, nombre, aprobado, activo, secciones };
}

function buildSeccion({ id = "sec-1", titulo = "Sección 1", campos = [] } = {}) {
  return { id, titulo, campos };
}

function buildCampoNumero({ id = "campo-temp", etiqueta = "Temperatura", min = null, max = null } = {}) {
  const validaciones = {};
  if (min !== null) validaciones.min = min;
  if (max !== null) validaciones.max = max;
  return { id, etiqueta, tipo: "numero", validaciones };
}

function buildRespuesta({ id = "resp-1", respuestas = {}, completado_en = null, created_at = null, id_usuario = 7 } = {}) {
  return { id, respuestas, completado_en, created_at, id_usuario };
}

beforeEach(() => {
  vi.clearAllMocks();
  checkScope.mockReturnValue(true);
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── derivarAlertas ──────────────────────────────────────────────────
describe("derivarAlertas", () => {
  it("genera alerta cuando un valor numérico está bajo el min", () => {
    const form = buildForm({
      secciones: [
        buildSeccion({
          campos: [buildCampoNumero({ id: "c1", min: 10, max: 20 })],
        }),
      ],
    });
    const respuestas = new Map([[1, [buildRespuesta({ respuestas: { c1: 5 } })]]]);

    const alertas = derivarAlertas([form], respuestas);

    expect(alertas).toHaveLength(1);
    expect(alertas[0].valor).toBe(5);
    expect(alertas[0].min).toBe(10);
    expect(alertas[0].max).toBe(20);
    expect(alertas[0].formulario_id).toBe(1);
    expect(alertas[0].campo_id).toBe("c1");
  });

  it("genera alerta cuando un valor está sobre el max", () => {
    const form = buildForm({
      secciones: [buildSeccion({ campos: [buildCampoNumero({ id: "c1", max: 100 })] })],
    });
    const respuestas = new Map([[1, [buildRespuesta({ respuestas: { c1: 250 } })]]]);

    const alertas = derivarAlertas([form], respuestas);
    expect(alertas).toHaveLength(1);
    expect(alertas[0].valor).toBe(250);
  });

  it("NO genera alerta cuando el valor está dentro del rango", () => {
    const form = buildForm({
      secciones: [buildSeccion({ campos: [buildCampoNumero({ min: 10, max: 20 })] })],
    });
    const respuestas = new Map([[1, [buildRespuesta({ respuestas: { "campo-temp": 15 } })]]]);

    expect(derivarAlertas([form], respuestas)).toEqual([]);
  });

  it("ignora campos no-numéricos", () => {
    const form = buildForm({
      secciones: [
        buildSeccion({
          campos: [
            { id: "c1", etiqueta: "X", tipo: "texto", validaciones: { min: 10 } },
            { id: "c2", etiqueta: "Y", tipo: "booleano", validaciones: { min: 10 } },
          ],
        }),
      ],
    });
    const respuestas = new Map([[1, [buildRespuesta({ respuestas: { c1: "5", c2: false } })]]]);

    expect(derivarAlertas([form], respuestas)).toEqual([]);
  });

  it("ignora campos numéricos sin validaciones", () => {
    const form = buildForm({
      secciones: [
        buildSeccion({
          campos: [{ id: "c1", etiqueta: "X", tipo: "numero" }],
        }),
      ],
    });
    const respuestas = new Map([[1, [buildRespuesta({ respuestas: { c1: 999 } })]]]);
    expect(derivarAlertas([form], respuestas)).toEqual([]);
  });

  it("ignora campos numéricos con validaciones pero sin min/max", () => {
    const form = buildForm({
      secciones: [
        buildSeccion({
          campos: [{ id: "c1", etiqueta: "X", tipo: "numero", validaciones: { requerido: true } }],
        }),
      ],
    });
    const respuestas = new Map([[1, [buildRespuesta({ respuestas: { c1: 999 } })]]]);
    expect(derivarAlertas([form], respuestas)).toEqual([]);
  });

  it("ignora respuestas vacías (null, undefined, '')", () => {
    const form = buildForm({
      secciones: [buildSeccion({ campos: [buildCampoNumero({ id: "c1", min: 10 })] })],
    });
    const respuestas = new Map([
      [
        1,
        [
          buildRespuesta({ id: "r1", respuestas: { c1: null } }),
          buildRespuesta({ id: "r2", respuestas: { c1: undefined } }),
          buildRespuesta({ id: "r3", respuestas: { c1: "" } }),
        ],
      ],
    ]);
    expect(derivarAlertas([form], respuestas)).toEqual([]);
  });

  it("ignora respuestas no parseables a número", () => {
    const form = buildForm({
      secciones: [buildSeccion({ campos: [buildCampoNumero({ id: "c1", min: 10 })] })],
    });
    const respuestas = new Map([[1, [buildRespuesta({ respuestas: { c1: "abc" } })]]]);
    expect(derivarAlertas([form], respuestas)).toEqual([]);
  });

  it("severidad 'critica' cuando distanciaRel > 0.1, 'media' si no", () => {
    const form = buildForm({
      secciones: [
        buildSeccion({
          campos: [
            // max=100, valor=109 → (109-100)/100 = 0.09 → media
            buildCampoNumero({ id: "c1", max: 100 }),
            // max=100, valor=120 → (120-100)/100 = 0.20 → critica
            buildCampoNumero({ id: "c2", max: 100 }),
          ],
        }),
      ],
    });
    const respuestas = new Map([
      [1, [buildRespuesta({ respuestas: { c1: 109, c2: 120 } })]],
    ]);

    const alertas = derivarAlertas([form], respuestas);
    const a1 = alertas.find((a) => a.campo_id === "c1");
    const a2 = alertas.find((a) => a.campo_id === "c2");

    expect(a1.severidad).toBe("media");
    expect(a2.severidad).toBe("critica");
  });

  it("ordena alertas por fecha descendente", () => {
    const form = buildForm({
      secciones: [buildSeccion({ campos: [buildCampoNumero({ id: "c1", max: 100 })] })],
    });
    const respuestas = new Map([
      [
        1,
        [
          buildRespuesta({ id: "r1", respuestas: { c1: 200 }, completado_en: "2026-01-01T00:00:00Z" }),
          buildRespuesta({ id: "r2", respuestas: { c1: 200 }, completado_en: "2026-03-01T00:00:00Z" }),
          buildRespuesta({ id: "r3", respuestas: { c1: 200 }, completado_en: "2026-02-01T00:00:00Z" }),
        ],
      ],
    ]);

    const alertas = derivarAlertas([form], respuestas);
    expect(alertas.map((a) => a.fecha)).toEqual([
      "2026-03-01T00:00:00Z",
      "2026-02-01T00:00:00Z",
      "2026-01-01T00:00:00Z",
    ]);
  });

  it("usa created_at como fallback cuando completado_en es null", () => {
    const form = buildForm({
      secciones: [buildSeccion({ campos: [buildCampoNumero({ id: "c1", max: 10 })] })],
    });
    const respuestas = new Map([
      [
        1,
        [
          buildRespuesta({
            respuestas: { c1: 50 },
            completado_en: null,
            created_at: "2026-04-01T10:00:00Z",
          }),
        ],
      ],
    ]);

    const alertas = derivarAlertas([form], respuestas);
    expect(alertas[0].fecha).toBe("2026-04-01T10:00:00Z");
  });

  it("retorna [] cuando no hay formularios", () => {
    expect(derivarAlertas([], new Map())).toEqual([]);
  });

  it("retorna [] cuando un formulario no tiene secciones", () => {
    const form = buildForm({ secciones: [] });
    const respuestas = new Map([[1, [buildRespuesta({ respuestas: { c1: 50 } })]]]);
    expect(derivarAlertas([form], respuestas)).toEqual([]);
  });
});

// ─── calcularKpis ────────────────────────────────────────────────────
describe("calcularKpis", () => {
  beforeEach(() => {
    // Fija "ahora" en 2026-04-15 12:00:00 UTC
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-15T12:00:00Z"));
  });

  it("cuenta correctamente respuestas hoy / 24h / 7d", () => {
    const respuestas = [
      { completado_en: "2026-04-15T08:00:00Z" }, // hoy y 24h y 7d
      { completado_en: "2026-04-15T14:00:00Z" }, // hoy (futuro mismo día) y 24h y 7d
      { completado_en: "2026-04-14T20:00:00Z" }, // ayer (24h sí, hoy no) y 7d
      { completado_en: "2026-04-10T10:00:00Z" }, // 7d sí, 24h no, hoy no
      { completado_en: "2026-03-01T10:00:00Z" }, // ninguna ventana
      { completado_en: null }, // se ignora
    ];
    const kpis = calcularKpis({ formularios: [], respuestas, alertas: [] });

    expect(kpis.respuestas_hoy).toBe(2);
    expect(kpis.respuestas_ultimas_24h).toBe(3);
    expect(kpis.respuestas_ultimos_7d).toBe(4);
  });

  it("cuenta formularios activos / aprobados / pendientes", () => {
    const formularios = [
      buildForm({ id: 1, activo: true, aprobado: true }),
      buildForm({ id: 2, activo: true, aprobado: false }),
      buildForm({ id: 3, activo: true, aprobado: false }),
      buildForm({ id: 4, activo: false, aprobado: true }), // excluido
    ];
    const kpis = calcularKpis({ formularios, respuestas: [], alertas: [] });

    expect(kpis.total_formularios_activos).toBe(3);
    expect(kpis.formularios_aprobados).toBe(1);
    expect(kpis.formularios_pendientes_aprobacion).toBe(2);
  });

  it("cuenta alertas críticas y de últimas 24h", () => {
    const alertas = [
      { severidad: "critica", fecha: "2026-04-15T10:00:00Z" },
      { severidad: "critica", fecha: "2026-04-10T10:00:00Z" }, // fuera de 24h
      { severidad: "media", fecha: "2026-04-15T10:00:00Z" },
      { severidad: "media", fecha: null }, // se ignora en 24h
    ];
    const kpis = calcularKpis({ formularios: [], respuestas: [], alertas });

    expect(kpis.total_alertas).toBe(4);
    expect(kpis.alertas_criticas).toBe(2);
    expect(kpis.alertas_ultimas_24h).toBe(2);
  });

  it("retorna ceros cuando todas las entradas están vacías", () => {
    const kpis = calcularKpis({ formularios: [], respuestas: [], alertas: [] });
    expect(kpis).toEqual({
      total_formularios_activos: 0,
      formularios_aprobados: 0,
      formularios_pendientes_aprobacion: 0,
      respuestas_hoy: 0,
      respuestas_ultimas_24h: 0,
      respuestas_ultimos_7d: 0,
      total_conformes: 0,
      total_desvios: 0,
      total_no_conformes: 0,
      desvios_ultimas_24h: 0,
      no_conformes_ultimas_24h: 0,
      total_alertas: 0,
      alertas_criticas: 0,
      alertas_ultimas_24h: 0,
    });
  });

  it("cuenta respuestas por estado y los desvíos/no conformidades en últimas 24h", () => {
    const ahora = new Date();
    const ayer = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);
    const haceDosDias = new Date(ahora.getTime() - 2 * 24 * 60 * 60 * 1000);
    const enRango = new Date(ahora.getTime() - 60 * 60 * 1000);

    const respuestas = [
      { id: 1, estado: "conforme", completado_en: enRango.toISOString() },
      { id: 2, estado: "conforme", completado_en: haceDosDias.toISOString() },
      { id: 3, estado: "desvio", completado_en: enRango.toISOString() },
      { id: 4, estado: "desvio", completado_en: haceDosDias.toISOString() },
      { id: 5, estado: "no-conforme", completado_en: enRango.toISOString() },
      { id: 6, estado: "no-conforme", completado_en: ayer.toISOString() },
    ];

    const kpis = calcularKpis({ formularios: [], respuestas, alertas: [] });

    expect(kpis.total_conformes).toBe(2);
    expect(kpis.total_desvios).toBe(2);
    expect(kpis.total_no_conformes).toBe(2);
    expect(kpis.desvios_ultimas_24h).toBe(1);
    expect(kpis.no_conformes_ultimas_24h).toBe(2);
  });

  it("trata 'activo === false' como inactivo, undefined como activo", () => {
    const formularios = [
      buildForm({ id: 1, activo: undefined, aprobado: true }), // activo (undefined !== false)
      buildForm({ id: 2, activo: false, aprobado: true }), // inactivo
    ];
    const kpis = calcularKpis({ formularios, respuestas: [], alertas: [] });
    expect(kpis.total_formularios_activos).toBe(1);
  });
});

// ─── topFormulariosPorRespuestas ─────────────────────────────────────
describe("topFormulariosPorRespuestas", () => {
  it("ordena por cantidad descendente y respeta el límite", () => {
    const forms = [
      buildForm({ id: 1, codigo: "A", nombre: "Form A" }),
      buildForm({ id: 2, codigo: "B", nombre: "Form B" }),
      buildForm({ id: 3, codigo: "C", nombre: "Form C" }),
    ];
    const respuestas = new Map([
      [1, [{ id: "r1" }, { id: "r2" }]],
      [2, [{ id: "r3" }, { id: "r4" }, { id: "r5" }]],
      [3, [{ id: "r6" }]],
    ]);

    const top = topFormulariosPorRespuestas(forms, respuestas, 2);
    expect(top).toHaveLength(2);
    expect(top[0]).toEqual({ id: 2, codigo: "B", nombre: "Form B", cantidad: 3 });
    expect(top[1]).toEqual({ id: 1, codigo: "A", nombre: "Form A", cantidad: 2 });
  });

  it("default limit=5 devuelve hasta 5", () => {
    const forms = Array.from({ length: 10 }, (_, i) => buildForm({ id: i + 1 }));
    const respuestas = new Map(forms.map((f) => [f.id, [{ id: `r-${f.id}` }]]));
    expect(topFormulariosPorRespuestas(forms, respuestas)).toHaveLength(5);
  });

  it("formularios sin respuestas tienen cantidad 0", () => {
    const forms = [buildForm({ id: 1 })];
    const top = topFormulariosPorRespuestas(forms, new Map());
    expect(top[0].cantidad).toBe(0);
  });
});

// ─── actividadReciente ───────────────────────────────────────────────
describe("actividadReciente", () => {
  it("ordena descendente por fecha y respeta límite", () => {
    const forms = [buildForm({ id: 1, codigo: "F1", nombre: "Form 1" })];
    const respuestas = [
      { id: "r1", formulario_id: 1, completado_en: "2026-01-01T00:00:00Z", id_usuario: 1 },
      { id: "r2", formulario_id: 1, completado_en: "2026-03-01T00:00:00Z", id_usuario: 2 },
      { id: "r3", formulario_id: 1, completado_en: "2026-02-01T00:00:00Z", id_usuario: 3 },
    ];

    const result = actividadReciente(forms, respuestas, 2);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("r2");
    expect(result[1].id).toBe("r3");
  });

  it("devuelve fallback '—' cuando el formulario no existe en el map", () => {
    const result = actividadReciente(
      [],
      [{ id: "r1", formulario_id: 999, completado_en: "2026-01-01T00:00:00Z", id_usuario: 1 }]
    );

    expect(result[0].formulario_codigo).toBe("—");
    expect(result[0].formulario_nombre).toBe("—");
  });

  it("default limit=10", () => {
    const forms = [buildForm({ id: 1 })];
    const respuestas = Array.from({ length: 25 }, (_, i) => ({
      id: `r-${i}`,
      formulario_id: 1,
      completado_en: `2026-01-${String((i % 28) + 1).padStart(2, "0")}T00:00:00Z`,
      id_usuario: 1,
    }));

    expect(actividadReciente(forms, respuestas)).toHaveLength(10);
  });

  it("preserva id_usuario y fecha", () => {
    const forms = [buildForm({ id: 1, codigo: "F1", nombre: "Form 1" })];
    const result = actividadReciente(forms, [
      { id: "r1", formulario_id: 1, completado_en: "2026-04-15T10:00:00Z", id_usuario: 42 },
    ]);

    expect(result[0]).toMatchObject({
      id: "r1",
      formulario_codigo: "F1",
      formulario_nombre: "Form 1",
      fecha: "2026-04-15T10:00:00Z",
      id_usuario: 42,
    });
  });
});

// ─── desviosYNoConformidades ────────────────────────────────────────
describe("desviosYNoConformidades", () => {
  it("filtra desvíos y no conformes, ignora conformes, ordena por fecha desc", () => {
    const forms = [buildForm({ id: 1, codigo: "F1", nombre: "Form 1" })];
    const respuestas = [
      {
        id: "r1",
        formulario_id: 1,
        estado: "conforme",
        completado_en: "2026-04-15T10:00:00Z",
      },
      {
        id: "r2",
        formulario_id: 1,
        estado: "desvio",
        detalle: "humedad alta",
        completado_en: "2026-04-16T10:00:00Z",
      },
      {
        id: "r3",
        formulario_id: 1,
        estado: "no-conforme",
        detalle: "falla crítica",
        completado_en: "2026-04-17T10:00:00Z",
      },
    ];

    const result = desviosYNoConformidades(forms, respuestas, 5);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: "r3",
      estado: "no-conforme",
      detalle: "falla crítica",
      formulario_codigo: "F1",
    });
    expect(result[1]).toMatchObject({ id: "r2", estado: "desvio" });
  });

  it("respeta el límite", () => {
    const forms = [buildForm({ id: 1 })];
    const respuestas = Array.from({ length: 8 }, (_, i) => ({
      id: `r${i}`,
      formulario_id: 1,
      estado: "desvio",
      completado_en: `2026-04-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
    }));
    expect(desviosYNoConformidades(forms, respuestas, 3)).toHaveLength(3);
  });
});

// ─── derivarEstadoRespuesta ──────────────────────────────────────────
function buildCampoConformidad({
  id = "campo-aspecto",
  etiqueta = "Aspecto general",
  opciones = [
    { valor: "conforme", etiqueta: "Conforme" },
    { valor: "observacion", etiqueta: "Con observaciones" },
    { valor: "no_conforme", etiqueta: "No conforme" },
  ],
} = {}) {
  return { id, etiqueta, tipo: "seleccion_unica", opciones };
}

describe("derivarEstadoRespuesta", () => {
  const form = buildForm({
    secciones: [buildSeccion({ campos: [buildCampoConformidad()] })],
  });

  it("mapea 'no_conforme' a 'no-conforme'", () => {
    const r = buildRespuesta({ respuestas: { "campo-aspecto": "no_conforme" } });
    expect(derivarEstadoRespuesta(form, r)).toBe("no-conforme");
  });

  it("mapea 'observacion' a 'desvio'", () => {
    const r = buildRespuesta({ respuestas: { "campo-aspecto": "observacion" } });
    expect(derivarEstadoRespuesta(form, r)).toBe("desvio");
  });

  it("mapea 'conforme' a 'conforme'", () => {
    const r = buildRespuesta({ respuestas: { "campo-aspecto": "conforme" } });
    expect(derivarEstadoRespuesta(form, r)).toBe("conforme");
  });

  it("devuelve null cuando el formulario no tiene campo de conformidad", () => {
    const sinConformidad = buildForm({
      secciones: [buildSeccion({ campos: [buildCampoNumero({ id: "c1", max: 10 })] })],
    });
    const r = buildRespuesta({ respuestas: { c1: 5 } });
    expect(derivarEstadoRespuesta(sinConformidad, r)).toBeNull();
  });

  it("devuelve null cuando la respuesta no contestó el campo de conformidad", () => {
    const r = buildRespuesta({ respuestas: {} });
    expect(derivarEstadoRespuesta(form, r)).toBeNull();
  });

  it("ignora selecciones únicas que no son de conformidad", () => {
    const otro = buildForm({
      secciones: [
        buildSeccion({
          campos: [
            buildCampoConformidad({
              id: "campo-color",
              opciones: [
                { valor: "rojo", etiqueta: "Rojo" },
                { valor: "azul", etiqueta: "Azul" },
              ],
            }),
          ],
        }),
      ],
    });
    const r = buildRespuesta({ respuestas: { "campo-color": "rojo" } });
    expect(derivarEstadoRespuesta(otro, r)).toBeNull();
  });

  it("toma el peor estado cuando hay varios campos de conformidad", () => {
    const multi = buildForm({
      secciones: [
        buildSeccion({
          campos: [
            buildCampoConformidad({ id: "c-a" }),
            buildCampoConformidad({ id: "c-b" }),
          ],
        }),
      ],
    });
    const r = buildRespuesta({
      respuestas: { "c-a": "conforme", "c-b": "no_conforme" },
    });
    expect(derivarEstadoRespuesta(multi, r)).toBe("no-conforme");
  });

  it("normaliza acentos, mayúsculas y separadores ('No-Conforme')", () => {
    const r = buildRespuesta({ respuestas: { "campo-aspecto": "No-Conforme" } });
    expect(derivarEstadoRespuesta(form, r)).toBe("no-conforme");
  });
});

// ─── derivarDetalleRespuesta ─────────────────────────────────────────
describe("derivarDetalleRespuesta", () => {
  it("prioriza el campo cuya etiqueta/id sugiere detalle", () => {
    const form = buildForm({
      secciones: [
        buildSeccion({
          campos: [
            { id: "campo-notas", etiqueta: "Notas", tipo: "texto_largo" },
            { id: "campo-detalle-defectos", etiqueta: "Detalle de defectos", tipo: "texto_largo" },
          ],
        }),
      ],
    });
    const r = buildRespuesta({
      respuestas: {
        "campo-notas": "una nota cualquiera",
        "campo-detalle-defectos": "bolsa cortada",
      },
    });
    expect(derivarDetalleRespuesta(form, r)).toBe("bolsa cortada");
  });

  it("usa el primer texto largo no vacío si ninguno es prioritario", () => {
    const form = buildForm({
      secciones: [
        buildSeccion({
          campos: [{ id: "campo-notas", etiqueta: "Notas", tipo: "texto_largo" }],
        }),
      ],
    });
    const r = buildRespuesta({ respuestas: { "campo-notas": "algo" } });
    expect(derivarDetalleRespuesta(form, r)).toBe("algo");
  });

  it("devuelve '' cuando no hay texto largo con contenido", () => {
    const form = buildForm({
      secciones: [
        buildSeccion({
          campos: [{ id: "campo-notas", etiqueta: "Notas", tipo: "texto_largo" }],
        }),
      ],
    });
    expect(derivarDetalleRespuesta(form, buildRespuesta({ respuestas: { "campo-notas": "  " } }))).toBe("");
  });
});

// ─── enriquecerRespuesta ─────────────────────────────────────────────
describe("enriquecerRespuesta", () => {
  const form = buildForm({
    secciones: [
      buildSeccion({
        campos: [
          buildCampoConformidad(),
          { id: "campo-detalle-defectos", etiqueta: "Detalle de defectos", tipo: "texto_largo" },
        ],
      }),
    ],
  });

  it("agrega estado y detalle derivados para una no conformidad", () => {
    const r = buildRespuesta({
      respuestas: {
        "campo-aspecto": "no_conforme",
        "campo-detalle-defectos": "empaque dañado",
      },
    });
    expect(enriquecerRespuesta(form, r)).toMatchObject({
      estado: "no-conforme",
      detalle: "empaque dañado",
    });
  });

  it("deja detalle vacío cuando el estado es conforme", () => {
    const r = buildRespuesta({
      respuestas: { "campo-aspecto": "conforme", "campo-detalle-defectos": "x" },
    });
    expect(enriquecerRespuesta(form, r)).toMatchObject({ estado: "conforme", detalle: "" });
  });

  it("respeta estado/detalle que ya vengan del backend", () => {
    const r = buildRespuesta({ respuestas: { "campo-aspecto": "conforme" } });
    const enriquecida = enriquecerRespuesta(form, { ...r, estado: "desvio", detalle: "manual" });
    expect(enriquecida).toMatchObject({ estado: "desvio", detalle: "manual" });
  });

  it("usa el meta embebido (__estado/__detalle) por sobre la derivación", () => {
    // El campo de conformidad dice "conforme", pero el selector manual marcó
    // un desvío embebido en el JSONB: debe ganar el meta.
    const r = buildRespuesta({
      respuestas: {
        "campo-aspecto": "conforme",
        __estado: "desvio",
        __detalle: "desvío declarado a mano",
      },
    });
    expect(enriquecerRespuesta(form, r)).toMatchObject({
      estado: "desvio",
      detalle: "desvío declarado a mano",
    });
  });
});

// ─── cargarDatosCalidad ──────────────────────────────────────────────
describe("cargarDatosCalidad", () => {
  it("retorna undefined y avisa con toast.error si falta scope FORMULARIO_CALIDAD.READ", async () => {
    checkScope.mockImplementation((model) =>
      model === "FormularioCalidad" ? false : true
    );

    const result = await cargarDatosCalidad();
    expect(result).toBeUndefined();
    expect(toast.permissionError).toHaveBeenCalledTimes(1);
    expect(listarFormularios).not.toHaveBeenCalled();
  });

  it("retorna undefined y avisa con toast.error si falta scope RESPUESTA_FORMULARIO_CALIDAD.READ", async () => {
    checkScope.mockImplementation((model) =>
      model === "RespuestaFormularioCalidad" ? false : true
    );

    const result = await cargarDatosCalidad();
    expect(result).toBeUndefined();
    expect(toast.permissionError).toHaveBeenCalledTimes(1);
    expect(listarFormularios).not.toHaveBeenCalled();
  });

  it("agrega formulario_id a cada respuesta y construye respuestasPorForm", async () => {
    const forms = [buildForm({ id: 1 }), buildForm({ id: 2 })];
    listarFormularios.mockResolvedValue(forms);
    listarRespuestas.mockImplementation(async (id) => {
      if (id === 1) return [{ id: "r1" }, { id: "r2" }];
      if (id === 2) return [{ id: "r3" }];
      return [];
    });

    const result = await cargarDatosCalidad();

    expect(result.formularios).toEqual(forms);
    expect(result.respuestas).toHaveLength(3);
    expect(result.respuestas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "r1", formulario_id: 1 }),
        expect.objectContaining({ id: "r2", formulario_id: 1 }),
        expect.objectContaining({ id: "r3", formulario_id: 2 }),
      ])
    );
    expect(result.respuestasPorForm.get(1)).toHaveLength(2);
    expect(result.respuestasPorForm.get(2)).toHaveLength(1);
  });

  it("captura errores de listarRespuestas y trata el formulario como sin respuestas", async () => {
    listarFormularios.mockResolvedValue([buildForm({ id: 1 }), buildForm({ id: 2 })]);
    listarRespuestas.mockImplementation(async (id) => {
      if (id === 1) throw new Error("boom");
      return [{ id: "r3" }];
    });

    const result = await cargarDatosCalidad();
    expect(result.respuestasPorForm.get(1)).toEqual([]);
    expect(result.respuestasPorForm.get(2)).toHaveLength(1);
    expect(result.respuestas).toHaveLength(1);
  });

  it("trata listarFormularios no-array como []", async () => {
    listarFormularios.mockResolvedValue(null);
    const result = await cargarDatosCalidad();
    expect(result.formularios).toEqual([]);
    expect(result.respuestas).toEqual([]);
    expect(listarRespuestas).not.toHaveBeenCalled();
  });

  it("trata listarRespuestas no-array como []", async () => {
    listarFormularios.mockResolvedValue([buildForm({ id: 1 })]);
    listarRespuestas.mockResolvedValue("invalid-not-array");

    const result = await cargarDatosCalidad();
    expect(result.respuestasPorForm.get(1)).toEqual([]);
  });

  it("deriva estado y detalle de cada respuesta desde el JSONB", async () => {
    const form = buildForm({
      id: 1,
      secciones: [
        buildSeccion({
          campos: [
            buildCampoConformidad(),
            { id: "campo-detalle-defectos", etiqueta: "Detalle de defectos", tipo: "texto_largo" },
          ],
        }),
      ],
    });
    listarFormularios.mockResolvedValue([form]);
    listarRespuestas.mockResolvedValue([
      buildRespuesta({ id: "r1", respuestas: { "campo-aspecto": "conforme" } }),
      buildRespuesta({
        id: "r2",
        respuestas: {
          "campo-aspecto": "no_conforme",
          "campo-detalle-defectos": "empaque dañado",
        },
      }),
      buildRespuesta({ id: "r3", respuestas: { "campo-aspecto": "observacion" } }),
    ]);

    const result = await cargarDatosCalidad();

    const porId = Object.fromEntries(result.respuestas.map((r) => [r.id, r]));
    expect(porId.r1.estado).toBe("conforme");
    expect(porId.r2).toMatchObject({ estado: "no-conforme", detalle: "empaque dañado" });
    expect(porId.r3.estado).toBe("desvio");
  });

  it("resuelve el nombre del usuario en respuestas y alertas", async () => {
    const form = buildForm({
      id: 1,
      secciones: [buildSeccion({ campos: [buildCampoNumero({ id: "c1", max: 100 })] })],
    });
    listarFormularios.mockResolvedValue([form]);
    listarRespuestas.mockResolvedValue([
      buildRespuesta({ id: "r1", respuestas: { c1: 250 }, id_usuario: 7 }),
    ]);
    listarUsuarios.mockResolvedValueOnce([
      { id: 7, nombre: "Ana Pérez" },
      { id: 8, nombre: "Otro" },
    ]);

    const result = await cargarDatosCalidad();

    expect(result.respuestas[0].usuario_nombre).toBe("Ana Pérez");
    expect(result.alertas[0].usuario_nombre).toBe("Ana Pérez");
  });

  it("deja usuario_nombre en null cuando no se puede resolver el usuario", async () => {
    const form = buildForm({
      id: 1,
      secciones: [buildSeccion({ campos: [buildCampoNumero({ id: "c1", max: 100 })] })],
    });
    listarFormularios.mockResolvedValue([form]);
    listarRespuestas.mockResolvedValue([
      buildRespuesta({ id: "r1", respuestas: { c1: 250 }, id_usuario: 7 }),
    ]);
    listarUsuarios.mockRejectedValueOnce(new Error("403"));

    const result = await cargarDatosCalidad();

    expect(result.respuestas[0].usuario_nombre).toBeNull();
    expect(result.alertas[0].usuario_nombre).toBeNull();
  });

  it("integra alertas computadas con derivarAlertas", async () => {
    const form = buildForm({
      id: 1,
      secciones: [buildSeccion({ campos: [buildCampoNumero({ id: "c1", max: 100 })] })],
    });
    listarFormularios.mockResolvedValue([form]);
    listarRespuestas.mockResolvedValue([
      buildRespuesta({ respuestas: { c1: 250 } }),
    ]);

    const result = await cargarDatosCalidad();
    expect(result.alertas).toHaveLength(1);
    expect(result.alertas[0].valor).toBe(250);
  });
});
