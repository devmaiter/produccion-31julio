# Contexto del proyecto (léelo primero)

Herramientas de **producción técnica de backline** para **Circuito Naranja**
(empresa de renta de audio, video, iluminación, backline, energía y tarimas en
Colombia). El usuario trabaja en producción, no programa y escribe en español
desde el celular: respóndele en español, claro y sin jerga, y muéstrale capturas
cuando cambie algo visible.

**Este es el único repositorio del proyecto.** `devmaiter/cordillera` quedó como
histórico: su contenido ya está aquí (`cordillera/` y `prototipos/estado/`).

## Publicación

- GitHub Pages publica la rama `main` en https://devmaiter.github.io/produccion-31julio/.
  La Home es `index.html`, con una tarjeta por demo.
- El usuario autorizó publicar en `main`: se trabaja en la rama que asigne la
  sesión y, cuando está probado, se empuja también a `main` (fast-forward).
- Pages tarda 1–3 min y el navegador guarda la página ~10 min: para ver lo nuevo
  en el celular, abrir el link con `?v=N` cambiando el número.
- Desde el contenedor no se puede abrir github.io; el estado del despliegue se ve
  en Actions ("pages build and deployment").

## Qué hay en `main`

| Carpeta | Qué es |
|---|---|
| `lab-reels/` | **Lo más reciente.** El backline como reels (ver abajo). |
| `cordillera/` | Lista de chequeo ESC 2 Cordillera 2026 con "Subir documento". Trae el lector empaquetado en `cordillera/lector/` (lo usan también los reels). |
| `planilla/` | **Del rider a la planilla de backline** en el formato de OML (Stage \| fecha, SET A, Cat / Rider, Cant \| Requerimiento \| Cant \| Propuesta): se sube el rider, sale el Requerimiento, se edita y se descarga el .xlsx. El nombre de la banda casi nunca está en el texto (va en el logo): la página lo pide. |
| `extractor/` | Build (Vite) del extractor: suelta un documento y sale el listado. Sus `data/` y `muestras/` sirven de ejemplo. `texto.html` («Así lo leí»): el texto tal como se leyó, sin interpretar, y un Excel dibujado como en Excel al lado. |
| `demo-listado/` | Del listado del PDF al backline organizado (Cordillera 2024). |
| `reconocimiento-3d/` | Cámara + MobileNet que reconoce un equipo y lo muestra como holograma 3D (Three.js). |
| `produccion-31-julio/` | La app que se usó en producción el 31 de julio (Firestore del proyecto `backline-2797d`, `functions/`). |
| `prototipos/estado/` | Prototipo del Excel de Stage 4 como estado reactivo, con perfiles Admin/Operario y fotos por equipo (venía del repo `cordillera`; sus funciones de base de datos eran de un artifact y aquí solo corren en memoria). |
| `lector/` | **Código fuente del lector** (TypeScript + Vitest). Aquí se arregla el lector. |
| `extractor-fuente/` | Código fuente del extractor (Vite). `extractor/` es su build. |
| `app/` | La app definitiva en Elm (en construcción): entidades, JSON del lector y pruebas. |
| `app-unificada/` | La app en TypeScript que une los dos prototipos (lectura local y modo evento sin internet); la de la demo. |
| `prototipos/31-julio/` | Variantes de la app del 31 de julio que no entraron al evento (fotos por ítem, IA, backline entre días). |
| `construir-sitio.sh` | Arma lo publicado desde el código de main: `cordillera/lector/` y `extractor/` desde `lector/` y `extractor-fuente/`, y `demo-listado/index.html`. |

## Ramas

**Todo el código está en `main`** (pedido del usuario, 2026-10-03). Las demás ramas
(`extractor`, `lector`, `cordillera`, `demo`, `elm`, `ccr-*`, `claude/*`) ya están
fusionadas y quedan solo como historia: **no trabajes en ellas**. Se trabaja en una
rama propia sacada de `main` y, probado, se integra a `main`.

## El lector de documentos (lo primordial ahora)

Convierte un rider o listado (PDF, foto, Excel, correo, texto) en ítems de
backline: cantidad, descripción, categoría, banda y día. Corre en el dispositivo
y **sin IA de pago ni internet** (pdf.js, Tesseract para OCR y exceljs); es una
decisión del proyecto.

