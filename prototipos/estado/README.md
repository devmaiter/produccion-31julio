# Prototipo: del Excel al estado

`prototipo-estado.html` es una página de muestra que enseña cómo un dato del
Excel se vuelve un **estado reactivo**: el mismo patrón que se usaría en todo
el festival.

Usa las hojas `ST4-D1` y `ST4-D2` de `EQUIPO_CORDILLERAS_OML.xlsx` (backline
de Stage 4, 10 artistas, 598 ítems).

## Cómo está armado

1. **La hoja.** Las celdas van embebidas tal cual (con sus celdas combinadas).
   Un solo lector (`parseWorkbook`) recorre cada bloque de 4 columnas
   `Cant · Requerimiento · Cant · Propuesta` y saca artistas, secciones e
   ítems. Cada ítem recuerda su celda de origen (`ST4-D1!B20`).
2. **El estado.** Un store mínimo (`get / set / subscribe`) guarda los datos,
   los filtros y el ítem seleccionado. Lo demás (qué se ve, los contadores de
   cada chip) se calcula a partir de él y no se guarda.
3. **Las vistas.** Filtros, lista por artista, hoja resaltada y el panel del
   estado se suscriben al store. Los clics solo llaman acciones que cambian el
   estado; nunca tocan la pantalla directamente.

Qué se puede probar:

- Clic en un ítem de la lista: se resalta su celda en la hoja.
- Clic en una celda de la hoja: se selecciona el ítem y se abre su artista.
- Clic en el nombre de un artista en la hoja o en una categoría dentro de un
  artista: se agrega al filtro.
- Filtro avanzado: texto, día, artista, tipo de equipo, columna
  (Requerimiento / Propuesta), categoría en estrellas y "propuesta corta".
- Los filtros quedan en la URL, así que un enlace filtrado se puede compartir.
- **Cargar otro Excel…** lee un `.xlsx` en el navegador (SheetJS desde cdnjs)
  y reemplaza solo los datos del estado. Con el mismo archivo da exactamente
  los mismos 598 ítems.

"Propuesta corta" compara **unidades** pedidas contra propuestas por artista y
tipo de equipo, no ítem por ítem. Hardware y platillos cuentan como batería
porque el requerimiento suele meter los stands bajo BATERÍA y la propuesta los
separa.

## Perfiles: Admin y Operario

Arriba hay un selector **Admin / Operario**. Es un solo estado central; el
perfil solo cambia qué versión del Excel se ve y qué botones aparecen.

- **Admin** carga el Excel. Queda como **borrador**: solo el admin lo ve, con
  un resumen de lo que cambia frente a lo publicado (ítems nuevos, cambiados,
  quitados, artistas que entran o salen). Luego **Publicar para operarios** o
  **Descartar**.
- **Operario** ve solo el Excel publicado. Cuando el admin publica, le llega en
  vivo un aviso, los ítems nuevos o cambiados llevan una marca, y el filtro
  **Solo lo que cambió en el último Excel** los aísla. No puede cargar Excel;
  sí filtra y sube fotos.

En la página publicada, el Excel vive en un documento de su base de datos
(`config/excel`) al que todos están suscritos. La regla de acceso de `config`
solo deja escribir a quien puede editar la página, así que un operario real no
puede publicar aunque cambie el selector a Admin. Abierto como archivo local,
publicar funciona en memoria: cambia a Operario para ver lo que le llega.

## Fotos por equipo

Al seleccionar un ítem aparece **+ Agregar foto**. En el celular abre la cámara
o la galería. La foto se reduce a 1600 px antes de subirla.

- En la página publicada, la imagen va al almacén de archivos del artifact y
  una fila en la colección `fotos` de su base de datos la une a su celda
  (`item: "ST4-D1!B20"`, `asset`, `by`, `at`). Todos los que abren la página
  ven las mismas fotos, en vivo.
- Abierto como archivo local, las fotos se quedan en memoria y se pierden al
  recargar. La página lo avisa junto al filtro.
- El filtro **Fotos** (Todas / Con foto / Sin foto) sirve para ver qué equipo
  falta por fotografiar. Cada artista dice cuántos ítems tienen foto, y en la
  hoja las celdas con foto llevan una esquina verde.
- Borrar una foto pide confirmar en la misma página. Solo puede borrarla quien
  la subió o el perfil Admin.

Las fotos se amarran a la celda. Si se carga otro Excel con otras filas, una
foto puede quedar apuntando a otra celda.

No incluye la hoja `EQUIPO SOLICITADO` (inventario con valores).
