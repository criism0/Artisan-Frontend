import { describe, it, expect } from "vitest";
import {
  SIN_VALOR,
  ETIQUETA_SIN_VALOR,
  filtroActivo,
  contarFiltrosColumna,
  valorDeFiltro,
  opcionesDeColumna,
  filaPasaFiltroColumna,
  filaPasaFiltros,
  filtroVacio,
  inferirFiltro,
} from "../filtrosColumna";

const colEstado = { accessor: "estado", filtro: "valores" };
const colComuna = {
  accessor: "comuna",
  filtro: "valores",
  filtroValor: (r) => r.direccion?.comuna,
};
const colTexto = { accessor: "numero_oc", filtro: "texto" };
const colNumero = { accessor: "ingreso_venta", filtro: "numero" };
const colFecha = { accessor: "fecha_entrega", filtro: "fecha" };

const fila = (over = {}) => ({
  estado: "Facturada",
  numero_oc: "PO-122586",
  ingreso_venta: 2000,
  fecha_entrega: "2026-09-15",
  direccion: { comuna: "Vitacura" },
  ...over,
});

describe("filtroActivo", () => {
  it("un filtro recién abierto no filtra nada", () => {
    expect(filtroActivo(filtroVacio("valores"))).toBe(false);
    expect(filtroActivo(filtroVacio("texto"))).toBe(false);
    expect(filtroActivo(filtroVacio("numero"))).toBe(false);
    expect(filtroActivo(filtroVacio("fecha"))).toBe(false);
    expect(filtroActivo(undefined)).toBe(false);
  });

  it("se activa con algo puesto", () => {
    expect(filtroActivo({ tipo: "valores", seleccion: ["Facturada"] })).toBe(true);
    expect(filtroActivo({ tipo: "texto", q: "PO" })).toBe(true);
    expect(filtroActivo({ tipo: "numero", min: "100", max: "" })).toBe(true);
    expect(filtroActivo({ tipo: "numero", min: "", max: "500" })).toBe(true);
    expect(filtroActivo({ tipo: "fecha", desde: "2026-09-01", hasta: "" })).toBe(true);
  });

  // Un espacio no es un criterio: si contara, el chip de "columnas filtradas" quedaría encendido
  // sin que nada se esté filtrando y el usuario buscaría un filtro que no existe.
  it("un texto de puros espacios no cuenta", () => {
    expect(filtroActivo({ tipo: "texto", q: "   " })).toBe(false);
  });

  it("el 0 sí es un límite válido", () => {
    expect(filtroActivo({ tipo: "numero", min: "0", max: "" })).toBe(true);
  });
});