Piezas, en `lector/src/lectura/`:
- `pdf.ts`: texto del PDF por renglones. Detecta páginas a 2–3 columnas y las
  lee columna por columna. No parte las tablas "Cant | Equipo | Observación".
- `interpretar.ts`: reglas que recorren los renglones.
  - **Secciones:** backline sí; input list, monitores, PA, luces, video,
    camerinos, catering, hotel, transporte y radios no.
  - **In ears y consolas** (2026-10-08, las pidió el usuario): son categorías y secciones propias.
    "IN EARS" o "CONSOLAS" abren su grupo. Dentro del audio se lee el renglón que ES el equipo
    ("CONSOLA FOH: Yamaha CL5", "2 Shure PSM 1000"); "3 LIDER IEM" es una mezcla y no cuenta
    (`equipoDeAudio` en `categorias.ts`).
  - **"Batería DW"** (batería + marca, sin cantidad) es el título del bloque de la batería; en una
    lista sin títulos, lo de otro instrumento ("1 Bajo Fender") cierra ese bloque.
  - **La banda:** "RIDER TÉCNICO" o "TECHNICAL RIDER" + nombre fija la banda de
    todo el documento.
    Si debajo no está el nombre (va en el logo), se busca: el nombre en MAYÚSCULAS
    repetido tras "para/de/por"; el nombre en mayúsculas y minúsculas que las frases
    repiten ("el show de Los Rayos"), con 2 veces si está en la web o el
    correo del documento y 3 si no; o quien firma ("Att: Ana Pérez") si su nombre está
    en el correo. Las palabras del contrato ("El Artista", "El Contratante") no cuentan.
  - **Renglones partidos y listas corridas.**
  - **Páginas repetidas:** un bloque igual a uno anterior se lee una vez.
  - **Unidades:** "16 CH" o "4 RETORNOS" no son cantidades.
  - **Opciones:** "OPCIÓN #2" es alternativa y no suma.
  - **Capítulos numerados:** "3.1.- DRUMS" o "5.1 TARIMA" llevan el número del capítulo,
    no una cantidad. Otro capítulo ("4. SOUNDCHECK", "5. ESCENARIO") cierra el del backline.
  - **Opciones de la banda:** "DRUMS: DW, Yamaha, Pearl" es UNA batería; las marcas son
    información del grupo (no ítems). "TOMS 12, 14 y 16 O 16, 18" son 3 toms.
  - **Grupos y subtítulos:** "DRUMS/BATERIA - FULANO DE TAL" (instrumento + músico)
    abre un grupo; dentro, "OPCIONES", "STANDS", "Type/Tipo", "Accesorios",
    "CYMBALS SET"… son subtítulos y no abren otro. "OPCIONES EN ORDEN DE PRIORIDAD"
    + "1. … 2. …": solo la 1 suma (y si es solo una marca, es nota). "Sizes KD 22” -
    Rack Toms 8”-10”-12” - …" sale pieza por pieza. "1 Fan / 1 Ventilador" es uno.
  - **Respaldo:** si no sale nada, relee sin secciones y marca todo "para revisar".
  - **Tablas con fila de títulos** (pdf.ts, `leerTabla`): "FAMILY TYPE | MODEL | NOTES",
    "Cant | Equipo | Marca"… se leen fila por fila aunque una celda ocupe dos renglones
    (la fila es la que trae la cantidad; lo de arriba o abajo es de la más cercana). Un
    trozo solo al comienzo de la primera columna ("DRUM") es la sección.
  - **La banda sin "RIDER TÉCNICO":** el título del primer renglón si debajo habla de
    backline; o el nombre del archivo si el texto también lo nombra; si no, sin nombre,
    pero el listado no se pierde. "FULANO GEAR" es el equipo de un músico, no una banda.
