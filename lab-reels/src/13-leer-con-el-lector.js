/* ── Leer con el lector (el mismo de la lista de Cordillera) ── */
let lectorCargando = null;
function cargarLector(){
  if (window.LectorBackline) return Promise.resolve(window.LectorBackline);
  return lectorCargando ??= new Promise((ok, mal) => {
    const sc = document.createElement("script"); sc.src = LECTOR + "lector.js?v=2026-10-24";   // con versión: el celular no se queda con un lector viejo guardado
    sc.onload = () => window.LectorBackline ? ok(window.LectorBackline) : mal(new Error("El lector no cargó."));
    sc.onerror = () => { lectorCargando = null; mal(new Error("No pude cargar el lector. Revisa la conexión y vuelve a intentar.")); };
    document.head.append(sc);
  });
}

function fallo(titulo, texto, avisos){
  subida.estado = "error"; subida.error = {titulo, texto, avisos};
  pintarSubir();
  reels[0]?.scrollIntoView();
}

async function subirArchivos(archivos, tipo = "cargar", nombreDoc = null){
  if (!archivos.length) return;
  subida.estado = "leyendo";
  subida.archivos = archivos.map(f => ({nombre: f.name, estado: "en cola", clase: ""}));
  pintarSubir();
  reels[0]?.scrollIntoView();
  const lento = setTimeout(() => { const el = document.getElementById("lento"); if (el) el.textContent = "Sigue leyendo. Un PDF escaneado o una foto puede tardar hasta un minuto en el celular."; }, 12000);
  try { await leerYArmar(archivos, tipo, nombreDoc); }
  catch (err) { fallo("No se pudo leer", (err && err.message) || "Algo falló leyendo el archivo. Prueba otra vez o con otro archivo."); }
  finally { clearTimeout(lento); }
}

async function leerYArmar(archivos, tipo = "cargar", nombreDoc = null){
  if (V?.doc) await instantanea("antes de subir " + archivos.map(f => f.name).join(", "));
  let r;
  const traza = [];   // lo que el lector decidió de cada renglón: sirve para mostrar lo que pidió la banda
  {
    const L = await cargarLector();
    r = await L.leerTodo(archivos, {rutas: {pdfWorker: LECTOR + "pdf.worker.min.mjs", ocr: LECTOR + "ocr/"}, base: null, traza, sinNombre: true,
      alProgreso: (nombre, estado) => {
        const a = subida.archivos.find(x => x.nombre === nombre); if (!a) return;
        a.estado = estado; a.clase = /^error/.test(estado) ? "err" : /ítem/.test(estado) ? "ok" : "";
        const li = [...document.querySelectorAll("#subir .archivos li")].find(li => li.firstElementChild.textContent === nombre);
        if (li) { li.className = a.clase; li.lastElementChild.textContent = estado; }
      }});
  }
  const ext = r.extraccion;
  if (!ext.items.length) {
    const errores = subida.archivos.filter(a => a.clase === "err").map(a => a.nombre + ": " + a.estado);
    return fallo(errores.length ? "No se pudo leer" : "No encontré backline",
      errores.length ? "El lector no pudo abrir el archivo." : "Leí el documento pero no vi una lista de equipos (cantidad y descripción). Si es una foto, que sea nítida y de cerca; si es un PDF escaneado, prueba con una foto de la hoja.",
      [...errores, ...ext.avisos]);
  }
  const d = aDatos(ext, traza);
  const nombre = nombreDoc || (archivos.length === 1 ? archivos[0].name.replace(/\.[^.]+$/, "") : archivos.length + " archivos");
  // Las piezas que se agregaron a mano a este documento no se pierden al volver a leerlo.
  ponerAgregados(d, leer(P + "agregados:" + nombre, []));
  ponerShow(d, await cargarShow(nombre));
  escribir(P + "listos:doc", null);
  const categorias = [...new Set(d.items.map(reelDe))];
  subida.estado = "listo";
  subida.resultado = {items: d.items.length, bandas: new Set(d.items.filter(i => !i.sinBanda).map(i => i.artistaId)).size, cats: categorias.length, dudosos: d.items.filter(i => i.porConfirmar).length, avisos: ext.avisos.length};
  destinoPendiente = "subir";
  enviar({tipo, doc: {nombre, archivos: archivos.map(f => f.name), cuando: new Date().toISOString(), datos: d}});
}

async function probarMuestra(){
  try {
    const b = await (await fetch(MUESTRA)).blob();
    subirArchivos([new File([b], "hoja-backline.pdf", {type: "application/pdf"})]);
  } catch { aviso("No pude abrir el ejemplo"); }
}
