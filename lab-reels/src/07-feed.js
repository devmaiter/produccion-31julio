/* ── Feed ── */
const feed = document.getElementById("feed");
/* Subir y bajar desde cualquier historia (lo pidió el usuario: antes había que volver a la portada de la sección).
   En una historia de lado, al estar arriba del todo (o abajo del todo) y deslizar hacia abajo (o hacia arriba), se
   pasa a la sección anterior (o siguiente), en la misma historia (de la lista a la lista). */
(function(){
  let ini = null;
  feed.addEventListener("touchstart", e => {
    const sl = e.target.closest(".slide.banda");
    if (!sl || e.touches.length !== 1) { ini = null; return; }
    ini = { x: e.touches[0].clientX, y: e.touches[0].clientY, sl,
      arriba: sl.scrollTop <= 2, abajo: sl.scrollTop + sl.clientHeight >= sl.scrollHeight - 2 };
  }, {passive: true});
  feed.addEventListener("touchend", e => {
    const s = ini; ini = null; if (!s) return;
    const t = e.changedTouches[0], dx = t.clientX - s.x, dy = t.clientY - s.y;
    if (Math.abs(dy) < 60 || Math.abs(dy) < Math.abs(dx) * 1.5) return;   // poco o de lado: es cambiar de historia
    const reel = s.sl.closest(".reel"); if (!reel) return;
    const otro = el => { while (el && !(el.classList?.contains("reel") && el.offsetParent !== null)) el = dy < 0 ? el.nextElementSibling : el.previousElementSibling; return el; };
    const destino = dy < 0 && s.abajo ? otro(reel.nextElementSibling) : dy > 0 && s.arriba ? otro(reel.previousElementSibling) : null;
    if (!destino) return;
    // Se llega a la misma historia de la otra sección (de la lista a la lista), no a su portada.
    const de = reel.querySelector(".slides"), a = destino.querySelector(".slides");
    if (de && a) {
      const i = Math.round(de.scrollLeft / Math.max(1, de.clientWidth));
      a.scrollTo({left: Math.min(i, a.children.length - 1) * a.clientWidth, behavior: "instant"});
      const h = a.children[i]; if (h?.classList.contains("banda")) h.scrollTop = 0;
    }
    destino.scrollIntoView({behavior: "smooth"});
  }, {passive: true});
})();
let cats = [], entradas = [], reels = [], actual = null, io = null;

function pintar(destino){
  cargarListos(); cargarChulos();
  holoItems.clear();
  const d = datos();
  if (festival()) {
    cats = armar(d);
    entradas = cats.map(c => ({id: c.id, e: EMOJI[sinNum(c.cat)] || "📦", nombre: c.cat, x: `${c.equipos} ${c.equipos === 1 ? "banda" : "bandas"}`}));
  } else {
    const bs = bandasDePestana(armarBandas(d));
    cats = [];
    // El admin ve primero todo el equipo con su estado (lo pidió el usuario).
    entradas = [...(V?.perfil === "admin" && d.items.length ? [{id: "resumen", e: "📋", nombre: "Todo el equipo", x: `${piezasDe(d.items)} piezas`, html: () => htmlResumen(bs)}] : []), ...bs.flatMap(pantallasBanda)];
  }
  const nada = V?.doc && V.hayFiltro && !V.encontrados;
  feed.innerHTML = htmlSubir() + (nada ? htmlNada()
    : festival() ? cats.map((c,i) => htmlReel(c, i, cats.length)).join("")
    : entradas.map(x => x.html()).join(""));
  feed.setAttribute("aria-label", festival() ? "Backline por categoría" : "Backline por banda");
  cargarFotos(); cargarMediaNotas().catch(() => {});
  reels = [...feed.querySelectorAll(".reel")];
  actual = reels[0];
  correrIntro();
  io?.disconnect();
  io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const r = e.target; actual = r;
    if (!r.classList.contains("visto")) { r.classList.add("visto"); contar(r.querySelector(".big strong, .encontre strong")); }
    holograma(r);
    history.replaceState(null, "", r.id === "subir" ? location.pathname : "#" + r.id);
    pintarLado();
    guiaAlLlegar(r);
  }), {root: feed, threshold: .6});
  reels.forEach(r => io.observe(r));
  for (const r of reels) {
    const s = r.querySelector(".slides"), marcas = r.querySelectorAll(".prog i");
    const ant = r.querySelector(".pasar.ant"), sig = r.querySelector(".pasar.sig");
    if (!ant) continue;
    let antes = 0;
    const progreso = () => {
      const k = Math.round(s.scrollLeft / s.clientWidth);
      marcas.forEach((m,j) => m.classList.toggle("on", j <= k));
      ant.disabled = k === 0; sig.disabled = k >= marcas.length - 1;
      // Al llegar a otra pantalla, el holograma se pasa a la suya.
      if (k !== antes) { antes = k; if (r === actual) holograma(r); }
    };
    s.addEventListener("scroll", progreso, {passive: true}); progreso();
  }
  pintarLado();
  const ir = destino && document.getElementById(destino);
  if (ir) ir.scrollIntoView();
}