- `cortar.ts` (**el cortador**, 2026-10-06): lee cada renglón de izquierda a derecha y decide dónde
  empieza cada pieza. Así lo escribe la planilla del usuario (Excel OML):
  - "TOMS 10”, 12” Y 14”" son 3 filas; "2 CRASH DE 16” Y 18”, RIDE 20”" son crash 16, crash 18 y ride.
  - "1 SNARE … Y UN PICCOLO" y "MOTIF 8 XF Y MOTIF XF 7" son 2 piezas.
  - "3 Toms: 8’’ 10’’ 14’’" y "3 Rack Toms 8” - 10”- 12”" dan una fila por medida.
  - "· 1 … · 1 …" y "; " separan piezas; "Type/ Tipo • 1 HIHAT…" pierde la etiqueta.
  - Lo que va después de "O" es alternativa y no se corta. "Djembe y su base" es una pieza.
  - Una tabla con columnas (3 espacios o más) no pasa por el cortador.
- **Entrenamiento** (`tests/fixtures/entrenamiento/renglones.txt`): casos inventados, cada uno con los
  renglones del rider y `=> cantidad | pieza` de lo que debe salir. `npm run entrenar` da el % de
  acierto y `tests/entrenamiento.test.ts` convierte cada caso en prueba. Cuando un rider real falla,
  se agrega su forma ahí (con texto inventado) y se corrige hasta que vuelva al 100 %.
- Otras reglas de 2026-10-06/07:
  - "2.50 X 2.50" es una medida, no una hora. "4 4 Cymbal Stands" es una cantidad repetida, y "2.4O" es "2.40".
  - "5 Strings" y "6 cuerdas" son parte del instrumento.
  - En una tabla, lo que se repite en varias filas (la marca) es del grupo, y "Cymbals | Ride 22”" es la pieza de al lado.
  - Con capítulos numerados, un "Guitarras:" o un "VOCES" de otro capítulo no reabre el backline.
  - "Luminarias", "SFX", "Seguidores" y "TARIMAS" son secciones que no son backline.
  - "1. Roland… 2. Roland…" es una lista numerada: cada uno vale 1. "Amplificador Fender…" es pieza, no subtítulo.
  - En la planilla, las opciones en orden de prioridad van en la fila de la preferida: "Ampeg … / Aguilar …".
- `../dominio/bateria.ts` (**qué lleva una batería**, 2026-10-07): el usuario escribe el rider como
  quiera ("KD 22”", "Kick 22x18", "03 x Toms 10/12/16" o un tom por fila, "Kcik"), pero una batería
  siempre son las mismas piezas. Reconoce bombo, redoblante, tom, tom de piso, hi-hat, crash, ride,
  china, splash, sus bases, pedal, silla y alfombra, y su medida. También en inglés, con errores de
  dedo y con la profundidad primero. Así se comparan baterías **pieza por pieza, no por filas**: no se le
  pregunta al usuario cómo partir filas.
  `npm run comparar -- planilla.xlsx "Banda" rider.pdf` compara la batería del rider con la columna de
  esa banda en la planilla OML. Al 2026-10-07, 9 de 10 bandas reales coinciden al 100 % y la otra al 97 %.
- `../dominio/categorias.ts`: categoría por palabras clave (Batería, Platillos,
  Percusión, Teclado, Ampli bajo, Ampli guitarra, Guitarra, Bajo, Bases,
  In ears, Consolas, Escenario, Cables y energía, DJ, Otro).
- Pruebas: `tests/riders.test.ts` tiene riders de prueba inventados
  (`tests/fixtures/riders/`, generados desde `fuentes/*.html` imprimiendo a PDF
  con Chromium), y `rider-secciones.test.ts` dos riders inventados con la forma
  de dos riders reales (secciones a su manera, logo sin nombre, rider de gira en
  inglés). Hay 239 pruebas en verde (las de categorías revisan también «plásticos»).
- En la terminal: `npm run texto -- rider.pdf` (el texto tal como se leyó),
  `npm run traza -- rider.pdf` (qué decidió de cada renglón) y
  `npm run planilla -- rider.pdf --banda "…" --escenario "Stage 4" --fecha AAAA-MM-DD`
  (la planilla .xlsx). Los riders reales van en `lector/riders-reales/`, que no se sube.
