# Extractor de backline (demo)

Una página: sueltas el correo `.eml`, el PDF, la foto del rider o el desglose de producción `.xlsx`, y el lector (`../lector`) lo convierte en el listado del evento ahí mismo, en el navegador. Sin internet ni servicios pagos: pdfjs para PDF, Tesseract para fotos y planos, exceljs para el desglose, y las reglas del lector.

## Correr

```bash
cd ../lector && npm install && npm run preparar   # deja el motor OCR y los idiomas en lector/ocr/ (16 MB, una vez)
cd ../extractor && npm install
npm run dev        # http://localhost:5180
npm run build      # dist/ estático, listo para abrir sin conexión con `npm run preview`
```

`public/ocr`, `public/data` y `public/muestras` son enlaces a `lector/`: el extractor no copia nada, usa el mismo código y los mismos datos.

## Qué se ve

1. **Evento**: opcional. Con "Cordillera 2026" el lector reconoce sus artistas (NICHE → Grupo Niche) y sus días ("Day 2" → fecha).
2. **Suelta documentos** (o pega texto, o pega una imagen del portapapeles). Cada archivo muestra su estado y, al terminar, lo que sacó. Se pueden soltar varios: el listado se va uniendo.
3. **Listado dinámico** con contadores, búsqueda, filtro por artista y "solo lo dudoso":
   - *Backline*: por artista y grupo del rider; cantidad y descripción editables en la fila; lo dudoso en ámbar con su nota (alternativas que no suman, frases del rider, lecturas del OCR); "lo trae la banda" cuando el rider lo dice.
   - *Tarima*: el stage plot con los puestos y zonas que propuso el OCR encima, la tabla de risers con medidas, y los puestos con corriente, monitor y canales que los captan.
   - *Canales*: el IO List, entradas y salidas.
   - *Horario*, *Requisitos* (power, crew, notas) y *Avisos* (lo que no se entendió o no cuadra entre fuentes).
4. **Integrar al evento**: aplica la extracción sobre el evento elegido con ids estables y muestra cuántos ítems, zonas o canales son nuevos, cambiaron o ya estaban.
5. **Descargar JSON**: la `Extraccion` (por nombres) o, ya integrado, el `PaqueteEvento` completo. Es el mismo JSON que consume la app.

Muestras incluidas: el desglose real de Cordillera 2026 (8 planos con OCR, unos 20 s), una hoja de backline en PDF y una foto de una hoja.

## Límites

- El OCR de fotos y planos corre en WebAssembly: la primera lectura carga el motor (unos segundos); las siguientes son rápidas.
- Los cambios hechos en el listado viven en la página hasta descargar el JSON; no se guardan solos.
- Es una demostración del lector, no la app: la app (Elm, en `app/`) es la que guardará, sincronizará y funcionará en modo evento.