describe("valorDeFiltro", () => {
  it("usa filtroValor cuando la columna lo declara", () => {
    expect(valorDeFiltro(colComuna, fila())).toBe("Vitacura");
  });

  it("cae al accessor cuando no hay filtroValor ni sortValue", () => {
    expect(valorDeFiltro(colEstado, fila())).toBe("Facturada");
  });

  // Las columnas que muestran un objeto ya declaran `sortValue` para poder ordenarse; el filtro
  // lo reutiliza en vez de obligar a declarar lo mismo dos veces.
  it("cae a sortValue cuando la celda trae un objeto", () => {
    const col = { accessor: "cliente", sortValue: (r) => r.cliente?.nombre };
    expect(valorDeFiltro(col, { cliente: { nombre: "Better Food" } })).toBe("Better Food");
  });

  // 🔴 EL CASO QUE OBLIGÓ A INVERTIR LA PRIORIDAD, cazado probando Solicitudes en vivo: sus tres
  // columnas de fecha ordenan por `new Date(x).getTime()`, y tomando ese número como valor de
  // filtro quedaban con un rango NUMÉRICO que pedía milisegundos.
  it("el valor crudo le gana a sortValue: una fecha no se filtra por su timestamp", () => {
    const col = { accessor: "fecha_envio", sortValue: (r) => new Date(r.fecha_envio).getTime() };
    const row = { fecha_envio: "2026-09-15" };
    expect(valorDeFiltro(col, row)).toBe("2026-09-15");
    expect(inferirFiltro(col, [row])).toBe("fecha");
  });

  // 🔴 La segunda mitad del mismo bug, y sólo apareció probando Solicitudes con datos reales:
  // 2 de cada 3 solicitudes no tienen `fecha_envio`, y su `sortValue` devuelve 0 para poder
  // ordenarlas. Ese 0 entraba a la muestra y la volvía «números y fechas mezclados» → texto.
  it("una celda vacía es vacía, no el 0 que devuelve su sortValue", () => {
    const col = { accessor: "fecha_envio", sortValue: (r) => (r.fecha_envio ? new Date(r.fecha_envio).getTime() : 0) };
    expect(valorDeFiltro(col, { fecha_envio: null })).toBeNull();

    const filas = [
      { fecha_envio: null },
      { fecha_envio: "2026-07-23T21:12:28.175Z" },
      { fecha_envio: null },
      { fecha_envio: "2026-07-30T15:11:39.746Z" },
    ];
    expect(inferirFiltro(col, filas)).toBe("fecha");
  });

  it("si la fila ni siquiera trae la clave, ahí sí manda sortValue", () => {
    const col = { accessor: "comuna_despacho", sortValue: (r) => r.direccion?.comuna || "" };
    expect(valorDeFiltro(col, { direccion: { comuna: "Vitacura" } })).toBe("Vitacura");
  });

  it("lo mismo con un estado que ordena por un número de orden", () => {
    const col = { accessor: "estado", sortValue: (r) => ({ Creada: 1, Validada: 2 })[r.estado] };
    expect(valorDeFiltro(col, { estado: "Validada" })).toBe("Validada");
  });
});

describe("opcionesDeColumna", () => {
  const data = [
    fila({ estado: "Facturada" }),
    fila({ estado: "Facturada" }),
    fila({ estado: "Validada" }),
    fila({ estado: null }),
  ];

  it("lista los valores distintos con su conteo", () => {
    expect(opcionesDeColumna(colEstado, data)).toEqual([
      { valor: "Facturada", etiqueta: "Facturada", n: 2 },
      { valor: "Validada", etiqueta: "Validada", n: 1 },
      { valor: SIN_VALOR, etiqueta: ETIQUETA_SIN_VALOR, n: 1 },
    ]);
  });

  // Los vacíos son el caso menos buscado; arriba estorban la lectura de la lista.
  it("deja los vacíos al final", () => {
    const opciones = opcionesDeColumna(colEstado, data);
    expect(opciones[opciones.length - 1].valor).toBe(SIN_VALOR);
  });

  it("una cadena de espacios cuenta como vacío, no como un valor propio", () => {
    const opciones = opcionesDeColumna(colEstado, [fila({ estado: "   " })]);
    expect(opciones).toEqual([{ valor: SIN_VALOR, etiqueta: ETIQUETA_SIN_VALOR, n: 1 }]);
  });

  it("ordena con criterio español y numérico", () => {
    const d = [fila({ estado: "Ñandú" }), fila({ estado: "Alfa" }), fila({ estado: "Zeta" })];
    expect(opcionesDeColumna(colEstado, d).map((o) => o.valor)).toEqual(["Alfa", "Ñandú", "Zeta"]);
  });

  it("sin datos no ofrece opciones", () => {
    expect(opcionesDeColumna(colEstado, [])).toEqual([]);
  });
});

