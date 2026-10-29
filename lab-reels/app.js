/* Armado por lab-reels/armar.py desde lab-reels/src/: no editar a mano. */
/* ═══ src/00-base.js ═══ */
/* El lector de PDF usa Map.getOrInsert(Computed), que solo traen los navegadores más nuevos. */
for (const C of [Map, WeakMap]) {
  if (!C.prototype.getOrInsertComputed) C.prototype.getOrInsertComputed = function(k, f){ if (!this.has(k)) this.set(k, f(k)); return this.get(k); };
  if (!C.prototype.getOrInsert) C.prototype.getOrInsert = function(k, v){ if (!this.has(k)) this.set(k, v); return this.get(k); };
}
const BASE_IMG = "../extractor/data/";
const LECTOR = new URL(ENTORNO.rutas.lector, location.href).href;   // el mismo lector de "Subir documento"
const MUESTRA = "../extractor/muestras/hoja-backline.pdf";
const ORDEN = ["Batería","Platillos","Percusión","Teclado","Ampli bajo","Ampli guitarra","Guitarra","Bajo","Vientos","Voces","Bases","In ears","Consolas","Escenario","Cables y energía","DJ","Otro"];
const EMOJI = {"Batería":"🥁","Platillos":"🔔","Percusión":"🪘","Teclado":"🎹","Ampli bajo":"🔊","Ampli guitarra":"📢","Guitarra":"🎸","Bajo":"🎸","Bases":"🎙️","Escenario":"🏗️","Cables y energía":"🔌","DJ":"🎧","In ears":"🎧","Consolas":"🎛️","Vientos":"🎷","Voces":"🎤","Extras":"✨","Otro":"📦"};
const HUE = {"Batería":20,"Platillos":45,"Percusión":5,"Teclado":265,"Ampli bajo":200,"Ampli guitarra":340,"Guitarra":30,"Bajo":180,"Bases":220,"Escenario":120,"Cables y energía":55,"DJ":290,"In ears":175,"Consolas":235,"Vientos":40,"Voces":310,"Extras":150,"Otro":0};
const PC = matchMedia("(hover: hover) and (pointer: fine)").matches;
const QUIETO = matchMedia("(prefers-reduced-motion: reduce)").matches;
// ?demo=backstage (el link corto backstage/): la presentación para Backstage Company al abrir.
// Una copia con otra marca (backstage.html, la arma hacer-marcas.py) trae window.MARCA: su logo en el arranque y en
// la presentación, sin Circuito, y sus datos aparte en el celular.
const MARCA = ENTORNO.marca;
// Claves del almacenamiento: "<prefijo>:<nombre>" (el prefijo depende de la marca; ver entorno.js).
const P = ENTORNO.claves.app + ":", PREFIJOS = new RegExp("^(" + Object.values(ENTORNO.claves).join("|") + "):");
const DEMO = MARCA ? "backstage" : new URLSearchParams(location.search).get("demo") || (location.hash === "#presentacion" ? "backstage" : "");

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const slug = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
// Todo lo guardado pasa por el almacén (plataforma/almacen.js): la app no sabe si queda en el celular o en un servidor.
const leer = Almacen.leer, escribir = Almacen.escribir;
// Las ayudas ("Baja con ↓…", "Pasa con ›…") salen solo la primera vez que se abren los reels (lo pidió el usuario).
const AYUDA = !leer(P + "ayuda-vista", false);
escribir(P + "ayuda-vista", true);
if (!AYUDA) document.getElementById("teclas")?.remove();

function aviso(t){
  const a = document.createElement("div"); a.className = "aviso"; a.textContent = t;
  document.body.append(a); setTimeout(() => a.remove(), 1800);
}

/* ═══ src/01-estado-elm.js ═══ */
/* ── El estado vive en el núcleo en Elm (app/src/Backline/Tablero.elm): el documento, el perfil
   (admin o empleado), el modo (normal o festival), la búsqueda, los filtros y las fotos de cada banda.
   Elm decide qué puede hacer cada perfil y devuelve la vista; aquí solo se dibuja y se guarda. ── */
function estadoGuardado(){
  const t = leer(P + "tablero", null);
  if (t) return t;
  // Lo que se subió antes de que existiera el núcleo: se trae tal cual.
  const viejo = leer(P + "doc", null);
  return viejo ? {doc: viejo} : null;
}
const tablero = Elm.Tablero.init({flags: estadoGuardado()});
let V = null;                 // la última vista que mandó Elm
let arrancado = false;
let destinoPendiente = null;  // a qué reel ir cuando llegue la próxima vista
const enviar = m => tablero.ports.entrada.send(m);
tablero.ports.guardar.subscribe(v => { escribir(P + "tablero", v); escribir(P + "doc", null); });
tablero.ports.error.subscribe(e => console.warn("tablero:", e));
tablero.ports.vista.subscribe(v => {
  V = v;
  cargarFotosSitio();
  if (arrancado) setTimeout(() => recuperarPiezas().catch(() => {}).then(() => asegurarShow()).catch(() => {}), 600);
  pintarBarra();
  if (!arrancado) return;   // la primera vista la pinta el arranque
  const destino = destinoPendiente ?? (actual && document.getElementById(actual.id) ? actual.id : null);
  // Al volver a dibujar (una foto, un chulo…) se queda en el mismo panel del reel, no vuelve al primero.
  const lado = !destinoPendiente && destino ? document.querySelector(`#${CSS.escape(destino)} .slides`)?.scrollLeft : 0;
  destinoPendiente = null;
  pintar(destino);
  if (lado) requestAnimationFrame(() => { const sl = document.querySelector(`#${CSS.escape(destino)} .slides`); if (sl) sl.scrollTo({left: lado, behavior: "instant"}); });
  if (!document.getElementById("filtros").hidden) pintarFiltros();
});

/* El chulo verde (lo pidió el usuario): tocar un ítem del listado lo marca como listo, y otro toque lo
   quita. Se guarda en el dispositivo, por documento. La hoja de detalle queda en el «›» del renglón. */
/* Se guardan por pieza (banda, sección y nombre), no por el número del ítem: así sobreviven a volver a abrir
   la misma lista o a que la lista se actualice. Antes se guardaban por "nombre|cuando" + "doc-N"; esos se
   recuperan al cargar (ver migrarChulos). */
const claveChulos = () => P + "chulos2:" + (V?.doc ? V.doc.nombre : "");

let chulos = new Set();   // ids de ítems del documento abierto que tienen chulo
function cargarChulos(){
  const d = V?.doc ? datos() : null; if (!d) { chulos = new Set(); return; }
  const guardadas = new Set(leer(claveChulos(), []));
  migrarChulos(d, guardadas);
  chulos = new Set(d.items.filter(x => guardadas.has(piezaDe(x))).map(x => x.id));
}
function migrarChulos(d, guardadas){
  const viejas = Almacen.claves().filter(k => k.startsWith(P + "chulos:" + V.doc.nombre + "|"));
  if (!viejas.length) return;
  const porId = new Map(d.items.map(x => [x.id, x]));
  for (const k of viejas) {
    const actual = k === P + "chulos:" + V.doc.nombre + "|" + V.doc.cuando;
    for (const id of leer(k, [])) {
      const n = Number(String(id).replace("doc-", ""));
      // De una carga anterior solo se confía en el número si es del tramo que no cambió entre versiones de la
      // lista (en la lista a mano, del bombo a los primeros PSM: doc-0 … doc-13).
      if (porId.has(id) && (actual || (V.doc.nombre === "lista-a-mano" && n <= 13))) guardadas.add(piezaDe(porId.get(id)));
    }
    // La clave vieja no se borra: queda de respaldo en el dispositivo.
  }
  escribir(claveChulos(), [...guardadas]);
}
function marcarChulo(id){
  const x = datos().items.find(i => i.id === id); if (!x) return;
  const guardadas = new Set(leer(claveChulos(), [])), k = piezaDe(x);
  guardadas.has(k) ? guardadas.delete(k) : guardadas.add(k);
  escribir(claveChulos(), [...guardadas]);
  chulos.has(id) ? chulos.delete(id) : chulos.add(id);
  document.querySelectorAll(`[data-item="${CSS.escape(id)}"]`).forEach(el => el.classList.toggle("hecho", chulos.has(id)));
  navigator.vibrate?.(15);
  // En «Todo el equipo» el contador de listas cambia al tocar.
  const kOk = document.querySelector("#resumen .kpi.ok b"); if (kOk) kOk.textContent = datos().items.filter(i => chulos.has(i.id)).length;
  huboCambio();
}
let listos = new Set();
const cargarListos = () => { listos = new Set(leer(P + "listos:doc", [])); };
const guardarListos = () => escribir(P + "listos:doc", [...listos]);
const VACIO = {artistas: [], dias: [], bloques: [], stagePlots: [], items: []};
const datos = () => V?.doc?.datos || VACIO;
const titulo = () => V?.doc ? V.doc.nombre : "Sube un documento para empezar";
const festival = () => V?.modo === "festival";

/* Siempre los mismos reels, en este orden (In ears y Consolas los pidió el usuario el 2026-10-08). Se respeta cómo agrupa la banda: lo que
   pidió en el bloque del bajo (una mesa de percusión) se queda en Bajo, y los platillos del
   bloque de batería, en Batería. Un grupo que no es de un instrumento ("Tarimas", "Vientos",
   "DJ") no es un reel: cada ítem va por su categoría y lo que no es instrumento, a Extras. */
/* El holograma de cada reel: el del equipo principal del grupo (en "Teclado" sin teclados,
   solo bases, salen las bases) y armado solo con lo que pide ese grupo. */
const PRINCIPAL = {"Batería": ["Batería", "Platillos"], "Bajo": ["Ampli bajo", "Bajo"], "Guitarra": ["Ampli guitarra", "Guitarra"], "Teclado": ["Teclado"]};
const PRIORIDAD = ["Batería","Ampli bajo","Ampli guitarra","Teclado","Percusión","Platillos","Guitarra","Bajo","Bases","In ears","Consolas"];
const sinNum = r => r.replace(/\s\d$/, "");   // "Guitarra 1" se ve como Guitarra
function catHolograma(reel, items){
  reel = sinNum(reel);
  const hay = new Set(items.map(i => i.categoria));
  if (reel === "Extras") return reel;   // Extras lleva su emoji, no holograma
  return [...(PRINCIPAL[reel] || [reel]), ...PRIORIDAD].find(c => hay.has(c)) || reel;
}

/* Agrupa los ítems por reel: totales por día (se suman), "a tener" = máximo entre días,
   resumen por referencia y una ficha por banda. */
function armar(d){
  const art = Object.fromEntries(d.artistas.map(a => [a.id, a.nombre]));
  const dia = Object.fromEntries(d.dias.map(x => [x.id, x.nombre]));
  const corto = Object.fromEntries(d.dias.map(x => [x.id, x.nombre.replace(/^(\S{3})\S*/, "$1").replace(/ · .*/, "")]));
  const show = {}; for (const b of d.bloques) if (b.tipo === "show" && b.artistaId) show[b.diaId + "|" + b.artistaId] = b;
  const plot = {}; for (const p of d.stagePlots) plot[p.artistaId] = BASE_IMG + p.archivo;
  const diasShow = d.dias.filter(x => x.tipo === "show").map(x => x.id);
  const cats = new Map();
  for (const it of d.items) {
    const r = reelDe(it);
    if (!cats.has(r)) cats.set(r, []);
    cats.get(r).push(it);
  }
  const porGrupo = d.items.some(i => i.grupo);
  const pos = c => REELES.indexOf(c);
  // Todo lo de cada banda y día, en el orden del documento: la ficha se muestra como viene en el rider.
  const deBanda = new Map();
  for (const it of d.items) { if (it.sinBanda) continue; const k = it.diaId + "|" + it.artistaId; if (!deBanda.has(k)) deBanda.set(k, []); deBanda.get(k).push(it); }
  return [...cats.keys()].sort((a,b) => pos(a) - pos(b)).map(cat => {
    const items = cats.get(cat);
    const porDia = Object.fromEntries(diasShow.map(id => [id, 0]));
    const refs = new Map(), bandas = new Map();
    for (const it of items) {
      porDia[it.diaId] = (porDia[it.diaId] || 0) + it.cantidad;
      const r = refs.get(it.referencia) || {ref: it.referencia, dias:{}};
      r.dias[it.diaId] = (r.dias[it.diaId] || 0) + it.cantidad;
      refs.set(it.referencia, r);
      if (it.sinBanda) continue; // listado general: solo en los totales
      const k = it.diaId + "|" + it.artistaId;
      if (!bandas.has(k)) bandas.set(k, {nombre: art[it.artistaId] || it.artistaId, dia: dia[it.diaId], show: show[k], plot: plot[it.artistaId], items: []});
      bandas.get(k).items.push(it);
    }
    // Pide / propuesta de este reel. Las dos columnas del Excel no van alineadas renglón por
    // renglón, así que cada lado entra por su propio reel y se compara el total.
    for (const c of d.comparaciones || []) {
      const enReel = l => !!l && reelDe({grupo: l.grupo, categoria: l.categoria, referencia: l.texto}) === cat;
      const filas = c.filas.filter(f => enReel(f.pide) || enReel(f.propone))
        .map(f => ({fila: f.fila, pide: enReel(f.pide) ? f.pide : null, propone: enReel(f.propone) ? f.propone : null}));
      if (!filas.length) continue;
      const k = c.diaId + "|" + c.artistaId;
      if (!bandas.has(k)) bandas.set(k, {nombre: art[c.artistaId] || c.artistaId, dia: dia[c.diaId], show: show[k], plot: plot[c.artistaId], items: []});
      const b = bandas.get(k);
      b.cmp = [...(b.cmp || []), ...filas];
      const piezas = l => l ? (l.cantidad ?? 1) : 0;
      b.pide = (b.pide || 0) + filas.reduce((s, f) => s + piezas(f.pide), 0);
      b.propone = (b.propone || 0) + filas.reduce((s, f) => s + piezas(f.propone), 0);
    }
    // Como viene en el rider: las secciones de la banda que tienen algo de este reel,
    // completas y en su orden ("DRUM" con su pedal y su banqueta, aunque esos sean de otra categoría).
    for (const [k, b] of bandas) {
      const secciones = [];
      for (const it of deBanda.get(k) || []) {
        const g = it.grupo || "";
        let s = secciones.find(x => x.grupo === g);
        if (!s) secciones.push(s = {grupo: g, items: []});
        s.items.push(it);
      }
      b.secciones = secciones.filter(s => s.items.some(it => reelDe(it) === cat));
    }
    const resumen = [...refs.values()].map(r => ({ref: r.ref, q: Math.max(...Object.values(r.dias))})).sort((a,b) => porGrupo ? 0 : b.q - a.q || a.ref.localeCompare(b.ref));   // con grupos, como en el rider
    const orden = [...bandas.values()].sort((a,b) => (a.dia + (a.show?.inicio || "")).localeCompare(b.dia + (b.show?.inicio || "")));
    // Lo grande de la portada son las bandas (por banda y día) que tienen algo en este reel.
    const equipos = orden.filter(b => b.items.length).length;
    const bandasPorDia = {};
    for (const [k, b] of bandas) if (b.items.length) { const id = k.split("|")[0]; bandasPorDia[id] = (bandasPorDia[id] || 0) + 1; }
    return {cat, id: slug(cat), items, holo: catHolograma(cat, items), porDia, bandasPorDia, corto, aTener: resumen.reduce((s,r) => s + r.q, 0), equipos, resumen, bandas: orden, dudosos: items.filter(i => i.porConfirmar).length};
  });
}

