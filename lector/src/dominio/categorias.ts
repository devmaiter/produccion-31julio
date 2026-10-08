import type { Categoria } from "./entidades";

/** Equipo de in ears: "Shure PSM 1000", "Sennheiser EW IEM G4", petacas, antena helicoidal. */
export const IN_EARS = /(\bpsm ?-?\d{3,4}\b|\biems?\b|\bin ?-?ears?\b|\bew ?-?iem\b|\bsr ?2050\b|\bp(9|10)[rt]\+?\b|\bek ?(2000|300|500)\b|\bsr ?(2000|300)\b|petacas?|bodypacks?|monitoreo (personal|inal[aá]mbrico)|personal monitor|antenas? helicoidal(es)?|helical antennas?|combinador(es)? de antenas?|antenna combiner|\bpa ?821\b|\bac ?3000\b)/i;
/** Consolas: "Yamaha DM7", "CL5", "DiGiCo SD12", "Allen & Heath dLive", "X32"… o la palabra "consola". */
export const CONSOLAS = /(\bconsolas?\b|\bmixers?\b(?! de (dj|djm))|mezcladoras?|mesas? de (sonido|mezcla|audio)|\bdm ?[37]\b|\bcl ?[135]\b|\bql ?[15]\b|\brivage\b|digico|\bsd ?(5|7|8|9|10|11|12)\b|\bquantum ?\d|\bdlive\b|\bavantis\b|\bsq ?-?[567]\b|\b[xm] ?32\b|\bwing\b|\bvi ?(1|3|7)000\b|\bs6l\b|\bavid (venue|s6l)|\bsc ?48\b|\bmidas\b|\bheritage ?d\b|\btf ?[135]\b)/i;

/** El renglón ES un equipo de in ears o una consola: la palabra va justo después de la cantidad (y de la
 *  marca): "16 Shure PSM 1000", "2 DM7 con 48 canales", "CONSOLA FOH: Yamaha CL5". En "3 LIDER IEM" o
 *  "13 DRUMS L IEM (PSM1000)" el IEM es la mezcla de un músico, no un equipo que se pide. */
const MARCA_AUDIO = /^(shure|sennheiser|yamaha|digico|allen ?(&|and|y) ?heath|a&h|midas|behringer|avid|soundcraft|lectrosonics|wisycom|audio-?technica)\s+/i;
const AL_INICIO = new RegExp(`^(?:${IN_EARS.source}|${CONSOLAS.source})`, "i");
export function equipoDeAudio(texto: string): boolean {
  const t = texto.replace(/^[\s•·*-]*(\d{1,3}\s*(x\s*)?)?/i, "").replace(/^(sistemas?|equipos?)\s+(de\s+)?/i, "").replace(MARCA_AUDIO, "");
  return AL_INICIO.test(t);
}

/* Reglas para adivinar la categoría por palabras clave (orden = prioridad).
   Vienen de la hoja de producción y se ampliaron con el vocabulario de las
   hojas de Cordillera (hardware de batería, percusión latina, cables).
   "Bases" va antes que los instrumentos para que "base de teclado" no caiga
   en "Teclado", y los amplis antes que "Bajo"/"Guitarra". */
