/* ── Respaldo (lo pidió el usuario: "no perder los estados"): un archivo con todo lo de la app en este celular:
   documentos, chulos, fotos (las imágenes también), cronograma. Se comparte por WhatsApp/Drive o se descarga. ── */
const blobADataURL = b => new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(b); });
/* Sumar un estado guardado al de ahora sin perder nada: los chulos, los "no hace falta" y la papelera se
   unen; las fotos de cada pieza o banda se unen; lo que no estaba se agrega; un documento abierto se queda. */
function sumarEstado(otro){
  const unir = (a, b) => [...new Map([...a, ...b].map(x => [JSON.stringify(x), x])).values()];
  for (const [k, v] of Object.entries(otro)) {
    const actual = Almacen.crudo(k);
    try {
      if (actual === null) { Almacen.ponerCrudo(k, v); continue; }
      const A = JSON.parse(actual), B = JSON.parse(v);
      if (Array.isArray(A) && Array.isArray(B)) { Almacen.ponerCrudo(k, JSON.stringify(unir(A, B))); continue; }
      if (k === P + "tablero" && A && B) {
        const fotos = {...(B.fotos || {})};
        for (const [c, fs] of Object.entries(A.fotos || {})) fotos[c] = unir(fotos[c] || [], fs);
        Almacen.ponerCrudo(k, JSON.stringify({...B, ...A, pruebas: A.pruebas || B.pruebas, evento: A.evento || B.evento, fotos}));
      }
      // Cualquier otro valor que ya existe se deja como está (lo de ahora manda).
    } catch {}
  }
}
/* Copia interna automática (en este celular): una al día y antes de cualquier cosa que reemplace algo
   (borrar el documento, subir otro, cargar un respaldo). Se guardan las 5 últimas. */
async function instantanea(motivo){
  try {
    const ls = {};
    for (const k of Almacen.claves()) if (PREFIJOS.test(k)) ls[k] = Almacen.crudo(k);
    const clave = "instantanea-" + new Date().toISOString();
    await idb("readwrite", st => st.put(new Blob([JSON.stringify({motivo, ls})], {type: "application/json"}), clave));
    const todas = (await idb("readonly", st => st.getAllKeys())).filter(k => String(k).startsWith("instantanea-")).sort();
    for (const k of todas.slice(0, -5)) await idb("readwrite", st => st.delete(k));
  } catch {}
}
async function instantaneas(){
  try { return (await idb("readonly", st => st.getAllKeys())).filter(k => String(k).startsWith("instantanea-")).sort().reverse(); } catch { return []; }
}
{
  const hoy = new Date().toISOString().slice(0, 10);
  if (leer(P + "instantanea-dia", "") !== hoy) { escribir(P + "instantanea-dia", hoy); setTimeout(() => instantanea("la del día"), 4000); }
}
async function elegirInstantanea(){
  const ks = await instantaneas();
  const motivos = {};
  for (const k of ks) { try { motivos[k] = JSON.parse(await (await idb("readonly", st => st.get(k))).text()).motivo || ""; } catch {} }
  const hora = k => new Date(k.replace("instantanea-", "")).toLocaleString("es-CO", {day: "numeric", month: "short", hour: "numeric", minute: "2-digit"});
  const panel = $b("panel-filtros");
  panel.innerHTML = `<h4>Copias internas</h4>
    <p class="nota">La app guarda sola una copia al día y antes de borrar o reemplazar algo. Al volver a una, se <b>suma</b> a lo de ahora: no se pierde ningún chulo ni foto.</p>
    ${ks.length ? ks.map(k => `<div class="botones"><button class="btn sec" data-instantanea="${esc(k)}" style="text-transform:none;text-align:left">${esc(hora(k))}<small style="display:block;font:400 13px/1.2 'IBM Plex Sans',sans-serif;opacity:.75">${esc(motivos[k] || "")}</small></button></div>`).join("") : `<p class="nota">Todavía no hay copias internas.</p>`}
    <div class="botones"><button class="btn" data-cerrar>Cerrar</button></div>`;
}
$b("filtros").addEventListener("click", async e => {
  const k = e.target.closest("[data-instantanea]")?.dataset.instantanea; if (!k) return;
  e.stopImmediatePropagation();
  try {
    const blob = await idb("readonly", st => st.get(k)); const r = JSON.parse(await blob.text());
    await instantanea("antes de volver a una copia");
    sumarEstado(r.ls || {});
    aviso("Copia sumada. Volviendo a abrir…"); setTimeout(() => location.replace(location.pathname), 800);
  } catch { aviso("No se pudo abrir esa copia"); }
}, true);
/* Una copia con otra marca (Backstage) guarda aparte, pero lo que se hizo antes en la app de Circuito no se
   puede quedar atrás (el 2026-10-08 en la noche el link de Backstage todavía guardaba en el espacio de Circuito):
   se COPIA de allá para acá lo de las piezas (fotos, chulos, avisos descartados). Allá no se borra nada.
   Las claves de Circuito vienen de ENTORNO.circuito. */
