// Fixture con el schema real del backend (tabla formularios_calidad).
// Ya no es usado por las páginas (que consumen el API), pero sirve de
// referencia para ver la forma exacta que espera/entrega el backend.
//
// Tipos de campo soportados por el backend:
//   texto, numero, seleccion_unica, seleccion_multiple,
//   booleano, fecha, texto_largo, imagen
export const MOCK_FORMULARIOS = [
  {
    id: 1,
    codigo: "FORM-INSP-CAL-001",
    version: 1,
    nombre: "Inspección de Calidad — Producto Terminado",
    descripcion: "Formulario de inspección estándar para producto terminado.",
    frecuencia_esperada: "Por cada lote producido",
    tipo_firma: "digital",
    aprobado: true,
    activo: true,
    secciones: [
      {
        id: "sec-datos-generales",
        titulo: "Datos Generales",
        descripcion: "Información básica de la inspección",
        campos: [
          {
            id: "campo-fecha-inspeccion",
            etiqueta: "Fecha de inspección",
            tipo: "fecha",
            requerido: true,
          },
          {
            id: "campo-lote",
            etiqueta: "Código de lote",
            tipo: "texto",
            requerido: true,
            placeholder: "Ej: LOTE-2026-001",
            validaciones: { min_length: 3, max_length: 50 },
          },
          {
            id: "campo-observaciones-generales",
            etiqueta: "Observaciones generales",
            tipo: "texto_largo",
            requerido: false,
          },
        ],
      },
      {
        id: "sec-mediciones",
        titulo: "Mediciones",
        descripcion: "Mediciones físicas del producto",
        campos: [
          {
            id: "campo-temperatura",
            etiqueta: "Temperatura (°C)",
            tipo: "numero",
            requerido: true,
            validaciones: { min: -20, max: 200 },
          },
          {
            id: "campo-peso",
            etiqueta: "Peso (kg)",
            tipo: "numero",
            requerido: true,
            validaciones: { min: 0 },
          },
          {
            id: "campo-dentro-rango",
            etiqueta: "¿Dentro del rango esperado?",
            tipo: "booleano",
            requerido: true,
          },
        ],
      },
      {
        id: "sec-evaluacion-visual",
        titulo: "Evaluación Visual",
        descripcion: "Inspección visual del producto",
        campos: [
          {
            id: "campo-aspecto-general",
            etiqueta: "Aspecto general",
            tipo: "seleccion_unica",
            requerido: true,
            opciones: ["conforme", "observacion", "no_conforme"],
          },
          {
            id: "campo-defectos",
            etiqueta: "Defectos detectados",
            tipo: "seleccion_multiple",
            requerido: false,
            opciones: ["color", "olor", "textura", "envase", "etiqueta"],
          },
          {
            id: "campo-foto-evidencia",
            etiqueta: "Foto de evidencia",
            tipo: "imagen",
            requerido: false,
          },
        ],
      },
    ],
  },
];
