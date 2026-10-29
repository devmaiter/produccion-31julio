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