const CLAVE_CIRCUITO = ENTORNO.circuito.app + ":", FOTOS_CIRCUITO = ENTORNO.circuito.fotos;
async function traerDeCircuito(){
  if (!MARCA) return 0;
  const unir = (a, b) => [...new Set([...(a || []), ...(b || [])])];
  let fotos = 0;
  // Chulos, chulos viejos y "no hace falta": se unen con los de aquí.
  for (const k of Almacen.claves()) {
    if (!k.startsWith(CLAVE_CIRCUITO)) continue;
    const resto = k.slice(CLAVE_CIRCUITO.length);
    if (!/^(chulos2?:|no-falta:)/.test(resto)) continue;
    try { escribir(P + resto, unir(leer(P + resto, []), JSON.parse(Almacen.crudo(k)))); } catch {}
  }
  // Fotos de las piezas: la imagen se copia a la base de aquí y se agrega a la pieza.
  let deAlla = {};
  try { deAlla = JSON.parse(Almacen.crudo(CLAVE_CIRCUITO + "tablero") || "{}").fotos || {}; } catch {}
  const pendientes = Object.entries(deAlla).filter(([k]) => k.startsWith("pieza|"));
  if (pendientes.length) {
    const deCircuito = Almacen.archivos(FOTOS_CIRCUITO);
    for (const [clave, ids] of pendientes) {
      for (const id of ids) {
        if ((V?.fotos?.[clave] || []).includes(id)) continue;
        const blob = await deCircuito("readonly", st => st.get(id)).catch(() => null) || null;
        if (!blob) continue;
        try { await idb("readwrite", st => st.put(blob, id)); } catch { continue; }
        enviar({tipo: "foto", banda: clave, foto: id});
        fotos++;
      }
    }
  }
  escribir(P + "importado-circuito", new Date().toISOString());
  cargarChulos(); pintar(actual?.id);
  return fotos;
}
/* El evento de hoy (hoy/evento.json, se lee sin caché): si la app abre con otro documento (un acceso guardado a
   lab-reels/, o el celular guardó el link viejo), abre el de hoy si lo anterior vino de un link del sitio; si lo
   subió el usuario, arriba sale «Evento de hoy · Abrir» («×» lo esconde para ese evento). Nada se borra. */
