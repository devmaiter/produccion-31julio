/* ── Al abrir: el logo de Circuito Naranja con glitch, siempre, como TikTok. La mano que enseña cada gesto sale una sola vez. ── */
const vistos = new Set(leer(P + "guias", []));
if (location.hash === "#intro") vistos.clear();
function guia(clave, tipo, texto, sub){
  if (vistos.has(clave) || document.querySelector(".guia")) return;
  vistos.add(clave); escribir(P + "guias", [...vistos]);
  const dedo = tipo === "toque-g" ? "👆" : "☝️";
  const g = document.createElement("div"); g.className = "guia " + tipo; g.setAttribute("role", "dialog");
  g.innerHTML = `<div class="mano" aria-hidden="true"><span class="estela"></span><span class="dedo">${dedo}</span></div><p>${texto}</p><small>${sub}</small>`;
  const cerrar = () => { g.remove(); feed.removeEventListener("scroll", cerrar); };
  g.addEventListener("click", cerrar); feed.addEventListener("scroll", cerrar, {once: true, passive: true});
  document.body.append(g);
}
function guiaAlLlegar(r){
  if (document.querySelector(".splash:not(.fuera)")) return;
  if (r.id === "subir") entradas.length && guia("arriba", "arriba-g", PC ? (festival() ? "Baja para ver cada categoría" : "Baja para ver cada banda") : "Desliza hacia arriba", PC ? "Con la rueda del mouse, ↓ o los botones de la derecha" : festival() ? "Cada pantalla es una categoría: Batería, Platillos, Bases…" : "Cada pantalla es una banda, con su backline como viene en el rider");
  else if (!vistos.has("lado")) setTimeout(() => actual === r && guia("lado", "lado-g", PC ? "Pasa con ›" : "Desliza a la izquierda", festival() ? "Ahí está lo que hay que tener y cada banda con su plano" : "Ahí está cada sección en detalle, las fotos y lo que pidió la banda"), 1400);
}
/* La presentación (lo pidió el usuario, para mostrársela a Don John de Backstage Company): el equipo
   llegando a la bodega con las fotos de verdad, cada pieza se marca con el chulo, y al final Backstage
   Company. Se salta tocando «Saltar». El logo va en marca/backstage.png; si no está, el nombre en letras. */