- Reglas que no se deben perder: un correo o teléfono nunca es ítem (ni llega a la
  planilla); si el rider tiene sección de backline, lo leído antes y fuera de toda
  sección (tarima, wifi) se quita, salvo in ears y consolas; el hardware de batería es Batería;
  en la planilla no entran párrafos del contrato ("deberá…", transporte, hotel).

**Qué es backline (lo definió el usuario, 2026-10-04; respetarlo siempre):**
- Sí: ventiladores (en los reels, **siempre** a Extras), alfombras y tapetes (sueltos a
  Extras; dentro del bloque de un instrumento se quedan ahí; "drum carpet" = "drum rug" =
  "alfombra para batería": una cosa puede tener varios nombres), atriles, sillas y bancos de
  músicos, pedales de efectos (guitarra, o bajo si lo dice), parches (ítem de batería),
  cuerdas de repuesto, baquetas, instrumento spare (suma) y afinadores.
- No: escenografía (plantas, lámparas, sofás, sala, tapetes persas; así lo deja el Excel del usuario),
  risers, tarimas y sobretarimas, pedestales de micrófono, cajas directas (DI), cables y la
  corriente en tarima (extensiones, multitomas, regletas, UPS). Confirmado el 2026-10-05;
  vive en `noEsBackline` de `categorias.ts`. Un "pedestal" que dice de qué instrumento es
  ("pedestal para platillo") o que está en la sección de batería o percusión sí es backline;
  "DI" a secas solo cuenta en mayúscula.
- Cabezal + caja ("Ampeg SVT Classic + 8x10") son dos piezas.
- Lo que la banda trae va marcado ("lo trae la banda"); "la banda lleva X pero necesitamos
  Y" son dos piezas. Varias opciones para lo mismo ("Ampeg SVT / Fender Rumble o Aguilar")
  son una sola pieza.

Trabajar el lector (todo en main):
```bash
cd lector && npm install && npm run preparar    # datos del OCR (no se suben)
npx vitest run && npx tsc --noEmit -p .
cd .. && ./construir-sitio.sh                   # lector.js, build del extractor, demo y bytes escapados
```
Después probar `lab-reels/` y `planilla/` con un rider real y publicar `main`.
En Windows (sin symlinks) los enlaces de `extractor-fuente/public/` quedan como
archivos de texto: para el build hay que cambiarlos localmente por carpetas reales
y no subir ese cambio.

**Riders reales de prueba.** No están en el repo porque traen teléfonos y correos del
equipo; no se suben. **El código y las pruebas no guardan nombres de bandas ni textos
copiados de un rider real**: las reglas son generales y las pruebas usan riders
inventados con la misma forma (bandas "Los Rayos", "Luna Roja"…). Los riders reales son
para entrenar y medir, en la máquina del usuario.

Aun así el usuario ve errores en cada rider nuevo: **las reglas no alcanzan**.

### Siguiente paso acordado: entrenar el lector con el usuario

El usuario quiere pulir la lectura antes de seguir con los reels, enseñándole él
mismo qué es backline. La propuesta que se le hizo:
1. **Ver el texto:** documento → texto limpio tipo Markdown, página por página,
   para confirmar que se leyó bien antes de interpretar.
2. **Etiquetar renglones:** pantalla de tarjetas para deslizar ✓/✗. Cada renglón
   es ítem, sección o grupo, banda, no-backline o nota; para los ítems, la
   cantidad, el equipo, la marca, el modelo y la categoría.
3. **Aprender de las etiquetas:**
   - un catálogo de equipos confirmados y una lista de lo que no es backline;
   - un clasificador pequeño entrenado con esas etiquetas;
   - las reglas, que siguen haciendo lo estructural.
   Cada rider etiquetado queda como prueba, para medir la precisión con un número.

**Pendiente de que el usuario decida:** dónde guardar las etiquetas. Puede ser
un archivo que se exporta, o Firestore `backline-2797d`. En cualquier caso, sin
datos de contacto.

## `entrenar/`: enseñarle al lector (en marcha)

Pantalla de tarjetas para el paso 1 y el paso 2 del plan de arriba:
1. Se sube un PDF, una foto o un texto.
2. "Así lo leí" muestra cada renglón con su etiqueta. Es la traza: el lector
   recibe `ctx.traza` y `leerTodo` recibe `op.traza`.
