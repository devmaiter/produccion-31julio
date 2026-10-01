# Reconocimiento de equipo en 3D

La cámara mira un equipo de backline, el dispositivo dice qué es y lo muestra como
holograma 3D encima de la imagen, con su ficha y lo que hay que revisar.

## Cómo se usa

1. **Cámara** abre la cámara trasera (en GitHub Pages ya es https, que es lo que pide el navegador).
2. Se pone el equipo dentro del recuadro y se pulsa **Escanear**: promedia 6 cuadros.
3. El holograma se dibuja de abajo hacia arriba; se gira con el dedo y se acerca pellizcando.
4. Sin cámara: **Foto** reconoce una imagen, o se toca un equipo del **Catálogo**.

## Cómo reconoce

- MobileNet v1 0.50 (ImageNet, 1000 clases) corre en el navegador con TensorFlow.js.
  El modelo está en `modelo/` (5 MB) y las librerías en `vendor/`, así que no depende
  de servicios ni de internet una vez cargada la página.
- `MAPA` en `index.html` dice qué clases de ImageNet cuentan para cada equipo
  (`electric guitar` → guitarra, `drum` → batería, `microphone` → micrófono...).
- MobileNet no conoce marcas ni distingue un amplificador de un monitor: ve "parlante".
  Por eso el parlante se reparte entre amplificador, gabinete de bajo y monitor, y la
  ficha avisa los parecidos para que la persona toque el correcto.
- Si nada pasa del 8 %, dice qué cree que vio y no inventa un equipo.

## Los hologramas

No hay archivos 3D: cada equipo se arma con piezas de Three.js en `CONSTRUIR`
(amplificador combo, cabezal y 8×10, batería, teclado con base X, guitarra en base,
micrófono con boom y monitor de piso). El brillo es un shader propio (borde fresnel,
líneas de barrido, parpadeo) más bloom.

## Lo que sigue

- Entrenar un clasificador propio con fotos reales del backline (Twin, JC-120, SVT,
  Nord...) para reconocer referencias exactas en vez de categorías.
- Al reconocer un equipo, marcarlo como contado en la lista de chequeo de Cordillera.

## Renovar `vendor/`

`vendor/three.js` es un bundle de three 0.170 con OrbitControls, EffectComposer,
RenderPass, UnrealBloomPass, OutputPass y RoundedBoxGeometry (esbuild).
`vendor/tf.min.js` es `@tensorflow/tfjs` 4.22 y `vendor/imagenet.js` los nombres de
las clases sacados de `@tensorflow-models/mobilenet`.
