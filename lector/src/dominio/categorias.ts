import type { Categoria } from "./entidades";

/* Reglas para adivinar la categoría por palabras clave (orden = prioridad).
   Vienen de la hoja de producción y se ampliaron con el vocabulario de las
   hojas de Cordillera (hardware de batería, percusión latina, cables).
   "Bases" va antes que los instrumentos para que "base de teclado" no caiga
   en "Teclado", y los amplis antes que "Bajo"/"Guitarra". */
const REGLAS: ReadonlyArray<readonly [Categoria, RegExp]> = [
  ["DJ",               /(\bcdj\b|\bdjm\b|pioneer|\bdj\b|tornamesa|turntable)/i],
  ["Escenario",        /(stage fan|cooler fan|tapete|\bfans?\b|ventilador|fald[oó]n|plexiglass|sand ?bags|sacos de arena|alfombra|carpet|\brug\b|stage ?dex|\briser|tarima)/i],
  ["Percusión",        /(magician|percussion table|toys table|mesa (de percusi[oó]n|tipo mago|de toys))/i],
  ["Batería",          /(\bx ?-?hat\b|\bclamps?\b|boom arm|\bspd\b|sample ?pad|octapad)/i],
  ["Cables y energía", /(\bcables?\b|transformador|convertidor|\bups\b|extensi[oó]n|regleta|power ?strip)/i],
  // Modelos de teclado: "YAMAHA MO6 STAND" es el teclado con su base, no una base.
  ["Teclado",          /(\bnord (stage|electro|piano|lead|wave)|kronos|montage|\bmodx\b|\bmo ?[68]\b|motif|fantom|\bjuno\b|triton|kurzweil|\bcp-?(73|88)\b|rd-?(88|2000)|yamaha es7)/i],
  ["Bases",            /(\bbases?\b|\bsoportes?\b|\batril|\bstands?\b|pie de micr[oó]|guitar boat|guitarrero|\bstool\b|\bsillas?\b|\basientos?\b|\bthrone\b|laptop stand|mesa)/i],
  ["Ampli bajo",       /(\b[48] ?x ?10\b|\bampeg\b|\bsvt\b|gallien|\bgk\b|markbass|hartke|\brumble\b|aguilar|ampli(ficador)? de bajo|cabezal de bajo|bass head|bass cab)/i],
  ["Ampli guitarra",   /(hot ?rod|deville|blues junior|bassbreaker|twin reverb|deluxe reverb|jazz chorus|jc[- ]?120|marshall|vox ac|\borange\b|mesa ?boogie|princeton|katana|ampli(ficador)? de guitarra|cabezal de guitarra)/i],
  ["Teclado",          /(montage|\bnord\b|fantom|\bjuno\b|motif|kurzweil|\bkorg\b|\bmoog\b|kronos|triton|rd-?88|cp-?88|yamaha es7|teclado|\bpiano\b|keyboard|sintetizador|\bsynth\b|sustain|\bfc[47]\b)/i],
  ["Platillos",        /(\bh\/h\b|platillo|\bride\b|crash|splash|china|hi ?-?hat|hit hat|charles|c[ií]mbal|cymbal)/i],
  ["Percusión",        /(conga|bongo|timbal|\bquinto\b|\btumba\b|cencerro|cowbell|shekere|g[uü]iro|maraca|chimes|surdo|\bclave\b|\btoys\b|cajón|cajon|\blp\b|percusi[oó]n|tambora|alegre|llamador|guacharaca)/i],
  ["Bajo",             /(bass guitar|jazz bass|precision bass|\b[pj]-?bass\b|bajo el[eé]ctrico)/i],
  ["Batería",          /(\bbd\b|\bsn\b|bater[ií]a|redoblante|tarola|bombo|\btoms?\b|snare|\bkick\b|drum|pedal|parches|\bspd\b|\bpad\b)/i],
  ["Ampli bajo",       /(\b\d+x\d+\b.*cabinet|cabinet)/i],
  ["Guitarra",         /(guitarra|guitar|telecaster|stratocaster|les paul|taylor|\bcuerdas\b)/i],
  ["Bajo",             /(\bbajo\b|\bbass\b)/i],
];

export function categorizar(texto: string): Categoria {
  // "Congas LP con sus bases", "Timbales con base": la base viene con el instrumento, no es una base.
  texto = texto.replace(/\b(con|with|incl\.?|incluye|including)\s+(su|sus|its|their|el|la|los|las)?\s*(bases?|soportes?|stands?)\b/gi, " ");
  for (const [cat, re] of REGLAS) if (re.test(texto)) return cat;
  return "Otro";
}