const REGLAS: ReadonlyArray<readonly [Categoria, RegExp]> = [
  ["DJ",               /(\bcdj\b|\bdjm\b|pioneer|\bdj\b|tornamesa|turntable)/i],
  // In ears y consolas (los pidió el usuario como secciones propias): el sistema de monitoreo personal
  // (transmisor, petacas, antenas) y las mesas de mezcla. Van antes de todo: "PSM 1000" no es un canal
  // y "DM7 con 48 canales" no es un cable.
  ["In ears",          IN_EARS],
  ["Consolas",         CONSOLAS],
  // El HARDWARE de la batería es batería: así vienen los riders (DRUMS → HARDWARE con pedal,
  // stands, banqueta y tapete). Va antes de "Escenario" (tapete) y de "Bases" (stands, throne).
  ["Batería",          /((snares?|redoblantes?|tarolas?|hi ?-?hats?|hihats?|charles|cymbals?|c[ií]mbal(es)?|platillos?|boom|toms?|bombos?|kicks?)\s*(stands?|soportes?|bases?)\b|\b(stands?|soportes?|bases?)\s+((de|para|del)\s+)?(redoblante|tarola|snare|hi ?-?hat|charles|platillos?|cymbals?|c[ií]mbal(es)?|toms?|bombo)\b|\bdouble tom\b|\bthrone\b|banqueta|silla de bater|drum (stool|carpet|rug|mat)|(tapete|alfombra) (de |para )?(la )?bater|pedal de bombo|kick pedal|(twin|doble|double) pedal)/i],
  // Pedales de efectos y pedalboards son de la guitarra (o del bajo si lo dice), no de la batería.
  ["Bajo",             /((pedal(es)?|pedalboard|pedal ?board|efectos?|fx)\b.{0,25}\b(bajo|bass)\b|\bbass (pedals?|pedalboard|fx|effects?)\b)/i],
  ["Guitarra",         /(pedal(es)? de efectos?|pedalboard|pedal ?board|effects? pedals?|fx pedals?|tuner pedal|pedal afinador|\bafinador(es)?\b|\btuners?\b|\bwah\b|overdrive|distorsi[oó]n|\bhelix\b|\bkemper\b)/i],
  // Parches por su marca o modelo ("Remo Coated Ambassador", "Evans G2") y baquetas: son de la batería.
  ["Batería",          /(\b(remo|evans|aquarian)\b|ambassador|emperor|powerstroke|pinstripe|\bemad\b|\bg(1|2|14)\b|drum ?heads?|baquetas?|escobillas?|\bmallets?\b|drum ?sticks?|\bsticks\b|\bbrushes\b|vic firth)/i],
  ["Escenario",        /(stage fan|cooler fan|tapete|\bfans?\b|ventilador|fald[oó]n|plexiglass|sand ?bags|sacos de arena|alfombra|carpet|\brug\b|stage ?dex|\briser|tarima)/i],
  ["Percusión",        /(magician|percussion tables?|toys tables?|trap tables?|cortina|bar chimes|mark tree|mesas? (de percusi[oó]n|tipo mago|de toys))/i],
  ["Batería",          /(\bx ?-?hat\b|\bkd\b|\bclamps?\b|boom arm|\bspd\b|sample ?pad|octapad)/i],
  ["Cables y energía", /(\bcables?\b|transformador|convertidor|\bups\b|extensi[oó]n|regleta|power ?strip)/i],
  // Modelos de teclado: "YAMAHA MO6 STAND" es el teclado con su base, no una base.
  ["Teclado",          /(\bnord (stage|electro|piano|lead|wave)|kronos|montage|\bmodx\b|\bmo ?[68]\b|motif|fantom|\bjuno\b|triton|kurzweil|\bcp-?(73|88)\b|rd-?(88|2000)|yamaha es7)/i],
  ["Bases",            /(\bbases?\b|\bsoportes?\b|\batril|\bstands?\b|pie de micr[oó]|guitar boat|guitarrero|\bstool\b|\bsillas?\b|\bbancos?\b|\basientos?\b|\bthrone\b|laptop stand|mesa(?! ?boogie))/i],
  ["Ampli bajo",       /(\b[48] ?x ?10\b|\bampeg\b|\bsvt\b|gallien|\bgk\b|markbass|hartke|\brumble\b|aguilar|ampli(ficador)? de bajo|cabezal de bajo|bass head|bass cab)/i],
  ["Ampli guitarra",   /(hot ?rod|deville|blues junior|bassbreaker|twin reverb|deluxe reverb|jazz chorus|jc[- ]?120|marshall|vox ac|\borange\b|mesa ?boogie|princeton|katana|ampli(ficador)? de guitarra|cabezal de guitarra)/i],
  ["Teclado",          /(montage|\bnord\b|fantom|\bjuno\b|motif|kurzweil|\bkorg\b|\bmoog\b|kronos|triton|rd-?88|cp-?88|yamaha es7|teclado|\bpiano\b|keyboard|sintetizador|\bsynth\b|sustain|\bfc[47]\b)/i],
  ["Platillos",        /(\bh\/h\b|platillo|\bride\b|crash|splash|china|hi ?-?hat|hit hat|charles|c[ií]mbal|cymbal)/i],
  ["Percusión",        /(conga|bongo|timbal|\bquinto\b|\btumba\b|cencerro|cowbell|shekere|g[uü]iro|maraca|chimes|surdo|\bclave\b|\btoys\b|cajón|cajon|\blp\b|percusi[oó]n|tambora|alegre|llamador|guacharaca)/i],
  ["Bajo",             /(bass guitar|jazz bass|precision bass|\b[pj]-?bass\b|bajo el[eé]ctrico|^bass\b(?!.*\b(amp|head|cab|drum|pedal)))/i],
  ["Batería",          /(\bbd\b|\bsn\b|bater[ií]a|redoblante|tarola|bombo|\btoms?\b|snare|\bkick\b|drum|pedal|parches|\bspd\b|\bpad\b)/i],
  ["Ampli bajo",       /(\b\d+x\d+\b.*cabinet|cabinet)/i],
  ["Guitarra",         /(guitarra|guitar|telecaster|stratocaster|les paul|taylor|\bcuerdas\b)/i],
  ["Bajo",             /(\bbajo\b|\bbass\b)/i],
];