/* Quién pone el equipo: "ARTISTA" es la banda; "CN" o nada, nosotros; otro nombre ("AUDIO ROOM",
   "ARBOL NARANJA") es el proveedor que lo trae. */
function dueno(p){
  if (p === "ARTISTA") return {tipo: "tercero", nombre: "la banda"};
  if (!p || /^(cn|propio|producci[oó]n)$/i.test(p)) return {tipo: "propio"};
  return {tipo: "tercero", nombre: /^(OML|BACKLINE COP)$/i.test(p) ? p.toUpperCase() : p.toLowerCase().replace(/(^|\s)\p{L}/gu, m => m.toUpperCase())};
}

/* Lo que devuelve el lector → el mismo formato de datos que Cordillera, para armar los reels. */
function aDatos(ext, traza){
  // Los reels son por banda: lo que el lector marcó como listado general (la hoja no dice de qué
  // banda es) no sale como si fuera una banda, pero sí entra en los totales de fondo.
  // Si el documento no trae ninguna banda, el listado se muestra como ficha.
  const conBanda = ext.items.some(i => !i.sinBanda);
  // "Opción 2": alternativa del rider, no se pide además de la opción 1.
  const fuente = ext.items.filter(i => !/no suma/.test(i.nota || ""));
  const fechas = [...new Set(fuente.map(i => i.fecha).filter(Boolean))].sort();
  const nombreDia = f => new Date(f + "T12:00").toLocaleDateString("es", {weekday: "long", day: "numeric"}).replace(/^./, c => c.toUpperCase());
  const dias = fechas.map(f => ({id: "d-" + f, nombre: nombreDia(f), tipo: "show"}));
  if (fuente.some(i => !i.fecha)) dias.push({id: "d-doc", nombre: "Del documento", tipo: "show"});
  const artistas = new Map();
  const items = fuente.map((i, n) => {
    const nombre = (i.artista || "").trim() || "Sin banda";
    const id = slug(nombre) || "sin-banda";
    artistas.set(id, nombre);
    const ref = (i.descripcion || "").replace(/^[.·•\-–]\s*\d+\s+(?=\D)/, "");   // ". 1 Hi-hat stand"
    return {id: "doc-" + n, diaId: i.fecha ? "d-" + i.fecha : "d-doc", artistaId: id, cantidad: Math.max(0, Math.round(+i.cantidad || 0)) || 1,
      categoria: i.categoria || "Otro", grupo: (i.grupo || "").trim(), referencia: ref, descripcion: i.nota || ref,
      nota: i.nota || null,   // la nota del rider, para la ficha
      propietario: dueno(i.proveedor), porConfirmar: !!i.dudoso,
      ...(conBanda && i.sinBanda ? {sinBanda: true} : {})};
  });
  // "Cant | Requerimiento | Cant | Propuesta": lo que pide cada banda junto a lo que se le propone.
  const comparaciones = (ext.comparaciones || []).map(c => {
    const nombre = (c.artista || "").trim() || "Sin banda";
    const id = slug(nombre) || "sin-banda";
    artistas.set(id, artistas.get(id) || nombre);
    return {artistaId: id, diaId: c.fecha ? "d-" + c.fecha : "d-doc", hoja: c.hoja, filas: c.filas};
  });
  return {artistas: [...artistas].map(([id, nombre]) => ({id, nombre})), dias, bloques: [], stagePlots: [], items, comparaciones,
    pedidos: pedidosDe(ext, traza, fuente, items)};
}

/* Lo que pidió cada banda, tal como viene en el rider: los renglones de su backline en orden, con lo
   que el lector hizo de cada uno (ítem del listado, título con opciones, nota o "no es backline").
   Así se ve aparte lo que pidió la banda y lo que quedó en el listado. Solo con un documento:
   con varios, los números de ítem de la traza son de cada archivo. */
const PRIVADO = /@|\+?\d[\d\s().-]{7,}\d|\bwww\.|https?:/i;
function pedidosDe(ext, traza, fuente, items){
  if (!traza?.length || new Set(traza.map(r => r.documento)).size !== 1) return [];
  const idDe = new Map(fuente.map((it, n) => [ext.items.indexOf(it), items[n]]));
  const porBanda = new Map(), antes = [];
  let banda = null;
  const poner = (b, r) => { if (!porBanda.has(b)) porBanda.set(b, []); porBanda.get(b).push(r); };
  for (const r of traza) {
    const enBackline = r.seccion === "backline" || ["item", "grupo"].includes(r.etiqueta) || (r.seccion === "neutra" && r.grupo);
    if (!enBackline || PRIVADO.test(r.texto) || r.etiqueta === "banda") continue;
    const it = r.item !== null && r.item !== undefined ? idDe.get(r.item) : null;
    const tipo = it ? "item" : ["grupo", "seccion"].includes(r.etiqueta) ? "grupo" : r.etiqueta === "no-backline" ? "fuera" : r.etiqueta === "item" ? "alternativa" : "nota";
    const opciones = tipo === "grupo" && /opciones de la banda: /.test(r.motivo) ? r.motivo.replace(/^.*opciones de la banda: /, "").split(" · ") : null;
    const renglon = {texto: r.texto, tipo, ...(it ? {itemId: it.id} : {}), ...(opciones ? {opciones} : {}), ...(tipo === "fuera" ? {motivo: r.motivo} : {})};
    if (it && !it.sinBanda) {
      if (banda === null) antes.splice(0).forEach(x => poner(it.artistaId, x));
      banda = it.artistaId;
    }
    if (banda === null) antes.push(renglon); else poner(banda, renglon);
  }
  return [...porBanda].map(([artistaId, renglones]) => ({artistaId, renglones}));
}

/* La ficha de una banda: como viene en el rider (sus secciones, en orden) y, si el Excel trae
   "Requerimiento | Propuesta", el botón para verlos lado a lado. */
function htmlFicha(b, cat){
  // Sin categoría (modo normal) se ve todo igual. El admin toca un ítem para editarlo.
  const editable = V?.puede?.editar;
  const item = x => `<li class="${!cat || reelDe(x) === cat ? "" : "otra"}${editable ? " editable" : ""}${chulos.has(x.id) ? " hecho" : ""}" data-item="${esc(x.id)}"><span class="q">${x.cantidad}</span><span class="t">${esc(corto(x.referencia))}
        ${corto(x.referencia) !== x.referencia ? `<small class="modelo">${esc((x.referencia.match(/\(([^)]*)\)/g) || []).map(p => p.slice(1, -1)).join(" · "))}</small>` : ""}
        ${x.nota ? `<small>${esc(x.nota)}</small>` : x.grupo === undefined && x.descripcion !== x.referencia ? `<small>${esc(x.descripcion)}</small>` : ""}
        ${x.propietario?.tipo === "tercero" ? `<span class="chip ter">Lo trae ${esc(x.propietario.nombre || "un tercero")}</span>` : ""}
        ${x.porConfirmar ? `<span class="chip warn">Por confirmar</span>` : ""}${chipsFotos(x)}</span><button class="foto-pieza" data-foto-pieza="${esc(x.id)}" aria-label="Tomar o subir foto">📷</button><button class="ver-pieza" data-detalle="${esc(x.id)}" aria-label="Ver detalle">›</button></li>`;
  const conTitulos = b.secciones.some(s => s.grupo);
  const rider = b.secciones.length
    ? b.secciones.map(s => `${conTitulos ? `<h4 class="seccion">${esc(s.grupo || "Sin sección")}</h4>` : ""}<ul class="lista">${s.items.map(item).join("")}</ul>`).join("")
    : `<p class="sub">La propuesta no trae nada${cat ? ` de ${esc(cat.toLowerCase())}` : ""} para esta banda. Mira lo que pidió en "Pide vs propuesta".</p>`;
  if (!b.cmp) return `<div class="rider">${rider}</div>`;
  // Sin nada propuesto en esta categoría, la ficha abre directo en la comparación.
  const abierta = !b.secciones.length;
  return `
      <button class="ver-cmp${abierta ? " on" : ""}" aria-pressed="${abierta}"><span>⇄</span> Pide vs propuesta${b.pide !== b.propone ? ` <b>${b.pide} ≠ ${b.propone}</b>` : ""}</button>
      <div class="rider"${abierta ? " hidden" : ""}>${rider}</div>
      <div class="cmp-pane"${abierta ? "" : " hidden"}>${htmlComparar(b)}</div>`;
}

/* Lo que pide la banda | la propuesta, en el orden de la hoja, con el total de cada lado. */
function htmlComparar(b){
  const lado = l => l
    ? `<span class="q${l.cantidad === null ? " sin" : ""}">${l.cantidad ?? "·"}</span><span class="t">${esc(l.texto)}</span>`
    : "";
  const distinto = b.pide !== b.propone;
  return `
      <div class="vs${distinto ? " distinto" : ""}" title="${distinto ? "No cuadra: revisa qué falta o qué sobra" : "Cuadra el total"}">
        <div><b>${b.pide}</b><span>pide la banda</span></div>
        <span class="flecha">${distinto ? "≠" : "="}</span>
        <div><b>${b.propone}</b><span>propuesta</span></div>
      </div>
      <div class="cmp">
        <div class="cab-cmp"><span>Pide</span><span>Propuesta</span></div>
        ${b.cmp.map(f => `<div class="fila-cmp" title="Fila ${f.fila} de la hoja"><div class="${f.pide ? "" : "vacio"}">${lado(f.pide)}</div><div class="${f.propone ? "" : "vacio"}">${lado(f.propone)}</div></div>`).join("")}
      </div>`;
}

/* ═══ src/02-subir.js ═══ */
/* ── Reel 0: subir un documento ── */
const subida = {estado: "inicio", archivos: [], resultado: null, error: ""};
/* Subir un documento, explicado como un reel (lo pidió el usuario: "el usuario no entiende de programación,
   que sea como un juego que le explique"). Tres escenas que se repiten: el rider entra, la app lo lee y
   sale el backline como en la planilla. Leyendo un archivo de verdad se queda en la segunda. */
