/* El cortador: lee un renglón de izquierda a derecha y decide dónde empieza cada pieza.
 *
 *   "TOMS 10”, 12” Y 14”"                    → 1 TOMS 10” · 1 TOMS 12” · 1 TOMS 14”
 *   "2 CRASH DE 16” Y 18”, RIDE 20”"          → 1 CRASH 16” · 1 CRASH 18” · 1 RIDE 20”
 *   "1 SNARE 14” X 6” Y UN PICCOLO 13”"       → 1 SNARE 14” X 6” · 1 PICCOLO 13”
 *   "· 1 22” Bass drum · 1 14” Floor tom"     → 1 22” Bass drum · 1 14” Floor tom
 *
 * Primero parte en los separadores fuertes (viñetas en medio del renglón, "; ", un punto suelto
 * antes de una cantidad). Luego, dentro de cada trozo, mira cada coma o "y": lo que sigue es otra
 * pieza si trae su propia cantidad, si es solo una medida (es otra del mismo equipo), si nombra
 * otra pieza ("RIDE 20”") o si repite la marca de la anterior ("KORG … Y KORG …"). Si no, sigue
 * siendo la misma ("Djembe y su base", "con parches nuevos"). Después de "O" vienen alternativas
 * de la misma pieza y ya no se corta. Las medidas de un set de percusión ("Timbales 14” y 15”",
 * "Congas 11”, 11¾” y 12½”") y sus tambores ("Congas: quinto, conga y tumba") tampoco lo cortan: es una fila por
 * set (lo dijo el usuario). La profundidad del mismo tambor ("Snare 14”, 6.5” deep") tampoco; la caja del ampli
 * ("… head and 8x10 cabinet") sí es otra pieza. Una medida al comienzo ("4x10", "14x6.5", "15”") no es una
 * cantidad. Devuelve null si el renglón es una sola pieza. */

