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
  it("reutiliza sortValue si no hay filtroValor", () => {
    const col = { accessor: "cliente", sortValue: (r) => r.cliente?.nombre };
    expect(valorDeFiltro(col, { cliente: { nombre: "Better Food" } })).toBe("Better Food");
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
