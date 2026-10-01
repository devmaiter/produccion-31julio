## Lab: el backline en reels

Prueba de qué tan difícil es mostrar el backline como reels: una pantalla por
categoría (Batería, Platillos, Percusión…) que se cambia deslizando hacia arriba,
y dentro de cada una se desliza a los lados de la portada al resumen y a cada banda.

Usa los datos reales de Cordillera 2026, ESC 2 (`../extractor/data/cordillera-2026.json`)
y los stage plots de cada banda. Un solo archivo, sin librerías.

### Qué tiene

- **↑ ↓** una categoría por pantalla, con imán (`scroll-snap`) para que nunca quede a medias.
- **← →** portada (piezas a tener, sáb/dom, bandas, por confirmar) → resumen por
  referencia → una pantalla por banda con su hora de show, stage plot e ítems.
- Rayitas arriba como en las historias, que marcan en qué pantalla vas.
- Riel a la derecha: **✓ Listo** (también con doble toque, como el "me gusta"),
  **Enviar** (abre el menú de compartir del celular con el enlace a esa categoría)
  e **Índice** para saltar.
- Enlaces directos: `lab-reels/#bateria`, `#platillos`…
- En computador: flechas del teclado.

### Qué tan difícil fue

Poco. Lo que hace que se sienta como reels lo da el navegador:
`scroll-snap-type: y mandatory` en el contenedor y `x mandatory` en cada carrusel,
más `scroll-snap-stop: always` para que un deslizón fuerte no se salte categorías.
El resto (agrupar por categoría, contar, el riel, las rayitas) son unas 200 líneas.

Lo que falta para llevarlo a la app de verdad:

- Marcar listo por ítem y no solo por categoría, y sincronizarlo como la lista de chequeo.
- Elegir escenario y evento (hoy está fijo en Cordillera 2026, ESC 2).
- Probarlo en iPhone y Android reales: el carrusel horizontal dentro del vertical
  funciona en Chrome móvil emulado, pero los gestos finos se juzgan en la mano.

Para probarlo local: `python3 -m http.server 8000` en la raíz y abrir
http://localhost:8000/lab-reels/.
