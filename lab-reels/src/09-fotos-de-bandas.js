/* ── Fotos de las bandas: la imagen queda en este dispositivo (IndexedDB) y el núcleo guarda de qué banda es. ── */
const idb = Almacen.archivos(ENTORNO.bases.fotos);
// Los riders que el cronograma guardó en este dispositivo.
const riders = Almacen.archivos(ENTORNO.bases.riders, "archivos");
const urlsFotos = new Map();
async function cargarFotos(raiz = feed){
  for (const img of raiz.querySelectorAll("img[data-foto]")) {
    const id = img.dataset.foto;
    if (id.startsWith("url:")) { img.src = id.slice(4); img.loading = "lazy"; continue; }
    if (!urlsFotos.has(id)) {
      const blob = await idb("readonly", st => st.get(id)).catch(() => null);
      if (blob) urlsFotos.set(id, URL.createObjectURL(blob));
    }
    if (urlsFotos.has(id)) img.src = urlsFotos.get(id); else img.alt = "Foto no está en este dispositivo";
  }
}
// Una foto del celular pesa varios MB: se achica a 1600 px antes de guardarla.
async function achicar(archivo){
  try {
    const bmp = await createImageBitmap(archivo), k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = Object.assign(document.createElement("canvas"), {width: Math.round(bmp.width * k), height: Math.round(bmp.height * k)});
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise(ok => c.toBlob(b => ok(b || archivo), "image/jpeg", .82));
  } catch { return archivo; }
}
let fotoDe = null;
for (const id of ["foto-camara", "foto-galeria"]) $b(id).addEventListener("change", async e => {
  const archivos = [...e.target.files], banda = fotoDe;
  e.target.value = ""; fotoDe = null;
  if (!banda || !archivos.length) return;
  let n = 0;
  for (const a of archivos) {
    const foto = "f-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
    const blob = await achicar(a);   // antes de abrir la transacción: IndexedDB no espera promesas adentro
    try { await idb("readwrite", st => st.put(blob, foto)); } catch { continue; }
    n++;
    enviar({tipo: "foto", banda, foto});
    huboCambio();
  }
  aviso(n ? (n === 1 ? "Foto guardada" : `${n} fotos guardadas`) : "No se pudo guardar la foto en este dispositivo");
  refrescarDetalle();
});