// 🔴 El filtro se guarda en localStorage, o sea que viaja por JSON. La primera versión usaba
// una cadena centinela con un byte de control adentro: además de sobrevivir mal al viaje, hacía
// que git tratara el archivo fuente como binario y dejara de mostrar sus diffs.
describe("el centinela de vacío sobrevive a localStorage", () => {
  it("va y vuelve por JSON sin cambiar", () => {
    const filtro = { tipo: "valores", seleccion: [SIN_VALOR, "Renca"] };
    const ida = JSON.parse(JSON.stringify(filtro));
    expect(ida).toEqual(filtro);
    expect(filaPasaFiltroColumna(colComuna, ida, fila({ direccion: null }))).toBe(true);
    expect(filaPasaFiltroColumna(colComuna, ida, fila())).toBe(false);
  });

  it("no es un texto que pueda chocar con un valor real de la columna", () => {
    expect(typeof SIN_VALOR).not.toBe("string");
  });
});

describe("filaPasaFiltroColumna", () => {
  it("un filtro vacío no deja nada fuera", () => {
    expect(filaPasaFiltroColumna(colEstado, filtroVacio("valores"), fila())).toBe(true);
  });

  describe("valores", () => {
    it("deja pasar lo seleccionado", () => {
      const f = { tipo: "valores", seleccion: ["Facturada"] };
      expect(filaPasaFiltroColumna(colEstado, f, fila())).toBe(true);
      expect(filaPasaFiltroColumna(colEstado, f, fila({ estado: "Validada" }))).toBe(false);
    });

    it("varios valores se suman", () => {
      const f = { tipo: "valores", seleccion: ["Facturada", "Validada"] };
      expect(filaPasaFiltroColumna(colEstado, f, fila({ estado: "Validada" }))).toBe(true);
      expect(filaPasaFiltroColumna(colEstado, f, fila({ estado: "Creada" }))).toBe(false);
    });

    // 31 de las 220 órdenes de producción no tienen dirección: encontrarlas es un caso de uso
    // real, así que "(vacío)" es una opción de verdad y no la ausencia de filtro.
    it("«(vacío)» es una opción que se puede elegir", () => {
      const f = { tipo: "valores", seleccion: [SIN_VALOR] };
      expect(filaPasaFiltroColumna(colComuna, f, fila({ direccion: null }))).toBe(true);
      expect(filaPasaFiltroColumna(colComuna, f, fila())).toBe(false);
    });

    it("usa filtroValor para columnas que muestran un objeto", () => {
      const f = { tipo: "valores", seleccion: ["Vitacura"] };
      expect(filaPasaFiltroColumna(colComuna, f, fila())).toBe(true);
      expect(filaPasaFiltroColumna(colComuna, f, fila({ direccion: { comuna: "Colina" } }))).toBe(false);
    });
  });

  describe("texto", () => {
    // 🔴 DIFUSO — pedido de Cristóbal, 2026-09-02: «por si alguien se equivoca en alguna letra
    // al buscar, que igual salga». Reutiliza el `fuzzyMatch` que ya usan Insumos y los
    // Selector: un segundo criterio de parecido haría que la misma consulta encontrara cosas
    // distintas según en qué caja se escriba.
    describe("tolera errores de tipeo", () => {
      const conComentario = (t) => ({ ...fila(), numero_oc: t });

      it.each([
        ["Vitakura", "Vitacura"],   // letra cambiada
        ["Vitcura", "Vitacura"],    // letra faltante
        ["Vitaacura", "Vitacura"],  // letra repetida
        ["Vitacrua", "Vitacura"],   // dos letras traspuestas
      ])("buscar %s encuentra %s", (consulta, real) => {
        expect(
          filaPasaFiltroColumna(colTexto, { tipo: "texto", q: consulta }, conComentario(real)),
        ).toBe(true);
      });

      it("encuentra la palabra aunque esté en medio de un texto largo", () => {
        const largo = conComentario("LOCAL MUT · Encomenderos 65, las condes. Piso -4, bodega 8");
        expect(filaPasaFiltroColumna(colTexto, { tipo: "texto", q: "encomederos" }, largo)).toBe(true);
      });

      // La tolerancia es proporcional al largo, así que una consulta larga y bien escrita no
      // arrastra cualquier cosa: sigue siendo un filtro y no un "muestra todo".
      it("no encuentra una palabra que no se parece", () => {
        expect(
          filaPasaFiltroColumna(colTexto, { tipo: "texto", q: "quilicura" }, conComentario("Vitacura")),
        ).toBe(false);
      });

      it("todos los términos de la consulta tienen que aparecer", () => {
        const f = conComentario("LOCAL MUT Encomenderos");
        expect(filaPasaFiltroColumna(colTexto, { tipo: "texto", q: "local mut" }, f)).toBe(true);
        expect(filaPasaFiltroColumna(colTexto, { tipo: "texto", q: "local vitacura" }, f)).toBe(false);
      });

      // El guion de una OC no puede hacer fallar la búsqueda: el normalizador lo convierte en
      // espacio en LOS DOS lados, que es la razón de reusar `normalizeText` de fuzzyMatch.
      it("la puntuación no estorba", () => {
        const f = conComentario("PO-122586");
        expect(filaPasaFiltroColumna(colTexto, { tipo: "texto", q: "po-1225" }, f)).toBe(true);
        expect(filaPasaFiltroColumna(colTexto, { tipo: "texto", q: "PO 122586" }, f)).toBe(true);
      });
    });

    it("busca por contenido, sin importar mayúsculas ni tildes", () => {
      expect(filaPasaFiltroColumna(colTexto, { tipo: "texto", q: "po-12" }, fila())).toBe(true);
      expect(
        filaPasaFiltroColumna(
          { accessor: "c", filtro: "texto" },
          { tipo: "texto", q: "vitacura" },
          { c: "VITÁCURA" },
        ),
      ).toBe(true);
    });

    it("no encuentra lo que no está", () => {
      expect(filaPasaFiltroColumna(colTexto, { tipo: "texto", q: "zzz" }, fila())).toBe(false);
    });

    // 🔴 Si una celda vacía pasara, buscar "MUT" en Comentario traería además las 128 órdenes
    // que no tienen comentario — o sea, el filtro agregaría filas en vez de quitarlas.
    it("una celda vacía nunca contiene lo que se busca", () => {
      expect(filaPasaFiltroColumna(colTexto, { tipo: "texto", q: "po" }, fila({ numero_oc: null }))).toBe(false);
    });
  });

  describe("numero", () => {
    it("acota por mínimo y por máximo, con los extremos incluidos", () => {
      expect(filaPasaFiltroColumna(colNumero, { tipo: "numero", min: "2000", max: "" }, fila())).toBe(true);
      expect(filaPasaFiltroColumna(colNumero, { tipo: "numero", min: "", max: "2000" }, fila())).toBe(true);
      expect(filaPasaFiltroColumna(colNumero, { tipo: "numero", min: "2001", max: "" }, fila())).toBe(false);
      expect(filaPasaFiltroColumna(colNumero, { tipo: "numero", min: "", max: "1999" }, fila())).toBe(false);
    });

    it("lee el número aunque venga como string, que es como llega un DOUBLE de Sequelize", () => {
      expect(
        filaPasaFiltroColumna(colNumero, { tipo: "numero", min: "1000" }, fila({ ingreso_venta: "2000" })),
      ).toBe(true);
    });

    it("una fila sin número queda fuera del rango", () => {
      expect(filaPasaFiltroColumna(colNumero, { tipo: "numero", min: "0" }, fila({ ingreso_venta: null }))).toBe(false);
    });
  });

  describe("fecha", () => {
    it("acota por rango con los extremos incluidos", () => {
      expect(filaPasaFiltroColumna(colFecha, { tipo: "fecha", desde: "2026-09-15" }, fila())).toBe(true);
      expect(filaPasaFiltroColumna(colFecha, { tipo: "fecha", hasta: "2026-09-15" }, fila())).toBe(true);
      expect(filaPasaFiltroColumna(colFecha, { tipo: "fecha", desde: "2026-09-16" }, fila())).toBe(false);
      expect(filaPasaFiltroColumna(colFecha, { tipo: "fecha", hasta: "2026-09-14" }, fila())).toBe(false);
    });

    // 🔴 Comparar como texto ISO evita construir un Date, que es donde aparece el corrimiento
    // de zona horaria: una fecha con hora tiene que valer lo mismo que la misma fecha sin hora.
    it("una fecha con hora no se corre de día", () => {
      const conHora = fila({ fecha_entrega: "2026-09-15T00:00:00.000Z" });
      expect(
        filaPasaFiltroColumna(colFecha, { tipo: "fecha", desde: "2026-09-15", hasta: "2026-09-15" }, conHora),
      ).toBe(true);
    });

    // ⚠️ Si pasaran, filtrar "esta semana" traería además todo lo que no tiene fecha y el filtro
    // no serviría para planificar nada.
    it("una fila SIN fecha no entra en ningún rango", () => {
      const sin = fila({ fecha_entrega: null });
      expect(filaPasaFiltroColumna(colFecha, { tipo: "fecha", desde: "2026-01-01" }, sin)).toBe(false);
      expect(filaPasaFiltroColumna(colFecha, { tipo: "fecha", hasta: "2030-01-01" }, sin)).toBe(false);
    });
  });
});

