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