3. Se revisan tarjetas: derecha = acertó; izquierda = se equivocó, y se elige qué
   era (ítem con cantidad, equipo y categoría; no backline; sección; grupo;
   banda; nota). "Lo importante" muestra los ítems, lo no entendido, dónde
   empieza el backline y lo descartado que suena a instrumento: unas 60
   tarjetas por rider.
4. Resultado: el % de acierto, la lista de correcciones y "Descargar etiquetas",
   un JSON `etiquetas-lector/1` sin correos ni teléfonos. "Ver reels con lo
   confirmado" arma `lab-reels:doc` solo con lo que quedó como ítem.

Por ahora las etiquetas se guardan como archivo que el usuario descarga y le
pasa a Claude. **Lo que sigue:** con esos JSON, crecer el catálogo de equipos y
la lista de no-backline, entrenar el clasificador, y medir con cada archivo como
prueba (que el % suba sin romper los riders anteriores).

## `lab-reels/`

**Lo nuevo (2026-10-07), y manda sobre lo de abajo si chocan:**
- **Entrada.** El saludo se escribe solo, letra por letra, y después se borra: va según la hora, nombra el
  evento del día y el cierre cambia en cada visita. Al final quedan dos recuadros con íconos de línea,
  «Subir rider» y «Tomar foto». Mientras se lee el documento sale el escáner (hoja + línea naranja), y al
  terminar, el holograma de la «tarima» (`holograma.js`). Si ya hay un rider, o si hoy hay un evento del
  cronograma con riders, no hay entrada: saludo corto y directo a los reels.
- **A la derecha de cada reel solo va «›».** No hay Listo, Subir, doble toque ni conteos bajo el título;
  solo las etiquetas de categoría. Las ayudas salen solo la primera vez.
- **El listado se ve como Excel** (blanco, cuadrícula, Cant | Requerimiento).
- **Scroll en las historias (2026-10-08):** las historias de los lados (`.slide.banda`) se deslizan enteras hacia
  abajo (antes quedaban cortadas y el dedo cambiaba de reel); adentro no hay otro scroll y arriba se desvanecen
  bajo el título. Para probar el dedo en Playwright sirve `Input.dispatchTouchEvent` por CDP
  (`synthesizeScrollGesture` no mueve nada en este Chromium).
- **Chulo verde (2026-10-08, lo pidió el usuario):** tocar una pieza del listado la marca como lista (✓ verde)
  y otro toque la quita. Se guarda por pieza (banda|sección|nombre corto) en `lab-reels:chulos2:<documento>`, así
  sobrevive a volver a abrir la lista o a que cambie; las claves viejas `lab-reels:chulos:<doc>|<cuando>` se
  migran al cargar y no se borran. Las fotos de una pieza se buscan por su nombre corto (sin paréntesis). La hoja de
  detalle (`abrirDetalle`: renglón del rider, su sección y la misma categoría en otras bandas; el admin
  edita desde ahí) se abre con el «›» al final del renglón.
- **Fotos por pieza (2026-10-08, lo pidió el usuario):** en la hoja de detalle, «En bodega» y «En evento»,
  cada una con Tomar foto / Subir. Se guardan como las de las bandas (IndexedDB + `fotos` de Elm) con la
  clave `pieza|banda|sección|referencia|momento`, que no cambia al recargar la misma lista. En el listado
  sale «📷 Bodega n» / «📷 Evento n». Al volver a dibujar, el reel se queda en el panel donde estaba.
  Además, cada sección tiene una **cuarta historia «Fotos»** (`htmlHistoriaFotos`): cada pieza con su fila de
  Bodega y de Evento, 📷 y 🖼, y arriba cuántas piezas tienen foto en cada momento. Las fotos se ven
  **grandes y en carrusel** (deslizar de lado), y las piezas con fotos van primero. En el listado, cada
  renglón trae su **📷** (abre «En bodega / En evento» con Tomar foto y Subir), y el chip «📷 Bodega n»
  lleva a la historia de fotos.
  Una lista del sitio puede traer sus fotos en `listas/<nombre>.fotos.json` (pieza por nombre, momento y URLs
  en `listas/fotos/`, achicadas y sin EXIF): se ven en cualquier celular y no se borran desde la app.
