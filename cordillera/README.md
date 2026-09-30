# Backline ESC 2 — Cordillera 2026

Lista de chequeo del backline del **Escenario 2 (Aval Aconcagua)** del festival
Cordillera 2026, Parque Simón Bolívar, Bogotá.

El entregable es una página web, `backline-esc2.html`, más la carpeta `lector/`
que usa la pestaña **Subir documento**. Hay que servir la carpeta completa
(por ejemplo `npx serve cordillera` o `python3 -m http.server` dentro de
`cordillera/`); abrir el HTML suelto desde el disco no deja cargar el lector.

## Qué contiene la página

| Pestaña | Para qué sirve |
|---|---|
| Día 1 · Sáb | Lista de equipos de las 5 bandas del sábado, con cantidad esperada y contada |
| Día 2 · Dom | Lo mismo para las 5 bandas del domingo |
| Bandas | Las 10 bandas de los dos días en bloques colapsables, cerrados por defecto |
| Shows | Cartel del sábado 12, columna de Aconcagua resaltada |
| Pruebas | Load in, soundcheck, linecheck y cambios del viernes 11, sábado 12 y domingo 13 |
| Stage plots | Los 8 planos de escenario extraídos del desglose |
| Σ Totales | Cada referencia con lo que pide cada día y lo que hay que tener |
| ＋ Subir documento | Sueltas el rider (PDF, foto, correo, texto) o el desglose `.xlsx`; se lee en el dispositivo y eliges qué entra a la lista y a qué banda |

Funciona en celular, guarda lo verificado en el dispositivo y lo sincroniza
entre dispositivos de la misma cuenta.

### Cómo se cuentan los totales

Dentro de un mismo día las cantidades se **suman**, porque las bandas montan en
paralelo. Entre los dos días se toma el **máximo**, porque es el mismo equipo
que se desmonta el sábado y se vuelve a montar el domingo. La columna se llama
"A tener" por eso.

### Referencias equivalentes

La hoja escribe la misma cosa de varias formas. La página las agrupa con una
tabla de equivalencias, por ejemplo:

- `base de redoblante` = `snare stand`
- `base de platillo tipo boom` = `boom cymbal stand`
- `silla de batería` = `drum throne`
- `tapete de batería` = `drum carpet`
- `mesa tipo mago` = `magician percussion table`
- `guitarrero` = `guitar boat`
- `bar stool` = `music stool`
- `cencerro` = `cowbell`

## Origen de los datos

- **Equipos**: 7 fotos de la hoja impresa "ESC 2" (Día 1 y Día 2), 337 ítems.
  Cada cantidad es la impresa en la misma línea de su descripción.
- **Cartel de shows**: foto del cartel del sábado 12.
- **Pruebas**: 3 fotos de las hojas de producción del viernes, sábado y domingo.
- **Stage plots**: hojas `Stage Plots Day 1` y `Stage Plots Day 2` del archivo
  `Cordillera_2026_DESGLO_FINAL.xlsx`. Los planos originales están en
  `stage-plots/` y van embebidos en el HTML como data URI.

## Pendiente

Todo esto depende de material que aún no está transcrito:

1. **Cartel de shows del domingo.** Tan Biónica, Mago de Oz, Kany García y
   Panteón Rococó no tienen hora de show, solo pruebas.
2. **Mitad de abajo de las hojas de producción** del sábado y domingo: las dos
   fotos se cortan a las 16:45.
3. **Stage plots de Tan Biónica y Panteón Rococó**: no vienen en el desglose.
4. **8 cantidades por confirmar** contra el papel, marcadas en la página con
   "confirmar cantidad":
   - Nelda Piña: music stool = 2
   - Ed Maverick: cuerdas = 1
   - Cultura Profética: snare stand = 3, drum throne = 3
   - Sean Paul: speakers cables = 3, Korg Triton Extreme 88 = 1, consola Behringer 2442 = 1
   - Estrambóticos: amp Roland Jazz Chorus = 2
5. **Cuatro anotaciones a mano sin resolver**:
   - Grupo Niche, snare 14" x 6.5": nota a mano ilegible.
   - Panteón Rococó, mesa LP 760A: dice 4 impreso con un 2 a mano encima.
   - Estrambóticos: un 5 suelto junto al encabezado PERCUSSION.
   - Sean Paul, DJ set: el encabezado dice OML/CN/DIEGO REYES pero las filas dicen Fabián Romero.

## Convenciones de la hoja

- `CN` = equipo propio.
- `OML`, `BACKLINE COP` y nombres propios (Manuel Martín, Diego Reyes, Fabián
  Romero, La Piña) = equipo de terceros.
- La marca `✓ hoja` en la página significa que ese ítem ya tenía chulo a mano
  en el papel.

## Subir documento

La pestaña **＋ Subir documento** lee un rider o el desglose de producción
con el lector de la rama `lector`, empaquetado en `lector/lector.js` (con
pdfjs, Tesseract para OCR y exceljs adentro) y `lector/ocr/` (motor e idiomas,
17 MB). Todo corre en el dispositivo, sin internet ni servicios pagos.

1. Sueltas el archivo (o tomas una foto, o pegas el texto). Si es de una
   sola banda puedes decir cuál y de qué día; si es el desglose, el lector
   reconoce las bandas y los días solo.
2. Aparece una tarjeta por banda con lo leído: cantidad editable, grupo,
   quién lo pone ("trae la banda" cuando el rider lo dice) y lo dudoso en
   ámbar con su nota (alternativas que no suman, frases del rider, lecturas
   del OCR). Lo que el lector no entendió queda en "avisos".
3. Eliges la banda de destino (o "nueva banda") y agregas. Lo que ya estaba
   con la misma descripción no se repite. Lo agregado queda en el
   dispositivo (`state.extra`), se sincroniza con los demás dispositivos
   igual que lo verificado, entra en los totales y se puede quitar desde la
   misma pestaña.

Para regenerar `lector/` después de cambiar el lector: en la rama `extractor`,
`cd extractor && npm run build:cordillera`.