/* Solo vuelve a dibujar el reel de subir, sin perder el lugar en el feed. */
function pintarSubir(){
  const viejo = document.getElementById("subir"); if (!viejo) return;
  const t = document.createElement("template"); t.innerHTML = htmlSubir().trim();
  const nuevo = t.content.firstElementChild;
  viejo.replaceWith(nuevo); reels[0] = nuevo; if (actual === viejo) actual = nuevo;
  io.observe(nuevo);
  correrIntro();
  if (subida.estado === "listo") holograma(nuevo);
  contar(nuevo.querySelector(".encontre strong"));
}

function marcar(r, forzar){
  const b = r.querySelector(".listo"); if (!b) return;
  const on = forzar ?? !listos.has(r.id);
  on ? listos.add(r.id) : listos.delete(r.id); guardarListos(); pintarLado();
  b.setAttribute("aria-pressed", on);
  if (on) { const c = r.querySelector(".corazon"); c.classList.remove("go"); void c.offsetWidth; c.classList.add("go"); }
}

const mover = {
  ArrowDown: () => reels[reels.indexOf(actual)+1]?.scrollIntoView({behavior:"smooth"}),
  ArrowUp: () => reels[reels.indexOf(actual)-1]?.scrollIntoView({behavior:"smooth"}),
  ArrowRight: (r = actual) => { const s = r.querySelector(".slides"); s.scrollBy({left: s.clientWidth, behavior:"smooth"}); },
  ArrowLeft: (r = actual) => { const s = r.querySelector(".slides"); s.scrollBy({left: -s.clientWidth, behavior:"smooth"}); },
};

