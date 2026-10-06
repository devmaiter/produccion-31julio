# App de backline en Elm

Aquí va la app completa: entidades, reglas, estado y pantallas. Elm no tiene errores en tiempo de ejecución y sus tipos cerrados obligan a tratar todos los casos, que es lo que buscamos con "robusto".

## Correr

```bash
npm install          # instala elm, elm-test y elm-format (binarios, sin nada global)
npm test             # pruebas: decodificadores contra los eventos reales de data/
npm run revisar      # compila y valida el formato
npm run compilar     # dist/elm.js
npm run dev          # elm reactor en http://localhost:8000 → abrir index.html
```

## Qué hay

| Archivo | Qué es |
|---|---|
| `src/Backline/Entidades.elm` | El modelo: `Categoria`, `Propietario`, `TipoDia`, `TipoBloque` como tipos cerrados; `Evento`, `Escenario`, `Dia`, `Artista`, `Bloque`, `ItemBackline`, `StagePlot`, `Verificacion`, `PaqueteEvento` |
| `src/Backline/Json.elm` | Decodificadores y codificadores estrictos del JSON del lector: fechas `AAAA-MM-DD`, horas `HH:MM`, ids, cantidades no negativas; un campo opcional con el tipo equivocado es un error |
| `src/Backline/Extraccion.elm` | Lo que devuelve el lector al leer un archivo, antes de integrarlo |
| `src/Backline/Tablero.elm` | El estado de los reels: perfil admin/empleado, modo normal/festival, búsqueda, filtros, fotos por banda y permisos. `src/Tablero.elm` lo expone por ports y se compila a `lab-reels/tablero.js` |
| `src/Main.elm` | Arranque: recibe los eventos como flags y muestra un resumen (sin diseño aún) |
| `tests/JsonTest.elm` | Pruebas; `tests/Fixtures.elm` se genera desde `data/` con `npm run fixtures` |
| `data/` | Copia de los eventos que produce el lector (`lector/data/`), para las pruebas |

## La frontera con JavaScript

Elm no puede leer PDF, hacer OCR, usar IndexedDB ni la cámara. Eso vive en JavaScript y entra por **ports**:

| En Elm | En JavaScript (ports) |
|---|---|
| Entidades y JSON | Lector de archivos (`lector/`: correo, PDF, OCR) → `Extraccion` en JSON |
| Reglas: categorías, referencias, integrar, totales, verificación, reductor de operaciones | IndexedDB (almacén del dispositivo) |
| Estado y pantallas | Sincronización con el portátil, cámara, service worker |

El servidor del evento (Node) sigue en JavaScript.

## Qué se trae del prototipo en TypeScript

La lógica pura ya está escrita y probada en TypeScript (rama `ccr-0c2da25e-7kfm4m`, carpeta `app/src/`); se traduce a Elm en este orden:

1. `dominio/categorias.ts`, `referencias.ts`, `propietario.ts`, `lista.ts` → `Backline.Reglas`
2. `dominio/verificacion.ts`, `totales.ts` → `Backline.Verificacion`, `Backline.Totales`
3. `lectura/integrar.ts` → `Backline.Integrar`
4. `sync/ops.ts` (operaciones y reductor) → `Backline.Operaciones`
5. Pantallas (`ui/vistas/*`) → `Vista.*`, con los ports para IndexedDB y sincronización

## Nota sobre paquetes

El registro `package.elm-lang.org` puede estar bloqueado en algunas redes. Los paquetes también se pueden poner a mano en `~/.elm/0.19.1/packages/<autor>/<paquete>/<versión>/` (son los repos de GitHub en esa etiqueta), con un `registry.dat` generado; así se compiló esto.
