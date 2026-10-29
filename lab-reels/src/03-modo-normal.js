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
