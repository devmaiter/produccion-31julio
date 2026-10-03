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
| `extractor/` | Build (Vite) del extractor: suelta un documento y sale el listado. Sus `data/` y `muestras/` sirven de ejemplo. |
| `demo-listado/` | Del listado del PDF al backline organizado (Cordillera 2024). |
| `reconocimiento-3d/` | Cámara + MobileNet que reconoce un equipo y lo muestra como holograma 3D (Three.js). |
| `produccion-31-julio/` | La app que se usó en producción el 31 de julio (Firestore del proyecto `backline-2797d`, `functions/`). |
| `prototipos/estado/` | Prototipo del Excel de Stage 4 como estado reactivo, con perfiles Admin/Operario y fotos por equipo (venía del repo `cordillera`; sus funciones de base de datos eran de un artifact y aquí solo corren en memoria). |
| `construir-sitio.sh` | Trae a `main` la última versión de cada demo desde su rama. |

## Ramas

| Rama | Contenido |
|---|---|
| `main` | El sitio publicado. |
| `extractor` | **Código fuente del lector** (`lector/`, TypeScript + Vitest) y del extractor (`extractor/`, Vite). Aquí se arregla el lector. |
| `lector` | Versión vieja del lector; la vigente está en `extractor`. |
| `cordillera` | Fuente de la página de Cordillera. |
| `demo`, `elm` | Demo del listado y la app definitiva en Elm (en construcción). |
| `claude/*` | Trabajo viejo sobre la app del 31 de julio. |

## El lector de documentos (lo primordial ahora)

Convierte un rider o listado (PDF, foto, Excel, correo, texto) en ítems de
backline: cantidad, descripción, categoría, banda y día. Corre en el dispositivo
y **sin IA de pago ni internet** (pdf.js, Tesseract para OCR y exceljs); es una
decisión del proyecto.

Piezas, en `lector/src/lectura/` de la rama `extractor`:
- `pdf.ts`: texto del PDF por renglones. Detecta páginas a 2–3 columnas y las
  lee columna por columna. No parte las tablas "Cant | Equipo | Observación".
- `interpretar.ts`: reglas que recorren los renglones.
  - **Secciones:** backline sí; input list, monitores, PA, luces, video,
    camerinos, catering, hotel, transporte y radios no.
  - **La banda:** "RIDER TÉCNICO" o "TECHNICAL RIDER" + nombre fija la banda de
    todo el documento.
  - **Renglones partidos y listas corridas.**
  - **Páginas repetidas:** un bloque igual a uno anterior se lee una vez.
  - **Unidades:** "16 CH" o "4 RETORNOS" no son cantidades.
  - **Opciones:** "OPCIÓN #2" es alternativa y no suma.
  - **Respaldo:** si no sale nada, relee sin secciones y marca todo "para revisar".
- `../dominio/categorias.ts`: categoría por palabras clave (Batería, Platillos,
  Percusión, Teclado, Ampli bajo, Ampli guitarra, Guitarra, Bajo, Bases,
  Escenario, Cables y energía, DJ, Otro).
- Pruebas: `tests/riders.test.ts` tiene riders de prueba inventados
  (`tests/fixtures/riders/`, generados desde `fuentes/*.html` imprimiendo a PDF
  con Chromium). Hay 93 pruebas en verde.

Trabajar el lector:
```bash
git worktree add ../lector-wt origin/extractor -b <rama>
cd ../lector-wt/lector && npm install && npm run preparar   # datos del OCR
npx vitest run && npx tsc --noEmit -p .
cd ../extractor && npm install
npm run build:cordillera -- <ruta-a-main>/cordillera/lector   # lector.js para el sitio
npm run build    # dist/ → copiar a <main>/extractor/ (rm -rf extractor && cp -rL dist extractor)
```
Después, en `main`, escapar los bytes de control de los .js como hace el paso
de Python de `construir-sitio.sh`, probar `lab-reels/` con un rider real y
publicar. El código fuente se empuja a `extractor` (autorizado).

**Riders reales probados.** No están en el repo porque traen teléfonos y
correos del equipo; no se suben:
- Dread Mar I: pasó de 152 ítems con ~9 bien a 29, todos backline. De ~31
  referencias no falta ninguna.
- Los Tigres del Norte: pasó de 64 a 32. Repetía páginas, traía "SNAKE DE
  12 CH", P.A. y catering. Solo falta "COW PIE".

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

Una pantalla por categoría, que se cambia deslizando arriba y abajo; a los lados
están el resumen y cada banda. Todo usa CSS scroll-snap.
- Al abrir sale el logo de Circuito Naranja con glitch, como TikTok. Las guías de
  gestos con la mano salen una sola vez; `#intro` las repite.
- **Primer reel, "Sube un documento":** lee el archivo con
  `../cordillera/lector/` y arma reels solo con lo que encontró. Se guarda en
  `localStorage` (`lab-reels:doc`) y "Borrar" lo quita. No hay datos de ejemplo
  fijos: el usuario no quiere ver Cordillera ahí.
- En cada portada hay un holograma 3D (`holograma.js`, con el Three.js de
  `reconocimiento-3d/vendor/`). La batería se modeló según una foto real de
  tarima. Un solo lienzo WebGL pasa al reel visible.
- El holograma se arma con el listado (`receta.js`): si dice 4 bases de platillo,
  salen 4; lo que no diga sale del formato de siempre de una batería.
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
