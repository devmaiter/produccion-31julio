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