describe("filaPasaFiltros", () => {
  const columns = [colEstado, colComuna, colFecha];

  it("sin filtros no deja nada fuera", () => {
    expect(filaPasaFiltros(columns, {}, fila())).toBe(true);
  });

  it("los filtros de distintas columnas se acumulan: basta que uno falle", () => {
    const filtros = {
      estado: { tipo: "valores", seleccion: ["Facturada"] },
      comuna: { tipo: "valores", seleccion: ["Vitacura"] },
    };
    expect(filaPasaFiltros(columns, filtros, fila())).toBe(true);
    expect(filaPasaFiltros(columns, filtros, fila({ direccion: { comuna: "Colina" } }))).toBe(false);
  });

  // Un filtro guardado de una columna que ya no existe no puede vaciar la tabla: se ignora
  // porque el recorrido va por las columnas, no por las claves guardadas.
  it("ignora filtros de columnas que ya no existen", () => {
    expect(filaPasaFiltros(columns, { columnaBorrada: { tipo: "texto", q: "x" } }, fila())).toBe(true);
  });
});

describe("contarFiltrosColumna", () => {
  it("cuenta sólo los que filtran de verdad", () => {
    expect(contarFiltrosColumna({})).toBe(0);
    expect(contarFiltrosColumna({ a: filtroVacio("texto") })).toBe(0);
    expect(
      contarFiltrosColumna({
        a: { tipo: "texto", q: "x" },
        b: filtroVacio("valores"),
        c: { tipo: "fecha", desde: "2026-01-01" },
      }),
    ).toBe(2);
  });

  it("tolera undefined", () => {
    expect(contarFiltrosColumna(undefined)).toBe(0);
  });
});

