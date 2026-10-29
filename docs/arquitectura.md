# Arquitectura de los reels (2026-10-29)

El usuario pidió «empaquetar, encapsular y normalizar todo»: el backline es **un módulo** de una plataforma
más grande de Circuito Naranja (después vendrán audio, luces, video…), y la app debe poder **mudarse a
cualquier entorno** (otro servidor, otra base de datos, otra marca) sin rehacerla.

## Las capas

```
lab-reels/
  entorno.js            1. ENTORNO     qué cambia de un entorno a otro (claves, bases, rutas, marca)
  plataforma/
    almacen.js          2. Almacen     la única puerta para guardar y leer (datos y archivos)
  backline/
    reglas.js           3. ReglasBackline  reglas del backline, puras (sin pantalla ni almacenamiento)
  tablero.js            4. Elm         el estado: documento, perfil, espacio, permisos (app/src/Tablero.elm)
  src/NN-*.js           5. Pantalla    16 archivos por tema; armar.py los junta en app.js
  index.html            diseño (CSS) y HTML; carga 1 → 5 en ese orden
  backstage.html        la misma app con otra marca (la arma hacer-marcas.py)
```

Cada capa solo usa las de arriba. La pantalla nunca toca `localStorage` ni `IndexedDB`, y no escribe nombres
de claves ni rutas: los pide al almacén y al entorno.

## Cómo aplica SOLID

| Principio | Dónde |
|---|---|
| **Responsabilidad única** | Cada archivo hace una cosa: `entorno.js` configura, `almacen.js` guarda, `reglas.js` decide qué lleva cada instrumento, cada `src/NN-*.js` es un tema de la pantalla (subir, show, notas, respaldo…). |
| **Abierto/cerrado** | Otra marca = una entrada en `MARCAS` de `hacer-marcas.py` (ya no se reemplaza texto en el código). Otro instrumento = `ReglasBackline.registrar("Vientos", [...])`, sin tocar las reglas. Otro entorno = otra configuración en `entorno.js`. |
| **Sustitución (Liskov)** | Cualquier adaptador de datos o archivos que cumpla la misma forma (`obtener/poner/quitar/claves`, `ejecutar/listar`) reemplaza al del celular sin que la app note la diferencia. |
| **Segregación de interfaces** | El almacén separa **datos** (texto por clave) de **archivos** (Blob por clave y por base): un servidor puede implementar uno sin el otro. |
| **Inversión de dependencias** | La app depende de `Almacen` (una abstracción), no de `localStorage`. Las reglas no dependen de la pantalla: la pantalla les pasa lo que necesitan (`faltantesDe(items, {talCual, descartadas})`). |

## Mudarse a otro entorno

**Otro servidor (sitio estático):** copiar la carpeta. Si el lector o el link de hoy quedan en otra ruta,
cambiar `rutas` en `entorno.js`.

**Guardar en la nube en vez del celular:** escribir un adaptador y pasarlo al almacén antes de `app.js`:

```js
// p. ej. lab-reels/plataforma/nube.js (cargado después de almacen.js)
Almacen.usar({
  datos: {
    obtener: k => cache.get(k) ?? null,            // leído al abrir desde el servidor
    poner: (k, v) => { cache.set(k, v); enviar(k, v); },
    quitar: k => { cache.delete(k); enviar(k, null); },
    claves: () => [...cache.keys()],
  },
  archivos: { ejecutar: (base, modo, accion, almacen) => …, listar: base => … },
});
```

Las claves ya tienen la forma del modelo de datos (`docs/modelo-de-datos.md`): `<prefijo>:<qué>:<documento>`.
**Nunca cambiar un nombre de clave o de base sin migrar lo guardado** (CLAUDE.md: «nada se pierde»).

**Otra marca:** una entrada en `MARCAS` de `lab-reels/hacer-marcas.py` con `nombre`, `logo` y `prefijo`.

**Otro módulo de la plataforma (audio, luces):** su propio `<modulo>/reglas.js` como `backline/reglas.js`,
y usa los mismos `entorno.js` y `almacen.js`.

## Armar y probar

```bash
python3 lab-reels/armar.py          # src/*.js → app.js (también lo corre construir-sitio.sh)
python3 lab-reels/hacer-marcas.py   # index.html → backstage.html
cd pruebas && npm install           # una vez (Playwright)
npm run reglas                      # pruebas de las reglas, sin navegador
python3 -m http.server 8000 &       # desde la raíz del repo
npm run base                        # ANTES de un cambio: guarda lo que la app muestra y guarda
npm run comparar                    # DESPUÉS: dice qué cambió (debe decir «Igual: nada cambió.»)
```

La red de seguridad recorre 15 escenarios: hoy, 22-oct, 17-oct, la lista a mano, Backstage, chulo y nota,
respaldo con una foto, subir un rider, Don Teto, el aviso del evento de hoy (desde un link y con un rider
propio), planilla, cronograma, entrenar y la Home.

## Lo que sigue

1. Que `planilla/`, `cronograma/` y `entrenar/` usen también `entorno.js` y `almacen.js` (hoy guardan por su
   cuenta).
2. Partir el lector (`lector/`) en lectura genérica de documentos (PDF, foto, Excel → renglones), que sería de
   la plataforma, y reglas de backline (`interpretar.ts`, `categorias.ts`, `bateria.ts`), que son del módulo.
3. Un adaptador de nube para el almacén cuando se decida el servidor (`docs/modelo-de-datos.md`).
4. Pasar la pantalla a módulos ES con imports explícitos, tema por tema, ahora que cada tema vive en su archivo.