/** Medida: 14”, 14’’, 5 ½”, 14” x 6.5”, 2.40 x 2.40. */
const PULGADA = String.raw`(?:["”″]|[’'′]{2}|pulg(?:adas)?\.?|\s?inch(?:es)?\b)`;
const MEDIDA = String.raw`\d{1,3}(?:[.,]\d+)?(?:\s*[½¾¼])?\s*${PULGADA}(?:\s*[x×]\s*\d{1,3}(?:[.,]\d+)?(?:\s*[½¾¼])?\s*${PULGADA}?)?|\d{1,2}[.,]\d{1,2}\s*[x×]\s*\d{1,2}[.,]?\d{0,2}`;
const SOLO_MEDIDAS = new RegExp(`^(?:${MEDIDA})(?:\\s*(?:,|y|and|&)?\\s*(?:${MEDIDA}))*$`, "i");
const TIENE_MEDIDA = new RegExp(MEDIDA, "i");
// Una cantidad no va seguida de una unidad: "86 cm", "5 strings", "16 CH" son medidas o partes del equipo.
// Tampoco es cantidad el comienzo de una medida ("15”" son 15 pulgadas, no 1 de 5”): eso lo mira `medidaAlComienzo`.
// ("2 x 14” crash" y "2 x 4x10" sí traen cantidad.)
const CANTIDAD = /^(\d{1,3})(?!\d)\s*(?:x\s+)?(?!(?:cm|mm|mts?|m|kg|w|v|ft|in|inch(?:es)?|hz|k|ch|cuerdas?|strings?|canales|channels|voltios|volts?|watts?|vatios)(?!\p{L}))(?=\p{L}|\d{1,3}(?:[.,]\d+)?\s*(?:["”″]|[’'′]{2})|\d{1,2}\s*[x×]\s*\d)/iu;
/** Una caja de parlantes: "4x10", "8x10 cabinet", "2x12", "1x15" (cuántos parlantes y de qué tamaño, no cuántas cajas). */
const CONFIG_PARLANTES = /^[12468]\s*[x×]\s*(?:8|10|12|15|18)(?![\d.,x×"”″’'′])/i;
/** "4x10", "8x10 cabinet", "14x6.5 snare", "22x18 Kick": el renglón empieza con una medida, no con una cantidad. Una caja
 *  de parlantes, o el tamaño de un tambor (con decimales, o de 10 o más: nadie pide 22 bombos así). "2x16 Crash" y
 *  "2x14 Floor Tom" sí son cantidad por medida. */
export function medidaAlComienzo(t: string): boolean {
  const s = t.trim();
  if (/^\d{1,2}\s*[x×]\s*\d{1,2}[.,]\d/.test(s) || /^[12]\d\s*[x×]\s*\d{1,2}(?![\d.,])/.test(s)) return true;
  if (!CONFIG_PARLANTES.test(s)) return false;
  return !PIEZA.test(s.replace(/^\d{1,2}\s*[x×]\s*\d{1,2}\s*/, ""));
}
const tieneCantidad = (t: string) => !medidaAlComienzo(t) && CANTIDAD.test(t);
const UNO = /^(?:un|una|uno|one|an?)\s+/i;
/** Piezas que, nombradas después de una coma o una "y", son otra pieza aunque no traigan cantidad. "Bongó" y
 *  "djembé" terminan en tilde: el final se mira con letras de verdad (\b no las ve). */
export const PIEZA = /^(?:(?:set|juego|kit)\s+(?:de|of)\s+)?(crash|ride|splash|china|hi[\s-]?hats?|hihats?|hit[\s-]?hats?|x[\s-]?hats?|charles|stack|bell|toms?|floor\s*toms?|rack\s*toms?|tom\s+de\s+piso|tom\s+a[eé]reo|bombo|kick|bass\s*drum|snare|piccolo|redoblante|tarola|caja|congas?|tumbas?|tumbadoras?|quinto|bong[oó]s?|djemb[eé]|caj[oó]n|timbal(?:es)?|pailas?|cencerro|cowbell|shaker|pandereta|tambourine|g[uü]iro|maracas)(?![\p{L}\d])/iu;
/** Congas, timbales y bongó son un set: "Timbales 14” y 15”" es una sola pieza (lo dijo el usuario), no una
 *  por medida como los toms. */
export const SET_PERCUSION = /(?<![\p{L}])(congas?|tumbas?|tumbadoras?|quintos?|requintos?|timbal(?:es)?|timbaletas?|pailas?|bong[oó](?:e?s)?)(?![\p{L}])/iu;
/** El set de congas por su nombre ("Congas", "Tumbadoras", "Set de congas") y sus tambores ("quinto 11”", "conga", "tumba"):
 *  "3 Congas: quinto, conga y tumba" es un set, una fila (lo dijo el usuario). */
export const SET_CONGAS = /(?<![\p{L}])(congas|tumbadoras|(?:set|juego|kit)\s+(?:de|of)\s+(?:congas|tumbadoras|tumbas))(?![\p{L}])/iu;
export const TAMBOR_DE_CONGAS = /^(?:(?:el|la|un|una|1)\s+)?(quinto|requinto|conga|tumba|tumbadora|super\s?tumba|macho|hembra)(?![\p{L}])/iu;
/** "Hardware completo", "Full hardware", "Herrajes completos": todo el hardware de la batería, una pieza entre viñetas
 *  (el lector lo abre después, pieza por pieza). */
const HARDWARE = /^(?:\d{1,2}\s+)?(?:(?:set|kit|juego)\s+(?:de\s+|of\s+)?)?(?:(?:full|complete|completo)\s+)?(?:drum\s+)?(?:hardware|herrajes?)(?![\p{L}])/iu;
/** "6.5” deep", "5” de profundidad": la profundidad del mismo tambor, no otra pieza. */
const PROFUNDIDAD = /^(?:de\s+)?(?:deep|depth|profundidad|profundo|fondo)(?![\p{L}])/iu;
/** "8x10 cabinet", "2x12 cab", "caja 4x12" después de una coma o una "y": la caja del ampli es otra pieza. */
const CAJA_PARLANTES = /^(?:(?:su|sus|its|their|the|la|el)\s+)?(?:\d{1,2}\s*[x×]\s*(?:8|10|12|15|18)(?![\d.,])|(?:cabs?|cabinets?|gabinetes?|bafles?)(?![\p{L}])|cajas?\s+(?:de\s+)?(?:bajo|guitarra|bass|guitar|\d{1,2}\s*[x×]\s*\d))/iu;
/** "16” Floor tom", "12” con soporte": una medida al comienzo y lo que sigue. */
const MEDIDA_Y_RESTO = new RegExp(`^(${MEDIDA})\\s+(\\S.*)$`, "iu");
/** "1 X stand", "2 X-Stands", "1 X-hat": la X es el tipo (base en X, hi-hat auxiliar), no "por". Con minúscula
 *  y espacio ("2 x stands") sí es "por". */
export function xDeTipo(t: string): { cantidad: number; resto: string } | null {
  const m = t.trim().match(/^(\d{1,3})\s*(x[\s-]?(?:stands?|hats?)(?![\p{L}]).*)$/iu);
  if (!m || !(m[2]!.startsWith("X") || m[2]![1] === "-")) return null;
  return { cantidad: Number(m[1]), resto: m[2]!.trim() };
}
/** Lo que acompaña a la pieza anterior ("y su base", "con stand"): no es otra pieza. */
const ACOMPANA = /^(?:(?:su|sus|el|la|los|las|its|their)\s+)?(stands?|bases?|soportes?|holders?|clamps?|parches?|heads?|herrajes?|hardware|funda|case|estuche)\b/i;

export interface Pieza { cantidad: number | null; texto: string }

/** Los trozos de un texto separados por `re`, sin cortar dentro de paréntesis. */
export function partirFuera(t: string, re: RegExp): Array<{ texto: string; sep: string }> {
  const out: Array<{ texto: string; sep: string }> = [];
  let nivel = 0, desde = 0, sep = "";
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  const cortes: Array<{ i: number; fin: number; sep: string }> = [];
  for (const m of t.matchAll(g)) cortes.push({ i: m.index!, fin: m.index! + m[0].length, sep: m[0] });
  let k = 0;
  for (let i = 0; i < t.length; i++) {
    const c = t[i]!;
    if (c === "(") nivel++;
    else if (c === ")") nivel = Math.max(0, nivel - 1);
    while (k < cortes.length && cortes[k]!.i < i) k++;
    if (k < cortes.length && cortes[k]!.i === i && nivel === 0) {
      out.push({ texto: t.slice(desde, i), sep });
      sep = cortes[k]!.sep; desde = cortes[k]!.fin; i = desde - 1; k++;
    }
  }
  out.push({ texto: t.slice(desde), sep });
  return out.map(p => ({ texto: p.texto.trim(), sep: p.sep })).filter(p => p.texto);
}

/** "2 CRASH DE 16”" → { cantidad: 2, resto: "CRASH DE 16”" }. */
function cantidadDe(t: string): { cantidad: number | null; resto: string } {
  const x = xDeTipo(t);
  if (x) return x;
  const m = medidaAlComienzo(t) ? null : t.match(CANTIDAD);
  // "2x14 Floor Tom": 2 de 14, sin la x pegada.
  if (m) return { cantidad: Number(m[1]), resto: t.slice(m[0].length).trim().replace(/^[x×]\s*(?=\d{1,2}(?:[.,]\d+)?\s*(?:["”″]|[’'′]{2})?\s+\p{L})/u, "") };
  const u = t.match(UNO);
  if (u) return { cantidad: 1, resto: t.slice(u[0].length).trim() };
  return { cantidad: null, resto: t };
}

/** El equipo sin la medida: "CRASH DE 16”" → "CRASH"; "TOMS AÉREOS 10”" → "TOMS AÉREOS". */
function equipoDe(t: string): string {
  const i = t.search(TIENE_MEDIDA);
  return (i < 0 ? t : t.slice(0, i)).replace(/\s+(de|del|of|en)\s*$/i, "").trim();
}

const primeraPalabra = (t: string) => (t.match(/^[\p{L}][\p{L}\d-]*/u)?.[0] ?? "").toLowerCase();

type PiezaLeida = Pieza & { deMedida: boolean; base: number | null; repite?: boolean };

/** Corta un trozo (ya sin separadores fuertes) en piezas. */
function cortarTrozo(trozo: string): Pieza[] {
  // Lo que viene después de " O " son alternativas de la última pieza: no se corta.
  const iAlt = trozo.search(/\s(?:o|or|u|ó)\s/i);
  const principal = iAlt < 0 ? trozo : trozo.slice(0, iAlt);
  const alternativa = iAlt < 0 ? "" : trozo.slice(iAlt);
  // "6,5”" es un decimal: la coma entre dos números no separa.
  const partes = partirFuera(principal, /\s*(?:(?<!\d),|,(?!\d))\s*|\s+(?:y|and|e|&)\s+/i);
  const piezas: PiezaLeida[] = [];
  for (const { texto: p, sep } of partes) {
    const ant = piezas.at(-1);
    const c = cantidadDe(p);
    if (!ant) { piezas.push({ cantidad: c.cantidad, texto: c.resto, deMedida: false, base: c.cantidad }); continue; }
    const conResto = c.cantidad === null ? p.match(MEDIDA_Y_RESTO) : null;
    const juntar = () => { ant.texto += `${sep.trim() === "," ? "," : ` ${sep.trim()}`} ${p}`; };
    // "Snare 14”, 6.5” deep": la profundidad del mismo tambor.
    if (conResto && PROFUNDIDAD.test(conResto[2]!)) { juntar(); continue; }
    // "3 Congas: quinto, conga y tumba": los tambores de un set de congas son el mismo set.
    if (SET_CONGAS.test(ant.texto) && c.cantidad === null && TAMBOR_DE_CONGAS.test(p)) { juntar(); continue; }
    // "1 Ampeg SVT Classic head and 8x10 cabinet": la caja es otra pieza (una, aunque diga 8x10).
    if (c.cantidad === null && CAJA_PARLANTES.test(p)) { piezas.push({ cantidad: 1, texto: p, deMedida: false, base: 1 }); continue; }
    if (SOLO_MEDIDAS.test(p) || (conResto && !PIEZA.test(conResto[2]!))) {
      // "Timbales 14” y 15”", "Congas 11”, 11¾” y 12½”": las medidas de un set de percusión no lo parten.
      if (SET_PERCUSION.test(ant.texto)) { juntar(); continue; }
      // "…16” Y 18”", "…10” y 12” con soporte": otra del mismo equipo, con su medida.
      ant.deMedida = true;
      piezas.push({ cantidad: null, texto: `${equipoDe(ant.texto)} ${p}`, deMedida: true, base: null });
      continue;
    }
    // "…, 16” Floor tom": otra pieza, con la medida adelante.
    if (conResto) { piezas.push({ cantidad: null, texto: p, deMedida: false, base: null }); continue; }
    // "KORG KRONOS 88 Y KORG KRONOS 61": repite la marca de la anterior, es otro modelo. "YAMAHA MOTIF 8 XF Y
    // MOTIF XF 7": empieza con una palabra de la anterior (el modelo) y los dos traen su número.
    const pp = primeraPalabra(c.resto);
    const palabrasAnt = ant.texto.toLowerCase().split(/[^\p{L}\d-]+/u);
    const repite = pp.length >= 3 && TIENE_MEDIDA.test(c.resto) === TIENE_MEDIDA.test(ant.texto)
      && (pp === primeraPalabra(ant.texto) || (palabrasAnt.includes(pp) && /\d/.test(c.resto) && /\d/.test(ant.texto)));
    if (!(c.cantidad !== null || PIEZA.test(c.resto) || repite) || (ACOMPANA.test(c.resto) && c.cantidad === null)) { juntar(); continue; }
    if (repite) ant.repite = true;
    piezas.push({ cantidad: c.cantidad, texto: c.resto, deMedida: false, base: c.cantidad, repite });
  }
  if (alternativa) piezas.at(-1)!.texto += alternativa;
  // "2 CRASH DE 16” Y 18”": la cantidad se reparte entre las medidas (una de cada una).
  for (let i = 0; i < piezas.length; i++) {
    const p = piezas[i]!;
    if (!p.deMedida || p.base === null) continue;
    let n = 1;
    while (i + n < piezas.length && piezas[i + n]!.deMedida && piezas[i + n]!.base === null) n++;
    if (p.base === n) for (let k = 0; k < n; k++) piezas[i + k]!.cantidad = 1;
  }
  return piezas.flatMap(medidaPorMedida).map(p => ({
    cantidad: p.cantidad ?? (p.deMedida || p.repite ? 1 : null),
    // "CRASH DE 16”" se escribe "CRASH 16”" cuando la medida va sola.
    texto: p.texto.replace(new RegExp(`^(\\p{L}+)\\s+(?:de|del|of)\\s+(?=${MEDIDA})`, "iu"), "$1 "),
  }));
}

/** "3 Toms: 8’’ 10’’ 14’’", "3 Rack Toms 8” - 10”- 12”": tantas medidas seguidas como la cantidad → una pieza por medida. */
function medidaPorMedida(p: PiezaLeida): PiezaLeida[] {
  const m = p.texto.match(new RegExp(`^([\\p{L}][\\p{L}\\s-]*?)\\s*:?\\s+((?:${MEDIDA})(?:\\s*[-–]?\\s*(?:${MEDIDA}))+)$`, "iu"));
  if (!m || p.cantidad === null || p.cantidad < 2 || SET_PERCUSION.test(m[1]!)) return [p];
  const medidas = [...m[2]!.matchAll(new RegExp(MEDIDA, "gi"))].map(x => x[0]);
  if (medidas.length !== p.cantidad) return [p];
  return medidas.map(med => ({ ...p, cantidad: 1, deMedida: true, texto: `${m[1]!.trim()} ${med}` }));
}

/** Las piezas de un renglón, de izquierda a derecha; null si es una sola. */
export function cortarRenglon(t: string): Pieza[] | null {
  const limpio = t.replace(/^[\s•·*●▪◦○-]+/, "").trim();
  // Separadores fuertes: viñeta en medio, punto y coma, o un punto suelto antes de una cantidad.
  let fuertes = partirFuera(limpio, /\s+[•·●▪◦○]\s+|\s*;\s*|\s+\.\s+(?=\d)/);
  // "Type/ Tipo • 1 HIHAT DE 14”": lo de antes de la primera viñeta es una etiqueta, no una pieza.
  const etiqueta = fuertes.length >= 2 && !/\d/.test(fuertes[0]!.texto) && fuertes[0]!.texto.split(/\s+/).length <= 3 && !PIEZA.test(fuertes[0]!.texto) && !HARDWARE.test(fuertes[0]!.texto);
  if (etiqueta) fuertes = fuertes.slice(1);
  const enTrozos = (fuertes.length >= 2 || etiqueta) && fuertes.every(f => tieneCantidad(f.texto) || UNO.test(f.texto) || PIEZA.test(f.texto) || HARDWARE.test(f.texto));
  const trozos = enTrozos ? fuertes.map(f => f.texto) : [limpio];
  const piezas = trozos.flatMap(cortarTrozo).filter(p => /\p{L}/u.test(p.texto));
  if (piezas.length < 2 && !(etiqueta && enTrozos && piezas.length === 1)) return null;
  // Solo si cada pieza se sostiene sola: con cantidad, con medida o nombrando una pieza.
  // "Cabezal Ampeg SVT-4 PRO y gabinete 8x10": el cabezal con su caja detrás también se sostiene solo.
  const cabezal = (p: Pieza, i: number) => i === 0 && !!piezas[1] && CAJA_PARLANTES.test(piezas[1].texto) && /(?<![\p{L}])(head|cabezal|cabeza)(?![\p{L}])/iu.test(p.texto);
  if (!piezas.every((p, i) => p.cantidad !== null || TIENE_MEDIDA.test(p.texto) || PIEZA.test(p.texto) || HARDWARE.test(p.texto) || cabezal(p, i))) return null;
  return piezas;
}
