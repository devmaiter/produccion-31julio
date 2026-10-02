# Rama `extractor`: código del lector y del extractor

El contexto completo del proyecto está en `CLAUDE.md` de la rama `main`
(`git show origin/main:CLAUDE.md`). Léelo primero.

Esta rama es la fuente del **lector de documentos** (`lector/`, TypeScript +
Vitest) y del **extractor** (`extractor/`, Vite). El sitio publicado (`main`)
solo lleva lo empaquetado: `cordillera/lector/lector.js` y `extractor/`.

- Pruebas: `cd lector && npm install && npm run preparar && npx vitest run && npx tsc --noEmit -p .`
- Riders de prueba inventados: `lector/tests/fixtures/riders/` (PDF generados desde
  `fuentes/*.html`). Los riders reales del usuario no se suben: traen datos de contacto.
- Empaquetar para el sitio: `cd extractor && npm install && npm run build:cordillera -- <main>/cordillera/lector`
  y `npm run build` (copiar `dist/` a `<main>/extractor/`). Luego escapar bytes de control
  como `construir-sitio.sh` y publicar `main`.
- Textos y commits en español; sin IA de pago ni internet: todo corre en el dispositivo.
