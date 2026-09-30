# Demo: del listado al backline organizado

Presentación interactiva del listado general de backline del Escenario 1 (Cordillera 2024), en tres pasos:

1. **Listado**: las 192 filas tal como llegan en el PDF.
2. **Revisar**: se iluminan las filas donde algo se puede quedar en bodega: baterías completas escritas como una fila con sus piezas sueltas debajo, títulos contados como equipo, repartos escondidos en notas, nombres mal escritos.
3. **Organizado**: cada fila vuela a su caja (por banda o por categoría). Cada batería es una caja con sus piezas para chulear al cargar, con totales sumados, búsqueda y filtros.

**Abrir**: doble clic en `index.html`. Funciona sin internet; solo las fuentes tipográficas vienen de Google Fonts.
**Presentar**: flechas ← → para cambiar de paso.

- `pagina.html`: la página. `datos/listado-esc1.json`: el listado ya interpretado.
- `node construir.mjs` genera `index.html` y `publicar.html`.
- `vendor/`: GSAP 3.13 y su plugin Flip (licencia estándar gratuita de GSAP).

Las cantidades son las del listado; algunas son aproximadas para la demostración.