feed.addEventListener("click", async e => {
  const r = e.target.closest(".reel"); if (!r) return;
  const acc = e.target.closest("[data-acc]")?.dataset.acc;
  if (acc === "ir-seccion") return document.getElementById(e.target.closest("[data-acc]").dataset.id)?.scrollIntoView({behavior: "smooth"});
  if (acc === "elegir") return document.getElementById("archivo").click();
  if (acc === "foto") return document.getElementById("camara").click();
  if (acc === "muestra") return probarMuestra();
  if (acc === "otro") { subida.estado = "inicio"; subida.archivos = []; return pintarSubir(); }
  if (acc === "borrar") {
    // Dos toques: el botón está en cada pantalla y se puede tocar sin querer.
    const btn = e.target.closest("[data-acc]");
    if (!btn.dataset.seguro) { btn.dataset.seguro = "1"; btn.textContent = "¿Borrar el documento? Toca otra vez"; return; }
    instantanea("antes de borrar el documento").finally(() => { escribir(P + "listos:doc", null); subida.estado = "inicio"; subida.archivos = []; destinoPendiente = "subir"; enviar({tipo: "borrar"}); });
    return; }
  if (acc === "limpiar") { document.getElementById("buscar").value = ""; destinoPendiente = "subir"; return enviar({tipo: "limpiar"}); }
  if (acc === "tomar-foto" || acc === "subir-foto") { fotoDe = e.target.closest("[data-banda]").dataset.banda; return document.getElementById(acc === "tomar-foto" ? "foto-camara" : "foto-galeria").click(); }
  if (acc === "planilla") return abrirPlanilla(e.target.closest("[data-banda]").dataset.banda);
  const foto = e.target.closest("img[data-foto]");
  if (foto) return verFoto(foto);
  const bn = e.target.closest("[data-nota]");
  if (bn) {
    const sec = bn.dataset.sec;
    if (bn.dataset.nota === "grabar") return grabarAudio(bn, sec);
    if (bn.dataset.nota === "foto") { notaFotoDe = sec; return $b("nota-foto").click(); }
    if (bn.dataset.nota === "guardar") return guardarNota(sec);
  }
  const nq = e.target.closest("[data-nota-quitar]");
  if (nq) {
    if (!nq.dataset.seguro) { nq.dataset.seguro = "1"; nq.textContent = "¿Quitar? Toca otra vez"; return; }
    escribir(claveNotas(), todasNotas().map(n => n.id === nq.dataset.notaQuitar ? {...n, quitada: new Date().toISOString()} : n));
    huboCambio(); aviso("Nota quitada · se puede recuperar en Filtros"); return repintarQuieto();
  }
  const nf = e.target.closest("img[data-foto-nota]");
  if (nf?.src) { const v = $b("visor"); v.querySelector("img").src = nf.src; v.querySelector(".borrar-foto").hidden = true; return v.hidden = false; }
  if (e.target.closest(".historia-notas textarea")) return;
  const fa = e.target.closest("[data-falta-agregar]");
  if (fa) return agregarPieza(fa.dataset.de, fa.dataset.faltaAgregar, fa.dataset.cat);
  const fn = e.target.closest("[data-falta-no]");
  if (fn) { const no = new Set(leer(claveNoFalta(), [])); no.add(fn.dataset.faltaNo); escribir(claveNoFalta(), [...no]); destinoPendiente = actual?.id || null; return pintar(actual?.id); }
  const fp = e.target.closest("[data-foto-pieza]");
  if (fp) return abrirMomentos(fp.dataset.fotoPieza);
  const chipF = e.target.closest(".chip.foto");
  if (chipF) { const sl = chipF.closest(".reel")?.querySelector(".slides"), h = sl?.querySelector(".historia-fotos"); if (h) return sl.scrollTo({left: h.offsetLeft, behavior: "smooth"}); }
  const det = e.target.closest("[data-detalle]");
  if (det) return abrirDetalle(det.dataset.detalle);
  const li = e.target.closest("[data-item]");
  if (li) return marcarChulo(li.dataset.item);
  if (acc === "ver") return reels[1]?.scrollIntoView({behavior: "smooth"});
  const vt = e.target.closest(".ver-totales, .totales .cerrar");
  if (vt) {
    const p = vt.closest(".portada"), abrir = vt.classList.contains("ver-totales");
    p.querySelector(".totales").hidden = !abrir;
    p.querySelector(".ver-totales").setAttribute("aria-expanded", abrir);
    return;
  }
  const vc = e.target.closest(".ver-cmp");
  if (vc) {
    const s = vc.closest(".banda"), on = !vc.classList.contains("on");
    vc.classList.toggle("on", on); vc.setAttribute("aria-pressed", on);
    s.querySelector(".rider").hidden = on; s.querySelector(".cmp-pane").hidden = !on;
    return;
  }
  if (e.target.closest(".listo")) return marcar(r);
  if (e.target.closest(".ir-subir")) return reels[0].scrollIntoView({behavior: "smooth"});
  if (e.target.closest(".compartir")) {
    const url = location.href.split("#")[0] + "#" + r.id, t = "Backline · " + r.getAttribute("aria-label");
    try { if (navigator.share) await navigator.share({title: t, url}); else { await navigator.clipboard.writeText(url); aviso("Enlace copiado"); } } catch {}
    return;
  }
  if (e.target.closest(".ver-indice")) return abrirIndice();
  const p = e.target.closest(".pasar");
  if (p) return mover[p.classList.contains("sig") ? "ArrowRight" : "ArrowLeft"](r);
  const img = e.target.closest(".plot");
  if (img) { const v = document.getElementById("visor"); v.querySelector("img").src = img.src; v.querySelector(".borrar-foto").hidden = true; v.hidden = false; }
});
feed.addEventListener("change", e => {
  // Un documento subido a mano no es del evento que se abrió desde el cronograma.
  if (e.target.matches("#archivo, #camara")) { const fs = [...e.target.files]; e.target.value = ""; escribir(P + "evento", null); subirArchivos(fs); }
});
// Doble toque en cualquier parte = listo, igual que el "me gusta".

