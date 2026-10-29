/* Las reglas del backline: a qué reel va cada pieza y qué lleva cada instrumento (LLEVA). Solo reglas: no dibujan,
   no guardan, no leen la pantalla. Así se prueban solas (pruebas/reglas.test.mjs) y sirven igual en el celular, en un
   servidor o en otra app.

   Abierto a crecer sin tocar esto: otro instrumento con ReglasBackline.registrar("Vientos", [{pieza, categoria, hay}]).
   Las reglas de cada instrumento las definió el usuario (ver CLAUDE.md, «Lo que lleva cada instrumento»). */
(function (raiz) {
  const corto = t => String(t).replace(/\s*\([^)]*\)/g, "").trim() || t;
  const piezaDe = x => `${x.artistaId || "sin-banda"}|${x.grupo || ""}|${corto(x.referencia).toLowerCase()}`;
  const idFalta = (items, pieza) => `${items[0]?.artistaId || "sin-banda"}|${items[0]?.grupo || ""}|${pieza}`;
  const REELES = ["Batería", "Bajo", "Guitarra", "Teclado", "Percusión", "Platillos", "In ears", "Consolas", "Extras"];
  const GRUPOS = [[/bater|drum|\bkit\b/, "Batería"], [/platillo|cymbal/, "Platillos"], [/percus|\bperc\b/, "Percusión"],
    [/teclad|\bkeys?\b|piano|synth|sintet|organo|organ\b|hammond/, "Teclado"], [/\bbajo|bass|contrabajo/, "Bajo"],
    [/guitar|\bgtr\b|tiple|requinto|cuatro|bandola|charango/, "Guitarra"], [/tumbador|conga|timbal|bongo|djembe|cajon|vallenat|tambora|folclor/, "Percusión"]];
  const POR_CATEGORIA = {"Batería": "Batería", "Platillos": "Platillos", "Percusión": "Percusión", "Teclado": "Teclado",
    "Ampli bajo": "Bajo", "Bajo": "Bajo", "Ampli guitarra": "Guitarra", "Guitarra": "Guitarra", "In ears": "In ears", "Consolas": "Consolas"};
  // Una base o un tapete sin grupo va con su instrumento: "Boom cymbal stand" a Batería.
  const DE_QUIEN = [[/cymbal|platillo|plato|hi ?-?hat|snare|redoblante|throne|drum|bater|tom stand|porter/, "Batería"],
    [/teclado|keyboard|\bks ?\d|ax-?\d|tipo z|\bkeys? stand/, "Teclado"], [/guitar|guitarrero/, "Guitarra"],
    [/\bbajo|\bbass\b|contrabajo/, "Bajo"], [/conga|tumbadora|bongo|timbal|percus|cradle|djembe|cajon/, "Percusión"],
    [/tiple|requinto|cuatro|charango|bandola/, "Guitarra"]];
  function reelDe(it){
    const norm = t => (t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    // Los ventiladores siempre van a Extras, aunque est\u00e9n en el bloque del bajo o de la percusi\u00f3n (pedido del usuario).
    if (/\b(fans?|ventiladore?s?|cooler)\b/.test(norm(it.referencia))) return "Extras";
    // Los in ears y las consolas van a su reel aunque vengan en el bloque de un instrumento.
    if (it.categoria === "In ears" || it.categoria === "Consolas") return it.categoria;
    const n = norm(it.grupo);
    const g = n && GRUPOS.find(([re]) => re.test(n))?.[1];
    if (g) return g;
    if (POR_CATEGORIA[it.categoria]) return POR_CATEGORIA[it.categoria];
    if (["Bases", "Escenario"].includes(it.categoria)) { const t = norm(it.referencia); return DE_QUIEN.find(([re]) => re.test(t))?.[1] || "Extras"; }
    return "Extras";
  }
  /* ── Lo que lleva cada instrumento (lo pidió el usuario: "una batería debe llevar silla y él no puso silla; ese
     tipo de cosas las tiene que hacer la app"). Si la sección no lo nombra, se avisa para revisar; no se agrega
     solo. "Hardware completo" cubre los stands y el pedal, pero no la silla ni la alfombra. ── */
  // «Batería Pearl Master completa con todas sus medidas»: la batería entera, con su hardware.
  const HARDWARE = /hardware (completo|set|full)|full hardware|hardware de (la )?bater|\bbateria\b.{0,40}\bcomplet[ao]/;
  const LLEVA = {
    "Batería": [
      {pieza: "Silla de batería", categoria: "Batería", hay: /\b(sillas?|banquetas?|butacas?|thrones?|stools?|asientos?)\b/},
      {pieza: "Pedal de bombo", categoria: "Batería", hay: /\b(pedal(es)?|kick pedal)\b(?! de (sustain|expresi|efecto))/, hardware: true},
      {pieza: "Base de redoblante", categoria: "Batería", hay: /\b(bases?|stands?|soportes?)\b.{0,15}\b(redoblante|snare|tarola|caja)\b|snare stand/, hardware: true},
      {pieza: "Máquina de hi-hat", categoria: "Batería", hay: /hi ?-?hat|charles|contratiempo|\bhh\b/, hardware: true},
      {pieza: "Platillos", categoria: "Platillos", hay: /\b(platos?|platillos?|cymbals?|crash|ride|china|splash)\b/},
      {pieza: "Alfombra para batería", categoria: "Batería", hay: /\b(alfombras?|tapetes?|rugs?|carpets?|mats?)\b/},
      // "Plásticos" = parches (así les dicen en tarima). Una marca o modelo de parche también cuenta.
      {pieza: "Plásticos (parches)", categoria: "Batería", hay: /\b(plasticos?|parches?|heads?|drumheads?|remo|evans|aquarian|ambassador|emperor|pinstripe|powerstroke|g[12])\b/},
    ],
    // Bajo (lo dijo el usuario, 2026-10-16): siempre se avisa la base; el ampli no, porque cuál va depende del
    // evento. Si el bajista trae su cabezal, Circuito pone la caja y un cabezal de respaldo.
    "Bajo": [
      {pieza: "Base para bajo", categoria: "Bases", hay: /\b(bases?|stands?|soportes?|guitarreros?)\b/},
      {pieza: "Caja de bajo", categoria: "Ampli bajo", cuando: bandaTraeCabezal, hay: /\b(caja|cabina|cabinet|cab|gabinete|bafle|combo|\d ?x ?1[025])\b/},
      {pieza: "Cabezal de bajo de respaldo", categoria: "Ampli bajo", cuando: bandaTraeCabezal, soloNuestro: true, hay: /\b(cabezal|head|cabeza|svt|combo|respaldo|backup|spare)\b/},
    ],
    // Guitarra (2026-10-16): el ampli no se avisa, como en el bajo (cuál va lo define el evento).
    "Guitarra": [
      {pieza: "Base para guitarra", categoria: "Bases", hay: /\b(bases?|stands?|soportes?|guitarreros?)\b/},
    ],
    // "Atril" a secas es de partituras (lo dijo el usuario): no cuenta como base del teclado ni del bajo.
    "Teclado": [
      {pieza: "Base de teclado", categoria: "Bases", hay: /\b(bases?|stands?|soportes?)\b/},
      {pieza: "Pedal de sustain", categoria: "Teclado", hay: /\b(sustain|pedal(es)?|fc ?-?\d)\b/},
    ],
    // Percusión (2026-10-16): solo se avisan las bases de las congas, y solo si hay congas. «Conga y tumba + Stand»
    // o «Congas w/ stand» ya las traen.
    "Percusión": [
      {pieza: "Bases para congas", categoria: "Percusión", cuando: hayCongas, hay: /\b(bases?|stands?|soportes?)\b.{0,25}\b(congas?|tumbadoras?|tumbas?|quintos?)\b|\bcongas?\b.{0,40}\b(con|y|with|incl\w*) (sus |su |las |los )?(bases?|stands?|soportes?)\b|\bconga stands?\b|\b(congas?|tumbadoras?|tumbas?|quintos?)\b.{0,40}(\+|\bw\/) ?\(? ?(bases?|stands?|soportes?)\b/},
    ],
  };
  // Batería electrónica (Roland TD, Yamaha DTX…): no se avisa nada, depende del rider (lo dijo el usuario).
  const ELECTRONICA = /\b(electronica|electronic|e-?drums?|roland td|td-?\d{1,2}|dtx|v-?drums|alesis|efnote)\b/;
  function hayCongas(items){
    return items.some(x => /\b(congas?|tumbadoras?|quintos?)\b/.test(sinTildesL(`${x.referencia} ${x.descripcion || ""}`)));
  }
  const sinTildesL = t => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  // De qué instrumento es la sección: el reel que más se repite entre sus piezas.
  function instrumentoDe(items){
    // Un «dummie de piano» es utilería, no un teclado: no se le piden base ni pedal.
    const n = {}; for (const x of items) { if (/\bdumm(y|ie)s?\b/i.test(x.referencia)) continue; const r = reelDe(x); n[r] = (n[r] || 0) + 1; }
    return Object.keys(LLEVA).filter(r => n[r]).sort((a, b) => n[b] - n[a])[0] || null;
  }
  /** Lo que le falta a una sección (una lista de piezas del mismo grupo). `talCual`: la hoja del usuario como está, sin
   *  avisos. `descartadas`: los «No hace falta» (ids de idFalta). Se avisa, nunca se agrega solo. */
  function faltantesDe(items, {talCual = false, descartadas = new Set()} = {}){
    if (talCual) return [];
    const inst = items.length && instrumentoDe(items); if (!inst) return [];
    const textoDe = xs => sinTildesL(xs.map(x => `${x.referencia} ${x.descripcion || ""} ${x.nota || ""}`).join(" · "));
    const texto = textoDe(items), nuestro = textoDe(items.filter(x => !loTraeLaBanda(x)));
    if (inst === "Batería" && ELECTRONICA.test(texto)) return [];
    // Una sección de puro hardware ("MISC: 3 boom stands, 3 sillas") no es una batería: no se le piden sus piezas.
    // «5 Sillas de batería» tampoco hace una batería.
    if (inst === "Batería" && !/\b(bombos?|kicks?|bd|redoblantes?|snares?|tarolas?|toms?|bateria|drum ?kit|kit|shells?)\b/.test(sinTildesL(items.map(x => x.referencia).join(" · ")).replace(/\b(sillas?|banquetas?|alfombras?|tapetes?) de bateria\b/g, ""))) return [];
    return LLEVA[inst].filter(r => (!r.cuando || r.cuando(items)) && !r.hay.test(r.soloNuestro ? nuestro : texto)
        && !(r.hardware && HARDWARE.test(texto)) && !descartadas.has(idFalta(items, r.pieza)))
      .map(r => ({...r, instrumento: inst}));
  }
  // Lo que la banda trae ("lo trae la banda", "own", "propio"): no cuenta como algo que Circuito ya puso.
  function loTraeLaBanda(x){
    return x.propietario?.nombre === "la banda" || /\b(lo trae|la trae|los trae|trae la banda|traen|brings?|own|propi[oa]s?|suy[oa]s?)\b/.test(sinTildesL(`${x.nota || ""} ${x.descripcion || ""}`));
  }
  // El bajista trae su cabezal: una pieza de la sección que es un cabezal (sin caja) y la trae la banda.
  function bandaTraeCabezal(items){
    return items.some(x => loTraeLaBanda(x) && /\b(cabezal|head|cabeza|svt)\b/.test(sinTildesL(`${x.referencia} ${x.descripcion || ""}`)));
  }

  /** Otro instrumento (o más reglas para uno): se agregan sin cambiar las de arriba. */
  function registrar(instrumento, reglas) { LLEVA[instrumento] = [...(LLEVA[instrumento] || []), ...reglas]; }

  const api = Object.freeze({ REELES, GRUPOS, POR_CATEGORIA, DE_QUIEN, reelDe, HARDWARE, LLEVA, ELECTRONICA, hayCongas, sinTildesL,
    instrumentoDe, loTraeLaBanda, bandaTraeCabezal, corto, piezaDe, idFalta, faltantesDe, registrar });
  if (typeof module === "object" && module.exports) module.exports = api;   // Node (pruebas, servidor)
  raiz.ReglasBackline = api;                                                // navegador
})(typeof window !== "undefined" ? window : globalThis);