- **Lo que lleva cada instrumento (2026-10-08, lo pidió el usuario: "la batería debe llevar silla y no la
  pidió"):** tabla `LLEVA` en `lab-reels/index.html` (batería: silla, pedal, base de redoblante, máquina de
  hi-hat, platillos, alfombra y plásticos —así les dicen a los parches; cuenta también «parches» o una marca
  como Remo/Evans—; bajo: ampli y base; guitarra: ampli y base; teclado: base y pedal de sustain).
  «Hardware completo» cubre stands y pedal, no silla ni alfombra. Se avisa (⚠ en los botones de sección,
  «Revisa: no pidió…» en la portada de la sección, «Le falta» bajo el listado), nunca se agrega solo:
  «+ Agregar» (admin) vuelve a cargar el mismo documento con la pieza (nota «Agregado al revisar») y «No hace
  falta» lo descarta (`lab-reels:no-falta:<doc>`). Si el usuario corrige la tabla, cambiarla ahí.
- **Respaldo (2026-10-08, lo pidió el usuario: no perder estados):** en Filtros, «Guardar respaldo» arma un
  .json (`respaldo-lab-reels/1`) con lo de `lab-reels:`/`cronograma:`/`planilla:` en localStorage y las fotos de
  IndexedDB, y lo comparte (WhatsApp/Drive) o lo descarga; «Cargar respaldo» lo devuelve. Se pide
  `navigator.storage.persist()`. Firestore `backline-2797d` hoy niega lectura y escritura (403): para subir
  a la nube hay que abrir reglas o poner login.
- **Dos espacios** (en Elm, `Espacio`): **Evento** (oficial, viene del cronograma; el empleado lo ve
  con candado y no lo cambia) y **Mis pruebas** (el escritorio propio; lo que el empleado sube a mano cae
  ahí). La regla es `puedeEscribir` en `Tablero.elm`.
- **`cronograma/`** (admin): el mes con los eventos, escenarios, bandas por día con su rider
  (falta / recibido / revisado) y el contra-rider. Se guarda en el dispositivo por ahora. «Ver en reels»
  abre `lab-reels/?rider=…&evento=…`.
- **`?lista=listas/….txt`** abre los reels con una lista guardada en `lab-reels/listas/` (la hoja a mano
  del usuario del 2026-10-08, pasada a texto: `lista-a-mano.txt`). El proveedor de cada pieza
  ("Equipo   2   AUDIO ROOM") sale como «Proveedor: Audio Room» en la sección y «Lo trae …» en la pieza.
- **El plan del servidor** está en `docs/modelo-de-datos.md`: tablas, llaves y permisos.
- Para revisar en celular se usa una página local con varios iframes de 390×844 lado a lado
  (`_celular.html`, no se sube).

**Perfiles y modos (2026-10-05).** El estado vive en Elm: `app/src/Backline/Tablero.elm`
(pruebas en `app/tests/TableroTest.elm`), compilado a `lab-reels/tablero.js` por
`construir-sitio.sh`. Elm guarda documento, perfil, modo, búsqueda, filtros y fotos, y
decide los permisos; la página solo dibuja lo que recibe por el port `vista` y guarda
lo que llega por `guardar` (`localStorage` `lab-reels:tablero`).
- **Admin y empleado** (por ahora un toggle arriba; el login viene después): los dos
  suben riders con la misma herramienta, buscan, filtran y toman fotos de las bandas.
  **Solo el admin**: modo festival, Pide vs propuesta, editar o quitar ítems (tocar el
  ítem) y "Planilla .xlsx" (abre `planilla/?desde=reels` con la banda ya editada).