const ESCENAS = ["Sube el rider de la banda", "La app lo lee por ti", "Y te sale el backline, listo para revisar"];
function htmlTutorial(leyendo){
  const filas = [["1", "Bombo 22”"], ["1", "Redoblante 14”"], ["2", "Tom 10” · 12”"], ["4", "Bases de platillo"], ["1", "Ampeg SVT + 8x10"]];
  const papel = `<span class="tuto-papel"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>`;
  return `
      <div class="tuto${leyendo ? " leyendo" : ""}" aria-hidden="true">
        ${leyendo ? "" : `<div class="tuto-prog"><i></i><i></i><i></i></div>`}
        <div class="tuto-escena e1"><span class="tuto-zona">${papel}</span></div>
        <div class="tuto-escena e2">${papel.replace("tuto-papel", "tuto-papel leido")}<span class="tuto-linea"></span></div>
        <div class="tuto-escena e3"><div class="tuto-hoja">${filas.map(([q, t], k) => `<p style="--k:${k}"><b>${q} x</b><span>${t}</span></p>`).join("")}</div></div>
      </div>
      ${leyendo ? "" : `<div class="tuto-textos" aria-live="off">${ESCENAS.map((t, k) => `<p class="t${k + 1}"><b>${k + 1}</b>${t}</p>`).join("")}</div>`}`;
}
/* La entrada (lo pidió el usuario): el texto se escribe solo, letra por letra, para que se lea; después
   se borra y quedan solo los dos botones, sin texto fijo. El escáner es la espera mientras se lee el
   documento, y el holograma presenta lo que se encontró. Tocar la pantalla salta la escritura. */
const ICONO_RIDER = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2.5H6.5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8z"/><path d="M14 2.5V8h5.5"/><path d="M12 18v-6.5"/><path d="m9 14 3-3 3 3"/></svg>`;
const ICONO_CAMARA = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 4.5h-5L7.5 7H4.5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h15a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3.5"/></svg>`;
/* El mensaje de bienvenida (lo pidió el usuario: que a cualquier persona del equipo le guste leerlo).
   Saluda según la hora, como un compañero; reconoce el oficio (el que monta sabe, la app solo le
   quita leer el rider renglón por renglón); dice el beneficio concreto; y el cierre cambia en cada
   visita para que no se vuelva paisaje. Al admin le habla del evento que organiza. */
const CIERRES = [
  "Súbelo y en segundos tienes el backline listo para montar.",
  "Menos tiempo leyendo PDF, más tiempo en la tarima.",
  "Rider en mano, backline en segundos.",
  "Tú pones el oficio. Nosotros leemos la letra pequeña.",
  "Llega a la prueba de sonido sabiendo qué va en cada lugar.",
];
function frasesBienvenida(){
  const h = new Date().getHours();
  const saludo = h < 12 ? "Buen día, equipo." : h < 19 ? "Buenas tardes, equipo." : "Buenas noches, equipo.";
  const evento = leer(P + "evento", "");
  const admin = V?.perfil === "admin";
  const medio = evento ? `Hoy toca ${evento}.` : admin ? "Tú organizas el evento; nosotros leemos los riders." : "Sube el rider de la banda; nosotros lo leemos por ti.";
  const visitas = leer(P + "visitas", 0);
  escribir(P + "visitas", visitas + 1);
  return [saludo, medio, CIERRES[visitas % CIERRES.length]];
}
function htmlIntro(){
  return `
      <div class="intro" data-fase="1">
        <p class="intro-escribe" aria-live="polite"><span class="txt"></span><span class="cursor" aria-hidden="true"></span></p>
        <div class="intro-final">
          <div class="acciones-subir">
            <button class="accion-subir principal" data-acc="elegir">${ICONO_RIDER}<span>Subir rider</span><small>PDF, Excel o correo</small></button>
            <button class="accion-subir" data-acc="foto">${ICONO_CAMARA}<span>Tomar foto</span><small>De la hoja impresa</small></button>
          </div>
        </div>
      </div>`;
}
let introTimers = [], introHecha = false;
function correrIntro(){
  const el = document.querySelector("#subir .intro");
  if (!el || el.dataset.corriendo) return;
  el.dataset.corriendo = "1";
  introTimers.forEach(clearTimeout); introTimers = [];
  const txt = el.querySelector(".txt");
  const final = () => { introTimers.forEach(clearTimeout); el.dataset.fase = "3"; };
  // Se escribe una vez por visita: si la pantalla se vuelve a dibujar (filtros, perfil), queda en el final.
  if (QUIETO || introHecha) return final();
  introHecha = true;
  // Escribe cada frase letra por letra, la deja leer y la borra.
  let t = 400;
  for (const frase of frasesBienvenida()) {
    for (let i = 1; i <= frase.length; i++) { const k = i; introTimers.push(setTimeout(() => { txt.textContent = frase.slice(0, k); }, t)); t += 38; }
    t += 900 + frase.length * 18;
    introTimers.push(setTimeout(() => { el.dataset.fase = "2"; }, t));
    t += 450;
    introTimers.push(setTimeout(() => { txt.textContent = ""; el.dataset.fase = "1"; }, t));
    t += 250;
  }
  introTimers.push(setTimeout(final, t));
  el.addEventListener("click", e => { if (el.dataset.fase !== "3" && !e.target.closest("button")) final(); });
}
function htmlSubir(){
  const s = subida;
  const pie = "";
  const lista = s.archivos.length ? `<ul class="archivos">${s.archivos.map(a => `<li class="${a.clase}"><span>${esc(a.nombre)}</span><span>${esc(a.estado)}</span></li>`).join("")}</ul>` : "";
  let cuerpo;
  if (s.estado === "leyendo") cuerpo = `
      ${htmlTutorial(true)}
      <h2>Leyendo<em>…</em></h2>
      <p class="sub" id="lento">Todo pasa en este dispositivo. Una foto tarda más porque hay que reconocer las letras.</p>${lista}`;
  else if (s.estado === "error") cuerpo = `
      <div class="encontre" aria-hidden="true"><strong>⚠</strong></div>
      <h2>${esc(s.error.titulo)}</h2>
      <p class="sub">${esc(s.error.texto)}</p>
      ${s.error.avisos?.length ? `<ul class="archivos">${s.error.avisos.slice(0, 6).map(a => `<li><span>${esc(a)}</span></li>`).join("")}</ul>` : ""}
      <div class="botones"><button class="btn" data-acc="elegir">Probar con otro archivo</button></div>${lista}`;
  else if (s.estado === "listo") {
    const r = s.resultado;
    cuerpo = `
      <div class="resultado-holo"><div class="holo" data-cat="Tarima"><div class="emoji" aria-hidden="true">🥁</div></div></div>
      <div class="encontre"><strong data-to="${r.bandas}">${r.bandas}</strong></div>
      <h2>${r.bandas === 1 ? "Banda" : "Bandas"} <em>${r.bandas === 1 ? "encontrada" : "encontradas"}</em></h2>
      ${r.dudosos || r.avisos ? `<p class="sub">${[r.dudosos ? `${r.dudosos} por confirmar` : "", r.avisos ? `${r.avisos} ${r.avisos === 1 ? "aviso" : "avisos"} del lector` : ""].filter(Boolean).join(" · ")}</p>` : ""}
      <div class="botones"><button class="btn" data-acc="ver">Ver mis reels ${PC ? "↓" : "↑"}</button><button class="btn sec" data-acc="otro">Subir otro</button></div>${lista}`;
  } else cuerpo = htmlIntro() + lista;
  return `
  <article class="reel subir" id="subir" data-n="1" aria-label="Subir documento">
    <div class="slides"><section class="slide">
      ${cuerpo}
      ${pie}
    </section></div>
    <input type="file" id="archivo" hidden multiple accept=".pdf,.xlsx,.xls,.csv,.txt,.eml,image/*">
    <input type="file" id="camara" hidden accept="image/*" capture="environment">
  </article>`;
}

function htmlReel(c, i, total){
  const n = 1 + c.bandas.length;
  const dias = Object.entries(c.bandasPorDia).map(([id,q]) => `<span class="chip">${esc(c.corto[id])} · ${q} ${q === 1 ? "banda" : "bandas"}</span>`).join("");
  const max = Math.max(1, ...c.resumen.map(r => r.q));
  const resumen = c.resumen.map(r => `<li><span class="q">${r.q}</span><span class="t">${esc(r.ref)}<div class="barra" style="width:${Math.max(8, 100*r.q/max)}%"></div></span></li>`).join("");
  const bandas = c.bandas.map(b => `
    <section class="slide banda">
      ${b.plot ? `<div class="fondo" style="background-image:url('${esc(b.plot)}')"></div>` : ""}
      <h3>${esc(b.nombre)}</h3>
      <p class="sub"><span class="hora">${esc(b.dia)}${b.show ? " · " + esc(b.show.inicio) : ""}</span> · ${b.items.reduce((s,x)=>s+x.cantidad,0)} piezas</p>
      ${b.plot ? `<img class="plot" src="${esc(b.plot)}" alt="Stage plot de ${esc(b.nombre)}" loading="lazy">` : ""}
      ${htmlFicha(b, c.cat)}
    </section>`).join("");
  return `
  <article class="reel" id="${c.id}" style="--h:${HUE[sinNum(c.cat)] ?? 20}" data-n="${n}" aria-label="${esc(c.cat)}">
    <div class="prog">${"<i></i>".repeat(n)}</div>
    <div class="cab"><b>${esc(c.cat)}</b><span class="n">${i+1}/${total}</span></div>
    <div class="slides">
      <section class="slide portada">
        <div class="holo" data-cat="${esc(c.holo)}"><div class="emoji" aria-hidden="true">${EMOJI[sinNum(c.cat)] || "📦"}</div></div>
        ${htmlOrigen()}
        <h2>${esc(c.cat)}</h2>
        <div class="big"><strong data-to="${c.equipos}">${c.equipos}</strong><span>${c.equipos === 1 ? "banda" : "bandas"}</span></div>
        <div class="dias">${dias}${c.dudosos ? `<span class="chip warn">${c.dudosos} por confirmar</span>` : ""}</div>
        <p class="pista">${PC ? "Pasa con › para ver banda por banda" : "Desliza para ver banda por banda"} <span class="flecha">→</span></p>
        <button class="ver-totales" aria-expanded="false">Totales de fondo ›</button>
        <div class="totales" hidden>
          <button class="cerrar">Cerrar ✕</button>
          <p class="sub">Por referencia, todas las bandas: se suma dentro del día y se toma el máximo entre días. ${c.aTener} piezas.</p>
          <ul class="lista">${resumen}</ul>
        </div>
      </section>
      ${bandas}
    </div>
    <button class="pasar ant" aria-label="Anterior" disabled>‹</button>
    <button class="pasar sig" aria-label="Siguiente">›</button>
  </article>`;
}

/* ═══ src/03-modo-normal.js ═══ */
/* ── Modo normal: una pantalla por banda con todo su rider, como viene, y sus fotos.
   Lo que el documento trae sin banda (un listado general) va al final, aparte. ── */
function armarBandas(d){
  const art = Object.fromEntries(d.artistas.map(a => [a.id, a.nombre]));
  const bandas = new Map();
  const deLa = (id, sinBanda) => {
    const k = sinBanda ? "sin-banda" : id;
    if (!bandas.has(k)) bandas.set(k, {id: k, artistaId: sinBanda ? null : id, nombre: sinBanda ? "Listado general" : nombreVisible(art[id] || id), items: [], secciones: []});
    return bandas.get(k);
  };
  for (const it of d.items) {
    const b = deLa(it.artistaId, it.sinBanda);
    b.items.push(it);
    const g = it.grupo || "";
    let s = b.secciones.find(x => x.grupo === g);
    if (!s) b.secciones.push(s = {grupo: g, items: []});
    s.items.push(it);
  }
  // Pide vs propuesta (solo le llega al admin): toda la hoja de la banda, con el total de cada lado.
  for (const c of d.comparaciones || []) {
    const b = deLa(c.artistaId, false), piezas = l => l ? (l.cantidad ?? 1) : 0;
    b.cmp = [...(b.cmp || []), ...c.filas];
    b.pide = (b.pide || 0) + c.filas.reduce((s, f) => s + piezas(f.pide), 0);
    b.propone = (b.propone || 0) + c.filas.reduce((s, f) => s + piezas(f.propone), 0);
  }
  return [...bandas.values()].sort((a, b) => (a.id === "sin-banda") - (b.id === "sin-banda"));
}

function htmlFotos(b){
  if (!b.artistaId) return "";
  const fotos = V.fotos[b.artistaId] || [];
  return `
      <div class="fotos-banda">
        <div class="fila-fotos">${fotos.map(f => `<img data-foto="${esc(f)}" data-banda="${esc(b.artistaId)}" alt="Foto de ${esc(b.nombre)}">`).join("")}</div>
        <div class="botones-foto"><button data-acc="tomar-foto" data-banda="${esc(b.artistaId)}">📷 Tomar foto</button><button data-acc="subir-foto" data-banda="${esc(b.artistaId)}">🖼 Subir foto</button>${fotos.length ? `<span class="sub" style="margin:0;align-self:center">${fotos.length} ${fotos.length === 1 ? "foto" : "fotos"}</span>` : ""}</div>
      </div>`;
}

/* Fotos de cada pieza (lo pidió el usuario): una tanda en la bodega, al alistar, y otra en el evento. Se
   guardan como las de las bandas, con una clave que no cambia al recargar la misma lista. */
