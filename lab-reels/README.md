## Lab: el backline en reels

Prueba de qué tan difícil es mostrar el backline como reels: una pantalla por
categoría (Batería, Platillos, Percusión…) que se cambia deslizando hacia arriba,
y dentro de cada una se desliza a los lados de la portada al resumen y a cada banda.

Usa los datos reales de Cordillera 2026, ESC 2 (`../extractor/data/cordillera-2026.json`)
y los stage plots de cada banda. Un solo archivo, sin librerías.

### Subir un documento

El primer reel es **＋ Sube un documento**: rider en PDF, foto de la hoja, Excel del
desglose o el correo. Lo lee el mismo lector de la lista de Cordillera
(`../cordillera/lector/`), en el dispositivo y sin internet, y con eso arma reels
nuevos: uno por cada categoría que encontró, con sus bandas y días.

- Lo leído se guarda en el dispositivo y sigue ahí al volver a abrir el link.
- Abajo del reel se cambia entre **Mi documento** y **Ejemplo Cordillera**.
- **Probar con un ejemplo** lee `extractor/muestras/hoja-backline.pdf`.
- Cada categoría tiene **＋ Subir** en el riel para volver arriba.

### La primera vez

Como al abrir TikTok: el logo entra con glitch y luego una mano enseña cada gesto
una sola vez (deslizar arriba, deslizar a la izquierda, doble toque). Para verlo de
nuevo: `lab-reels/#intro`.

### Qué tiene

- **↑ ↓** una categoría por pantalla, con imán (`scroll-snap`) para que nunca quede a medias.
- **← →** portada (piezas a tener, sáb/dom, bandas, por confirmar) → resumen por
  referencia → una pantalla por banda con su hora de show, stage plot e ítems.
- Rayitas arriba como en las historias, que marcan en qué pantalla vas.
- Riel a la derecha: **✓ Listo** (también con doble toque, como el "me gusta"),
  **Enviar** (abre el menú de compartir del celular con el enlace a esa categoría)
  e **Índice** para saltar.
- Enlaces directos: `lab-reels/#bateria`, `#platillos`…
- En PC: índice fijo a la izquierda, flechas ‹ › sobre el reel para pasar de banda,
  botones ↑ ↓ al lado para cambiar de categoría, y también el teclado y la rueda del mouse.
  En el celular nada de eso aparece; se desliza.

### Holograma 3D en la portada

La portada de cada categoría muestra el equipo como holograma 3D que se dibuja de abajo
hacia arriba y gira solo. Viene de la rama del demo `reconocimiento-3d/`: usa su
`vendor/three.js` y el mismo shader. Las piezas están en `holograma.js`.

- La batería sigue una foto real de tarima: tarima con tapete, bombo con hueco en el
  parche frontal y su pedal, dos toms montados en el bombo, tom de piso a la derecha,
  redoblante y hi-hat a la izquierda con su pedal, crash, ride y silla.
- También hay holograma para Platillos, Percusión (congas), Teclado, Ampli bajo (8×10),
  Ampli guitarra, Guitarra, Bajo y Bases (base de micrófono boom). Escenario, Cables y
  DJ siguen con su emoji.
- Hay un solo lienzo WebGL que pasa al reel visible, porque el celular aguanta pocos.
  Si el teléfono no tiene WebGL, se queda el emoji.

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
