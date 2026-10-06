/* Receta del holograma: qué piezas dibujar según el listado. Lee cada renglón (cantidad +
   texto) y cuenta bombos, toms, platillos, bases… Se calcula banda por banda y se toma, pieza
   por pieza, lo más grande: el holograma es el montaje que le sirve a cualquiera de las bandas.
   No toca Three.js, así se puede probar con node. */

const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/* El texto de un ítem: la referencia y, si la nota la amplía ("4 bases de platillo (ride, 2 crash)"), la nota. */
function texto(it) {
  const r = it.referencia || it.descripcion || "", d = it.descripcion || "";
  return norm(d.length > r.length && norm(d).includes(norm(r)) ? d : r);
}

/* "4 bases de platillo" con cantidad 1: el número del texto manda. */
function cuantos(it, t) {
  const q = Math.max(1, Math.round(+it.cantidad || 1));
  const m = t.match(/^\s*(\d{1,2})\s+(x\s+)?(?=[a-z])/);   // "8x10 cabina" no son 8
  return q === 1 && m && +m[1] > 1 && +m[1] < 30 ? +m[1] : q;
}

/* Medidas en pulgadas: '10" – 12" – 14"', '14" x 6.5"' (la segunda es la profundidad), "toms 10 y 12". */
function medidas(t) {
  const s = t.replace(/[”″“]|''/g, '"').replace(/x\s*\d+(?:[.,]\d+)?\s*"/g, "");
  let m = [...s.matchAll(/(\d{1,2}(?:[.,]5)?)\s*(?:"|in\b|pulg)/g)].map(x => parseFloat(x[1].replace(",", ".")));
  if (!m.length) m = [...s.replace(/^\s*\d{1,2}\s+(?=[a-z])/, "").matchAll(/\b(\d{1,2})\b(?!\s*(x|ch|piezas))/g)].map(x => +x[1]).filter(n => n >= 6 && n <= 28);
  return m.filter(n => n >= 6 && n <= 28);
}

const BASE = /\b(stands?|bases?|soportes?|pie|atril|maquina)\b/;
const TIPO_PLATILLO = [
  ["hihat", /(hi ?-?hats?|hit hat|\bh\/h\b|\bhats?\b|charles|x ?-?hat)/],
  ["ride", /\bride\b/],
  ["china", /(china|chinese)/],
  ["splash", /splash/],
  ["crash", /(crash|o-?zone|platillo|cymbal|plato)/],
];
const tipoPlatillo = t => TIPO_PLATILLO.find(([, re]) => re.test(t))?.[0];

/* "Set de platillos: 1 ride, 2 crash, 1 splash y hi-hat" o '20" Ride, 16"-18" Crash' → lista de platillos. */
function platillos(t, q) {
  const out = [];
  const partes = t.replace(/^[^:]*:/, "").split(/,|;|\+|\s\by\b\s|\s\band\b\s|\//).map(x => x.trim()).filter(Boolean);
  for (const p of partes.length > 1 ? partes : [t]) {
    const tipo = tipoPlatillo(p); if (!tipo) continue;
    if (tipo === "hihat" && /\bbottom\b|\babajo\b|\binferior\b/.test(p)) continue; // la de abajo es el mismo hi-hat
    const n = p.match(/^\s*(\d)\s*[a-z]/), med = medidas(p);
    const k = partes.length > 1 ? (n ? +n[1] : Math.max(1, med.length)) : Math.max(q, med.length);
    for (let i = 0; i < k; i++) out.push({tipo, pulgadas: med[i] || med[0] || 0, xhat: /x ?-?hat/.test(p)});
  }
  if (!out.length && /set|juego|kit/.test(t)) out.push({tipo: "hihat"}, {tipo: "crash"}, {tipo: "ride"});
  return out;
}

/* ── Batería: tambores, herrajes y platillos de una banda ── */
function bateriaDe(items) {
  const r = {bombos: [], toms: [], pisos: [], redoblantes: [], generica: 0, doblePedal: false, pad: false,
    platillos: [], basesPlatillo: 0, hihatBase: 0, silla: 0};
  for (const it of items) {
    const t = texto(it), q = cuantos(it, t), med = medidas(t);
    const cuenta = Math.max(q, med.length), tam = i => med[i] || med[0] || 0;
    if (/(spd|sample ?pad|octapad|\bpdx|\bpad\b)/.test(t) && !BASE.test(t)) { r.pad = true; continue; }
    if (/pedal/.test(t)) { if (/(doble|double|twin)/.test(t)) r.doblePedal = true; continue; }
    if (/(clamp|parche|head|tapete|carpet|alfombra|rug|llave|key)/.test(t) && !/x ?-?hat/.test(t)) continue;
    const esBase = BASE.test(t) || /\b(boom|throne|silla|banco|stool)\b/.test(t);
    if (esBase) {
      if (/(throne|silla de bateria|banco|drum (stool|seat)|porter)/.test(t)) r.silla += q;
      else if (/(hi ?-?hat|\bh\/h\b|charles)/.test(t)) r.hihatBase += q;
      else if (/(cymbal|platillo|plato|crash|ride|boom)/.test(t) && !/(micro|\bmic)/.test(t)) r.basesPlatillo += q;
      continue;
    }
    if (tipoPlatillo(t) && it.categoria !== "Batería" || /x ?-?hat/.test(t)) { r.platillos.push(...platillos(t, q)); continue; }
    if (/(\bkick\b|bombo|\bbd\b|\bkd\b|bass drum)/.test(t)) { for (let i = 0; i < cuenta; i++) r.bombos.push(tam(i)); continue; }
    if (/(snare|redoblante|tarola|\bcaja\b)/.test(t)) {
      // "SNARE / REDOBLANTE: Ludwig 14”" después de "Sizes … Snare 14”" es el mismo redoblante, con su marca.
      const mismo = /^[^:]*(snare|redoblante)[^:]*:/.test(t) && r.redoblantes.includes(tam(0));
      if (!mismo && !/(spare|repuesto|auxiliar|backup|reserva)/.test(t)) for (let i = 0; i < q; i++) r.redoblantes.push(tam(i));
      continue;
    }
    if (/\btoms?\b|tom-?tom/.test(t)) {
      const piso = /(floor|piso|de pie|surdo|legs|patas)/.test(t), aereo = /(rack|aereo|montado)/.test(t);
      for (let i = 0; i < cuenta; i++) {
        const p = tam(i);
        (piso || (!aereo && p >= 14) ? r.pisos : r.toms).push(p);
      }
      continue;
    }
    if (/(bateria|drum ?kit|drums|shell ?pack|\bkit\b|\bset\b)/.test(t)) r.generica += q;
  }
  return r;
}

/* El formato que casi siempre trae una batería: bombo 22, toms 10 y 12, piso 16, redoblante 14,
   hi-hat, crash y ride en dos bases, pedal y silla. Lo que dice el listado reemplaza lo de aquí. */
function completarBateria(r) {
  const tambores = r.bombos.length + r.toms.length + r.pisos.length;
  const k = {
    bombos: r.bombos.length ? r.bombos.slice(0, 2) : [22],
    toms: tambores ? r.toms.slice(0, 4) : [10, 12],
    pisos: tambores ? r.pisos.slice(0, 3) : [16],
    redoblante: r.redoblantes[0] || 14, redoblante2: r.redoblantes[1] || 0,
    doblePedal: r.doblePedal, pad: r.pad,
  };
  const pl = r.platillos;
  const hihats = pl.filter(p => p.tipo === "hihat");
  k.hihat = hihats.find(p => !p.xhat)?.pulgadas || 14;
  k.xhat = hihats.some(p => p.xhat) || hihats.length > 1;
  let arriba = pl.filter(p => p.tipo !== "hihat");
  const bases = r.basesPlatillo || arriba.length || 2;
  if (!arriba.length) arriba = [{tipo: "crash"}, {tipo: "ride"}];
  // Una base por platillo: si sobran bases van con crash; si sobran platillos, los que tengan base.
  while (arriba.length < bases) arriba.push({tipo: "crash"});
  k.platillos = ordenarPlatillos(arriba.slice(0, Math.min(bases, 8)));
  return k;
}

/* De izquierda a derecha como se arma: crash, splash, crash… ride y china a la derecha. */
function ordenarPlatillos(l) {
  const de = t => l.filter(p => p.tipo === t);
  const crash = de("crash"), splash = de("splash"), out = [];
  while (crash.length || splash.length) { if (crash.length) out.push(crash.shift()); if (splash.length) out.push(splash.shift()); }
  return [...out, ...de("ride"), ...de("china")];
}

/* ── Bases: cuántas de cada tipo ── */
const TIPOS_BASE = [
  ["silla", /(throne|silla de bateria|banco de bateria|drum (stool|seat)|porter)/],
  ["hihat", /(hi ?-?hat|\bh\/h\b|charles)/],
  ["redoblante", /(snare|redoblante|tarola)/],
  ["platillo", /(cymbal|platillo|plato|crash|ride|boom (?!mic))/],
  ["teclado", /(teclado|keyboard|\bkeys? stand|\bks ?\d|ax-?\d|tipo z|piano)/],
  ["guitarra", /(guitar|guitarra|guitarrero|bajo|bass)/],
  ["atril", /(atril|music stand|partitura)/],
  ["taburete", /(stool|silla|asiento|chair|butaco)/],
  ["microfono", /(micro|\bmic|boom)/],
];
function basesDe(items) {
  const r = {};
  for (const it of items) {
    const t = texto(it);
    const tipo = TIPOS_BASE.find(([, re]) => re.test(t))?.[0] || (BASE.test(t) ? "otra" : null);
    if (tipo) r[tipo] = (r[tipo] || 0) + cuantos(it, t);
  }
  return r;
}

/* ── Teclados, amplis, guitarras y bajos: cuántos ── */
const ACCESORIO = {
  teclado: /(sustain|pedal|\bfc ?\d|cable|stand|base|banco|expresion)/,
  amp: /(cable|pedal|footswitch)/, bajo: /(cable|pedal|footswitch)/,
  guitarra: /(cuerdas|strings|cable|pedal|capo|afinador|tuner|correa|strap|\bpua)/,
};
function copiasDe(tipo, items) {
  let l = items.map(it => ({it, t: texto(it)})).filter(x => !ACCESORIO[tipo]?.test(x.t));
  // El cabezal ("head", o un ampli de bajo sin palabras de caja) no se dibuja: se dibujan las cajas.
  const caja = /(\d ?x ?\d{2}|\b\d{3}e?\b|cab\b|cabinet|caja|cabina|enclosure|bafle|combo)/;
  const cabezal = t => /(head|cabezal)/.test(t) || !caja.test(t);
  if (tipo === "bajo" && l.some(x => !cabezal(x.t))) l = l.filter(x => !cabezal(x.t));
  return l.reduce((s, x) => s + cuantos(x.it, x.t), 0);
}

/* ── Percusión: congas, bongós, djembe, timbales, cajón, mesa y platillos del grupo ── */
function percusionDe(items) {
  const r = {congas: 0, bongos: 0, djembe: 0, timbales: 0, cajon: 0, mesa: 0};
  for (const it of items) {
    const t = texto(it), q = cuantos(it, t);
    if (/(conga|tumba|quinto)/.test(t)) {
      const piezas = ["requinto", "quinto", "conga", "tumba"].filter(w => new RegExp("\\b" + w).test(t)).length;
      r.congas += Math.max(q, piezas, /\bset\b|juego/.test(t) && piezas < 2 ? 2 : 0);
    } else if (/bongo/.test(t)) r.bongos += q;
    else if (/(djemb|yemb)/.test(t)) r.djembe += q;
    else if (/timbal(es|itos)?\b/.test(t) && !/(bell|campana)/.test(t)) r.timbales += q;
    else if (/caj[oó]n/.test(t)) r.cajon += q;
    else if (/(table|mesa)/.test(t)) r.mesa += q;
  }
  const b = bateriaDe(items);
  let pl = b.platillos.filter(p => p.tipo !== "hihat");
  const bases = b.basesPlatillo || pl.length;
  while (pl.length < bases) pl.push({tipo: "crash"});
  r.platillos = ordenarPlatillos(pl.slice(0, Math.min(bases, 6)));
  for (const k of ["congas", "bongos", "djembe", "timbales", "cajon", "mesa"]) r[k] = Math.min(r[k], 4);
  if (!r.congas && !r.bongos && !r.djembe && !r.timbales && !r.cajon && !r.platillos.length) r.congas = 3;
  return r;
}

const CATS = {
  percusion: ["Percusión", "Otro", "Platillos", "Bases"],
  bateria: ["Batería", "Platillos", "Bases"], platillos: ["Platillos", "Batería", "Bases"], base: ["Bases", "Otro"],
  teclado: ["Teclado"], amp: ["Ampli guitarra"], bajo: ["Ampli bajo"], guitarra: ["Guitarra", "Bajo"],
};

/* Mezcla las recetas de las bandas: el máximo de cada pieza. */
function mayor(a, b) {
  if (a == null) return b;
  if (Array.isArray(a)) return b.length > a.length ? b : a;
  if (typeof a === "object") { const o = {...a}; for (const k in b) o[k] = mayor(a[k], b[k]); return o; }
  if (typeof a === "boolean") return a || b;
  return Math.max(a, b);
}

export function receta(tipo, items, categoria) {
  if (!items?.length) return null;
  const cats = tipo === "guitarra" && categoria ? [categoria] : CATS[tipo];
  if (!cats) return null;
  const grupos = new Map();
  for (const it of items) {
    if (!cats.includes(it.categoria)) continue;
    const k = (it.diaId || "") + "|" + (it.artistaId || "");
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(it);
  }
  let r = null;
  for (const g of grupos.values()) {
    let x;
    if (tipo === "bateria") x = completarBateria(bateriaDe(g));
    else if (tipo === "platillos") {
      const b = bateriaDe(g), pl = b.platillos.length ? b.platillos : [{tipo: "hihat"}, {tipo: "crash"}, {tipo: "ride"}];
      const arriba = pl.filter(p => p.tipo !== "hihat");
      x = {hihat: pl.some(p => p.tipo === "hihat") || !!b.hihatBase, platillos: ordenarPlatillos(arriba.slice(0, 8))};
    }
    else if (tipo === "base") x = basesDe(g);
    else if (tipo === "percusion") x = percusionDe(g);
    else x = {n: Math.min(4, copiasDe(tipo, g))};
    r = mayor(r, x);
  }
  return r;
}
