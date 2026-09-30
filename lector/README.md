# Lector de backline

Convierte lo que llega de producción (correos `.eml` con sus adjuntos, PDF, fotos de hojas de backline u horarios, texto pegado) en los datos del evento: días, escenarios, artistas, horario y backline, en JSON. Ese JSON es lo que recibe la app.

**Todo corre en el dispositivo.** Sin servicios pagos ni internet: el PDF se lee con pdfjs, las fotos con OCR (Tesseract, español e inglés, incluido aquí) y el correo con postal-mime. Lo que no se entiende no se inventa: queda en `avisos`; lo que el OCR no leyó con seguridad se marca `dudoso`.

## Usar

```bash
npm install
npm test                                   # pruebas (PDF, foto nítida, foto torcida, correo con adjunto)
npm run leer -- hoja.pdf foto.jpg          # → JSON de la extracción
npm run leer -- --evento cordillera-2026 --artista "Sean Paul" correo.eml
npm run leer -- --evento cordillera-2026 --integrar --guardar correo.eml   # suma al evento y escribe data/
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
| `src/lectura/` | `leer.ts` (archivo → texto), `pdf.ts`, `ocr.ts`, `interpretar.ts` (texto → `Extraccion`), `integrar.ts` (`Extraccion` + evento → `PaqueteEvento`), `esquema.ts` (la forma del JSON), `navegador.ts` y `node/` (lectores para cada entorno) |
| `src/dominio/` | Entidades (zod) y reglas que el lector necesita: categorías por palabras clave, referencias equivalentes, propietario, listas pegadas |
| `data/` | Eventos ya importados (`*.json`) y sus stage plots |
| `scripts/` | `leer.ts` (comando), `importar-prototipos.ts` (trae los datos de la hoja de producción y de `cordillera/`), `preparar-ocr.ts` (copia el motor y los idiomas a `ocr/`) |
| `tests/` | Pruebas y muestras reales: PDF, foto nítida, foto torcida y con ruido, correo con PDF adjunto |

## El contrato con la app

Dos formas de JSON, definidas en `src/lectura/esquema.ts` y `src/dominio/entidades.ts`:

- **`Extraccion`**: lo que se leyó, por nombres, para revisar y corregir en pantalla.
- **`PaqueteEvento`**: el evento completo, con ids, ya integrado.

La app (Elm, en `app/`) decodifica las dos con sus propios tipos. Si cambia un campo aquí, cambia allá.

## En el navegador

`lectoresNavegador({ pdfWorker, ocr })` recibe dónde está servido el worker de pdfjs y la carpeta que genera `npm run preparar` (`ocr/`, con el motor y los idiomas, unos 16 MB). Con eso lee sin internet.

## Límites conocidos

- En fotos de tablas con bordes, un dígito solo en su celda a veces no se lee: el ítem queda con cantidad 1 y marcado `dudoso`.
- Solo se ha probado con las muestras de `tests/fixtures/`. Falta probar con correos, PDF y fotos reales de producción.