const MOMENTOS = [["bodega", "En bodega"], ["evento", "En evento"]];
const clavePieza = (x, momento) => `pieza|${x.artistaId || "sin-banda"}|${x.grupo || ""}|${x.referencia}|${momento}`;
// Las fotos de la pieza: las del sitio y las del dispositivo. Del dispositivo se buscan por banda, sección y
// nombre corto (sin lo de entre paréntesis), para no perder fotos si la nota de la pieza cambia.
const fotoAClave = new Map();
function fotosPieza(x, momento){
  const propias = [];
  const quiero = `${x.artistaId || "sin-banda"}|${x.grupo || ""}|`, nombre = corto(x.referencia).toLowerCase();
  for (const [k, fs] of Object.entries(V?.fotos || {})) {
    if (!k.startsWith("pieza|" + quiero) || !k.endsWith("|" + momento)) continue;
    if (corto(k.slice(("pieza|" + quiero).length, -(momento.length + 1))).toLowerCase() !== nombre) continue;
    for (const f of fs) { fotoAClave.set(f, k); propias.push(f); }
  }
  return [...fotosDelSitio(x, momento), ...propias];
}
/* Las fotos que vienen con una lista del sitio (listas/<nombre>.fotos.json): se ven en cualquier celular y no
   se borran desde la app. Van como "url:…" para distinguirlas de las del dispositivo. */
let fotosSitio = {de: null, fotos: []};
function fotosDelSitio(x, momento){
  if (!V?.doc || fotosSitio.de !== V.doc.nombre) return [];
  const ref = (x.referencia || "").toLowerCase();
  return fotosSitio.fotos.filter(f => f.momento === momento && ref.includes(String(f.pieza).toLowerCase())).flatMap(f => f.fotos.map(u => "url:" + u));
}
async function cargarFotosSitio(){
  const nombre = V?.doc?.nombre;
  if (!nombre || fotosSitio.de === nombre || !/^[\w.-]+$/.test(nombre)) return;
  fotosSitio = {de: nombre, fotos: []};
  try {
    const r = await fetch(`listas/${nombre}.fotos.json`, {cache: "no-store"});
    if (!r.ok) return;
    fotosSitio.fotos = (await r.json()).fotos || [];
    if (fotosSitio.fotos.length && arrancado) pintar(actual?.id);
  } catch {}
}
function chipsFotos(x){
  return MOMENTOS.map(([m, t]) => { const n = fotosPieza(x, m).length; return n ? `<span class="chip foto">📷 ${t.replace("En b", "B").replace("En e", "E")} ${n}</span>` : ""; }).join("");
}
// Las reglas del backline (qué lleva cada instrumento, a qué reel va cada pieza) viven en backline/reglas.js:
// sin pantalla ni almacenamiento, se pueden probar solas y usar en cualquier entorno.
const { REELES, GRUPOS, POR_CATEGORIA, DE_QUIEN, reelDe, HARDWARE, LLEVA, ELECTRONICA, hayCongas, sinTildesL, instrumentoDe,
  loTraeLaBanda, bandaTraeCabezal, corto, piezaDe, idFalta } = ReglasBackline;
/** Lo que le falta a una sección, con lo de este documento: una lista «tal cual» no se avisa, y lo descartado con
 *  «No hace falta» tampoco. */
function faltantes(items){
  const talCual = !!V?.doc && leer(P + "tal-cual", []).includes(V.doc.nombre);
  return ReglasBackline.faltantesDe(items, {talCual, descartadas: new Set(leer(claveNoFalta(), []))});
}
const claveNoFalta = () => P + "no-falta:" + (V?.doc?.nombre || "");
function htmlFaltan(items, conBotones){
  const f = faltantes(items); if (!f.length) return "";
  if (!conBotones) return `<p class="falta-aviso">⚠ Revisa: no pidió <b>${f.map(r => esc(r.pieza)).join("</b>, <b>")}</b></p>`;
  return `<div class="faltan"><p class="et">⚠ Le falta (revisa con la banda)</p>${f.map(r => `
    <div class="falta-fila"><span>${esc(r.pieza)}</span>
      ${V.puede.editar ? `<button data-falta-agregar="${esc(r.pieza)}" data-cat="${esc(r.categoria)}" data-de="${esc(items[0].id)}">+ Agregar</button>` : ""}
      <button data-falta-no="${esc(idFalta(items, r.pieza))}">No hace falta</button></div>`).join("")}</div>`;
}
// "+ Agregar": el mismo documento, con la pieza nueva en la sección (fotos y chulos no se tocan).
function agregarPieza(deId, pieza, categoria){
  const d = datos(), de = d.items.find(i => i.id === deId); if (!de || !V.doc) return;
  const nuevo = {...de, id: "agregado-" + Date.now().toString(36), cantidad: 1, categoria, referencia: pieza, descripcion: pieza,
    nota: "Agregado al revisar: el rider no lo pedía", propietario: {tipo: "propio"}, porConfirmar: false};
  const i = d.items.lastIndexOf(d.items.filter(x => x.artistaId === de.artistaId && (x.grupo || "") === (de.grupo || "")).at(-1));
  const items = [...d.items.slice(0, i + 1), nuevo, ...d.items.slice(i + 1)];
  destinoPendiente = actual?.id || null;
  enviar({tipo: V.espacio === "evento" ? "cargar-evento" : "cargar", doc: {...V.doc, datos: {...d, items}}});
  guardarAgregado(nuevo);
  huboCambio();
  aviso(`${pieza}: agregado`);
}

/* ═══ src/04-agregados.js ═══ */
/* ── Piezas agregadas a mano: que no se pierdan nunca (lo pidió el usuario: tomó foto al pedal de sustain
   agregado y, al volver a abrir la lista, la pieza se cayó con su foto). Se guardan aparte por documento
   (lab-reels:agregados:<doc>) y vuelven al recargar. Lo de antes de este arreglo se recupera de las copias
   internas, de la app de Circuito (en la copia con marca) y de las fotos y chulos que quedaron sin pieza. ── */
function guardarAgregado(x){
  const k = P + "agregados:" + (V?.doc?.nombre || "");
  const l = leer(k, []).filter(y => piezaDe(y) !== piezaDe(x));
  escribir(k, [...l, x]);
}
// Mete en d las piezas que falten (por banda, sección y nombre), cada una al final de su sección.
function ponerAgregados(d, extra){
  const hay = new Set(d.items.map(piezaDe));
  let n = 0;
  for (const x of extra) {
    if (hay.has(piezaDe(x))) continue;
    const plantilla = d.items.find(i => i.artistaId === x.artistaId) || d.items[0]; if (!plantilla) continue;
    const nuevo = {...plantilla, ...x, id: String(x.id || "").startsWith("agregado-") ? x.id : "agregado-" + Date.now().toString(36) + n,
      diaId: plantilla.diaId, artistaId: x.artistaId || plantilla.artistaId};
    const deSeccion = d.items.filter(i => i.artistaId === nuevo.artistaId && (i.grupo || "") === (nuevo.grupo || ""));
    const i = deSeccion.length ? d.items.lastIndexOf(deSeccion.at(-1)) : d.items.length - 1;
    d.items.splice(i + 1, 0, nuevo); hay.add(piezaDe(nuevo)); n++;
  }
  return n;
}
async function piezasRecuperables(){
  const doc = V?.doc; if (!doc) return [];
  const de = [];
  const deTablero = txt => { try { const t = JSON.parse(txt || "{}"); for (const d of [t.pruebas, t.evento]) if (d?.nombre === doc.nombre) de.push(...(d.datos?.items || []).filter(i => String(i.id).startsWith("agregado-"))); } catch {} };
  // a) las copias internas de aquí
  for (const k of await instantaneas()) {
    try { const r = JSON.parse(await (await idb("readonly", st => st.get(k))).text()); deTablero(r.ls?.[P + "tablero"]); } catch {}
  }
  // b) en la copia con marca: lo de la app de Circuito (su tablero y sus copias internas)
  if (MARCA) {
    deTablero(Almacen.crudo(CLAVE_CIRCUITO + "tablero"));
    const deCircuito = Almacen.archivos(FOTOS_CIRCUITO);
    const claves = await deCircuito("readonly", st => st.getAllKeys()).catch(() => []) || [];
    for (const k of claves.filter(k => String(k).startsWith("instantanea-"))) {
      const b = await deCircuito("readonly", st => st.get(k)).catch(() => null);
      try { deTablero(JSON.parse(await b.text()).ls?.[CLAVE_CIRCUITO + "tablero"]); } catch {}
    }
  }
  // c) fotos y chulos que quedaron sin pieza: la pieza se arma con lo que dice su clave
  const actuales = new Set(datos().items.map(piezaDe));
  const artistas = new Set(datos().items.map(i => i.artistaId));
  const categoriaDe = nombre => Object.values(LLEVA).flat().find(r => sinTildesL(r.pieza) === sinTildesL(nombre))?.categoria;
  for (const k of Object.keys(V.fotos || {})) {
    if (!k.startsWith("pieza|")) continue;
    const partes = k.split("|"), art = partes[1], grupo = partes[2], ref = partes.slice(3, -1).join("|");
    if (!artistas.has(art)) continue;
    const x = {artistaId: art, grupo, referencia: ref, descripcion: ref, cantidad: 1, nota: "Recuperada: tenía fotos guardadas", propietario: {tipo: "propio"}, porConfirmar: false};
    const deGrupo = datos().items.find(i => i.artistaId === art && (i.grupo || "") === grupo);
    x.categoria = categoriaDe(corto(ref)) || deGrupo?.categoria || "Otro";
    if (!actuales.has(piezaDe(x))) de.push(x);
  }
  for (const nombre of leer(P + "chulos2:" + doc.nombre, [])) {
    if (actuales.has(nombre)) continue;
    const [art, grupo, ref] = String(nombre).split("|"); if (!artistas.has(art) || !ref) continue;
    const bonito = ref.charAt(0).toUpperCase() + ref.slice(1);
    const deGrupo = datos().items.find(i => i.artistaId === art && (i.grupo || "") === grupo);
    de.push({artistaId: art, grupo, referencia: bonito, descripcion: bonito, cantidad: 1, categoria: categoriaDe(bonito) || deGrupo?.categoria || "Otro", nota: "Recuperada: tenía chulo", propietario: {tipo: "propio"}, porConfirmar: false});
  }
  // Una sola vez cada pieza; la versión que vino de un documento (con su cantidad y nota) gana.
  const unicas = new Map();
  for (const x of de) if (!unicas.has(piezaDe(x)) && !actuales.has(piezaDe(x))) unicas.set(piezaDe(x), x);
  return [...unicas.values()];
}

/* ═══ src/05-show.js ═══ */
/* ── El show (lo pidió el usuario): las bandas del evento son otro capítulo, aparte de la lista de bodega.
   Vienen en listas/<doc>.show.json y se suman al MISMO documento como bandas nuevas, así nada de lo que
   ya hay (chulos, fotos, notas, piezas agregadas) cambia de clave. Cada pieza tiene su espacio de fotos y
   notas como cualquier otra. ── */
let showSitio = {de: null, bandas: []};
async function cargarShow(nombre){
  if (!nombre || showSitio.de === nombre || !/^[\w.-]+$/.test(nombre)) return showSitio.de === nombre ? showSitio.bandas : [];
  showSitio = {de: nombre, bandas: []};
  try { const r = await fetch(`listas/${nombre}.show.json`, {cache: "no-store"}); if (r.ok) showSitio.bandas = (await r.json()).bandas || []; } catch {}
  return showSitio.bandas;
}
function ponerShow(d, bandas){
  let n = 0;
  const hay = new Set(d.items.map(piezaDe)), diaId = d.items[0]?.diaId || "d-doc";
  for (const b of bandas) {
    if (!d.artistas.some(a => a.id === b.id)) d.artistas = [...d.artistas, {id: b.id, nombre: b.nombre}];
    (b.piezas || []).forEach((p, i) => {
      const x = {id: `show-${b.id}-${i}`, diaId, artistaId: b.id, cantidad: p.cantidad || 1, categoria: p.categoria || "Otro", grupo: p.grupo || "",
        referencia: p.referencia, descripcion: p.referencia, nota: p.nota || b.nota || null, propietario: {tipo: "propio"}, porConfirmar: false};
      if (hay.has(piezaDe(x))) return;
      d.items = [...d.items, x]; hay.add(piezaDe(x)); n++;
    });
  }
  return n;
}
// La etiqueta de capítulo en la portada de cada banda: la lista de bodega o una banda del show.
function capituloDe(b){
  const show = showSitio.bandas.find(x => x.id === b.artistaId);
  if (show) return `<p class="capitulo show">🎤 Show${show.nota ? ` · ${esc(show.nota)}` : ""}</p>`;
  // Lo que no es del show es lo que se alista en bodega («Lista de bodega», «Lo que llevamos»…).
  return showSitio.bandas.length ? `<p class="capitulo">📦 Bodega</p>` : "";
}
/* Dos páginas, como las pestañas de arriba de una red social (lo pidió el usuario): «Alistando» (la lista
   de bodega) y «Bandas» (el show). Solo salen cuando el documento tiene bandas del show. */