document.getElementById("visor").addEventListener("click", e => {
  const v = e.currentTarget, b = v.querySelector(".borrar-foto");
  if (e.target === b) {
    // Dos toques para borrar: el primero pregunta.
    if (!b.dataset.seguro) { b.dataset.seguro = "1"; b.textContent = "¿Seguro? Toca otra vez para borrar"; return; }
    const {foto, banda} = b.dataset;
    // La imagen NO se borra del celular: queda en la papelera y se puede recuperar desde Filtros.
    const papelera = leer(P + "papelera", []);
    papelera.push({foto, banda, cuando: new Date().toISOString()});
    escribir(P + "papelera", papelera);
    enviar({tipo: "quitar-foto", banda, foto});
    huboCambio();
    aviso("Foto quitada · se puede recuperar en Filtros");
    refrescarDetalle();
  }
  v.hidden = true;
});

const indice = document.getElementById("indice");
const filaIndice = (c, cls, actualId) => `<button class="${cls}${c.sub ? " sub-fila" : ""}" data-id="${esc(c.id)}" aria-current="${actualId === c.id}"><span class="e">${c.e}</span><span>${esc(c.nombre)}</span><span class="x">${listos.has(c.id) ? '<span class="ok">✓ </span>' : ""}${esc(c.x)}</span></button>`;
const filaSubir = (cls, actualId) => `<button class="${cls}" data-id="subir" aria-current="${actualId === "subir"}"><span class="e">＋</span><span>Subir documento</span></button>`
  + (V?.puede?.planilla ? `<a class="${cls} enlace" href="../cronograma/"><span class="e">📅</span><span>Cronograma</span></a>` : "");
function abrirIndice(){
  indice.querySelector("h4").textContent = festival() ? "Categorías" : "Bandas";
  document.getElementById("filas").innerHTML = filaSubir("fila") + entradas.map(c => filaIndice(c, "fila")).join("");
  indice.hidden = false;
}
indice.addEventListener("click", e => {
  const f = e.target.closest(".fila");
  if (f?.matches("a")) return;
  indice.hidden = true;
  if (f) document.getElementById(f.dataset.id).scrollIntoView({behavior: "smooth"});
});
addEventListener("keydown", e => {
  if (!detalle.hidden) { if (e.key === "Escape") detalle.hidden = true; return; }
  if (!indice.hidden || !document.getElementById("visor").hidden) { if (e.key === "Escape") indice.hidden = document.getElementById("visor").hidden = true; return; }
  if (document.querySelector(".guia, .splash:not(.fuera)")) return;
  if (mover[e.key] && actual) { e.preventDefault(); mover[e.key](); }
});
document.getElementById("sube").addEventListener("click", () => mover.ArrowUp());
document.getElementById("baja").addEventListener("click", () => mover.ArrowDown());

// Índice fijo a la izquierda en PC.
const lado = document.getElementById("lado");
function pintarLado(){
  const ev = V?.espacio === "evento" ? leer(P + "evento", "") : "Mis pruebas";
  lado.innerHTML = `<h1>Backline en reels</h1><p>${ev ? `<b class="evento-actual">${esc(ev)}</b> · ` : ""}${esc(titulo())}</p>` + filaSubir("", actual?.id) + entradas.map(c => filaIndice(c, "", actual?.id)).join("");
  document.getElementById("sube").disabled = actual === reels[0];
  document.getElementById("baja").disabled = actual === reels[reels.length - 1];
}
lado.addEventListener("click", e => { const b = e.target.closest("button"); if (b) document.getElementById(b.dataset.id).scrollIntoView({behavior: "smooth"}); });