async function avisarEventoNuevo(){
  if (MARCA) return;
  let e; try { const r = await fetch(ENTORNO.rutas.hoy + "evento.json?t=" + Date.now(), {cache: "no-store"}); if (!r.ok) return; e = await r.json(); } catch { return; }
  if (!Array.isArray(e?.listas) || !e.listas.length || !/^[\w.-]{1,60}$/.test(e.doc || "")) return;
  if (!e.listas.every(r => /^listas\/[\w.-]+\.(txt|pdf|xlsx|csv)$/.test(r))) return;
  if (V?.doc?.nombre === e.doc) return;
  // Si lo abierto vino de un link del sitio (un evento anterior, otra lista) o no hay nada abierto, la app abre el de
  // hoy sola (el usuario abría la app y le salía el evento anterior). Lo anterior no se borra: queda en su link
  // (hoy/22-oct/…) con sus chulos, fotos y notas. Lo que el usuario subió a mano no se cambia: solo sale el aviso.
  const delSitio = !V?.doc || leer(P + "docs-de-lista", []).includes(V.doc.nombre) || /^(salida|listado)-\d{4}-\d{2}-\d{2}$|^(don-teto|lista-a-mano)$/.test(V.doc.nombre);
  const ir = `?lista=${e.listas.map(encodeURIComponent).join(",")}&doc=${encodeURIComponent(e.doc)}`;
  if (delSitio) { location.replace(ir); return; }
  if (leer(P + "evento-visto", "") === e.doc) return;
  document.getElementById("evento-nuevo")?.remove();
  const el = Object.assign(document.createElement("div"), {id: "evento-nuevo", className: "evento-nuevo"});
  el.innerHTML = `<span>📅 Evento de hoy: <b>${esc(e.titulo || e.doc)}</b></span><a href="${ir}">Abrir</a><button aria-label="Cerrar">×</button>`;
  el.querySelector("button").addEventListener("click", () => { escribir(P + "evento-visto", e.doc); el.remove(); });
  document.body.append(el);
}
/* Aviso de cambios sin respaldo: cada chulo, foto o pieza agregada suma uno; al guardar el respaldo vuelve a 0. */
function huboCambio(){ escribir(P + "cambios", leer(P + "cambios", 0) + 1); pintarPendiente(); }
function pintarPendiente(){
  let el = document.getElementById("pendiente");
  const n = leer(P + "cambios", 0);
  // Nunca se ha guardado un respaldo y ya hay chulos o fotos: también se avisa.
  const hayDatos = Almacen.claves().some(k => k.startsWith(P + "chulos") && (Almacen.crudo(k) || "[]") !== "[]") || Object.keys(V?.fotos || {}).length > 0;
  const primero = !n && !leer(P + "ultimo-respaldo", "") && hayDatos;
  if (!n && !primero) { el?.remove(); return; }
  if (!el) { el = Object.assign(document.createElement("button"), {id: "pendiente", className: "pendiente"}); el.addEventListener("click", guardarRespaldo); document.body.append(el); }
  el.textContent = primero ? "💾 Guarda tu primer respaldo" : `💾 ${n} ${n === 1 ? "cambio" : "cambios"} sin respaldo · Guardar`;
}
async function guardarRespaldo(){
  aviso("Armando el respaldo…");
  const ls = {};
  for (const k of Almacen.claves()) if (PREFIJOS.test(k)) ls[k] = Almacen.crudo(k);
  const fotos = {};
  try {
    for (const [k, v] of await Almacen.listarArchivos(ENTORNO.bases.fotos)) if (!String(k).startsWith("instantanea-")) fotos[k] = await blobADataURL(v);
  } catch {}
  const hoy = new Date(), f = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}-${String(hoy.getHours()).padStart(2, "0")}${String(hoy.getMinutes()).padStart(2, "0")}`;
  const archivo = new File([JSON.stringify({formato: "respaldo-lab-reels/1", cuando: hoy.toISOString(), localStorage: ls, fotos})], `respaldo-reels-${f}.json`, {type: "application/json"});
  const n = Object.keys(fotos).length;
  const listo = () => { escribir(P + "cambios", 0); escribir(P + "ultimo-respaldo", new Date().toISOString()); pintarPendiente(); };
  try {
    if (navigator.canShare?.({files: [archivo]})) { await navigator.share({files: [archivo], title: "Respaldo de los reels"}); listo(); return aviso(`Respaldo listo: ${n} ${n === 1 ? "foto" : "fotos"} y los chulos`); }
  } catch (err) { if (err?.name === "AbortError") return; }
  listo();
  const a = Object.assign(document.createElement("a"), {href: URL.createObjectURL(archivo), download: archivo.name});
  document.body.append(a); a.click(); a.remove();
  aviso(`Respaldo descargado: ${n} ${n === 1 ? "foto" : "fotos"} y los chulos`);
}
$b("respaldo-archivo").addEventListener("change", async e => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  let r; try { r = JSON.parse(await f.text()); } catch { return aviso("Ese archivo no es un respaldo"); }
  if (r?.formato !== "respaldo-lab-reels/1") return aviso("Ese archivo no es un respaldo de los reels");
  // Las fotos se suman (no se borra ninguna); lo guardado en el celular se reemplaza por lo del respaldo.
  for (const [k, url] of Object.entries(r.fotos || {})) {
    try { const blob = await (await fetch(url)).blob(); await idb("readwrite", st => st.put(blob, k)); } catch {}
  }
  await instantanea("antes de cargar un respaldo");
  sumarEstado(r.localStorage || {});
  escribir(P + "cambios", 0); escribir(P + "ultimo-respaldo", new Date().toISOString());
  aviso("Respaldo cargado (sumado a lo que había). Volviendo a abrir…");
  setTimeout(() => location.replace(location.pathname), 800);
});
// Que el navegador no borre los datos de la app (fotos y chulos) cuando le falte espacio.
navigator.storage?.persist?.().catch(() => {});

function verFoto(img){
  const v = $b("visor"), b = v.querySelector(".borrar-foto");
  if (!img.src) return;
  v.querySelector("img").src = img.src;
  b.hidden = img.dataset.foto.startsWith("url:"); b.textContent = "Borrar esta foto"; delete b.dataset.seguro;
  b.dataset.foto = img.dataset.foto; b.dataset.banda = img.dataset.banda;
  v.hidden = false;
}
