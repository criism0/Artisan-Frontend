# Guía visual: menos ruido

Regla de Cristóbal (2026-10-22): las vistas van al grano. En pantalla queda sólo lo que cambia lo
que la persona hace **ahora**; cómo funciona algo se explica en un «(?)» que se abre al apretarlo.
No se elimina información: se mueve a donde no compite con el trabajo.

Se aplicó primero en ventas y entregas (web y móvil) y después al resto de la web: solicitudes,
producción, inventario, compras, calidad, usuarios y documentos tributarios.

## Qué va dónde

| Si el texto… | Va en |
|---|---|
| explica cómo funciona la vista o un estado | el «(?)» del título (`PageHeader ayuda=`) |
| explica un campo de formulario | el «(?)» junto a su etiqueta (`<Ayuda>`) |
| pide hacer algo ahora (falta un dato, queda saldo, algo bloquea) | un `Aviso` de una línea, tono `atencion` |
| dice que algo falló | un `Aviso` tono `error` (o un toast si es la respuesta a un clic) |
| es un dato que tiene que verse (quién canceló, cuándo se cerró) | un `Aviso` tono `neutro`: gris, sin recuadro |
| repite lo que ya dice otro elemento de la pantalla | no va |

Un vacío («sin documentos», «sin archivos») es una línea gris, no un recuadro punteado.

## Colores

- **Morado (primary)**: la acción principal de la vista (una) y lo seleccionado.
- **Ámbar**: algo pide atención ahora. Si todo está en ámbar, nada lo está.
- **Rojo**: error, pérdida o acción que destruye. En una tabla, el ícono de eliminar es gris hasta
  pasar el mouse.
- **Verde**: terminado o confirmado (entregada, aceptada por el SII).
- **Gris**: todo lo demás. No hay azul «informativo»: si sólo informa, no necesita color.

Los estados se pintan por **tramo**, no por estado: gris (no empezó), morado suave (en curso),
ámbar (queda algo pendiente), verde (terminó), rojo (cancelado). El nombre del estado ya dice cuál
es. Ver `components/Ventas/EstadoOVBadge.jsx`, `ESTADOS_RUTA` en `utils/rutas.js`,
`components/Produccion/EstadoOM.jsx` (OM y PVA) y `utils/estadoSolicitud.jsx`.

Lo que no es un estado —el tipo de ítem (I, PIP, PT), la categoría, el rol de un usuario, el tipo de
documento— va en gris: la etiqueta ya lo dice. El semáforo de calidad (conforme · desvío · no
conforme) sí lleva color, porque ahí el color es la información.

Un botón por bloque es primario; los demás van con borde gris. Los botones azules, verdes o
amarillos rellenos se pasaron al primario o a secundario.

## Componentes

- `components/UI/Ayuda.jsx` — el «(?)». Clic para abrir (sirve en pantallas táctiles), Esc o clic
  fuera para cerrar; se dibuja en `body`, así que ninguna tarjeta lo recorta.
- `components/UI/Aviso.jsx` — una línea, tonos `atencion` · `error` · `neutro`, con `ayuda`
  opcional pegada al texto y `accion` opcional a la derecha.
- `components/UI/PageHeader.jsx` — título, estado, acciones y `ayuda`.
- `components/UI/FranjaDatos.jsx` — los datos de un vistazo bajo la cabecera de un detalle, en una
  sola caja (`<FranjaDatos><Dato titulo detalle>…`). Reemplaza las filas de tarjetas con un borde
  de color cada una.
- `lib/dateUtils.js` → `formatFecha` — el único formateador de fechas (un día de calendario no se
  corre al día anterior).

## Textos

Tuteo chileno, sin voseo («arrastra», no «arrastrá»). Frases cortas que dicen qué hacer, no por qué
existe la pantalla.