const hayShow = () => !festival() && showSitio.bandas.length > 0 && datos().items.some(i => showSitio.bandas.some(b => b.id === i.artistaId));
const pestana = () => leer(P + "pestana", "alistando");
function bandasDePestana(bs){
  if (!hayShow()) return bs;
  const show = new Set(showSitio.bandas.map(b => b.id));
  return bs.filter(b => (pestana() === "bandas") === show.has(b.artistaId));
}
function pintarPestanas(){
  const nav = $b("pestanas"); if (!nav) return;
  const ver = hayShow();
  nav.hidden = !ver;
  document.documentElement.classList.toggle("con-pestanas", ver);
  nav.querySelectorAll("[data-pestana]").forEach(b => b.setAttribute("aria-current", String(b.dataset.pestana === pestana())));
}
function cambiarPestana(p){
  if (p === pestana()) return reels[1]?.scrollIntoView({behavior: "smooth"});
  escribir(P + "pestana", p); pintarPestanas(); pintar(null);
  setTimeout(() => reels[1]?.scrollIntoView(), 60);
}
let showDe = null;
async function asegurarShow(){
  if (!V?.doc || showDe === V.doc.nombre + "|" + V.doc.cuando) return;
  showDe = V.doc.nombre + "|" + V.doc.cuando;
  const bandas = await cargarShow(V.doc.nombre); if (!bandas.length) return;
  const d = {...datos(), items: [...datos().items], artistas: [...datos().artistas]};
  const n = ponerShow(d, bandas);
  if (!n) { if (!document.documentElement.classList.contains("con-pestanas") && hayShow()) { pintarPestanas(); pintar(actual?.id); } return; }
  showDe = null;
  destinoPendiente = actual?.id || null;
  enviar({tipo: V.espacio === "evento" ? "cargar-evento" : "cargar", doc: {...V.doc, datos: d}});
  aviso(`Show: ${bandas.map(b => b.nombre).join(", ")} ${bandas.length === 1 ? "lista" : "listas"} para fotos y notas`);
}
let recuperadoDe = null;
async function recuperarPiezas(){
  if (!V?.doc || recuperadoDe === V.doc.nombre + "|" + V.doc.cuando) return;
  recuperadoDe = V.doc.nombre + "|" + V.doc.cuando;
  const faltan = await piezasRecuperables(); if (!faltan.length) return;
  for (const x of faltan) guardarAgregado(x);
  const d = {...datos(), items: [...datos().items]};
  const n = ponerAgregados(d, faltan); if (!n) return;
  recuperadoDe = null;   // el documento cambia: se revisa otra vez y ya no falta nada
  destinoPendiente = actual?.id || null;
  enviar({tipo: V.espacio === "evento" ? "cargar-evento" : "cargar", doc: {...V.doc, datos: d}});
  aviso(`Recuperé ${n} ${n === 1 ? "pieza" : "piezas"} con sus fotos y chulos: ${faltan.map(x => corto(x.referencia)).join(", ")}`);
}

/* La historia de fotos de una sección (lo pidió el usuario): cada pieza con su foto en bodega y en evento. */
function htmlHistoriaFotos(titulo, items){
  const con = m => items.filter(x => fotosPieza(x, m).length).length;
  // Cada momento en un renglón: qué es, si ya tiene foto, las miniaturas (se abren en grande) y los botones.
  const momento = (x, m, t) => {
    const k = clavePieza(x, m), fotos = fotosPieza(x, m), nombre = t === "En bodega" ? "Bodega" : "Evento";
    return `<div class="mom">
      <div class="mom-cab"><span class="mom-nombre">${nombre}</span><span class="mom-estado ${fotos.length ? "si" : "no"}">${fotos.length ? `✓ ${fotos.length} ${fotos.length === 1 ? "foto" : "fotos"}` : "Sin foto"}</span></div>
      <div class="mom-fila">
        ${fotos.map(f => `<img class="mini" data-foto="${esc(f)}" data-banda="${esc(fotoAClave.get(f) || k)}" alt="Foto de ${esc(nombre.toLowerCase())}">`).join("")}
        <button class="mom-btn" data-acc="tomar-foto" data-banda="${esc(k)}"><span>📷</span>Tomar</button>
        <button class="mom-btn" data-acc="subir-foto" data-banda="${esc(k)}"><span>🖼</span>Galería</button>
      </div></div>`;
  };
  // Primero las piezas que ya tienen fotos: es lo que se quiere ver.
  items = [...items].sort((a, b) => (MOMENTOS.some(([m]) => fotosPieza(b, m).length) ? 1 : 0) - (MOMENTOS.some(([m]) => fotosPieza(a, m).length) ? 1 : 0));
  return `
      <section class="slide banda historia-fotos">
        <h3>Fotos</h3>
        <div class="ayuda-fotos"><p><b>Bodega</b> = cuando se alista y se empaca.</p><p><b>Evento</b> = cuando ya está montado en tarima.</p><p>Toca una foto para verla grande.</p></div>
        <div class="fotos-conteo"><span class="${con("bodega") ? "si" : ""}">Bodega <b>${con("bodega")}/${items.length}</b></span><span class="${con("evento") ? "si" : ""}">Evento <b>${con("evento")}/${items.length}</b></span></div>
        ${items.map(x => `
        <div class="pieza-fotos">
          <p class="nombre"><b>${x.cantidad} ×</b> ${esc(corto(x.referencia))}</p>
          ${MOMENTOS.map(([m, t]) => momento(x, m, t)).join("")}
        </div>`).join("")}
      </section>`;
}

/* ═══ src/06-notas-y-fotos-de-piezas.js ═══ */
/* ── Notas de última hora (lo pidió el usuario: "el sábado dejar una nota… grabar un audio, tomar una foto").
   Una historia por sección. Texto, audio y foto quedan en el celular (el audio y la foto en IndexedDB, con
   clave nota-audio-… / nota-foto-…, así entran al respaldo); la lista en lab-reels:notas:<doc>. Quitar una
   nota no la borra: queda marcada y se recupera desde Filtros. Lo que se va escribiendo se guarda solo. ── */
const claveNotas = () => P + "notas:" + (V?.doc?.nombre || "");
const seccionDeItems = items => `${items[0]?.artistaId || "sin-banda"}|${items[0]?.grupo || ""}`;
const claveBorrador = sec => P + "nota-borrador:" + (V?.doc?.nombre || "") + "|" + sec;
const todasNotas = () => leer(claveNotas(), []);
const notasDe = sec => todasNotas().filter(n => n.seccion === sec && !n.quitada).sort((a, b) => b.cuando.localeCompare(a.cuando));
function cuandoNota(iso){
  const f = new Date(iso);
  return `${f.toLocaleDateString("es", {weekday: "short", day: "numeric", month: "short"})} · ${f.toLocaleTimeString("es", {hour: "numeric", minute: "2-digit"})}`;
}
function htmlHistoriaNotas(titulo, items){
  const sec = seccionDeItems(items), notas = notasDe(sec), b = leer(claveBorrador(sec), {texto: "", audio: null, foto: null, dur: 0});
  return `
      <section class="slide banda historia-notas" data-seccion="${esc(sec)}">
        <h3>Notas</h3>
        <p class="ayuda-fotos"><b>Lo de última hora</b> de ${esc(titulo)}: escribe, graba un audio o toma una foto. Queda con fecha y hora.</p>
        <div class="nota-nueva">
          <textarea data-nota-texto="${esc(sec)}" rows="3" placeholder="Ej.: el bajista pidió otra base">${esc(b.texto || "")}</textarea>
          ${b.audio || b.foto ? `<div class="nota-adjuntos">${b.audio ? `<span class="adj">🎙 Audio ${b.dur ? `(${b.dur} s)` : ""} listo</span>` : ""}${b.foto ? `<span class="adj">📷 Foto lista</span>` : ""}</div>` : ""}
          <div class="nota-botones">
            <button data-nota="grabar" data-sec="${esc(sec)}">🎙 Grabar audio</button>
            <button data-nota="foto" data-sec="${esc(sec)}">📷 Foto</button>
            <button data-nota="guardar" data-sec="${esc(sec)}" class="principal">Guardar nota</button>
          </div>
        </div>
        ${notas.length ? notas.map(n => `
        <article class="nota">
          <p class="n-cuando">${esc(cuandoNota(n.cuando))}</p>
          ${n.texto ? `<p class="n-texto">${esc(n.texto)}</p>` : ""}
          ${n.audio ? `<audio controls preload="metadata" data-nota-media="${esc(n.audio)}"></audio>` : ""}
          ${n.foto ? `<img class="n-foto" data-nota-media="${esc(n.foto)}" data-foto-nota alt="Foto de la nota">` : ""}
          <button class="n-quitar" data-nota-quitar="${esc(n.id)}">Quitar</button>
        </article>`).join("") : `<p class="sub">Todavía no hay notas en esta sección.</p>`}
      </section>`;
}
const urlsNotas = new Map();
async function cargarMediaNotas(raiz = feed){
  for (const el of raiz.querySelectorAll("[data-nota-media]")) {
    const k = el.dataset.notaMedia;
    if (!urlsNotas.has(k)) { const b = await idb("readonly", st => st.get(k)).catch(() => null); if (b) urlsNotas.set(k, URL.createObjectURL(b)); }
    if (urlsNotas.has(k)) el.src = urlsNotas.get(k);
  }
}
// Volver a dibujar sin moverse de donde está el usuario (mismo reel, misma historia, mismo punto).
function repintarQuieto(){
  const id = actual?.id, sl = id && document.querySelector(`#${CSS.escape(id)} .slides`);
  const lado = sl?.scrollLeft || 0, i = sl ? Math.round(lado / (sl.clientWidth || 1)) : 0, arriba = sl?.children[i]?.scrollTop || 0;
  pintar(id);
  requestAnimationFrame(() => { const s2 = id && document.querySelector(`#${CSS.escape(id)} .slides`); if (!s2) return; s2.scrollTo({left: lado, behavior: "instant"}); if (s2.children[i]) s2.children[i].scrollTop = arriba; });
}
let grabando = null;
async function grabarAudio(btn, sec){
  if (grabando) { grabando.rec.stop(); return; }
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return aviso("Este navegador no deja grabar audio");
  let stream; try { stream = await navigator.mediaDevices.getUserMedia({audio: true}); } catch { return aviso("Sin permiso para el micrófono"); }
  const rec = new MediaRecorder(stream), partes = [], t0 = Date.now();
  rec.ondataavailable = e => { if (e.data.size) partes.push(e.data); };
  rec.onstop = async () => {
    stream.getTracks().forEach(t => t.stop()); clearInterval(grabando?.reloj); grabando = null;
    const blob = new Blob(partes, {type: rec.mimeType || "audio/mp4"}), k = "nota-audio-" + Date.now().toString(36);
    try { await idb("readwrite", st => st.put(blob, k)); } catch { return aviso("No se pudo guardar el audio"); }
    const b = leer(claveBorrador(sec), {}); escribir(claveBorrador(sec), {...b, audio: k, dur: Math.round((Date.now() - t0) / 1000)});
    aviso("Audio listo: toca «Guardar nota»"); repintarQuieto();
  };
  rec.start();
  btn.classList.add("grabando");
  grabando = {rec, reloj: setInterval(() => { btn.textContent = `⏹ Detener · ${Math.round((Date.now() - t0) / 1000)} s`; }, 300)};
}
let notaFotoDe = null;

async function guardarNota(sec){
  const b = leer(claveBorrador(sec), {}), texto = (document.querySelector(`[data-nota-texto="${CSS.escape(sec)}"]`)?.value || b.texto || "").trim();
  if (!texto && !b.audio && !b.foto) return aviso("Escribe algo, graba un audio o toma una foto");
  escribir(claveNotas(), [...todasNotas(), {id: "n-" + Date.now().toString(36), seccion: sec, texto, audio: b.audio || null, foto: b.foto || null, cuando: new Date().toISOString()}]);
  Almacen.quitar(claveBorrador(sec));
  huboCambio(); aviso("Nota guardada"); repintarQuieto();
}

function htmlFotosPieza(x){
  return `<p class="et">Fotos</p>` + MOMENTOS.map(([m, t]) => {
    const k = clavePieza(x, m), fotos = fotosPieza(x, m);
    return `
    <div class="fotos-pieza">
      <p class="momento">${t}${fotos.length ? ` · ${fotos.length} ${fotos.length === 1 ? "foto" : "fotos"}` : ""}</p>
      <div class="fila-fotos">${fotos.map(f => `<img data-foto="${esc(f)}" data-banda="${esc(fotoAClave.get(f) || k)}" alt="Foto ${esc(t.toLowerCase())}">`).join("")}</div>
      <div class="botones-foto"><button data-acc="tomar-foto" data-banda="${esc(k)}">📷 Tomar foto</button><button data-acc="subir-foto" data-banda="${esc(k)}">🖼 Subir</button></div>
    </div>`;
  }).join("");
}

/* El holograma que le toca a un grupo de ítems: el del equipo principal que haya (batería antes que
   platillos, ampli antes que bases…). Sin modelo 3D queda el emoji. */
