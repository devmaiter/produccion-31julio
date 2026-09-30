# Backline

Gestión de backline para festivales: listas por banda, conteo en cancha, totales y horario. Une los dos prototipos (hoja de producción Simón Bolívar/Vallenato y lista de chequeo de Cordillera 2026) en un solo proyecto.

**Principios**
- **Sin suscripciones ni servicios pagos.** Todo corre en los dispositivos del equipo; no hay IA ni nube obligatoria.
- **Modo evento: funciona sin internet.** Un portátil en tarima hace de servidor en la red local y los celulares se sincronizan con él.
- **Nada se carga sin revisar.** Lo que se lee de correos, PDF y fotos pasa por una pantalla de revisión antes de guardarse.

## Cómo correrlo

```bash
cd app
npm install
npm run evento     # modo evento: construye y sirve la app en el puerto 8080 (muestra la dirección y un QR)
npm run dev        # desarrollo
npm test           # pruebas
```

### Montar el modo evento

1. En el portátil: `npm run evento`.
2. Conecta los celulares a la misma red: el punto de acceso Wi-Fi del portátil o un router en tarima. **No hace falta internet.**
3. En cada celular, abre la dirección que muestra el portátil (o escanea el QR) y escribe tu nombre en **Equipo**.
4. Cada celular trabaja aunque pierda la red; al volver envía lo pendiente. Todo queda en `evento-datos/ops.jsonl` en el portátil. En **Equipo** se descarga un respaldo.

> Los navegadores solo guardan la app completa para abrirla sin conexión (service worker) cuando viene de `https` o de `localhost`. En los celulares conectados al portátil por `http://192.168…` la app funciona y guarda todo sin red **mientras la pestaña siga abierta**. Si se cierra lejos del Wi-Fi, hay que volver a la red para abrirla. Con la app publicada en `https` también abre sin conexión.

## Qué hace

| Pantalla | Para qué |
|---|---|
| Backline | Ficha por banda y día: lista, conteo (pide/hay/listo), editar, borrar o agregar ítems, fotos del montaje con la cámara, stage plot |
| Totales | Por referencia: se **suma** dentro del día y se toma el **máximo** entre días |
| Horario | Por escenario y día |
| Importar | Correo `.eml` (con adjuntos), PDF, fotos o texto pegado → revisión editable → guardar |
| Equipo | Nombre de quien usa el celular, estado de la sincronización, respaldo |

Cada conteo o cambio queda firmado con el nombre y la hora de quien lo hizo.

## Lectura de correos, PDF y fotos (`src/lectura/`), 100 % local

```
archivo ─► leer.ts ─────────────► interpretar.ts ─► revisión ─► integrar.ts ─► operaciones
           .eml: cuerpo+adjuntos   reglas: días,     en          ids, referencias,
           PDF: texto+columnas     horario, artistas pantalla    propietario,
           foto: OCR (Tesseract)   grupos, ítems                 sin duplicar
```

- **Correo**: postal-mime; lee el cuerpo y cada adjunto.
- **PDF**: pdfjs. Conserva las columnas (`Snare stand   2   CN`). Una página escaneada se pasa por OCR.
- **Foto**: Tesseract (WebAssembly) en español e inglés, con los idiomas incluidos en la app (`npm run preparar` los copia a `public/ocr/`). Tarda unos 2–3 s por foto. Endereza la imagen y lee por columnas.
- **Intérprete** (`interpretar.ts`): reconoce títulos de día, escenario, bloques de horario (`16:00 - 16:45 LOS RAYOS`, `Soundcheck 9:00`), encabezados de grupo (`DRUMS`) y de artista, ítems en columnas o en frase (`2 Snare stand`, `Base de redoblante x2`, `Platillos: 1 ride`) y el proveedor (CN/OML/…). Usa los artistas y días que ya existen en el evento.
- Lo que no entiende no lo inventa: lo deja en avisos. En fotos, lo que no se leyó con seguridad se marca **confirmar**.

**Resultados medidos con las muestras de `tests/fixtures/`:**

| Muestra | Resultado |
|---|---|
| PDF | 9/9 ítems con cantidad y proveedor; horario, escenario y evento |
| Foto nítida | 9/9 ítems |
| Foto torcida y con ruido | 9/9 ítems y artistas; las cantidades de una tabla con bordes no se leen y quedan en 1 marcadas "confirmar" |

Ese último es el límite real del OCR sin IA: se corrige en la revisión.

## Modo evento (`src/sync/`)

- Cada cambio es una **operación**: verificación, ítem guardado o borrado, foto, o la estructura de una importación.
- Se guarda primero en el dispositivo (IndexedDB) y luego se envía al portátil (`/api/sync`).
- El estado = datos base (`data/*.json`) + todas las operaciones, en orden por hora. Todos los dispositivos con las mismas operaciones ven exactamente lo mismo. Si dos personas cambian lo mismo, gana lo más reciente; la hora se ajusta con el reloj del portátil.
- Si se cambia de portátil (registro nuevo), los celulares se enteran y le reenvían todo.

## Estructura

```
app/
  src/dominio/    entidades (zod) y reglas: categorías, referencias, propietario, totales, verificación
  src/lectura/    correo/PDF/foto → texto → Extraccion → entidades
  src/sync/       operaciones, almacén en el dispositivo, tienda, sincronizador, registro del portátil
  src/datos/      eventos base y consultas
  src/ui/         interfaz mínima (sin diseño todavía)
  servidor/       servidor del evento (npm run evento)
  scripts/        importador de los prototipos y preparación del OCR
  data/           eventos migrados de los prototipos
  tests/          pruebas y muestras (PDF, foto, correo)
```

## Datos migrados de los prototipos (`data/`)

| Evento | Días | Artistas | Ítems | Stage plots |
|---|---|---|---|---|
| Cordillera 2026 | 3 | 40 | 337 | 8 |
| Vallenato al Parque 2026 | 3 | 19 | 0 | 0 |
| Parque Simón Bolívar jul–ago 2026 | 3 | 16 | 7 | 4 |

El backline de Simón Bolívar y Vallenato se editaba en Firebase y sus reglas no permiten leerlo desde fuera. Para traerlo hay que exportarlo desde la consola de Firebase.

## Siguientes pasos

1. Probar con correos, PDF y fotos reales de producción y ajustar el intérprete con lo que falle.
2. `https` en el portátil (certificado local) para que los celulares también puedan abrir la app sin conexión desde cero.
3. Diseño.
