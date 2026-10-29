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