// 🔴 La inferencia es lo que hace que las 29 listas de la app se comporten igual sin tocar 29
// archivos. Es CONSERVADORA a propósito: ante la duda no pone filtro, porque un embudo que
// filtra por algo distinto de lo que muestra la celda es peor que no tener embudo — el usuario
// no tiene cómo darse cuenta.
describe("inferirFiltro", () => {
  const filas = (accessor, valores) => valores.map((v) => ({ [accessor]: v }));

  it("respeta el tipo declarado a mano", () => {
    expect(inferirFiltro({ accessor: "x", filtro: "fecha" }, filas("x", ["abc"]))).toBe("fecha");
  });

  it("`filtro: false` apaga el embudo", () => {
    expect(inferirFiltro({ accessor: "x", filtro: false }, filas("x", ["a", "b"]))).toBeNull();
  });

  it("números → rango", () => {
    expect(inferirFiltro({ accessor: "n" }, filas("n", [1, 2, 3]))).toBe("numero");
  });

  // Sequelize entrega los DOUBLE como string: si no se reconocieran, el total de una lista
  // quedaría con un filtro de texto y no se podría acotar por monto.
  it("números que llegan como string también → rango", () => {
    expect(inferirFiltro({ accessor: "n" }, filas("n", ["1000", "2832.5"]))).toBe("numero");
  });

  it("fechas ISO → rango de fechas", () => {
    expect(inferirFiltro({ accessor: "f" }, filas("f", ["2026-09-15", "2026-08-01"]))).toBe("fecha");
    expect(inferirFiltro({ accessor: "f" }, filas("f", ["2026-09-15T00:00:00Z"]))).toBe("fecha");
  });

  it("objetos Date → rango de fechas", () => {
    expect(inferirFiltro({ accessor: "f" }, filas("f", [new Date()]))).toBe("fecha");
  });

  it("booleanos → lista de valores", () => {
    expect(inferirFiltro({ accessor: "b" }, filas("b", [true, false, true]))).toBe("valores");
  });

  it("texto que se repite → lista de valores", () => {
    const estados = ["Creada", "Validada", "Creada", "Facturada", "Validada", "Creada"];
    expect(inferirFiltro({ accessor: "e" }, filas("e", estados))).toBe("valores");
  });

  it("texto distinto en cada fila → contiene", () => {
    const ocs = Array.from({ length: 30 }, (_, i) => `PO-${1000 + i}`);
    expect(inferirFiltro({ accessor: "oc" }, filas("oc", ocs))).toBe("texto");
  });

  // 🔴 El caso que justifica ser conservador: una columna que pinta un objeto con su `Cell`
  // filtraría por "[object Object]" y el embudo mostraría esa cadena como única opción.
  it("una columna que trae objetos NO recibe filtro", () => {
    const rows = [{ c: { nombre: "Better Food" } }, { c: { nombre: "Cencosud" } }];
    expect(inferirFiltro({ accessor: "c" }, rows)).toBeNull();
  });

  it("…pero sí lo recibe si declara con qué compararse", () => {
    const rows = [{ c: { nombre: "Better Food" } }, { c: { nombre: "Cencosud" } }];
    expect(inferirFiltro({ accessor: "c", sortValue: (r) => r.c.nombre }, rows)).toBe("texto");
  });

  it("una columna sin un solo valor no recibe filtro", () => {
    expect(inferirFiltro({ accessor: "x" }, filas("x", [null, "", undefined]))).toBeNull();
    expect(inferirFiltro({ accessor: "x" }, [])).toBeNull();
  });

  // Los vacíos no deciden el tipo: una columna de fechas con la mitad sin llenar sigue siendo
  // de fechas.
  it("los vacíos no cambian el tipo inferido", () => {
    expect(inferirFiltro({ accessor: "f" }, filas("f", ["2026-09-15", null, "", "2026-08-01"]))).toBe("fecha");
  });

  it("valores mezclados caen a texto, no a un tipo equivocado", () => {
    expect(inferirFiltro({ accessor: "x" }, filas("x", ["2026-09-15", "sin fecha", "otra cosa"]))).toBe("texto");
  });
});

describe("etiquetas legibles en la lista de valores", () => {
  // La columna en pantalla dice "Sí"/"No"; el embudo tiene que decir lo mismo y no true/false.
  it("los booleanos se leen Sí y No", () => {
    const opciones = opcionesDeColumna({ accessor: "b" }, [{ b: true }, { b: false }]);
    expect(opciones.map((o) => o.etiqueta).sort()).toEqual(["No", "Sí"]);
  });

  it("una columna puede traducir sus propios códigos", () => {
    const col = { accessor: "e", filtroEtiqueta: (v) => ({ A: "Aprobado" })[v] ?? v };
    expect(opcionesDeColumna(col, [{ e: "A" }])[0].etiqueta).toBe("Aprobado");
  });
});