const holoItems = new Map();
function htmlHolo(clave, items){
  let cat = PRIORIDAD.find(c => items.some(x => x.categoria === c)) || "";
  // Un ítem que es solo el cabezal se dibuja como cabezal, no como caja: dice "head"/"cabezal", o es un
  // ampli de bajo sin ninguna palabra de caja (las cajas dicen 8x10, cabinet, caja, cabina…).
  const CAJA = /(\d ?x ?\d{2}|\b\d{3}e?\b|cab\b|cabinet|caja|cabina|enclosure|bafle|combo)/i;
  if (items.length === 1 && /^Ampli/.test(cat) && (/(head|cabezal)/i.test(items[0].referencia) || (cat === "Ampli bajo" && !CAJA.test(items[0].referencia)))) cat = "Cabezal";
  holoItems.set(clave, items.filter(x => (POR_HOLO[cat] || [cat]).includes(x.categoria)));
  return `<div class="holo" data-cat="${esc(cat)}" data-holo="${esc(clave)}"><div class="emoji" aria-hidden="true">${EMOJI[cat] || (cat === "Cabezal" ? "🔊" : "🎤")}</div></div>`;
}
const POR_HOLO = {"Batería": ["Batería", "Platillos"]};
const sinTildes = t => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
// "3.1.-DRUMS: DW, YAMAHA" → "drums", como queda el grupo de los ítems ("Drums").
const nombreDeGrupo = t => sinTildes(String(t).replace(/^\d{1,2}\s*\.\s*(?:\d{1,2}\s*\.?)?\s*[-–]?\s*/, "").split(":")[0].replace(/[\s:·|–—-]+$/, ""));

/* Modo normal, al estilo reels (lo pidió el usuario): hacia abajo se pasa de sección en sección. Primero
   la portada de la banda (holograma y el listado ahí mismo, compacto y entrando uno a uno) con sus
   fotos al lado; después una pantalla por sección del rider con, a los lados, solo su información,
   lo que está en el listado y lo que pidió la banda. */
// A la derecha de cada reel solo va «›» (lo decidió el usuario): sin Listo ni Subir.
const riel = () => "";
const pasar = `
    <button class="pasar ant" aria-label="Anterior" disabled>‹</button>
    <button class="pasar sig" aria-label="Siguiente">›</button>`;
// En los listados compactos va el equipo; las opciones entre paréntesis quedan para el detalle.

const piezasDe = items => items.reduce((s, x) => s + x.cantidad, 0);
const conSeccionesDe = b => b.secciones.filter(s => s.items.length);
const idSeccion = (b, j) => `${idBanda(b)}-s${j + 1}`;

/* «Todo el equipo» (solo admin): cada sección con sus piezas y en qué va cada una: ✓ lista, foto en bodega,
   foto en evento, y lo que le falta. Tocar una pieza le pone o quita el chulo; tocar la sección va a ella. */
function htmlResumen(bs){
  const todas = bs.flatMap(b => b.items);
  const con = m => todas.filter(x => fotosPieza(x, m).length).length;
  const listas = todas.filter(x => chulos.has(x.id)).length;
  const faltan = bs.flatMap(b => conSeccionesDe(b).flatMap(s => faltantes(s.items))).length;
  const n = (v, t, cls = "") => `<div class="kpi ${cls}"><b>${v}</b><span>${t}</span></div>`;
  const celda = (x, m) => { const k = fotosPieza(x, m).length; return `<span class="c-foto${k ? " si" : ""}">${k ? "📷" + (k > 1 ? k : "") : "·"}</span>`; };
  const fila = x => `<li data-item="${esc(x.id)}" class="${chulos.has(x.id) ? "hecho" : ""}"><span class="q">${x.cantidad}</span><span class="t">${esc(corto(x.referencia))}${x.propietario?.tipo === "tercero" ? `<small>${esc(x.propietario.nombre)}</small>` : ""}</span><span class="c-ok"></span>${celda(x, "bodega")}${celda(x, "evento")}</li>`;
  return `
  <article class="reel" id="resumen" style="--h:30" data-n="1" aria-label="Todo el equipo">
    <div class="prog"><i></i></div>
    <div class="cab"><b>Todo el equipo</b><span class="n">${hayShow() ? (pestana() === "bandas" ? "🎤 Bandas" : "📦 Alistando") : "Administrador"}</span></div>
    <div class="slides">
      <section class="slide banda resumen">
        <h3>Todo el equipo</h3>
        <p class="sub">${esc(V.doc?.nombre || "")} · ${esc(cuandoSeSubio(V.doc?.cuando || "") || "")}</p>
        <div class="kpis">${n(piezasDe(todas), "piezas")}${n(listas, "✓ listas", "ok")}${n(con("bodega"), "📷 en bodega")}${n(con("evento"), "📷 en evento")}${n(faltan, "⚠ por revisar", faltan ? "warn" : "")}${n(todasNotas().filter(x => !x.quitada).length, "📝 notas")}</div>
        ${bs.map(b => conSeccionesDe(b).map((s, j) => `
        <button class="r-seccion" data-acc="ir-seccion" data-id="${esc(idSeccion(b, j))}">${esc(s.grupo || "Sin sección")}${bs.length > 1 ? ` · ${esc(b.nombre)}` : ""} <span>›</span></button>
        <div class="excel"><div class="cab-xl r-cab"><span>Cant</span><span>Equipo</span><span>✓</span><span>Bod.</span><span>Ev.</span></div>
          <ul class="lista">${s.items.map(fila).join("")}</ul></div>
        ${faltantes(s.items).length ? `<p class="falta-aviso">⚠ Le falta: <b>${faltantes(s.items).map(r => esc(r.pieza)).join("</b>, <b>")}</b></p>` : ""}`).join("")).join("")}
      </section>
    </div>
    ${riel("resumen")}
  </article>`;
}

/* Las pantallas de una banda en modo normal, para el feed y el índice. */
function pantallasBanda(b){
  const secs = conSeccionesDe(b), piezas = piezasDe(b.items);
  return [
    {id: idBanda(b), e: b.artistaId ? "🎤" : "📋", nombre: b.nombre, x: `${piezas} ${piezas === 1 ? "pieza" : "piezas"}`, html: () => htmlBanda(b)},
    ...secs.map((s, j) => {
      const p = piezasDe(s.items);
      return {id: idSeccion(b, j), e: EMOJI[PRIORIDAD.find(c => s.items.some(x => x.categoria === c))] || "·", nombre: `${s.grupo || "Sin sección"}`, sub: true, x: `${p} ${p === 1 ? "pieza" : "piezas"}`, html: () => htmlSeccion(b, s, j, secs.length)};
    }),
  ];
}

function htmlBanda(b){
  const piezas = piezasDe(b.items), dudosos = b.items.filter(x => x.porConfirmar).length, id = idBanda(b);
  const secs = conSeccionesDe(b);
  let k = 0;
  const vivo = b.secciones.map(s => `
        ${b.secciones.length > 1 || s.grupo ? `<li class="tit" style="--i:${k++}">${esc(s.grupo || "Sin sección")}</li>` : ""}
        ${s.items.map(x => `<li style="--i:${k++}" data-item="${esc(x.id)}" class="${x.porConfirmar ? "dudoso" : ""}${chulos.has(x.id) ? " hecho" : ""}"><b>${x.cantidad}</b> ${esc(corto(x.referencia))}</li>`).join("")}`).join("");
  return `
  <article class="reel" id="${esc(id)}" style="--h:20" data-n="2" aria-label="${esc(b.nombre)}">
    <div class="prog"><i></i><i></i></div>
    <div class="cab"><b>${esc(b.nombre)}</b></div>
    <div class="slides">
      <section class="slide portada portada-banda">
        ${htmlHolo(`${id}|todo`, b.items)}
        ${htmlOrigen()}
        ${capituloDe(b)}
        <h2${b.nombre.length > 18 ? ' class="largo"' : ""}>${esc(b.nombre)}</h2>
        ${dudosos ? `<p class="sub" style="margin:4px 0 8px"><span class="chip warn">${dudosos} por confirmar</span></p>` : ""}
        ${secs.length > 1 ? `<nav class="ir-secciones" aria-label="Secciones">${secs.map((s, j) => `<button data-acc="ir-seccion" data-id="${esc(idSeccion(b, j))}"><span aria-hidden="true">${EMOJI[PRIORIDAD.find(c => s.items.some(x => x.categoria === c))] || "·"}</span>${esc(s.grupo || "Sin sección")}${faltantes(s.items).length ? ` <b class="ojo">⚠ ${faltantes(s.items).length}</b>` : ""}</button>`).join("")}</nav>` : ""}
        <ul class="vivo">${vivo}</ul>
        ${AYUDA && secs.length ? `<p class="pista">${PC ? "Baja con ↓ para ir sección por sección" : "Desliza hacia arriba para ir sección por sección"}</p>` : ""}
      </section>
      <section class="slide banda">
        <h3>Fotos</h3>
        ${V.puede.planilla && b.items.length ? `<p class="sub"><button class="ir-planilla" style="margin:0" data-acc="planilla" data-banda="${esc(b.id)}">Planilla .xlsx</button></p>` : ""}
        ${htmlFotos(b)}
      </section>
    </div>
    ${pasar}
    ${riel(id)}
  </article>`;
}

/* Una sección del rider es una pantalla del reel (hacia abajo). A los lados, solo tres: la
   información (holograma, opciones de marca, resumen), lo que está en el listado y lo que pidió la
   banda (lo pidió el usuario). */
function htmlSeccion(b, s, j, total){
  const id = idSeccion(b, j), titulo = s.grupo || "Sin sección";
  const pide = pedidoDeSeccion(b, s);
  const op = pide.find(r => r.tipo === "grupo" && r.opciones)?.opciones;
  const piezas = piezasDe(s.items), dudosos = s.items.filter(x => x.porConfirmar).length;
  const trae = s.items.filter(x => x.propietario?.nombre === "la banda").length;
  const otros = [...new Set(s.items.filter(x => x.propietario?.tipo === "tercero" && x.propietario.nombre !== "la banda").map(x => x.propietario.nombre))];
  const cats = [...new Set(s.items.map(x => x.categoria))];
  return `
  <article class="reel" id="${esc(id)}" style="--h:${HUE[PRIORIDAD.find(c => s.items.some(x => x.categoria === c))] ?? 20}" data-n="5" aria-label="${esc(titulo)} · ${esc(b.nombre)}">
    <div class="prog"><i></i><i></i><i></i><i></i><i></i></div>
    <div class="cab"><b>${esc(titulo)}</b><span class="n">${esc(b.nombre)} · ${j + 1}/${total}</span></div>
    <div class="slides">
      <section class="slide portada seccion-portada">
        ${htmlHolo(`${id}|todo`, s.items)}
        <h2${titulo.length > 18 ? ' class="largo"' : ""}>${esc(titulo)}</h2>
        ${op ? `<p class="opciones">Opciones de la banda: <b>${op.map(esc).join("</b>, <b>")}</b>. Es una sola, de cualquiera de esas marcas.</p>` : ""}
        ${htmlFaltan(s.items, false)}
        <p class="chips-pieza">${cats.map(c => `<span class="chip">${esc(c)}</span>`).join("")}${trae ? `<span class="chip ter">${trae} lo trae la banda</span>` : ""}${otros.map(n => `<span class="chip ter">Proveedor: ${esc(n)}</span>`).join("")}${dudosos ? `<span class="chip warn">${dudosos} por confirmar</span>` : ""}</p>
        ${AYUDA ? `<p class="pista">${PC ? "Pasa con › para ver el listado, lo que pidió la banda, las fotos y las notas" : "Desliza para ver el listado, lo que pidió la banda, las fotos y las notas"} <span class="flecha">→</span></p>` : ""}
      </section>
      <section class="slide banda">
        <h3>En el listado</h3>
        <p class="sub">${esc(titulo)} · toca una pieza para marcarla ✓ · › para ver más</p>
        <div class="excel"><div class="cab-xl"><span>Cant</span><span>Requerimiento</span></div>${htmlFicha({secciones: [{grupo: "", items: s.items}], items: s.items}, null)}</div>
        ${htmlFaltan(s.items, true)}
      </section>
      <section class="slide banda">
        <h3>Lo que pidió la banda</h3>
        ${pide.length ? htmlPedido(pide) : `<p class="sub">No está el texto del rider de esta sección. Vuelve a subir el documento para verlo.</p>`}
      </section>
      ${htmlHistoriaFotos(titulo, s.items)}
      ${htmlHistoriaNotas(titulo, s.items)}
    </div>
    ${pasar}
    ${riel(id)}
  </article>`;
}
const idBanda = b => "banda-" + slug(b.id);

/* Lo que pidió la banda, como viene en el rider: cada renglón con lo que quedó de él en el listado,
   las opciones de marca y lo que no va (tachado, con el motivo). */
