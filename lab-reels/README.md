## Lab: el backline en reels

Prueba de qué tan difícil es mostrar el backline como reels: una pantalla por
categoría (Batería, Platillos, Percusión…) que se cambia deslizando hacia arriba,
y dentro de cada una se desliza a los lados de la portada al resumen y a cada banda.

Los reels salen del documento que se sube. Un solo archivo, sin librerías aparte del
lector y el Three.js de los otros demos.

### Subir un documento

El primer reel es **＋ Sube un documento**: rider en PDF, foto de la hoja, Excel del
desglose o el correo. Lo lee el mismo lector de la lista de Cordillera
(`../cordillera/lector/`), en el dispositivo y sin internet, y con eso arma reels
nuevos: uno por cada categoría que encontró, con sus bandas y días.

- Sin documento solo está el reel de subir: no se muestra ningún evento de ejemplo.
- Lo leído se guarda en el dispositivo y sigue ahí al volver a abrir el link.
  **Borrar** lo quita.
- Si el archivo no se puede abrir o no trae una lista de equipos, el reel lo dice en
  grande con lo que el lector no entendió. Si tarda más de 12 s avisa que sigue leyendo.
- **Probar con un ejemplo** lee `extractor/muestras/hoja-backline.pdf`.
- Cada categoría tiene **＋ Subir** en el riel para volver arriba.

### La primera vez

Como al abrir TikTok: cada vez que se abre, el logo de Circuito Naranja entra con glitch. La
primera vez, además, una mano enseña cada gesto una sola vez (deslizar arriba, deslizar a la izquierda, doble toque). Para verlo de
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

### Siempre los mismos 9 reels

Batería, Bajo, Guitarra, Teclado, Percusión, Platillos, In ears, Consolas y Extras, en ese
orden (In ears y Consolas desde el 2026-10-08; van a su reel aunque vengan en el bloque de
un instrumento). Se
respeta cómo agrupa la banda: lo que pidió en el bloque del bajo (una mesa de percusión,
un ventilador) se queda en Bajo, y los platillos y bases del bloque de batería, en
Batería. Un grupo que no es de un instrumento ("Tarimas", "Vientos", "DJ") no abre reel:
cada ítem va por su categoría, las bases con su instrumento y el resto a Extras.

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
- **El holograma sigue el listado** (`receta.js`): cuenta las piezas de cada renglón
  ("4 bases de platillo", '10" – 12" – 14" Rack tom', "Set de platillos: 1 ride, 2 crash,
  1 splash y hi-hat") y dibuja eso: tantos toms, tom de piso, bombos, bases de platillo
  (cada una con su platillo: crash, splash, ride, china), doble pedal, X-hat o pad como
  diga la lista. Lo que no diga sale del formato de siempre: bombo 22, toms 10 y 12,
  piso 16, redoblante 14, hi-hat, crash y ride, silla. Las Bases salen por tipo (platillo,
  hi-hat, redoblante, silla, micrófono, teclado, guitarra, atril, taburete) y los
  teclados, amplis y guitarras salen tantos como haya (hasta 4).
- El holograma de cada reel es el del equipo principal del grupo y se arma solo con lo
  que pide ese grupo (en Teclado sin teclados, solo bases, salen las bases; en Percusión
  salen las congas, bongós, djembe, timbales, cajón, mesa y platillos que diga).
- Con varias bandas se toma, pieza por pieza, lo más grande de una sola banda: es el
  montaje que le sirve a cualquiera. Por eso el número "a tener" (que suma las bandas del
  mismo día) puede ser mayor que lo que se ve.
- Hay un solo lienzo WebGL que pasa al reel visible, porque el celular aguanta pocos.
  Si el teléfono no tiene WebGL, se queda el emoji.

### Qué tan difícil fue

Poco. Lo que hace que se sienta como reels lo da el navegador:
`scroll-snap-type: y mandatory` en el contenedor y `x mandatory` en cada carrusel,
más `scroll-snap-stop: always` para que un deslizón fuerte no se salte categorías.
El resto (agrupar por categoría, contar, el riel, las rayitas) son unas 200 líneas.

Lo que falta para llevarlo a la app de verdad:

- Marcar listo por ítem y no solo por categoría, y sincronizarlo como la lista de chequeo.
- Probarlo en iPhone y Android reales: el carrusel horizontal dentro del vertical
  funciona en Chrome móvil emulado, pero los gestos finos se juzgan en la mano.

Para probarlo local: `python3 -m http.server 8000` en la raíz y abrir
http://localhost:8000/lab-reels/.
