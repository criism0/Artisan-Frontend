import { describe, it, expect } from "vitest";
import {
  resolverColumna,
  opcionesDeColumna,
  aDiaIso,
  aNumero,
} from "../filtrosColumna";

// ─── Conversores ─────────────────────────────────────────────────────────────

describe("aDiaIso", () => {
  it("deja pasar un día ISO tal cual", () => {
    expect(aDiaIso("2026-09-15")).toBe("2026-09-15");
  });

  // 🔴 Nunca se construye un `Date` para un texto que ya es un día: ése es el corrimiento de
  // zona horaria que costó un día de desvío en el vencimiento de una factura (§0-centies-ter).
  it("recorta la hora sin correrse de día", () => {
    expect(aDiaIso("2026-09-15T00:00:00.000Z")).toBe("2026-09-15");
    expect(aDiaIso("2026-01-01T02:30:00.000Z")).toBe("2026-01-01");
  });

  // Órdenes de Compra guarda la fecha ya formateada con `toLocaleDateString()`.
  it("entiende el dd-mm-aaaa que muestra la app", () => {
    expect(aDiaIso("13-08-2026")).toBe("2026-08-13");
    expect(aDiaIso("3/8/2026")).toBe("2026-08-03");
  });

  it("acepta un objeto Date", () => {
    expect(aDiaIso(new Date(2026, 8, 15))).toBe("2026-09-15");
    expect(aDiaIso(new Date("no es fecha"))).toBeNull();
  });

  it("lo que no es una fecha devuelve null", () => {
    expect(aDiaIso("Bodega Santiago")).toBeNull();
    expect(aDiaIso(1789)).toBeNull();
    expect(aDiaIso("13-13-2026")).toBeNull();
    expect(aDiaIso(null)).toBeNull();
  });
});

describe("aNumero", () => {
  it("lee un número tal cual", () => {
    expect(aNumero(1234)).toBe(1234);
    expect(aNumero("1234")).toBe(1234);
  });

  // Órdenes de Compra guarda el total ya formateado con signo peso y puntos de miles.
  it("lee el formato chileno", () => {
    expect(aNumero("$1.234.567")).toBe(1234567);
    expect(aNumero("1.234,50")).toBe(1234.5);
    expect(aNumero("$ 830")).toBe(830);
  });

  // ⚠️ «Bodega 3» tiene un dígito y NO es un número: tratarlo como tal pondría un rango
  // numérico sobre una columna de nombres.
  it("un texto con dígitos adentro no es un número", () => {
    expect(aNumero("Bodega 3")).toBeNull();
    expect(aNumero("PO-122586")).toBeNull();
    expect(aNumero("2026-09-15")).toBeNull();
  });

  it("vacío no es cero", () => {
    expect(aNumero(null)).toBeNull();
    expect(aNumero("")).toBeNull();
    expect(aNumero("  ")).toBeNull();
  });
});

// ─── resolverColumna ─────────────────────────────────────────────────────────