function htmlPedido(renglones){
  const enListado = new Map(datos().items.map(x => [x.id, x]));
  const fila = r => {
    if (r.tipo === "grupo") return `<h4 class="seccion">${esc(r.texto)}</h4>${r.opciones ? `<p class="opciones">Opciones de la banda: <b>${r.opciones.map(esc).join("</b>, <b>")}</b>. Es una sola, de cualquiera de esas marcas.</p>` : ""}`;
    if (r.tipo === "item") {
      const x = enListado.get(r.itemId);
      return `<li class="pide"${x ? ` data-item="${esc(x.id)}"` : ""}><span class="t">${esc(r.texto)}</span><span class="va${x ? "" : " no"}">${x ? `→ ${x.cantidad} × ${esc(x.referencia)}` : "→ quitado del listado"}</span></li>`;
    }
    if (r.tipo === "fuera") return `<li class="pide fuera"><span class="t">${esc(r.texto)}</span><span class="va no">no va: ${esc(r.motivo || "no es backline")}</span></li>`;
    if (r.tipo === "alternativa") return `<li class="pide nota"><span class="t">${esc(r.texto)}</span><span class="va no">alternativa, no suma</span></li>`;
    return `<li class="pide nota"><span class="t">${esc(r.texto)}</span></li>`;
  };
  // Las secciones del rider abren y cierran su propia lista.
  let html = "", abierta = false;
  for (const r of renglones) {
    if (r.tipo === "grupo") { if (abierta) html += "</ul>"; abierta = false; html += fila(r); continue; }
    if (!abierta) { html += '<ul class="lista">'; abierta = true; }
    html += fila(r);
  }
  if (abierta) html += "</ul>";
  const n = renglones.filter(r => r.tipo === "item").length, quedaron = renglones.filter(r => r.tipo === "item" && enListado.has(r.itemId)).length;
  return `<p class="resumen-pide">Así viene en el rider. ${n} ${n === 1 ? "renglón pide equipo" : "renglones piden equipo"}; ${quedaron} ${quedaron === 1 ? "quedó" : "quedaron"} en el listado.</p>
        <div class="rider">${html}</div>`;
}

/* Los renglones del rider que son de una sección: el bloque que empieza en su título, o el que tiene
   sus ítems. Lo de antes del primer título ("3. BACKLINE") no es de ninguna. */
function pedidoDeSeccion(b, s){
  const pedido = b.artistaId && (datos().pedidos || []).find(p => p.artistaId === b.artistaId);
  if (!pedido?.renglones?.length) return [];
  const ids = new Set(s.items.map(x => x.id)), bloques = [];
  for (const r of pedido.renglones) {
    if (r.tipo === "grupo") bloques.push([r]);
    else if (bloques.length) bloques.at(-1).push(r);
  }
  return bloques.filter(bl => nombreDeGrupo(bl[0].texto) === sinTildes(s.grupo) || bl.some(r => ids.has(r.itemId))).flat();
}

/* De qué documento sale lo que se ve y cuándo se subió en este celular, para que no aparezca
   una banda sin saber de dónde. */
function cuandoSeSubio(iso){
  const f = new Date(iso); if (isNaN(f)) return "";
  const hora = f.toLocaleTimeString("es", {hour: "numeric", minute: "2-digit"});
  const dias = Math.round((new Date().setHours(0,0,0,0) - new Date(f).setHours(0,0,0,0)) / 864e5);
  const fecha = f.toLocaleDateString("es", {day: "numeric", month: "short"});
  return dias === 0 ? `hoy, ${fecha} · ${hora}` : dias === 1 ? `ayer ${hora}` : `${f.toLocaleDateString("es", {day: "numeric", month: "short"})} ${hora}`;
}
function htmlOrigen(){
  if (!V?.doc) return "";
  const c = cuandoSeSubio(V.doc.cuando);
  return `<p class="origen">Del documento <b>${esc(V.doc.nombre)}</b>${c ? ` · subido ${esc(c)}` : ""}</p>`;
}

function htmlNada(){
  const t = V.filtro.texto.trim();
  return `
  <article class="reel vacio-busqueda" id="nada" data-n="1" aria-label="Sin resultados" style="--h:0">
    <div class="slides"><section class="slide">
      <div class="encontre" aria-hidden="true"><strong>0</strong></div>
      <h2 style="font-family:var(--display);text-transform:uppercase;margin:0">No encontré ${t ? `«${esc(t)}»` : "nada con esos filtros"}</h2>
      <p class="sub">Busca con otra palabra o quita los filtros.</p>
      <div class="botones"><button class="btn" data-acc="limpiar">Quitar filtros</button></div>
    </section></div>
  </article>`;
}

function contar(el){
  if (!el || !el.dataset.to) return;
  // Números chicos (1 banda, 2 bandas) van directo: la cuenta animada a veces se quedaba en 0.
  const to = +el.dataset.to; el.textContent = to; if (QUIETO || to < 10) return;
  const t0 = performance.now();
  const paso = t => { const k = Math.min(1, Math.max(0, (t - t0) / 700)); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(paso); };
  requestAnimationFrame(paso);
}

/* Holograma 3D de la rama de reconocimiento-3d en la portada. Si no hay WebGL se queda el emoji. */
let holo3d = null;
const holo3dListo = import("./holograma.js?v=4").then(m => holo3d = m).catch(() => null);
function holograma(r){
  holo3dListo.then(() => {
    // El de la pantalla que se ve: la portada o la sección a la que se deslizó.
    const s = r.querySelector(".slides"), slides = s ? [...s.children] : [];
    const visible = slides[s ? Math.round(s.scrollLeft / Math.max(1, s.clientWidth)) : 0];
    const h = visible?.querySelector(".holo"), tipo = h && holo3d?.MODELO[h.dataset.cat];
    if (!tipo) { holo3d?.pausar(); return; }
    try {
      if (!holo3d.mostrar(h, tipo, holoItems.get(h.dataset.holo) ?? cats.find(c => c.id === r.id)?.items, h.dataset.cat)) return;
      document.querySelectorAll(".holo.con3d").forEach(x => x !== h && x.classList.remove("con3d"));
      h.classList.add("con3d");
    } catch { holo3d = null; }
  });
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) holo3d?.pausar();
  else if (actual) holograma(actual);
});

/* ═══ src/07-feed.js ═══ */
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

/* ═══ src/08-barra.js ═══ */
/* ── Barra de arriba: perfil, buscador y filtros ── */
const $b = id => document.getElementById(id);
function pintarBarra(){
  if (!V) return;
  pintarPestanas();
  const p = $b("perfil"), admin = V.perfil === "admin";
  p.textContent = admin ? "Admin" : "Empleado";
  p.classList.toggle("admin", admin);
  p.setAttribute("aria-label", `Perfil: ${p.textContent}. Toca para cambiar`);
  if (document.activeElement !== $b("buscar")) $b("buscar").value = V.filtro.texto;
  const n = (V.filtro.banda ? 1 : 0) + (V.filtro.categoria ? 1 : 0);
  const f = $b("filtrar");
  f.innerHTML = `Filtros${n ? ` · ${n}` : ""}${festival() ? '<span class="fest">Festival</span>' : ""}`;
  f.classList.toggle("on", n > 0);
  // Evento: lo oficial, sincronizado con el cronograma (el empleado lo ve pero no lo cambia).
  // Pruebas: el escritorio propio, donde cualquiera sube y prueba sin dañar el evento.
  const e = $b("espacio"), enEvento = V.espacio === "evento";
  e.hidden = !V.hay?.evento && !enEvento;
  e.classList.toggle("pruebas", !enEvento);
  e.innerHTML = enEvento ? `${V.puede.editar ? "" : "🔒 "}Evento` : "Mis pruebas";
  e.title = enEvento ? (V.puede.editar ? "Backline del evento. Toca para ir a Mis pruebas" : "Backline del evento: lo armó el admin y no se puede cambiar. Toca para ir a Mis pruebas")
    : "Tu escritorio: sube y prueba sin dañar el evento. Toca para volver al evento";
}
$b("espacio").addEventListener("click", () => {
  // Al cambiar de espacio se va a la primera banda de ese espacio (o a subir, si no hay nada).
  subida.estado = "inicio"; subida.archivos = []; destinoPendiente = "subir";
  enviar({tipo: "espacio", espacio: V.espacio === "evento" ? "pruebas" : "evento"});
  setTimeout(() => { if (V.doc && reels[1]) reels[1].scrollIntoView(); }, 80);
});
$b("perfil").addEventListener("click", () => {
  enviar({tipo: "perfil", perfil: V.perfil === "admin" ? "empleado" : "admin"});
  aviso(V.perfil === "admin" ? "Ahora eres admin" : "Ahora eres empleado");
});
let tecleo = null;
$b("buscar").addEventListener("input", e => {
  clearTimeout(tecleo);
  // Sin esperar a que termine de escribir no se redibuja en cada letra.
  tecleo = setTimeout(() => { destinoPendiente = reels[1] ? "subir" : null; enviar({tipo: "buscar", texto: e.target.value}); if (reels[1]) reels[1].scrollIntoView(); }, 250);
});
$b("buscar").addEventListener("keydown", e => { if (e.key === "Enter") { e.target.blur(); setTimeout(() => reels[1]?.scrollIntoView({behavior: "smooth"}), 300); } });
$b("filtrar").addEventListener("click", () => { pintarFiltros(); $b("filtros").hidden = false; });

function pintarFiltros(){
  const o = V.opciones, f = V.filtro;
  const chip = (attr, v, txt, on) => `<button data-${attr}="${esc(v ?? "")}" aria-pressed="${on}">${txt}</button>`;
  $b("panel-filtros").innerHTML = `
    <h4>Filtros</h4>
    ${V.puede.festival ? `
      <p class="et">Vista</p>
      <div class="seg" role="group" aria-label="Vista">${chip("modo", "normal", "Normal", V.modo === "normal")}${chip("modo", "festival", "Festival", V.modo === "festival")}</div>
      <p class="nota">Normal: cada banda con su backline como viene en el rider. Festival: varias bandas, un reel por categoría, conteo por día y totales de fondo.</p>` : ""}
    ${o.bandas.length > 1 ? `<p class="et">Banda</p><div class="chips">${chip("banda", "", "Todas", !f.banda)}${o.bandas.map(b => chip("banda", b.id, `${esc(b.nombre)} · ${b.n}`, f.banda === b.id)).join("")}</div>` : ""}
    ${o.categorias.length ? `<p class="et">Categoría</p><div class="chips">${chip("categoria", "", "Todas", !f.categoria)}${o.categorias.map(c => chip("categoria", c.nombre, `${esc(c.nombre)} · ${c.n}`, f.categoria === c.nombre)).join("")}</div>` : `<p class="nota">Sube un documento para filtrar por banda y categoría.</p>`}
    <p class="et">Respaldo</p>
    <p class="nota">Los chulos y las fotos quedan en este celular. Guarda un respaldo y mándalo por WhatsApp o guárdalo en Drive; con «Cargar respaldo» se recupera todo.</p>
    <div class="botones"><button class="btn sec" data-respaldo="guardar">💾 Guardar respaldo</button><button class="btn sec" data-respaldo="cargar">📂 Cargar respaldo</button></div>
    ${leer(P + "ultimo-respaldo", "") ? `<p class="nota">Último respaldo: ${esc(cuandoSeSubio(leer(P + "ultimo-respaldo", "")) || "")}.</p>` : `<p class="nota"><b>Todavía no has guardado ningún respaldo.</b></p>`}
    ${leer(P + "papelera", []).length ? `<div class="botones"><button class="btn sec" data-respaldo="papelera">♻️ Recuperar ${leer(P + "papelera", []).length} ${leer(P + "papelera", []).length === 1 ? "foto quitada" : "fotos quitadas"}</button></div>` : ""}
    ${Almacen.claves().filter(k => k.startsWith(P + "notas:")).flatMap(k => leer(k, [])).some(n => n.quitada) ? `<div class="botones"><button class="btn sec" data-respaldo="notas">♻️ Recuperar notas quitadas</button></div>` : ""}
    <div class="botones"><button class="btn sec" data-respaldo="instantanea">🕘 Volver a una copia interna</button></div>
    ${MARCA ? `<div class="botones"><button class="btn sec" data-respaldo="circuito">📥 Traer fotos y chulos de la app de Circuito</button></div>` : ""}
    <div class="botones"><button class="btn" data-cerrar>Ver ${V.encontrados} ${V.encontrados === 1 ? "ítem" : "ítems"}</button>${V.hayFiltro ? '<button class="btn sec" data-limpiar>Quitar filtros</button>' : ""}</div>`;
}
$b("filtros").addEventListener("click", e => {
  const t = e.target.closest("button");
  if (!t) { if (e.target === e.currentTarget) e.currentTarget.hidden = true; return; }
  if (t.dataset.respaldo === "guardar") return guardarRespaldo();
  if (t.dataset.respaldo === "cargar") return $b("respaldo-archivo").click();
  if (t.dataset.respaldo === "papelera") {
    for (const {foto, banda} of leer(P + "papelera", [])) enviar({tipo: "foto", banda, foto});
    escribir(P + "papelera", []); huboCambio();
    e.currentTarget.hidden = true; return aviso("Fotos recuperadas");
  }
  if (t.dataset.respaldo === "instantanea") return elegirInstantanea();
  if (t.dataset.respaldo === "notas") {
    for (const k of Almacen.claves().filter(k => k.startsWith(P + "notas:"))) escribir(k, leer(k, []).map(({quitada, ...n}) => n));
    e.currentTarget.hidden = true; huboCambio(); aviso("Notas recuperadas"); return repintarQuieto();
  }
  if (t.dataset.respaldo === "circuito") { e.currentTarget.hidden = true; return traerDeCircuito().then(f => aviso(f ? `Traje ${f} ${f === 1 ? "foto" : "fotos"} y los chulos` : "Ya estaba todo: chulos al día")); }
  destinoPendiente = "subir";
  if (t.dataset.modo !== undefined) return enviar({tipo: "modo", modo: t.dataset.modo});
  if (t.dataset.banda !== undefined) return enviar({tipo: "banda", banda: t.dataset.banda || null});
  if (t.dataset.categoria !== undefined) return enviar({tipo: "categoria", categoria: t.dataset.categoria || null});
  if (t.hasAttribute("data-limpiar")) { $b("buscar").value = ""; return enviar({tipo: "limpiar"}); }
  if (t.hasAttribute("data-cerrar")) { e.currentTarget.hidden = true; reels[1]?.scrollIntoView({behavior: "smooth"}); }
});

