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
