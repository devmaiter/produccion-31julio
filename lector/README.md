# Lector de backline

Convierte lo que llega de producción (correos `.eml` con sus adjuntos, PDF, fotos de hojas de backline u horarios, texto pegado y el **desglose de producción** `.xlsx`) en los datos del evento: días, escenarios, artistas, horario, backline y la tarima de cada banda (zonas, puestos, canales), en JSON. Ese JSON es lo que recibe la app.

**Todo corre en el dispositivo.** Sin servicios pagos ni internet: el PDF se lee con pdfjs, las fotos con OCR (Tesseract, español e inglés, incluido aquí) y el correo con postal-mime. Lo que no se entiende no se inventa: queda en `avisos`; lo que el OCR no leyó con seguridad se marca `dudoso`.

## Usar

```bash
npm install
npm test                                   # pruebas (PDF, foto nítida, foto torcida, correo con adjunto)
npm run texto -- rider.pdf desglose.xlsx    # → el texto tal como se leyó (Markdown), sin interpretar
npm run texto -- --guardar riders-reales/*  # → escribe <archivo>.md al lado de cada uno
npm run leer -- hoja.pdf foto.jpg          # → JSON de la extracción
npm run leer -- --evento cordillera-2026 --artista "Sean Paul" correo.eml
npm run leer -- --evento cordillera-2026 --integrar --guardar correo.eml   # suma al evento y escribe data/
npm run leer -- --evento cordillera-2026 --integrar --guardar desglose.xlsx # el desglose entero: riders, risers, IO list, planos
```

Opciones de `leer`: `--evento <id>` (usa los artistas y días de ese evento), `--artista`, `--fecha AAAA-MM-DD`, `--integrar` (devuelve también el evento integrado y el resumen), `--guardar`.

## Cómo funciona

```
archivo ─► leer.ts ──────────► interpretar.ts ──► Extraccion (JSON) ──► integrar.ts ──► PaqueteEvento
           .eml: cuerpo+adjuntos   reglas: días,      por nombres,         ids, referencias,
           PDF: texto+columnas     horario, artistas   revisable           propietario,
           foto: OCR               grupos, ítems                           sin duplicar
```

| Carpeta | Qué hay |
|---|---|
| `src/lectura/` | `leer.ts` (archivo → texto), `pdf.ts`, `ocr.ts`, `interpretar.ts` (texto → `Extraccion`), `desglose.ts` (`.xlsx` → `Extraccion`), `plano.ts` (stage plot → puestos y zonas por OCR), `medidas.ts`, `nombres.ts`, `xlsx.ts`, `imagen.ts`, `integrar.ts` (`Extraccion` + evento → `PaqueteEvento`), `esquema.ts` (la forma del JSON), `navegador.ts` y `node/` (lectores para cada entorno) |
| `src/dominio/` | Entidades (zod) y reglas que el lector necesita: categorías por palabras clave, referencias equivalentes, propietario, listas pegadas |
| `data/` | Eventos ya importados (`*.json`) y sus stage plots |
| `scripts/` | `leer.ts` (comando), `importar-prototipos.ts` (trae los datos de la hoja de producción y de `cordillera/`), `preparar-ocr.ts` (copia el motor y los idiomas a `ocr/`) |
| `tests/` | Pruebas y muestras reales: PDF, foto nítida, foto torcida y con ruido, correo con PDF adjunto, desglose de Cordillera 2026 |

## La tarima: de dónde sale cada cosa

El desglose de producción trae, por banda y por día, varias fuentes que hablan de lo mismo desde ángulos distintos. El lector las junta en un solo modelo y anota en `avisos` lo que no cuadra entre ellas:

| Hoja | Qué se lee | Entidad |
|---|---|---|
| `Backline Day n` | El rider en texto: secciones ("BAJO (Omar)"), cantidades ("X1", "2x", "(02)"), alternativas ("Opción 2…", "Sustituciones aceptables:", que no suman), "Nota:" (va a `requisitos`), lo que "la agrupación lleva" (proveedor `ARTISTA`) | `ItemBackline` |
| `Risers Day n` | Sobretarimas con medidas en m, cm, ft o in; "RISER C Y D" son dos; "Rolling" da ruedas a todas; los módulos en que se divide una no son otra | `Zona` (tipo `riser`) |
| `IO List Day n` | Un bloque de columnas por banda: canal, instrumento, micrófono, base, ubicación o snake ("1 - RACK" separa canal y rack); después del bloque `OUTPUT`, las salidas | `Canal` |
| `Stage Plots Day n` | La imagen se guarda en `data/stage-plots/<evento>/<artista>.png`; el OCR (imagen ampliada 3×) propone puestos ("BASS", "OMAR" si el IO List dice "BASS OMAR"), zonas ("AMP RISER", "GUITAR WORLD"), tomas ("110V") y monitores ("MIX 3") con su posición 0–1. Todo queda `dudoso`: la posición se confirma a mano en el plano | `Puesto`, `Zona` (tipo `area`) |
| `Power`, `Crew`, `BACKLINE <iniciales>` | Texto tal cual, y el backline en filas Qty / ítem | `Requisito`, `ItemBackline` |
| Cualquier otra hoja con `Cant | descripción` | Tablas de backline como el inventario de OML: bloques `Cant | Requerimiento | Cant | Propuesta` por banda (la banda, la fecha y el escenario se leen encima del encabezado); los ítems salen de la propuesta y el rider queda como requisito. Una hoja plana (`CANTIDAD | ítem | DIAS | VALOR`) entra con las columnas extra como nota | `ItemBackline`, `Requisito` |

Cruces que producen avisos: riser dibujado en el plano con medidas distintas a la hoja (Kany García: 12.2 m vs 14.44 m), canales ubicados en un riser que no existe en la hoja ni en el plano, más mesas de percusión pedidas que percusionistas dibujados, tomas de corriente que no quedan junto a ningún puesto.

## El contrato con la app

Dos formas de JSON, definidas en `src/lectura/esquema.ts` y `src/dominio/entidades.ts`:

- **`Extraccion`**: lo que se leyó, por nombres, para revisar y corregir en pantalla.
- **`PaqueteEvento`**: el evento completo, con ids, ya integrado.

La app (Elm, en `app/`) decodifica las dos con sus propios tipos. Si cambia un campo aquí, cambia allá.

## En el navegador

`lectoresNavegador({ pdfWorker, ocr })` recibe dónde está servido el worker de pdfjs y la carpeta que genera `npm run preparar` (`ocr/`, con el motor y los idiomas, unos 16 MB). Con eso lee sin internet.

## Límites conocidos

- En fotos de tablas con bordes, un dígito solo en su celda a veces no se lee: el ítem queda con cantidad 1 y marcado `dudoso`.
- Riders con el texto partido a ancho fijo (líneas cortadas a mitad de frase) dejan ítems truncados: se ven en el aviso de "líneas sin interpretar".
- El OCR de los planos lee bien las etiquetas escritas a máquina; los planos hechos a mano o muy comprimidos no dan texto y quedan solo como imagen para marcar a mano.
- Se ha probado con las muestras de `tests/fixtures/` y con el desglose real de Cordillera 2026. Falta probar con más correos, PDF y fotos reales.