/* ═══ src/09-fotos-de-bandas.js ═══ */
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

/* ═══ src/10-respaldo-y-evento-de-hoy.js ═══ */
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

/* ═══ src/11-editar.js ═══ */
/* ── Editar un ítem (solo el admin; el núcleo no acepta la edición de un empleado) ── */
const editor = $b("editor"), form = editor.querySelector("form");
let editando = null;
/* Todo se puede tocar (lo pidió el usuario: "todo se relaciona con todo"): una pieza abre una hoja que
   sube desde abajo con su información, el renglón del rider de donde salió, lo demás de su sección y
   lo mismo en otras bandas; desde ahí se salta a cualquiera de esas piezas. El admin la edita. */
const detalle = document.getElementById("detalle");
function abrirDetalle(id){
  const d = datos(), x = d.items.find(i => i.id === id); if (!x) return;
  const art = Object.fromEntries(d.artistas.map(a => [a.id, a.nombre]));
  const renglones = (d.pedidos || []).filter(p => p.artistaId === x.artistaId).flatMap(p => p.renglones || []).filter(r => r.itemId === x.id);
  const deSeccion = d.items.filter(i => i.id !== x.id && i.artistaId === x.artistaId && (i.grupo || "") === (x.grupo || ""));
  const enOtras = d.items.filter(i => i.artistaId !== x.artistaId && !i.sinBanda && i.categoria === x.categoria);
  const pieza = (i, banda) => `<button class="pieza" data-item="${esc(i.id)}"><b>${i.cantidad}</b>${esc(corto(i.referencia))}${banda ? `<small>${esc(art[i.artistaId] || "")}</small>` : ""}</button>`;
  const modelo = corto(x.referencia) !== x.referencia ? (x.referencia.match(/\(([^)]*)\)/g) || []).map(t => t.slice(1, -1)).join(" · ") : "";
  detalle.querySelector(".panel").innerHTML = `
    <div class="agarre" aria-hidden="true"></div>
    <p class="donde">${esc(x.sinBanda ? "Listado general" : art[x.artistaId] || "")}${x.grupo ? ` · ${esc(x.grupo)}` : ""}</p>
    <h4 class="titulo-pieza"><span class="cant">${x.cantidad} ×</span> ${esc(corto(x.referencia))}</h4>
    ${modelo ? `<p class="modelo">${esc(modelo)}</p>` : ""}
    <p class="chips-pieza"><span class="chip">${esc(x.categoria)}</span>${x.propietario?.tipo === "tercero" ? `<span class="chip ter">Lo trae ${esc(x.propietario.nombre || "la banda")}</span>` : ""}${x.porConfirmar ? `<span class="chip warn">Por confirmar</span>` : ""}</p>
    ${x.nota ? `<p class="nota">${esc(x.nota)}</p>` : ""}
    ${htmlFotosPieza(x)}
    ${renglones.length ? `<p class="et">Así lo pidió el rider</p><blockquote>${renglones.map(r => esc(r.texto)).join("<br>")}</blockquote>` : ""}
    ${deSeccion.length ? `<p class="et">En la misma sección</p><div class="piezas">${deSeccion.map(i => pieza(i, false)).join("")}</div>` : ""}
    ${enOtras.length ? `<p class="et">${esc(x.categoria)} en otras bandas</p><div class="piezas">${enOtras.slice(0, 12).map(i => pieza(i, true)).join("")}</div>` : ""}
    <div class="botones">${V.puede.editar ? `<button class="btn" data-acc="editar-item" data-id="${esc(x.id)}">Editar</button>` : ""}<button class="btn sec" data-acc="cerrar-detalle">Cerrar</button></div>`;
  const vuelve = detalleId === id && !detalle.hidden, arriba = detalle.querySelector(".panel").scrollTop;
  detalleId = id;
  detalle.hidden = false;
  detalle.querySelector(".panel").scrollTop = vuelve ? arriba : 0;
  cargarFotos(detalle);
}
let detalleId = null;
/* El 📷 del listado: elegir si la foto es de la bodega o del evento, y tomarla o subirla. */
const momentos = Object.assign(document.createElement("div"), {className: "hoja", id: "momentos", hidden: true});
momentos.innerHTML = `<div class="panel" role="dialog" aria-label="Foto de la pieza"></div>`;
document.body.append(momentos);
function abrirMomentos(id){
  const x = datos().items.find(i => i.id === id); if (!x) return;
  momentos.querySelector(".panel").innerHTML = `
    <div class="agarre" aria-hidden="true"></div>
    <h4 class="titulo-pieza"><span class="cant">${x.cantidad} ×</span> ${esc(corto(x.referencia))}</h4>
    ${MOMENTOS.map(([m, t]) => { const k = clavePieza(x, m), n = fotosPieza(x, m).length; return `
    <p class="et">${t}${n ? ` · ${n} ${n === 1 ? "foto" : "fotos"}` : ""}</p>
    <div class="botones"><button class="btn" data-acc="tomar-foto" data-banda="${esc(k)}">📷 Tomar foto</button><button class="btn sec" data-acc="subir-foto" data-banda="${esc(k)}">🖼 Subir</button></div>`; }).join("")}
    <div class="botones"><button class="btn sec" data-acc="cerrar">Cancelar</button></div>`;
  momentos.hidden = false;
}
momentos.addEventListener("click", e => {
  const acc = e.target.closest("[data-acc]")?.dataset.acc;
  if (acc === "tomar-foto" || acc === "subir-foto") { fotoDe = e.target.closest("[data-banda]").dataset.banda; momentos.hidden = true; return document.getElementById(acc === "tomar-foto" ? "foto-camara" : "foto-galeria").click(); }
  if (e.target === momentos || acc === "cerrar") momentos.hidden = true;
});
// Después de tomar o borrar una foto, la hoja abierta se vuelve a dibujar con lo nuevo.
const refrescarDetalle = () => setTimeout(() => { if (!detalle.hidden && detalleId) abrirDetalle(detalleId); }, 150);
detalle.addEventListener("click", e => {
  const otra = e.target.closest("[data-item]"); if (otra) return abrirDetalle(otra.dataset.item);
  const acc = e.target.closest("[data-acc]")?.dataset.acc;
  if (acc === "tomar-foto" || acc === "subir-foto") { fotoDe = e.target.closest("[data-banda]").dataset.banda; return document.getElementById(acc === "tomar-foto" ? "foto-camara" : "foto-galeria").click(); }
  const foto = e.target.closest("img[data-foto]"); if (foto) return verFoto(foto);
  if (acc === "editar-item") { detalle.hidden = true; return abrirEditor(e.target.closest("[data-id]").dataset.id); }
  if (e.target === detalle || acc === "cerrar-detalle") detalle.hidden = true;
});
// Se cierra también deslizándola hacia abajo.
{
  const panel = detalle.querySelector(".panel"); let y0 = null;
  panel.addEventListener("touchstart", e => { y0 = panel.scrollTop <= 0 ? e.touches[0].clientY : null; }, {passive: true});
  panel.addEventListener("touchmove", e => { if (y0 === null) return; panel.style.transform = `translateY(${Math.max(0, e.touches[0].clientY - y0)}px)`; }, {passive: true});
  panel.addEventListener("touchend", e => {
    if (y0 === null) return; const dy = e.changedTouches[0].clientY - y0; y0 = null;
    panel.style.transform = ""; if (dy > 90) detalle.hidden = true;
  });
}
function abrirEditor(id){
  const it = datos().items.find(x => x.id === id); if (!it) return;
  editando = it;
  const cats = [...new Set([...ORDEN, "Otro", it.categoria])];
  form.categoria.innerHTML = cats.map(c => `<option${c === it.categoria ? " selected" : ""}>${esc(c)}</option>`).join("");
  form.cantidad.value = it.cantidad; form.referencia.value = it.referencia;
  const q = form.querySelector('[data-acc="quitar"]'); q.textContent = "Quitar ítem"; delete q.dataset.seguro;
  editor.hidden = false;
  form.referencia.focus();
}
form.addEventListener("submit", e => {
  e.preventDefault();
  const cantidad = Math.round(+form.cantidad.value);
  if (!(cantidad >= 1) || !form.referencia.value.trim()) return aviso("Pon una cantidad y el nombre del equipo");
  enviar({tipo: "editar", id: editando.id, cantidad, referencia: form.referencia.value, categoria: form.categoria.value});
  editor.hidden = true; aviso("Guardado");
});
editor.addEventListener("click", e => {
  const acc = e.target.closest("[data-acc]")?.dataset.acc;
  if (e.target === editor || acc === "cancelar") return editor.hidden = true;
  if (acc === "quitar") {
    const q = e.target.closest("[data-acc]");
    if (!q.dataset.seguro) { q.dataset.seguro = "1"; q.textContent = "¿Seguro? Toca otra vez"; return; }
    if (String(editando.id).startsWith("agregado-")) escribir(P + "agregados:" + (V.doc?.nombre || ""), leer(P + "agregados:" + (V.doc?.nombre || ""), []).filter(x => piezaDe(x) !== piezaDe(editando)));
    enviar({tipo: "quitar-item", id: editando.id});
    editor.hidden = true; aviso("Ítem quitado");
  }
});

/* ═══ src/12-planilla.js ═══ */
/* ── Planilla .xlsx (solo el admin): la banda como va, con lo que se haya editado ── */
function abrirPlanilla(id){
  const b = armarBandas(datos()).find(x => x.id === id); if (!b) return;
  const mayuscula = t => t.charAt(0).toLocaleUpperCase("es") + t.slice(1);
  const filas = [];
  for (const s of b.secciones) {
    if (s.grupo) filas.push({tipo: "seccion", cantidad: null, texto: s.grupo.replace(/[\s:·|–—-]+$/, "").toUpperCase()});
    for (const x of s.items) filas.push({tipo: "item", cantidad: x.cantidad, texto: mayuscula(x.referencia) + (x.propietario?.tipo === "tercero" ? " (lo trae la banda)" : "")});
  }
  const fecha = (b.items.find(x => /^d-\d{4}-\d{2}-\d{2}$/.test(x.diaId))?.diaId || "").slice(2);
  escribir("planilla:desde-reels", {banda: b.artistaId ? b.nombre : "", rider: V.doc?.nombre || "", fecha, filas});
  window.open("../planilla/?desde=reels", "_blank") || (location.href = "../planilla/?desde=reels");
}

/* ═══ src/13-leer-con-el-lector.js ═══ */
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

/* ═══ src/14-logo-y-presentacion.js ═══ */
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

/* ═══ src/15-arranque.js ═══ */
/* ── Arranque ── */
splash().then(() => DEMO ? presentacion() : null).then(() => { if (DEMO) irALaBanda(); if (actual) guiaAlLlegar(actual); });
if (location.hash === "#intro") history.replaceState(null, "", location.pathname);
// Los filtros no se guardan: se arranca sin ellos, y así llega la primera vista.
enviar({tipo: "limpiar"});
(function arrancar(){
  if (!V) return setTimeout(arrancar, 20);
  arrancado = true;
  fotosSitio.de = null; cargarFotosSitio();
  // Al abrir: recuperar piezas que se hayan caído y sumar las bandas del show.
  setTimeout(() => recuperarPiezas().catch(() => {}).then(() => asegurarShow()).catch(() => {}), 1200);
  pintarPendiente();
  if (MARCA && !leer(P + "importado-circuito", "")) {
    const esperar = n => V?.doc ? traerDeCircuito().then(f => f && aviso(`Traje ${f} ${f === 1 ? "foto" : "fotos"} de la app de Circuito`)) : n > 0 && setTimeout(() => esperar(n - 1), 500);
    setTimeout(() => esperar(40), 1500);
  }
  pintarBarra();
  // Si se abrió con ?lista= ya es el documento pedido; si no, se avisa si hay un evento de hoy distinto al abierto.
  if (!new URLSearchParams(location.search).get("lista")) setTimeout(() => avisarEventoNuevo().catch(() => {}), 1200);
  riderDelCronograma();
  if (V.doc && !location.hash) introHecha = true;   // ya hay rider: sin la entrada
  pintar(location.hash.slice(1));
  if (!location.hash) setTimeout(directoALosReels, 1700);   // después del logo de Circuito
  eventoDeHoy().then(ok => ok && setTimeout(directoALosReels, 300)).catch(() => {});
})();