const ESCENAS_BODEGA = [
  {foto: "listas/fotos/antena-helicoidal.jpg", pieza: "Antena helicoidal", nota: "In ears · Jon"},
  {foto: "listas/fotos/in-ears-maleta-2.jpg", pieza: "12 Shure PSM 1000", nota: "In ears · Jon"},
  {foto: "listas/fotos/hardware-1.jpg", pieza: "Hardware DW completo", nota: "Batería · 5 bases"},
  {foto: "listas/fotos/hardware-3.jpg", pieza: "Pedales y stands", nota: "Batería"},
];
for (const e of ESCENAS_BODEGA) { const i = new Image(); i.src = e.foto; }
// La hoja a mano no dice banda: se muestra como "Lista de bodega" (solo el nombre; las claves de chulos y fotos no cambian).
const nombreVisible = n => n === "Banda sin nombre" && V?.doc?.nombre === "lista-a-mano" ? "Lista de bodega" : n;
function presentacion(){
  return new Promise(ok => {
    const hoy = new Date().toLocaleDateString("es", {weekday: "long", day: "numeric", month: "long"});
    const p = document.createElement("div"); p.className = "presenta";
    p.innerHTML = `
      <div class="pr-titulo"><small>Backline en reels</small><b>Así llega el equipo a la bodega</b></div>
      ${ESCENAS_BODEGA.map((e, i) => `<figure class="pr-foto" style="--i:${i}"><img src="${e.foto}" alt=""><figcaption><span class="pr-ok">✓</span><b>${esc(e.pieza)}</b><small>${esc(e.nota)}</small></figcaption></figure>`).join("")}
      <div class="pr-final">
        <img class="pr-logo" src="marca/backstage.png" alt="Backstage Company" onerror="this.remove()">
        <div class="pr-nombre"><b>BACKSTAGE</b><span>COMPANY</span></div>
        <p>Revisado en bodega · ${esc(hoy)}</p>
        <small>${MARCA ? "Backline en reels" : "con Circuito Naranja · Backline en reels"}</small>
      </div>
      <button class="pr-saltar">Saltar</button>`;
    document.body.append(p);
    let listo = false;
    const fin = () => { if (listo) return; listo = true; p.classList.add("fuera"); ok(); setTimeout(() => p.remove(), 700); };
    p.querySelector(".pr-saltar").addEventListener("click", fin);
    if (QUIETO) { p.classList.add("quieto"); setTimeout(fin, 2500); return; }
    // 1,6 s el título, 1,9 s cada foto, 2,8 s el final.
    const pasos = [1600, ...ESCENAS_BODEGA.map(() => 1900), 2800];
    let t = 0;
    pasos.forEach((d, i) => { setTimeout(() => { if (!listo) p.dataset.paso = String(i + 1); }, t); t += d; });
    setTimeout(fin, t);
    p.dataset.paso = "0";
    p.addEventListener("click", e => { if (e.target.closest(".pr-final") && p.dataset.paso === String(pasos.length)) fin(); });
  });
}
// Después de la presentación: a la portada de la banda (la lista ya está leída o se está leyendo).
function irALaBanda(){
  const intento = (n) => { if (V?.doc && reels[1]) { introHecha = true; reels[1].scrollIntoView(); } else if (n > 0) setTimeout(() => intento(n - 1), 400); };
  intento(25);
}
function splash(){
  return new Promise(ok => {
    const s = document.createElement("div"); s.className = "splash";
    const xlr = `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="43" fill="none" stroke="currentColor" stroke-width="8"/><rect x="44" y="3" width="12" height="9" rx="2" fill="currentColor"/><circle cx="31" cy="46" r="8" fill="currentColor"/><circle cx="69" cy="46" r="8" fill="currentColor"/><circle cx="50" cy="69" r="8" fill="currentColor"/></svg>`;
    const capa = c => `<div class="capa ${c}"${c ? ' aria-hidden="true"' : ""}><div class="marca">circuit${xlr}</div><div class="naranja">Naranja</div></div>`;
    const tarjeta = c => `<div class="tarjeta-marca ${c}"${c ? ' aria-hidden="true"' : ""}><img src="${MARCA?.logo}" alt=""></div>`;
    s.innerHTML = MARCA
      ? `<div class="logo logo-marca" role="img" aria-label="${esc(MARCA.nombre)}">${tarjeta("")}${QUIETO ? "" : tarjeta("cian") + tarjeta("nar")}<small>BACKLINE EN REELS</small></div>`
      : `<div class="logo" role="img" aria-label="Circuito Naranja">${capa("")}${QUIETO ? "" : capa("cian") + capa("nar")}<small>BACKLINE EN REELS</small></div>`;
    document.body.append(s);
    setTimeout(() => { s.classList.add("fuera"); ok(); setTimeout(() => s.remove(), 500); }, QUIETO ? 600 : 1600);
  });
}

/* Abierto desde el cronograma (?rider=…&evento=…): el rider que el admin subió allá queda guardado en
   este dispositivo (IndexedDB "backline-riders") y se lee aquí como cualquier documento. */