// 🔴 Los tres primeros casos son listas REALES de la app, y los tres se encontraron probándolas
// el 2026-09-02, no leyendo el código. Ninguna de las dos fuentes de una columna —el accessor o
// el `sortValue`— sirve sola: el criterio es qué muestra la celda.
describe("resolverColumna", () => {
  const filas = (accessor, valores) => valores.map((v) => ({ [accessor]: v }));

  describe("los tres casos reales", () => {
    // Solicitudes ordena sus fechas por timestamp para poder compararlas.
    it("SOLICITUDES: la fecha ISO le gana al timestamp de sortValue", () => {
      const col = {
        accessor: "fecha_envio",
        sortValue: (r) => (r.fecha_envio ? new Date(r.fecha_envio).getTime() : 0),
      };
      const data = [
        { fecha_envio: null },
        { fecha_envio: "2026-07-23T21:12:28.175Z" },
        { fecha_envio: null },
        { fecha_envio: "2026-07-30T15:11:39.746Z" },
      ];
      const r = resolverColumna(col, data);
      expect(r.tipo).toBe("fecha");
      expect(r.valor(data[1])).toBe("2026-07-23T21:12:28.175Z");
    });

    // Órdenes de Compra deja la fecha formateada en la fila y el ISO en `fecha_raw`.
    it("ÓRDENES DE COMPRA: la fecha formateada se filtra como fecha", () => {
      const col = { accessor: "fecha", sortValue: (r) => r.fecha_raw || "" };
      const data = [
        { fecha: "13-08-2026", fecha_raw: "2026-08-13T00:00:00.000Z" },
        { fecha: "01-09-2026", fecha_raw: "2026-09-01T00:00:00.000Z" },
      ];
      const r = resolverColumna(col, data);
      expect(r.tipo).toBe("fecha");
      expect(aDiaIso(r.valor(data[0]))).toBe("2026-08-13");
    });

    it("ÓRDENES DE COMPRA: el total con signo peso se filtra como rango numérico", () => {
      const col = { accessor: "total_neto", sortValue: (r) => r.total_neto_raw ?? 0 };
      const data = [
        { total_neto: "$1.234.567", total_neto_raw: 1234567 },
        { total_neto: "$830", total_neto_raw: 830 },
      ];
      const r = resolverColumna(col, data);
      expect(r.tipo).toBe("numero");
      // Se prefiere el candidato que YA es número, para no re-parsear en cada tecla.
      expect(r.valor(data[0])).toBe(1234567);
    });

    // Usuarios es el caso inverso: el accessor es el id y el nombre está en sortValue.
    it("USUARIOS: se filtra por el nombre del rol, no por su id", () => {
      const nombres = { 1: "Super Admin", 2: "Administrador" };
      const col = { accessor: "role_id", sortValue: (r) => nombres[r.role_id] };
      const data = [{ role_id: 1 }, { role_id: 2 }, { role_id: 2 }];
      const r = resolverColumna(col, data);
      expect(r.tipo).toBe("valores");
      expect(r.valor(data[1])).toBe("Administrador");
    });
  });

  describe("tipos simples", () => {
    it("números → rango", () => {
      expect(resolverColumna({ accessor: "n" }, filas("n", [1, 2, 3])).tipo).toBe("numero");
    });

    // Sequelize entrega los DOUBLE como string.
    it("números que llegan como string → rango", () => {
      expect(resolverColumna({ accessor: "n" }, filas("n", ["1000", "2832.5"])).tipo).toBe("numero");
    });

    it("fechas ISO y objetos Date → rango de fechas", () => {
      expect(resolverColumna({ accessor: "f" }, filas("f", ["2026-09-15", "2026-08-01"])).tipo).toBe("fecha");
      expect(resolverColumna({ accessor: "f" }, filas("f", [new Date()])).tipo).toBe("fecha");
    });

    it("booleanos → lista de valores", () => {
      expect(resolverColumna({ accessor: "b" }, filas("b", [true, false])).tipo).toBe("valores");
    });
  });

  // Pedido de Cristóbal: que se puedan ir marcando valores, como los clientes en Ventas.
  describe("texto: lista para marcar, salvo que sea texto libre y largo", () => {
    it("nombres que se repiten → lista", () => {
      const estados = ["Creada", "Validada", "Creada", "Facturada"];
      expect(resolverColumna({ accessor: "e" }, filas("e", estados)).tipo).toBe("valores");
    });

    // 🔴 Antes esto caía a "contiene" por tener un valor distinto en cada fila, y es justo el
    // caso que se quiere poder marcar: una lista de proveedores o de clientes.
    it("nombres distintos en cada fila TAMBIÉN → lista", () => {
      const nombres = Array.from({ length: 120 }, (_, i) => "Proveedor " + i);
      expect(resolverColumna({ accessor: "p" }, filas("p", nombres)).tipo).toBe("valores");
    });

    it("texto libre y largo → contiene", () => {
      const comentarios = Array.from({ length: 30 }, (_, i) => (i + " ").padEnd(200, "x"));
      expect(resolverColumna({ accessor: "c" }, filas("c", comentarios)).tipo).toBe("texto");
    });

    // 🔴 La primera versión cortaba en 500 valores distintos y eso dejaba a Clientes fuera de
    // la lista —hay 456 en producción—, que es EL ejemplo que se pidió. Manda el largo del
    // valor, no cuántos haya: la lista tiene buscador difuso y scroll.
    it("muchos valores distintos pero cortos → SIGUE siendo lista", () => {
      const muchos = Array.from({ length: 600 }, (_, i) => "codigo-" + i);
      expect(resolverColumna({ accessor: "c" }, filas("c", muchos)).tipo).toBe("valores");
    });
  });

  // ⚠️ No todo lo que se escribe con dígitos es una cantidad: un «desde / hasta» sobre un
  // teléfono no significa nada. Visto en Proveedores el 2026-09-02.
  describe("identificadores numéricos no son rangos", () => {
    it("un teléfono se ofrece como lista, no como rango", () => {
      const tels = ["912345678", "998765432", "911112222"];
      expect(resolverColumna({ accessor: "telefono" }, filas("telefono", tels)).tipo).toBe("valores");
    });

    it("un id corto sí es un rango", () => {
      expect(resolverColumna({ accessor: "id" }, filas("id", [1, 25, 846])).tipo).toBe("numero");
    });

    // Un total en millones tiene 7 dígitos y NO puede confundirse con un identificador.
    it("un monto grande sigue siendo rango: manda el signo peso", () => {
      const col = { accessor: "total", sortValue: (r) => r.total_raw };
      const data = [
        { total: "$1.234.567", total_raw: 1234567 },
        { total: "$9.876.543", total_raw: 9876543 },
      ];
      expect(resolverColumna(col, data).tipo).toBe("numero");
    });

    it("y una columna alineada a la derecha también, sea cual sea su largo", () => {
      const col = { accessor: "monto", align: "right" };
      expect(resolverColumna(col, filas("monto", [1234567, 9876543])).tipo).toBe("numero");
    });

    it("los decimales delatan una cantidad", () => {
      expect(resolverColumna({ accessor: "peso" }, filas("peso", [1234567.5, 2222222.25])).tipo).toBe("numero");
    });
  });

  describe("lo que NO recibe filtro", () => {
    // Un embudo que filtra por "[object Object]" es peor que no tener embudo.
    it("una columna que trae objetos y no dice cómo compararse", () => {
      const rows = [{ c: { nombre: "Better Food" } }, { c: { nombre: "Cencosud" } }];
      expect(resolverColumna({ accessor: "c" }, rows)).toBeNull();
    });

    it("pero sí lo recibe si declara sortValue o filtroValor", () => {
      const rows = [{ c: { nombre: "Better Food" } }, { c: { nombre: "Cencosud" } }];
      expect(resolverColumna({ accessor: "c", sortValue: (r) => r.c.nombre }, rows).tipo).toBe("valores");
      expect(resolverColumna({ accessor: "c", filtroValor: (r) => r.c.nombre }, rows).tipo).toBe("valores");
    });

    it("una columna sin un solo valor", () => {
      expect(resolverColumna({ accessor: "x" }, filas("x", [null, "", undefined]))).toBeNull();
      expect(resolverColumna({ accessor: "x" }, [])).toBeNull();
    });

    it("filtro false la apaga aunque tenga datos", () => {
      expect(resolverColumna({ accessor: "x", filtro: false }, filas("x", ["a", "b"]))).toBeNull();
    });
  });

  describe("lo declarado a mano manda", () => {
    it("respeta el tipo forzado", () => {
      expect(resolverColumna({ accessor: "x", filtro: "texto" }, filas("x", [1, 2])).tipo).toBe("texto");
      expect(resolverColumna({ accessor: "f", filtro: "fecha" }, filas("f", ["2026-09-15"])).tipo).toBe("fecha");
    });

    it("filtroValor gana sobre el accessor y sobre sortValue", () => {
      const col = { accessor: "a", sortValue: () => "orden", filtroValor: () => "elegido" };
      const r = resolverColumna(col, [{ a: "crudo" }]);
      expect(r.valor({ a: "crudo" })).toBe("elegido");
    });
  });

  it("los vacíos no cambian el tipo: una fecha a medio llenar sigue siendo fecha", () => {
    expect(resolverColumna({ accessor: "f" }, filas("f", ["2026-09-15", null, "", "2026-08-01"])).tipo).toBe("fecha");
  });
});

describe("etiquetas legibles en la lista de valores", () => {
  // La columna en pantalla dice "Sí"/"No"; el embudo tiene que decir lo mismo, no true/false.
  it("los booleanos se leen Sí y No", () => {
    const opciones = opcionesDeColumna({ accessor: "b" }, [{ b: true }, { b: false }]);
    expect(opciones.map((o) => o.etiqueta).sort()).toEqual(["No", "Sí"]);
  });

  it("una columna puede traducir sus propios códigos", () => {
    const col = { accessor: "e", filtroEtiqueta: (v) => ({ A: "Aprobado" }[v] ?? v) };
    expect(opcionesDeColumna(col, [{ e: "A" }])[0].etiqueta).toBe("Aprobado");
  });
});
