# Guía visual: menos ruido

Regla de Cristóbal (2026-10-22): las vistas van al grano. En pantalla queda sólo lo que cambia lo
que la persona hace **ahora**; cómo funciona algo se explica en un «(?)» que se abre al apretarlo.
No se elimina información: se mueve a donde no compite con el trabajo.

El ruido son los **textos**: párrafos explicativos fijos, notas bajo cada campo, recuadros que
repiten lo que ya dice otra parte de la pantalla. **Los colores no son ruido.**

## Qué va dónde

| Si el texto… | Va en |
|---|---|
| explica cómo funciona la vista o un estado | el «(?)» del título (`PageHeader ayuda=`) |
| explica un campo o una sección | el «(?)» junto a su etiqueta (`<Ayuda>`) |
| pide hacer algo ahora (falta un dato, queda saldo, algo bloquea) | un aviso de una línea |
| dice que algo falló | un aviso de error (o un toast si es la respuesta a un clic) |
| repite lo que ya dice otro elemento de la pantalla | no va |

## Colores

Corrección de Cristóbal (2026-10-22), después de una primera pasada que había apagado los
colores: **está bien que haya variedad de colores, idealmente los que ya teníamos.**

- **Cada estado lleva su propio color**, y dos estados de la misma cosa no pueden confundirse
  entre sí. La idea es diferenciarlos más, no que pasen desapercibidos. Nada de pintar varios
  estados con el mismo color «porque están en el mismo tramo».
- Si dos estados de una misma entidad tienen colores parecidos (ámbar y amarillo, verde y verde
  lima), se cambia uno: se conserva el que ya tenía cada estado y se mueve sólo el que choca.
- Los mapas de color de un estado viven en **un solo lugar** por entidad, para que la lista y el
  detalle digan lo mismo:
  - OV: `components/Ventas/EstadoOVBadge.jsx`
  - Solicitudes: `utils/estadoSolicitud.jsx`
  - OM y PVA: `components/Produccion/EstadoOM.jsx`
  - Órdenes de compra: `utils/estadoOrdenCompra.js`
- Las etiquetas de tipo (I, PIP, PT, merma), los botones de colores y las tarjetas con borde de
  color se quedan como estaban.

## Componentes

- `components/UI/Ayuda.jsx` — el «(?)». Clic para abrir (sirve en pantallas táctiles), Esc o clic
  fuera para cerrar; se dibuja en `body`, así que ninguna tarjeta lo recorta.
- `components/UI/Aviso.jsx` — un aviso de una línea, con `ayuda` opcional pegada al texto y
  `accion` opcional a la derecha.
- `components/UI/PageHeader.jsx` — título, estado, acciones y `ayuda`.
- `lib/dateUtils.js` → `formatFecha` — el único formateador de fechas (un día de calendario no se
  corre al día anterior).

## Textos

Tuteo chileno, sin voseo («arrastra», no «arrastrá»). Frases cortas que dicen qué hacer, no por qué
existe la pantalla.