async function riderDelCronograma(){
  const q = new URLSearchParams(location.search), id = q.get("rider");
  // ?lista=listas/….txt: una lista guardada en el sitio (la hoja escrita a mano, ya pasada a texto). Varias listas
  // separadas por coma son un solo documento con una banda por lista (la hoja de salida de un evento con dos bandas);
  // &doc=nombre le da al documento un nombre fijo, para que chulos, fotos y notas no cambien de clave.
  const rutas = (q.get("lista") || "").split(",").map(r => r.trim()).filter(Boolean);
  // &pestana=bandas: el link abre directo en 🎤 Bandas (o en 📦 Alistando).
  if (/^(alistando|bandas)$/.test(q.get("pestana") || "")) escribir(P + "pestana", q.get("pestana"));
  if (rutas.length && rutas.every(r => /^listas\/[\w.-]+\.(txt|pdf|xlsx|csv)$/.test(r))) {
    const doc = /^[\w.-]{1,60}$/.test(q.get("doc") || "") ? q.get("doc") : null;
    // Los documentos que vienen de un link del sitio: al abrir la app sin link, se cambian solos por el de hoy.
    if (doc) escribir(P + "docs-de-lista", [...new Set([...leer(P + "docs-de-lista", []), doc])].slice(-30));
    history.replaceState(null, "", location.pathname);
    try {
      const archivos = await Promise.all(rutas.map(async ruta => {
        const r = await fetch(ruta, {cache: "no-store"}); if (!r.ok) throw 0;
        const blob = await r.blob();
        // Una lista «tal cual» es la hoja del usuario como está: no se le avisa nada («⚠ 1» se leía como «falta una batería»).
        if (doc && /^\s*#\s*tal\s+cual/i.test(await blob.slice(0, 40).text())) escribir(P + "tal-cual", [...new Set([...leer(P + "tal-cual", []), doc])].slice(-30));
        return new File([blob], ruta.split("/").pop(), {type: r.headers.get("content-type") || "text/plain"});
      }));
      return subirArchivos(archivos, "cargar", doc);
    } catch { return aviso("No encontré esa lista"); }
  }
  if (q.get("evento")) escribir(P + "evento", q.get("evento"));
  if (!id) return;
  history.replaceState(null, "", location.pathname);
  const guardado = await riders("readonly", st => st.get(id)).catch(() => null);
  if (!guardado) return aviso("No encontré ese rider en este dispositivo");
  subirArchivos([new File([guardado.blob], guardado.nombre, {type: guardado.tipo})], "cargar-evento");
}

/* El evento de hoy en el cronograma: si ya tiene riders, se cargan todos como el backline del evento
   (para cualquier perfil) y se entra directo a los reels, sin la entrada. Si ya estaban cargados, no
   se vuelven a leer. */
async function eventoDeHoy(){
  const hoy = new Date(), iso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
  const ev = leer(ENTORNO.claves.cronograma + ":eventos", []).find(e => e.desde <= iso && iso <= e.hasta);
  if (!ev) return false;
  const idsRiders = ev.escenarios.flatMap(e => e.bandas).map(b => b.rider?.archivoId).filter(Boolean);
  if (!idsRiders.length) return false;
  escribir(P + "evento", ev.nombre);
  const clave = ev.id + ":" + idsRiders.join(",");
  if (leer(P + "evento-cargado", "") === clave && V.hay?.evento) return true;
  const archivos = (await Promise.all(idsRiders.map(id => riders("readonly", st => st.get(id)).catch(() => null))))
    .filter(Boolean).map(g => new File([g.blob], g.nombre, {type: g.tipo}));
  if (!archivos.length) return false;
  escribir(P + "evento-cargado", clave);
  introHecha = true;
  await subirArchivos(archivos, "cargar-evento");
  return true;
}

/* Con un rider ya cargado no hace falta la entrada: saludo corto y directo a los reels. */
function directoALosReels(){
  if (!V?.doc || !reels[1]) return;
  introHecha = true;
  const el = document.querySelector("#subir .intro"); if (el) el.dataset.fase = "3";
  reels[1].scrollIntoView();
  const h = new Date().getHours(), ev = leer(P + "evento", "");
  aviso(`${h < 12 ? "Buen día" : h < 19 ? "Buenas tardes" : "Buenas noches"}, equipo${ev && V.espacio === "evento" ? ` · Hoy toca ${ev}` : ""}`);
}

// Las pestañas de arriba: Alistando / Bandas.
$b("pestanas").addEventListener("click", e => { const b = e.target.closest("[data-pestana]"); if (b) cambiarPestana(b.dataset.pestana); });

/* Notas: lo que se escribe se guarda solo; la foto de una nota queda en el celular. */
feed.addEventListener("input", e => {
  const t = e.target.closest("[data-nota-texto]"); if (!t) return;
  const sec = t.dataset.notaTexto; escribir(claveBorrador(sec), {...leer(claveBorrador(sec), {}), texto: t.value});
});
$b("nota-foto").addEventListener("change", async e => {
  const f = e.target.files[0]; e.target.value = ""; const sec = notaFotoDe; notaFotoDe = null; if (!f || !sec) return;
  const blob = await achicar(f), k = "nota-foto-" + Date.now().toString(36);
  try { await idb("readwrite", st => st.put(blob, k)); } catch { return aviso("No se pudo guardar la foto"); }
  escribir(claveBorrador(sec), {...leer(claveBorrador(sec), {}), foto: k});
  aviso("Foto lista: toca «Guardar nota»"); repintarQuieto();
});