const SECCION_BATERIA = /\b(bater[ií]as?|drums?|drum ?kit|hardware)\b/i;
const SECCION_PERCUSION = /\b(percusi[oó]n|percussion|percu|perc)\b/i;
const ALFOMBRA = /\b(alfombras?|tapetes?|carpets?|rugs?|mats?)\b/i;
const HARDWARE = /\b(stands?|soportes?|bases?|sillas?|banquetas?|asientos?|throne|stool|tapetes?|alfombras?|carpet|rug|mat|pedal(es)?)\b/i;

/** Lo que nunca es backline aunque venga con el backline (lo definió el usuario): risers y sobretarimas,
 *  pedestales de micrófono, cajas directas, cables y la corriente en tarima. */
const NUNCA_BACKLINE = new RegExp([
  "\\b(risers?|drum ?risers?|sobre ?-?tarimas?|sobretarimas?|stage ?dex|plataformas?)\\b",
  "\\bpies? de micr[oó]fonos?|\\bmic(rophone)? stands?\\b|\\bstands? (de |para )?(micr[oó]fonos?|mics?)\\b|\\bjirafas?\\b",
  "\\bcajas? directas?|\\bdirect ?box(es)?\\b|\\bdi ?box(es)?\\b|\\bd\\.i\\.",
  "\\bcables?\\b|\\bcableado\\b|\\bregletas?\\b|\\bmultitomas?\\b|\\bpower ?strips?\\b|\\btransformador(es)?\\b|\\bconvertidor(es)?\\b|\\bups\\b",
  // Escenografía (plantas, lámparas, sofás, la sala): la piden con el backline, pero en la planilla no va.
  "\\bplantas?\\b|\\bl[aá]mparas?\\b(?!\\s+(de|para)\\s+atril)|\\bsof[aá]s?(?!\\p{L})|\\bsets? de sala\\b|\\bsala (para|de) \\d|\\bmesas? (de )?(centro|caf[eé]|coffee)(?!\\p{L})|\\bcoffee tables?\\b|\\btapetes? persas?\\b|\\bcojines\\b|\\bescenograf[ií]a\\b|\\bdecoraci[oó]n\\b",
].join("|"), "iu");
/** "DI" a secas solo en mayúscula: "di la vuelta" es texto. */
const DI = /\bDIs?\b/;
/** "Pedestal" o "extensión" a secas son de micrófono o de corriente, salvo que digan de qué instrumento son
 *  ("pedestal para platillo", "extensión para pedal de bombo"). Un pedestal en la sección de batería o
 *  percusión es hardware de esa sección; una extensión en la sección del bajo sigue siendo corriente. */
const PEDESTAL = /\bpedestal(es)?\b/i;
const EXTENSION = /\bextensi[oó]n(es)?\b/i;
const DE_INSTRUMENTO = /\b(platillos?|cymbals?|crash|ride|china|splash|hi-?hats?|redoblantes?|snares?|toms?|bombos?|kick|bater[ií]as?|drums?|percusi[oó]n|percussion|congas?|timbal(es)?|bong[oó]s?|teclados?|keyboards?|keys|guitarras?|guitars?|bajos?|bass|pedal(es)?|atriles?)\b/i;

export function noEsBackline(texto: string, grupo?: string | null): boolean {
  if (NUNCA_BACKLINE.test(texto) || DI.test(texto)) return true;
  if (DE_INSTRUMENTO.test(texto)) return false;
  if (PEDESTAL.test(texto)) return !(grupo && (SECCION_BATERIA.test(grupo) || SECCION_PERCUSION.test(grupo)));
  return EXTENSION.test(texto);
}

/** "Ampeg SVT Classic + 8x10": la caja de un ampli (para separarla del cabezal). */
export const CAJA_AMPLI = /\b(\d{1,2}\s*[x×]\s*(10|12|15)\b|cabinets?|\bcab\b|cajas?\b|bafles?|810e?|412|410|212|115)/i;

export function categorizar(texto: string): Categoria {
  // "Congas LP con sus bases", "Timbales con base": la base viene con el instrumento, no es una base.
  texto = texto.replace(/\b(con|with|incl\.?|incluye|including)\s+(su|sus|its|their|el|la|los|las)?\s*(bases?|soportes?|stands?)\b/gi, " ");
  for (const [cat, re] of REGLAS) {
    if (!re.test(texto)) continue;
    // Dentro de la sección de batería (el texto trae el grupo: "silla batería Baterías"), los stands,
    // sillas, tapetes y pedales son de la batería, como los pone cada rider en su sección.
    if ((cat === "Bases" || cat === "Escenario") && SECCION_BATERIA.test(texto) && HARDWARE.test(texto)) return "Batería";
    // Igual con la percusión: "percussion rug", "alfombra para percusión" o una alfombra en el
    // bloque de percusión es de la percusión. Una alfombra o un ventilador sueltos quedan en Escenario.
    if (cat === "Escenario" && SECCION_PERCUSION.test(texto) && ALFOMBRA.test(texto)) return "Percusión";
    return cat;
  }
  return "Otro";
}