- **Modo normal** (el de siempre, y el único del empleado), al estilo reels: **hacia abajo,
  sección por sección** (lo pidió el usuario). Primero la portada de la banda (holograma y el
  listado ahí mismo, entrando uno a uno) con sus fotos al lado; luego una pantalla por sección
  del rider y, a los lados, **solo tres**: información (holograma, opciones de marca, resumen),
  "En el listado" (el admin edita ahí) y "Lo que pidió la banda" (los renglones del rider de
  esa sección, de `datos.pedidos`, con qué quedó de cada uno). Sin botones de Índice ni Enviar.
  En la portada, una fila de botones con las secciones (Batería, Bajo, In ears, Consolas…) salta a
  cada una (2026-10-08, lo pidió el usuario).
  Un ítem que es solo el cabezal (SVT, head) se dibuja como cabezal. El nombre de la banda va
  solo en la cabecera.
- **Modo festival** (lo elige el admin en Filtros): los reels por categoría de abajo.
- Las fotos quedan en el dispositivo (IndexedDB `backline-fotos`), achicadas a 1600 px;
  todavía no se comparten entre celulares.

Una pantalla por categoría, que se cambia deslizando arriba y abajo; a los lados
están el resumen y cada banda. Todo usa CSS scroll-snap.
- Al abrir sale el logo de Circuito Naranja con glitch, como TikTok. Las guías de
  gestos con la mano salen una sola vez; `#intro` las repite.
- **Primer reel, "Sube un documento":** lee el archivo con
  `../cordillera/lector/` y arma reels solo con lo que encontró. Se guarda en
  `localStorage` (`lab-reels:doc`) y "Borrar" lo quita. No hay datos de ejemplo
  fijos: el usuario no quiere ver Cordillera ahí.
- **Siempre 9 reels, en este orden:** Batería, Bajo, Guitarra, Teclado, Percusión,
  Platillos, In ears, Consolas y Extras (lo pidió el usuario; nada de "Tarimas", "Vientos" ni "DJ").
  In ears y Consolas (2026-10-08) van a su reel aunque vengan en el bloque de un instrumento.
  Se respeta el bloque de la banda (el `grupo` del lector): lo pedido en el bloque
  del bajo se queda en Bajo y los platillos del bloque de batería, en Batería. Sin
  grupo de instrumento, cada ítem va por su categoría; las bases van con su
  instrumento y lo que no es instrumento, a Extras.
- En cada portada hay un holograma 3D (`holograma.js`, con el Three.js de
  `reconocimiento-3d/vendor/`). La batería se modeló según una foto real de
  tarima. Un solo lienzo WebGL pasa al reel visible.
- El holograma se arma con el listado (`receta.js`): si dice 4 bases de platillo,
  salen 4; lo que no diga sale del formato de siempre de una batería.
- **Siempre** (cualquier modo): la ficha de cada banda se lee como el rider, con sus
  secciones completas y en orden (lo de otro reel, tenue); y todo es dinámico:
  reglas generales, nada amarrado a un documento ni palabras fijas por categoría.
- **Modo festival** (así lo llama el usuario: un evento con varias bandas):
  - Lo que importa son las bandas: la portada dice cuántas bandas y cuántas por día;
    los totales por referencia ("4 kick") quedan de fondo, detrás de "Totales de fondo".
  - En un Excel "Cant | Requerimiento | Cant | Propuesta" (OML), cada ficha tiene el
    botón **Pide vs propuesta** con las dos columnas en el orden de la hoja y el total
    de cada lado. Se compara por total, no fila por fila: no van alineadas.
  - Las reglas de modo festival no se imponen en el otro modo: si se trabaja ese modo,
    preguntarle al usuario cómo debe verse.
- Un listado sin banda (`sinBanda` del lector) no sale como banda, pero sí en los totales.
- En PC hay índice lateral y flechas para el mouse; en el celular nada de eso.
- Lleva un reemplazo de `Map.getOrInsertComputed`, porque pdf.js lo necesita en
  navegadores no tan nuevos.

## Convenciones

- Textos de pantalla, commits y comentarios en español.
- Commits descriptivos que digan el porqué.
- Estilo de la marca: fondo negro, naranja `#ff6a1f`, títulos en Barlow
  Condensed y texto en IBM Plex Sans.
- Probar en un celular simulado con Playwright; Chromium está en
  `/opt/pw-browsers`. Para subir archivos se usa `waitForEvent('filechooser')`.
- Para probar en local: `python3 -m http.server 8000` en la raíz. Los demos con
  lector u OCR no funcionan abriendo el HTML suelto.
