/* Texto leído (correo, PDF, OCR) → Extraccion, con reglas. Sin IA.
 *
 * Recorre las líneas en orden, llevando el contexto de la hoja: fecha,
 * escenario, artista y grupo actuales. Reconoce:
 *   - títulos de día ("Sábado 14 de noviembre", "12/09/2026")
 *   - escenario ("ESCENARIO LUNA", "Stage 2")
 *   - bloques de horario ("16:00 - 16:45 LA TROVA NUEVA", "Soundcheck 9:00 Los Rayos")
 *   - ítems de backline, en columnas ("Snare stand   2   CN") o en frase
 *     ("2 Snare stand", "Base de redoblante x2", "Platillos: 1 ride")
 *   - encabezados: de grupo ("DRUMS", "Bass") o de artista ("LOS RAYOS")
 * Lo que no entiende no lo inventa: lo devuelve en avisos para revisarlo.
 */
import { CAJA_AMPLI, categorizar, equipoDeAudio, noEsBackline } from "../dominio/categorias";
import type { Categoria, PaqueteEvento } from "../dominio/entidades";
import { separarCantidad } from "../dominio/lista";
import type { Documento, Linea } from "./documento";
import { cortarRenglon } from "./cortar";
import type { Extraccion } from "./esquema";
import { buscarDiaSemana, buscarFecha, HORA, normalizarHora } from "./fechas";

export interface ContextoLectura {
  /** Evento destino: sus artistas, días y escenarios se reconocen por nombre. */
  base?: PaqueteEvento | null;
  /** Todo lo leído es de este artista (cuando el archivo es el rider de una sola banda). */
  artista?: string;
  /** Todo lo leído es de este día (AAAA-MM-DD). */
  fecha?: string;
  /** Año por defecto; si no, el del correo, el del evento o el actual. */
  anio?: number;
  /** Si viene, se llena con lo que se decidió de cada renglón (para revisarlo y enseñarle al lector). */
  traza?: RenglonLeido[];
}

/** Qué hizo el lector con un renglón. */
export type Etiqueta = "item" | "no-backline" | "seccion" | "grupo" | "banda" | "nota" | "horario" | "dia" | "escenario" | "evento" | "sin-interpretar";
export interface RenglonLeido {
  documento: string;
  texto: string;
  etiqueta: Etiqueta;
  /** Por qué, en palabras: "sección de luces", "canal del input list", "radios y pilas no son backline"… */
  motivo: string;
  /** Sección del rider en ese momento: "backline", "audio", "otra" o "neutra". */
  seccion: string;
  grupo: string | null;
  /** Índice del ítem en extraccion.items cuando la etiqueta es "item". */
  item: number | null;
}

/** Líneas de OCR por debajo de esta confianza se marcan "confirmar". */
export const CONFIANZA_MINIMA = 75;

const GRUPOS = /^(drums?|drum ?kit|bater[ií]a|hardware( set)?|cymbals?( set)?|cymbal set|set cymbals|platillos|percussion|percusi[oó]n|bass|bajo|guitars?|guitarras?|keys|keyboards?|teclados?|tecaldo|dj( set)?|misc(elaneous)?|varios|otros|backline|equipos?|stage|tarima|amps?|amplificadores?|vientos|brass|horns|strings|cuerdas|vocals?|voces|power|energ[ií]a|cables|accesorios|sobre\s*tarimas?|risers?)$/i;
/* Títulos de sección hechos solo de palabras genéricas de instrumentos, como los escribe cada
 * rider a su manera: "Baterías", "Amplificadores de bajo", "Amplificadores de Guitarras
 * Eléctricas", "Teclado / Piano", "Percu", "Adicionales". Un modelo ("Fender Twin Reverb") no lo es. */
const PALABRAS_TITULO = new Set(("bateria baterias drum drums kit kits hardware platillo platillos cymbal cymbals percu perc percusion percussion " +
  "bajo bajos bass basses guitarra guitarras guitar guitars electrica electricas electrico electricos electric acustica acusticas acoustic " +
  "amplificador amplificadores amp amps ampli amplis teclado teclados keys keyboard keyboards piano pianos synth synths " +
  "sintetizador sintetizadores adicional adicionales extra extras otros varios misc miscelaneos accesorios vientos brass horns cuerdas " +
  "strings dj backline sax saxo saxofon saxofones saxophone trompeta trumpet trombon trombone flauta flute").split(" "));
const CONECTORES_TITULO = new Set(["de", "del", "y", "e", "para", "la", "las", "el", "los", "and", "for", "the", "of"]);
export function esTituloGenerico(t: string): boolean {
  const s = t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[\s:·|–—-]+$/, "");
  if (/\d/.test(s) || s.length > 50) return false;
  const palabras = s.split(/[\s/&+,()-]+/).filter(Boolean);
  if (!palabras.length || palabras.length > 6) return false;
  return palabras.some(p => PALABRAS_TITULO.has(p)) && palabras.every(p => PALABRAS_TITULO.has(p) || CONECTORES_TITULO.has(p));
}
/** Títulos de un rider que no son el nombre de la banda. */
const NO_ES_NOMBRE = /^(informaci[oó]n|contactos?|contact|datos|[ií]ndice|contenidos?|introducci[oó]n|presentaci[oó]n|requerimientos?|requisitos?|importante|management|producci[oó]n|staff|notas?|generalidades|tabla de contenido|tour|gira|world tour)\b/i;
/** Marcas de backline: un título que empieza por una de ellas es el modelo de la sección. */
const MARCA_EQUIPO = /^(yamaha|dw|pearl|tama|ludwig|gretsch|sonor|mapex|zildjian|paiste|sabian|meinl|istanbul|lp|fender|ampeg|marshall|vox|orange|mesa|roland|nord|korg|kurzweil|moog|gibson|hartke|aguilar|markbass|gallien|evans|remo|aquarian|vic)$/i;
/** Correos y teléfonos: nunca son backline. */
const CONTACTO = /[\w.+-]+@[\w-]+\.[\w.]+|\+\d{1,3}[\s.)-]*\d{2,3}[\s.-]?\d{3,4}[\s.-]?\d{3,4}|\b\d{3}[\s.-]\d{3}[\s.-]\d{4}\b|\(\+?\d{2,3}\)\s*\d{3}/;
/** Consumibles: nunca son backline, aunque nombren una marca de amplis ("ORANGE GAFFER TAPE"). */
const CONSUMIBLE = /\b(gaf+er|tape|cinta|pilas?|batteries|procell|duracell|toallas?|towels?)\b/i;
/** Banda de un rider que no dice su nombre en el texto. */
export const SIN_NOMBRE = "Banda sin nombre";
const MARCAS = /\b(puertas|doors|noise curfew|curfew|almuerzo|lunch|cena|dinner|break|receso|apertura|cierre)\b/i;
const TIPO_BLOQUE: Array<[RegExp, Extraccion["bloques"][number]["tipo"]]> = [
  [/\b(line ?check)\b/i, "linecheck"],
  [/\b(sound ?check|prueba(s)? de sonido|prueba)\b/i, "soundcheck"],
  [/\b(load ?in|carga|descargue|llegada)\b/i, "load-in"],
  [/\b(montaje|set ?up|lx|vx|working areas?|ensayo t[eé]cnico)\b/i, "montaje"],
  [/\b(changeover|cambio)\b/i, "cambio"],
  [/\b(show|presentaci[oó]n|concierto)\b/i, "show"],
];
const PALABRAS_BLOQUE = /\b(line ?check|sound ?check|pruebas? de sonido|prueba|load ?in|montaje|set ?up|changeover|cambio|show|presentaci[oó]n|concierto|working areas?|lx|vx|on stage|off stage)\b/gi;
const ESCENARIO = /\b(escenario|tarima|stage)\s+([\p{L}\d][\p{L}\d .'-]{0,30})/iu;
const EVENTO = /\b(festival|fest|al parque|concierto|temporada|tour|gira|feria|carnaval|evento)\b/i;
const PROVEEDOR = /^(cn|oml|backline(?: cop)?|propio|banda|artista|cliente|producci[oó]n|rental|[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ.&/ -]{1,24})$/;

const PROVEEDOR_SUELTO = /^(cn|oml|backline( cop)?|propio|banda)$/i;

/* Secciones del rider. Un rider completo trae mucho más que backline: input list,
 * mezclas de monitores, PA, luces, video, camerinos, catering, hotel, transporte.
 * Esas secciones tienen cantidades ("1 VAN para 15 personas", "27 SNARE 2 SM57")
 * que no son backline; dentro de ellas no se leen ítems. */
const SECCION_BACKLINE = /^(backline|back line|instrumentos|requerimientos? de backline|equipos? de backline|listado de backline|lista de backline)\b/i;
const SECCION_AUDIO = /^(input(s| list)?|mixers? de monitores?|requerimientos? de (sala|audio|sonido)|amplificaci[oó]n de sala|channel list|lista(do)? de canales|patch|output(s| list| mix)?|monitor(es|eo)?|monitor mix|monitor world|mezclas?( de monitores)?|pa\b|p\.\s?a\.?|sistema de (sonido|pa)|sonido|audio|foh|front of house|control (foh|monitor(es|s)?)|microfon[ií]a|micr[oó]fonos|microphones?|mic (list|packages?)|stands? de mic(r[oó]fonos?)?|mic stands?|microphone stands?|cue monitor|arreglo principal|(sub ?)?snakes?|multipares?|wireless|inal[aá]mbricos|rf\b)/i;
/* In ears y consolas: secciones propias (las pidió el usuario). Lo que viene debajo se lee como el
 * backline, en su grupo: "IN EARS" → "16 Shure PSM 1000"; "CONSOLAS" → "2 Yamaha DM7". */
const SECCION_IN_EARS = /^((sistemas?|equipos?|requerimientos?) (de )?)?(iems?|in ?-?ears?|monitoreo (personal|inal[aá]mbrico)|personal monitors?)(\s+(de\s+|para\s+)?(la banda|banda|m[uú]sicos|artistas?))?$/i;
const SECCION_CONSOLAS = /^((requerimientos?|listado) (de )?)?(consolas?|mixers?|mezcladoras?|mesas? de (sonido|mezcla))(\s+(de\s+|para\s+)?(foh|monitores?|monitors?|sala|front of house))?$/i;
const SECCION_OTRA = /^(stage$|stage requirements?|stage needs|requerimientos? de (escenario|tarima)|requisitos de (escenario|tarima)|avisos?( importantes?)?$|stage plot|planta de escenario|ground support|stage ?hands|power( generators)?|generadores?|moving heads|follow ?spots?|fx$|sfx\b|efectos|luminarias?\b|seguidores\b|tarimas?$|risers?$|drum risers?$|sobre ?-?tarimas?$|led screens?|pantallas led|pronters|prompters?|teleprompters?|quick change|accesorios (artista|ballet|mariachi|staff|producci[oó]n)|alimentos|bebidas|comida|cena|iluminaci[oó]n|planta de iluminaci[oó]n|lighting|luces|lista de materiales|video|pantallas|screens?|led\b|catering|camerinos?|camarines?|dressing ?rooms?|hospitality|alimentaci[oó]n|comidas?|bebidas|hotel(es)?|hospedaje|alojamiento|estad[ií]a|transporte|traslados?|viajes?|vuelos?|seguridad|security|contactos?|contact|comunicaci[oó]n|prensa|grabaci[oó]n|fotograf[ií]a|merch(andising)?|pagos?|contrato|rigging|estructura|energ[ií]a el[eé]ctrica|planta el[eé]ctrica|generador(es)?|radios?|handies|walkie|motorola|intercom|backstage|pre-?show|after-?show|medidas|dimensiones|especiales|control\b|barricada|vallas?|credenciales|acreditaciones|invitaciones|guest ?list)/i;
/* Lo que no es backline aunque aparezca con cantidad dentro de la lista. */
const NO_BACKLINE = /\b(handies?|radios?|walkie|motorola|pilas?|cintas?|gaf+er|toallas?|agua|hielo|bebidas?|personas|habitaci[oó]n(es)?|suburban|vans?|guardias?|sillones?|espejos?|percheros?|(sub ?)?snakes?|multipar(es)?|retornos?|returns|canales|channels|pronters?|prompters?|iems?|in ?-?ears?|cuñas?|wedges?|sidefills?|subwoofers?)\b/i;
/* Renglón de input list: canal, instrumento y micrófono ("27  SNARE 2  SM 57  SHORT BOOM"). */
/** En una tabla, la primera columna que solo dice la familia ("Cymbals", "Percussion"). */
const FAMILIA_TABLA = /^(cymbals?|platillos?|percussion|percusi[oó]n)$/i;
const CANAL = /^\d{1,2}\s+.*\b(sm ?\d{2}|beta ?\d{2}|e ?9\d{2}|e ?6\d{2}|md ?4\d{2}|d ?box|di\b|ksm|c ?414|re ?20|m ?88|xlr|phantom|short boom|tall boom|claw)\b/i;

/** In ears y consolas se listan aunque vengan fuera de toda sección (los pidió el usuario). */
const deAudioPedido = (c: string) => c === "In ears" || c === "Consolas";

function seccionDe(t: string): { tipo: "backline" | "audio" | "otra"; grupo?: string } | null {
  const h = t.replace(/^[\s•·*\d.)-]+(?=\p{L})/u, "").trim();
  // "P.A." es abreviatura, no fin de frase.
  if (h.length > 70 || h.split(/\s+/).length > 9 || (/[.?!]$/.test(h) && h.split(/\s+/).length > 2)) return null;
  if (SECCION_BACKLINE.test(h)) return { tipo: "backline" };
  if (SECCION_IN_EARS.test(h)) return { tipo: "backline", grupo: "In ears" };
  if (SECCION_CONSOLAS.test(h)) return { tipo: "backline", grupo: "Consolas" };
  if (SECCION_AUDIO.test(h)) return { tipo: "audio" };
  if (SECCION_OTRA.test(h)) return { tipo: "otra" };
  return null;
}
const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const clave = (s: string) => sinTildes(s).toLowerCase().replace(/[^a-z0-9]+/g, "");
const letras = (s: string) => (s.match(/\p{L}/gu) ?? []).length;

/** "LA TROVA NUEVA" → "La Trova Nueva"; respeta lo que ya viene en mayúsculas y minúsculas. */
export function nombrePropio(s: string): string {
  const t = s.replace(/\s+/g, " ").replace(/[:\-–·|]+$/, "").trim();
  const fuera = t.replace(/\([^)]*\)/g, "").trim(); // "BAJO (Omar)": lo de fuera del paréntesis decide
  if (fuera !== fuera.toUpperCase()) return t;
  return t.toLowerCase().replace(/(^|[\s(])(\p{L}[\p{L}\d'-]*)/gu, (_, pre: string, w: string, off: number) =>
    pre + (off > 0 && /^(de|del|la|las|los|y|e|el|en|con)$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)));
}

export function interpretar(docs: Documento[], ctx: ContextoLectura = {}): Extraccion {
  const ext = interpretarCon(docs, ctx, true);
  if (ext.items.length) return ext;
  const trazaPrimera = ctx.traza ? [...ctx.traza] : null;
  if (ctx.traza) ctx.traza.length = 0;
  // Nada salió leyendo solo las secciones de backline: puede que el rider las llame de otra forma.
  // Se lee de nuevo sin separar secciones (los canales del input list igual se saltan) y todo queda para revisar.
  const todo = interpretarCon(docs, ctx, false);
  if (!todo.items.length) { if (ctx.traza && trazaPrimera) ctx.traza.splice(0, ctx.traza.length, ...trazaPrimera); return ext; }
  for (const i of todo.items) { i.dudoso = true; i.nota = [i.nota, "no encontré la sección de backline: revisar"].filter(Boolean).join(" · "); }
  todo.avisos.push("No reconocí la sección de backline del documento; lo encontrado queda para revisar.");
  return todo;
}

function interpretarCon(docs: Documento[], ctx: ContextoLectura, usarSecciones: boolean): Extraccion {
  const ext: Extraccion = { evento: null, escenarios: [], dias: [], artistas: [], bloques: [], items: [], avisos: [], zonas: [], puestos: [], canales: [], requisitos: [], planos: [], comparaciones: [] };
  const base = ctx.base ?? null;
  const conocidos = new Map<string, string>(); // clave → nombre como está registrado
  base?.artistas.forEach(a => conocidos.set(clave(a.nombre), a.nombre));
  const escenariosBase = base?.escenarios.map(e => e.nombre) ?? [];

  for (const doc of docs) {
    ext.avisos.push(...doc.avisos);
    const anio = ctx.anio ?? Number((doc.fechaReferencia ?? base?.evento.desde ?? String(new Date().getFullYear())).slice(0, 4));
    let fecha = ctx.fecha ?? null;
    let escenario: string | null = null;
    let artista = ctx.artista ? registrarArtista(ctx.artista) : null;
    let grupo: string | null = null;
    // Lo último que se decidió: "DRUMS" y debajo "YAMAHA MAPLE CUSTOM ABSOLUTE" es el modelo, no otra sección.
    let ultimaEtiqueta: Etiqueta | null = null;
    // Índice de cada ítem leído en este documento → ¿se leyó fuera de toda sección (antes del backline)?
    const fueraDeSeccion = new Map<number, boolean>();
    // "La agrupación lleva…" → lo que sigue lo pone el artista; "El festival suministra…" → lo pone la producción.
    let proveedorActual: string | null = null;
    // "Sustituciones aceptables:", "Guitarras spare", "Opción 2 …" → lo que sigue es alternativa, no suma.
    let modoAlternativa = false;
    // Dentro de un grupo ("DRUMS/BATERIA - FULANO DE TAL"), los subtítulos ("OPCIONES", "STANDS",
    // "Type/Tipo", "Accesorios") no abren otro grupo. Después de "OPCIONES EN ORDEN DE PRIORIDAD",
    // "1. … 2. … 3. …" es un ranking: solo la 1 cuenta. Después de "PARCHES", lo que sigue es nota.
    let familiaGrupo: string | null = null, listaOpciones = false, ranking = false, enParches = false, itemsDelSubgrupo = 0;
    const ponerGrupo = (nombre: string | null) => {
      grupo = nombre; familiaGrupo = nombre ? familiaDe(nombre) : null;
      listaOpciones = false; ranking = false; enParches = false; itemsDelSubgrupo = 0;
    };
    // En qué sección del rider va la lectura: "fuera" = audio, luces, catering…; ahí no se leen ítems.
    let seccion: "neutra" | "backline" | "audio" | "otra" = "neutra";
    // "RIDER TÉCNICO / LOS RAYOS 2026": el rider es de una sola banda y su nombre ya no cambia.
    let artistaFijo = !!ctx.artista, esperarArtista = false;
    const sinInterpretar: string[] = [];
    // Un rider escrito todo en mayúsculas no distingue encabezados de ítems por las mayúsculas.
    const conLetras = doc.lineas.filter(l => letras(l.texto) >= 3);
    const docEnMayusculas = conLetras.length > 0 && conLetras.filter(l => l.texto === l.texto.toUpperCase()).length / conLetras.length > 0.5;
    // Un rider con capítulos numerados ("3. BACKLINE", "3.1.- DRUMS"): los números de los títulos no son cantidades.
    // También "7. STAGE REQUIREMENTS" … "8. BACKLINE": capítulos de un nivel, si uno de ellos es el backline.
    const capituloDeBackline = doc.lineas.map(l => l.texto.trim().match(/^(\d{1,2})\s*\.\s*[-–]?\s*(\p{L}[^.]*)$/u))
      .find(m => m && SECCION_BACKLINE.test(m[2]!.replace(/[\s:·|–—-]+$/, "")));
    const conCapitulos = !!capituloDeBackline || doc.lineas.some(l => /^\s*\d{1,2}\s*\.\s*\d{1,2}\s*\.?\s*-?\s*\p{L}/u.test(l.texto));
    // Con el número del capítulo del backline sabido desde el principio, lo de otros capítulos queda
    // fuera aunque venga antes ("7. STAGE REQUIREMENTS" con sus boom stands de micrófono).
    let capituloBackline: number | null = capituloDeBackline ? Number(capituloDeBackline[1]) : null;
    // El capítulo en el que va la lectura ("5. SISTEMAS INALÁMBRICOS", "7. INPUT LIST").
    let capituloActual: number | null = null;

    if (doc.asunto) tituloEvento(doc.asunto);

    const renglones = sinRepetidos(unirRenglones(doc.lineas)).flatMap(dividirLista);
    // "1. Roland XPS-30 / 2. Roland JV-30 / 3. …": lista numerada; el número es el orden, no la cantidad.
    const NUMERADO = /^\s*(\d{1,2})\.\s+(?=\p{L})/u;
    const numerados = new Set<number>();
    renglones.forEach((r, i) => {
      const a = r.texto.match(NUMERADO), b = renglones[i + 1]?.texto.match(NUMERADO);
      if (a && b && Number(b[1]) === Number(a[1]) + 1) { numerados.add(i); numerados.add(i + 1); }
    });
    // En una tabla "cantidad | equipo | modelo | notas", lo que se repite en dos filas o más es del grupo.
    const vecesNota = new Map<string, number>();
    for (const r of renglones) {
      const cols = r.texto.trim().split(/\t|\s{2,}|\s+\|\s+/).map(c => c.trim()).filter(Boolean);
      if (cols.length < 2 || !/^\d{1,3}\s+\p{L}/u.test(cols[0]!)) continue;
      for (const c of new Set(cols.slice(1))) vecesNota.set(clave(c), (vecesNota.get(clave(c)) ?? 0) + 1);
    }
    const notasDeGrupo = new Set([...vecesNota].filter(([k, n]) => n >= 2 && k.length >= 3).map(([k]) => k));
    // ¿Lo que sigue es un input list? Canal + instrumento + micrófono en 2 de los próximos 4 renglones.
    // "Beta 58A", "SM58s", "Axient AD2": el micrófono con la letra de su modelo.
    const MIC = /\b(mic|sm ?\d{2}\p{L}?|beta ?\d{2}\p{L}?|d ?box|di\b|e ?9\d{2}|e ?6\d{2}|md ?4\d{2}|ksm|akg|shure|sennheiser|neumann|audix|re ?20|c ?414|axient|adx?[12]|ulx\w*|qlx\w*|slx\w*)(?!\p{L})/iu;
    const siguenCanales = (n: number) => renglones.slice(n + 1, n + 5).filter(x => CANAL.test(x.texto) || (/^\d{1,2}\s+\S/.test(x.texto.trim()) && MIC.test(x.texto))).length >= 2;
    for (let n = 0; n < renglones.length; n++) {
      const l = renglones[n]!;
      const original = limpiar(l.texto);
      let texto = original;
      if (!texto || letras(texto) + (texto.match(/\d/g) ?? []).length < 2) continue;
      const anotar = (etiqueta: Etiqueta, motivo: string, item: number | null = null) => {
        ultimaEtiqueta = etiqueta;
        ctx.traza?.push({ documento: doc.nombre, texto: original, etiqueta, motivo, seccion, grupo, item });
      };
      if (riderDe(texto)) { anotar("banda", "nombre del rider"); continue; }
      // Sin "RIDER TÉCNICO": "LOS RAYOS FEATURING ANA PÉREZ - GIRA 2026 (COLOMBIA)" de primer renglón y debajo
      // "Backline a proveer…": el título es la banda (sin lo de después del guion ni lo de entre paréntesis).
      if (!artistaFijo && !artista && n === 0 && texto === texto.toUpperCase() && letras(texto) >= 4 && texto.split(/\s+/).length <= 16
        && /\b(backline|rider|technical|t[eé]cnico)\b/i.test(renglones[1]?.texto ?? "")) {
        const nombre = texto.split(/\s+[-–—|]\s+/)[0]!.replace(/\([^)]*\)/g, "").trim();
        if (letras(nombre) >= 3) { fijar(nombre); anotar("banda", "título del documento"); continue; }
      }
      // "3.1.- DRUMS", "5.1 TARIMA", "4. SOUNDCHECK": el número del capítulo del rider, no una cantidad.
      const cap = capituloDe(texto, conCapitulos && !listaOpciones);
      if (cap) {
        texto = cap.titulo; capituloActual = cap.numero;
        const sec0 = seccionDe(cap.titulo);
        if (sec0?.tipo === "backline" && SECCION_BACKLINE.test(cap.titulo)) capituloBackline = cap.numero;
        // Otro capítulo del rider ("4. SOUNDCHECK", "5. ESCENARIO") termina el del backline.
        else if (capituloBackline !== null && cap.numero !== capituloBackline) {
          // "5.1 TARIMA" dentro del capítulo 5 (escenario): tampoco vuelve al backline.
          const terminaAqui = seccion !== "otra" && seccion !== "audio";
          seccion = "otra"; ponerGrupo(null);
          anotar(terminaAqui ? "seccion" : "no-backline", `capítulo ${cap.numero} del rider: el backline es el capítulo ${capituloBackline}`); continue;
        }
        // "3.3.- ELECTRIC GUITAR TOMÁS": capítulo con el instrumento y el músico, sin dos puntos.
        if (seccion !== "audio" && seccion !== "otra" && !/:/.test(texto) && esTituloDeInstrumento(texto.replace(/[\s:·|–—-]+$/, ""))) {
          ponerGrupo(nombrePropio(texto.replace(/[\s:·|–—-]+$/, ""))); modoAlternativa = false;
          anotar("grupo", "capítulo del instrumento"); continue;
        }
      }
      // "DRUMS: DW COLLECTOR, YAMAHA STAGE CUSTOM, PEARL MASTER CUSTOM": el título del instrumento con las
      // opciones de la banda. Es una sola batería (sus piezas vienen debajo); las marcas son información, no ítems.
      const conNota = seccion === "audio" || seccion === "otra" ? null : tituloConNota(texto);
      if (conNota) {
        ponerGrupo(nombrePropio(conNota.titulo)); modoAlternativa = false;
        if (seccion === "neutra" && capituloBackline !== null) seccion = "backline";
        anotar("grupo", conNota.opciones.length > 1 ? `título con opciones de la banda: ${conNota.opciones.join(" · ")}` : `título con nota: ${conNota.nota}`);
        continue;
      }
      if (seccion !== "audio" && seccion !== "otra") {
        const sinColaS = texto.replace(/[\s:·|–—-]+$/, "");
        const conMusico = grupoConMusico(sinColaS);
        if (conMusico) { ponerGrupo(nombrePropio(conMusico)); modoAlternativa = false; seccion = "backline"; anotar("grupo", "instrumento y músico"); continue; }
        // "Amplificadores de bajo" después de "Baterías" nombra otro instrumento: no es subtítulo, es otra sección.
        const otroInstrumento = !!familiaDe(sinColaS) && familiaDe(sinColaS) !== familiaGrupo;
        // "• PEDAL PARA BOMBO": con viñeta es un ítem de la lista, no un subtítulo.
        if (grupo && esSubtitulo(sinColaS) && !otraFamilia(sinColaS) && !otroInstrumento && !/^\s*[•●▪◦]/.test(l.texto)) {
          listaOpciones = false; ranking = false; enParches = false; modoAlternativa = false;
          if (/\b(options?|opciones?|opci[oó]n)\b/i.test(sinColaS) && !/^no\b/i.test(sinColaS)) {
            listaOpciones = true; ranking = /prioridad|priority/i.test(sinColaS);
            // "OPTIONS" sin ranking, después de lo pedido: lo que sigue es alternativa.
            // ("OPTIONS CABINETS" no: son las opciones de otra cosa, las cajas.)
            if (/^(options?|opciones?)(\s*\/\s*(options?|opciones?))?$/i.test(sinColaS) && itemsDelSubgrupo > 0) modoAlternativa = true;
          }
          if (/\b(parches|heads?)\b/i.test(sinColaS)) enParches = true;
          itemsDelSubgrupo = 0;
          anotar("nota", "subtítulo dentro del grupo"); continue;
        }
      }
      const sec = usarSecciones ? seccionDe(texto.replace(/[\s:·|–—-]+$/, "")) : null;
      if (sec) {
        const comoGrupo = sec.tipo === "backline" && GRUPOS.test(texto.replace(/[\s:·|–—-]+$/, "")) && !SECCION_BACKLINE.test(texto);
        // "DRUMS" dentro del input list es un grupo de canales, no el backline.
        if (!(comoGrupo && seccion === "audio" && siguenCanales(n))) { seccion = sec.tipo; ponerGrupo(null); modoAlternativa = false; }
        if (sec.grupo) { ponerGrupo(sec.grupo); anotar("grupo", `empieza la sección de ${sec.grupo.toLowerCase()}`); continue; }
        if (sec.tipo === "backline" && !comoGrupo) {
          // Empieza el backline de un rider (PDF o foto) y no se sabe de qué banda es: el nombre del archivo
          // ("LOS RAYOS - BACKLINE 2026.pdf") si el texto también lo nombra; si no, sin nombre. Sin esto se
          // perdía el listado entero.
          if (!artista && !conocidos.size && (doc.tipo === "pdf" || doc.tipo === "imagen")) fijar(nombreDelArchivo(doc.nombre, renglones) ?? SIN_NOMBRE);
          anotar("seccion", "empieza el backline"); continue;
        }
        if (sec.tipo !== "backline") { anotar("seccion", sec.tipo === "audio" ? "empieza una sección de audio (no es backline)" : "empieza una sección que no es backline"); continue; }
      }
      if (seccion === "audio" || seccion === "otra") {
        const sinColaF = texto.replace(/[\s:·|–—-]+$/, "");
        // "DRUMS" después de la sección de audio: es el backline, salvo que debajo vengan canales con micrófono.
        // Pero no en otro capítulo del rider ("Guitarras:" en el de inalámbricos, "VOCES" en el input list
        // cuando el backline es el capítulo 10), ni "VOCES": las voces no son backline.
        const otroCapitulo = capituloBackline !== null && capituloActual !== null && capituloActual !== capituloBackline;
        if (GRUPOS.test(sinColaF) && !SECCION_BACKLINE.test(sinColaF) && !otroCapitulo && !/^(vocals?|voces|voz)$/i.test(sinColaF) && (seccion === "otra" || !siguenCanales(n))) { seccion = "backline"; ponerGrupo(nombrePropio(sinColaF)); anotar("grupo", "título de instrumento: vuelve el backline"); continue; }
        // "CONSOLA FOH: Yamaha CL5", "8 Shure PSM 1000" dentro del audio: in ears y consolas sí se listan.
        const deAudio = seccion === "audio" ? categorizar(texto) : null;
        if ((deAudio === "In ears" || deAudio === "Consolas") && equipoDeAudio(texto) && !CANAL.test(texto) && !CONTACTO.test(texto)) {
          const grupoAntes = grupo as string | null, antesAu = ext.items.length;
          ponerGrupo(deAudio);
          if (item(texto, l) && ext.items.length > antesAu) { anotar("item", `${deAudio.toLowerCase()} en la sección de audio`, ext.items.length - 1); continue; }
          ponerGrupo(grupoAntes);
        }
        anotar("no-backline", seccion === "audio" ? "está en una sección de audio" : "está en una sección que no es backline");
        continue;
      }
      if (CANAL.test(texto)) { anotar("no-backline", "canal del input list (instrumento + micrófono)"); continue; }
      // Un correo o un teléfono nunca es backline (y no debe terminar en una planilla).
      if (CONTACTO.test(texto)) { anotar("no-backline", "datos de contacto"); continue; }
      // "IMAGEN DE EJEMPLO" (debajo de una foto) y "2 SETS DE BATERÍAS IGUALES" (la tabla ya trae las cantidades).
      if (/^(imagen|foto|image|picture)s? (de )?(ejemplo|referencia|example|reference)\b/i.test(texto)) { anotar("nota", "pie de foto"); continue; }
      if (/\bsets? de (bater[ií]as?|drums?)\b|\biguales\b|\bidentical\b/i.test(texto) && texto.split(/\s+/).length <= 7) { anotar("nota", "dice cuántos sets; las cantidades vienen en la tabla"); continue; }
      // "La banda lleva su teclado … pero necesitamos la base de teclado": dos piezas, lo que trae la
      // banda (marcado) y lo que pide (lo pone producción). Lo definió el usuario.
      const traePide = texto.match(/\b(?:lleva|llevan|trae|traen|brings?)\s+(?:su|sus|their|its|el|la|los|las)?\s*(.+?)[,;]?\s+(?:pero|but|y|and)\s+(?:se\s+)?(?:necesit\p{L}*|requier\p{L}*|requer\p{L}*|solicit\p{L}*|need\p{L}*)\s+(?:de\s+)?(?:la|el|una|un|las|los|the|an?)?\s*(.+?)\.?$/iu);
      if (traePide) {
        const previo: string | null = proveedorActual, antesTP = ext.items.length;
        proveedorActual = "ARTISTA";
        if (item(traePide[1]!, l) && ext.items.length > antesTP) anotar("item", "lo trae la banda", ext.items.length - 1);
        proveedorActual = null;
        const antesPide = ext.items.length;
        if (item(traePide[2]!, l) && ext.items.length > antesPide) anotar("item", "lo pide la banda", ext.items.length - 1);
        proveedorActual = previo;
        if (ext.items.length > antesTP) continue;
      }
      const quien = quienPone(texto);
      if (quien !== undefined) { proveedorActual = quien; if (letras(texto) > 40 || texto.split(/\s+/).length <= 5) { anotar("nota", quien ? "lo que sigue lo trae la banda" : "lo que sigue lo pone la producción"); continue; } }

      if (!artistaFijo && esEncabezadoArtistaConocido(texto)) { artista = conocidos.get(clave(texto))!; ponerGrupo(null); anotar("banda", "banda conocida del evento"); continue; }
      if (PROVEEDOR_SUELTO.test(texto)) { anotar("nota", "proveedor suelto"); continue; } // columna de proveedor que el OCR separó de su fila
      if (nota(texto)) { anotar("nota", "nota del rider"); continue; }
      const sinCola = texto.replace(/[\s:·|–—-]+$/, "");
      const pegados = variosGrupos(sinCola);
      // Un renglón con viñeta ("• Bajo eléctrico") es un equipo de una lista, no un título.
      // "PERCUSSION (MEINL PROFESSIONAL SERIES)", "BAJO (Omar)": el título sin lo que va entre paréntesis.
      const sinParentesis = sinCola.replace(/\s*\([^)]*\)\s*$/, "");
      if (GRUPOS.test(sinCola) || (sinParentesis !== sinCola && GRUPOS.test(sinParentesis)) || pegados || (esTituloGenerico(sinCola) && !/^\s*[•●▪◦·*–-]/.test(l.texto))) {
        // "CYMBALS" después de "DRUMS": es la misma batería, sigue en su grupo.
        if (grupo && familiaGrupo && familiaDe(sinCola) === familiaGrupo) { anotar("nota", "subtítulo del mismo instrumento"); continue; }
        ponerGrupo(nombrePropio(pegados ?? sinCola)); modoAlternativa = false; anotar("grupo", "título de instrumento"); continue;
      }
      // Dentro de una sección, sin cantidad, empieza por una marca y no nombra ningún equipo
      // ("YAMAHA MAPLE CUSTOM ABSOLUTE" dentro de DRUMS): es el modelo. "Fender Twin Reverb" sí es un ampli.
      const primera = sinCola.split(/[\s(]/)[0]!;
      if (grupo && !/^\d/.test(sinCola) && sinCola.split(/\s+/).length <= 6 && !/[.:;]$/.test(sinCola)
        && MARCA_EQUIPO.test(primera) && !GRUPOS.test(primera) && !esTituloGenerico(primera) && categorizar(sinCola) === "Otro") {
        anotar("nota", "marca o modelo de la sección"); continue;
      }
      if (encabezadoFuerte(sinCola, l)) {
        // Justo debajo del título de la sección, sin nada en medio: es la marca o el modelo, no otra sección.
        if (ultimaEtiqueta === "grupo" && grupo) { anotar("nota", "marca o modelo de la sección"); continue; }
        ponerGrupo(nombrePropio(sinCola)); modoAlternativa = false; anotar("grupo", "título en mayúsculas"); continue;
      }
      // "* LA BATERÍA DEBERÁ CONTAR CON PARCHES NUEVOS": indicación, no equipo.
      if (/\b(deber[aá]n?|debe|should|must)(?!\p{L})/iu.test(texto) && !/^\d/.test(texto)) { anotar("nota", "indicación del rider"); continue; }
      // Los parches son ítems de la batería (lo definió el usuario); si el renglón no se entiende como equipo, queda de nota.
      if (enParches && !/^\d/.test(texto)) {
        const antesP = ext.items.length;
        if (item(texto, l) && ext.items.length > antesP) { itemsDelSubgrupo++; anotar("item", "parche", ext.items.length - 1); continue; }
        anotar("nota", "parches recomendados"); continue;
      }
      // "1. SONOR PRO LITE  2. DW COLLECTOR": opciones en orden; la 1 es la preferida y las demás no suman.
      // Con "EN ORDEN DE PRIORIDAD" también vale sin punto: "1 AMPEG SVT 450", "2 AGUILAR DB751".
      const rank = listaOpciones ? texto.match(ranking ? /^(\d)\s*[.)]?\s+(\p{L}.*)$/u : /^(\d)\s*[.)]\s*(\p{L}.*)$/u) : null;
      if (rank) {
        if (categorizar(rank[2]!) === "Otro") { anotar("nota", `opción ${rank[1]}: marca o modelo`); continue; }
        const antesR = ext.items.length;
        if (item(`Opción ${rank[1]} ${rank[2]}`, l) && ext.items.length > antesR) { itemsDelSubgrupo++; anotar("item", `opción ${rank[1]}`, ext.items.length - 1); continue; }
      }
      const sola = sinCola.match(/^opci[oó]n\s*#?\s*(\d)$/i);
      if (sola) { modoAlternativa = Number(sola[1]) > 1; anotar("nota", "opción"); continue; }
      const alt = marcaAlternativa(sinCola);
      if (alt !== undefined) { modoAlternativa = alt; if (letras(sinCola) < 4 || /^(opci[oó]n|sustitu|alternativa|spare|.*\bspare)/i.test(sinCola) && sinCola.split(/\s+/).length <= 4) { anotar("nota", alt ? "empiezan alternativas" : "vuelve lo preferido"); continue; } }
      if (bloqueHorario(texto)) { anotar("horario", "hora de un bloque"); continue; }
      // Cada renglón de la lista es una pieza: "1. Roland XPS-30" → "1 Roland XPS-30".
      if (numerados.has(n) && !listaOpciones) texto = texto.replace(NUMERADO, "1 ");
      // "1 Ampeg SVT Classic + 8x10": cabezal y caja son dos piezas (lo definió el usuario).
      const ampli = cabezalYCaja(texto);
      if (ampli) {
        const antesA = ext.items.length;
        for (const parte of ampli) {
          const a = ext.items.length;
          if (item(parte, l) && ext.items.length > a) {
            itemsDelSubgrupo++; anotar("item", "cabezal y caja por separado", ext.items.length - 1);
            const g = grupo as string | null;
            fueraDeSeccion.set(ext.items.length - 1, seccion === "neutra" && !(g && (GRUPOS.test(g) || esTituloGenerico(g) || categorizar(g) !== "Otro")));
          }
        }
        if (ext.items.length > antesA) continue;
      }
      const antes = ext.items.length, artistaAntes = artista;
      if (item(texto, l)) {
        if (ext.items.length > antes) {
          itemsDelSubgrupo++; anotar("item", "equipo con cantidad o reconocido", ext.items.length - 1);
          // Fuera de toda sección y sin un título de instrumento encima ("RIDER TÉCNICO" no lo es).
          const g = grupo as string | null; // ponerGrupo lo cambia desde una función: TypeScript no lo ve
          const deInstrumento = !!g && (GRUPOS.test(g.replace(/\s*\([^)]*\)\s*$/, "")) || esTituloGenerico(g) || categorizar(g) !== "Otro");
          // In ears y consolas no se quitan, pero tampoco dicen dónde empieza el backline: no se anotan.
          if (!deAudioPedido(ext.items.at(-1)!.categoria)) fueraDeSeccion.set(ext.items.length - 1, seccion === "neutra" && !deInstrumento);
        } else anotar("no-backline", artistaAntes ? "radios, pilas, cinta… no son backline" : "parece backline pero no se sabe de qué banda");
        continue;
      }
      if (!ctx.fecha && diaDeLinea(texto)) { anotar("dia", "fecha"); continue; }
      if (lineaEscenario(texto)) { anotar("escenario", "nombre del escenario"); continue; }
      const artistaPrevio = artista;
      // "FULANO DE TAL GEAR", "EQUIPO DE FULANA": el equipo de un músico, no el nombre de la banda.
      if (/^[\p{L} .'-]{3,40}\s+(gear|equipment|rig)$|^(equipo|backline) de [\p{L} .'-]{3,40}$/iu.test(texto) && texto.split(/\s+/).length <= 6) { anotar("nota", "equipo de un músico"); continue; }
      if (encabezado(texto)) { anotar(artista !== artistaPrevio ? "banda" : "grupo", artista !== artistaPrevio ? "título que parece nombre de banda" : "título de grupo"); continue; }
      if (!ext.evento && tituloEvento(texto)) { anotar("evento", "nombre del evento"); continue; }
      anotar("sin-interpretar", "no lo entendí");
      sinInterpretar.push(texto);
    }

    // Si el rider tiene sección de backline (o títulos de instrumento), lo que se leyó antes, fuera de
    // toda sección (medidas de la tarima, wifi…), no era backline: se quita. Los in ears y las consolas se quedan.
    if ([...fueraDeSeccion.values()].some(fuera => !fuera)) {
      const quitar = new Set([...fueraDeSeccion].filter(([, fuera]) => fuera).map(([i]) => i));
      if (quitar.size) {
        const nuevoIndice = new Map<number, number>();
        const quedan = ext.items.filter((_, i) => { if (quitar.has(i)) return false; nuevoIndice.set(i, nuevoIndice.size); return true; });
        ext.items.splice(0, ext.items.length, ...quedan);
        for (const r of ctx.traza ?? []) {
          if (r.item === null) continue;
          if (quitar.has(r.item)) { r.etiqueta = "no-backline"; r.motivo = "antes de la sección de backline"; r.item = null; }
          else r.item = nuevoIndice.get(r.item) ?? r.item;
        }
      }
    }

    // Subtítulos cortos ("Instrumento", "Amplificación", "Configuración:") no hace falta revisarlos.
    const subtitulo = (t: string) => t.split(/\s+/).length <= 3 && !/\d/.test(t) && /^\p{Lu}/u.test(t) && categorizar(t) === "Otro";
    const utiles = sinInterpretar.filter(t => letras(t) >= 4 && t.length <= 120 && !subtitulo(t));
    if (utiles.length && doc.tipo !== "correo") {
      ext.avisos.push(`${doc.nombre}: ${utiles.length} línea(s) sin interpretar, p. ej. "${utiles.slice(0, 3).join('", "')}".`);
    }

    /* ---- reglas, en el orden en que se prueban ---- */

    /** "RIDER TÉCNICO" y en el renglón siguiente "LOS RAYOS 2026": esa es la banda de todo el documento. */
    function riderDe(t: string): boolean {
      if (artistaFijo) return false;
      const m = t.match(/^(?:rider(?:\s+t[eé]cnico)?|technical\s+rider|tech\s+rider)(?:\s+(?:de|del|of|-|–|:))?\s*(.*)$/i);
      if (m) {
        const resto = m[1]!.replace(/\b(19|20)\d\d\b/g, "").replace(/\b(v|versi[oó]n)\s*\d+\b/gi, "").trim();
        if (letras(resto) >= 3 && resto.split(/\s+/).length <= 6) { fijar(resto); return true; }
        if (!resto) { esperarArtista = true; return true; }
        return false;
      }
      if (esperarArtista) {
        esperarArtista = false;
        const nombre = t.replace(/\b(19|20)\d\d\b/g, "").replace(/[\s:·|–—-]+$/, "").trim();
        // "RIDER TÉCNICO 2026" y debajo "INFORMACIÓN DE CONTACTO" u "HOLA": el nombre no está en el texto
        // (suele ir en el logo). Se busca el nombre que el rider repite; si no, se escribe al revisar.
        const saludo = SALUDO.test(nombre) || NO_ES_NOMBRE.test(nombre);
        if (!saludo && letras(nombre) >= 3 && nombre.split(/\s+/).length <= 6 && !/[.?!,;]/.test(nombre)) { fijar(nombre); return true; }
        const repetido = nombreRepetido(doc.lineas);
        if (repetido) fijar(repetido); else if (saludo) fijar(SIN_NOMBRE);
        return saludo && SALUDO.test(nombre);
      }
      return false;
    }
    function fijar(nombre: string) { artista = registrarArtista(nombre); artistaFijo = true; ponerGrupo(null); }

    function bloqueHorario(t: string): boolean {
      const rango = new RegExp(`(${HORA})\\s*(?:-|–|—|a|al|hasta|to)?\\s*(${HORA})?`, "i");
      const m = t.match(rango);
      if (!m) return false;
      const inicio = normalizarHora(m[1]!);
      if (!inicio) return false;
      // 12.50" es una medida, no una hora; "TAPETE 2.50 X 2.50" o "2.40 m" también.
      if (/^\s*(["”″´'x×]|(m|mts?|metros|cm)\b)/i.test(t.slice(m.index! + m[0].length)) || /[x×]\s*$/i.test(t.slice(0, m.index))) return false;
      const fin = m[2] ? normalizarHora(m[2]) : null;
      let resto = (t.slice(0, m.index) + " " + t.slice(m.index! + m[0].length)).replace(/\s+/g, " ").trim();
      const f = buscarFecha(resto, anio);
      if (f) { fecha = f.fecha; resto = f.resto; }
      resto = resto.replace(/^[\s:·|–—-]+|[\s:·|–—-]+$/g, "");
      if (!fecha) { ext.avisos.push(`${doc.nombre}: "${t}" tiene hora pero no se sabe de qué día.`); return true; }

      const tipo = TIPO_BLOQUE.find(([re]) => re.test(resto))?.[1] ?? (MARCAS.test(resto) ? "marca" : "show");
      const nombre = resto.replace(PALABRAS_BLOQUE, " ").replace(/[()]/g, " ").replace(/\s*[-–·|+]\s*$/,"").replace(/^\s*[-–·|+]\s*/, "").replace(/\s+/g, " ").trim();
      const esMarca = tipo === "marca" || MARCAS.test(resto) || (!nombre && tipo !== "show");
      const titulo = esMarca ? (nombre || resto || "Marca") : (resto.match(PALABRAS_BLOQUE)?.join(" ") || "Show");
      ext.bloques.push({
        fecha, escenario: escenario ?? (escenariosBase.length === 1 ? escenariosBase[0]! : null),
        artista: esMarca ? null : registrarArtista(nombre || resto),
        titulo: nombrePropio(titulo), tipo: esMarca ? "marca" : tipo, inicio, fin,
      });
      return true;
    }

    function item(t: string, l: Linea): boolean {
      let redactado = false, opcion: string | null = null;
      // "Opción 2 Fender Precision…" → el ítem es lo que sigue, como alternativa.
      const op = t.match(/^opci[oó]n\s*#?\s*(\d)\s*[:.)-]?\s+(\p{L}.*)$/iu);
      if (op) { opcion = op[1]!; t = op[2]!; }
      // Una frase del rider ("Soporte firme y regulable para tambora. Alternativa: …"): se toma la primera oración.
      const FRASE = /(?<!\b(?:ref|no|aprox|min|m[aá]x|art|num|ej|pág))[.;]\s+(?=\p{L})/u;
      if (FRASE.test(t) || (/\.$/.test(t) && t.split(" ").length > 6)) {
        const [primera, ...resto] = t.replace(/\.$/, "").split(FRASE).map(x => x.trim());
        const arranque = /^(las?|los|el|es|son|se|debe|deber[aá]n?|cada|todos?|est[aeo]s?|hay|no|si|para|por|en|con)\b/i;
        // "2 Mesas de percusión. Especial atención a estas bases…": la cantidad y el equipo van en la primera oración.
        if (primera && primera.split(" ").length <= 12 && categorizar(primera) !== "Otro" && (!/^\d/.test(primera) || /^\d{1,2}\s+\p{L}/u.test(primera)) && !arranque.test(primera)) {
          t = primera; redactado = resto.length > 0;
        }
      }
      let cols = t.split(/\t|\s{2,}|\s+\|\s+/).map(c => c.trim()).filter(Boolean);
      // "CONGA HI | QUINTO | LP559X | CLASIC": tabla sin cantidad cuya primera columna es el equipo;
      // el resto son medida, marca y modelo.
      const primera = cols.length >= 2 ? separarCantidad(cols[0]!) : null;
      if (primera && !cols.some((c, i) => i > 0 && (/^(x\s*)?\d{1,3}(\s*x)?$/i.test(c) || PROVEEDOR_SUELTO.test(c) || /^(cn|oml|artista|producci[oó]n)$/i.test(c)))
        // Con cantidad y tres columnas o más ("1 Kcik 22” | modelos | notas") es una fila de tabla aunque el
        // equipo venga mal escrito o sea genérico ("Percussion").
        && (categorizar(primera.descripcion) !== "Otro" || (cols.length >= 3 && primera.descripcion !== cols[0])) && letras(primera.descripcion) >= 3) {
        // "1 Cymbals | Ride 22” dark | MEINL": "Cymbals" es la familia; la pieza es la columna de al lado.
        let cabeza = cols[0]!, resto = cols.slice(1);
        if (FAMILIA_TABLA.test(primera.descripcion) && resto[0] && letras(resto[0]) >= 3) { cabeza = `${primera.cantidad} ${resto[0]}`; resto = resto.slice(1); }
        // La marca que se repite fila tras fila ("DW Collector's / Yamaha…") es del grupo, no de cada pieza.
        const notas = [...new Set(resto)].filter(c => !notasDeGrupo.has(clave(c)));
        t = notas.length ? `${cabeza} (${notas.join(", ")})` : cabeza; cols = [t];
      }
      // "Fender  Deville 2x12": dos espacios de más no son columnas si ninguna es cantidad ni proveedor.
      if (cols.length >= 2 && !cols.some((c, i) => /^(x\s*)?\d{1,3}(\s*x)?$/i.test(c) && (i > 0 || cols.length >= 3)) && !cols.some(c => PROVEEDOR_SUELTO.test(c) || /^(cn|oml|artista|producci[oó]n)$/i.test(c))) {
        cols = [cols.join(" ")];
      }
      let descripcion: string, cantidad: number, proveedor: string | null = null, explicita = false;
      let principal: string | null = null; // la descripción sin las notas de otras columnas
      // "HI-HAT STAND DE   3   PATAS": el pedazo termina en "de", así que lo que sigue es la misma frase
      // (de 3 patas), no una columna de cantidad y otra de proveedor.
      if (cols.some((c, i) => i < cols.length - 1 && /\s(de|del|con|para|a|of|with|for)$/i.test(c))) { t = cols.join(" "); cols = [t]; }

      if (cols.length >= 2 && /^(x\s*)?\d{1,3}(\s*x)?$/i.test(cols[0]!) && letras(cols[1]!) >= 2) {
        // "1 | Bombo 22" | Parche frontal sin logo": tabla con la cantidad primero.
        cantidad = Number(cols[0]!.replace(/\D/g, "")); descripcion = cols[1]!; principal = descripcion; explicita = true;
        const resto = cols.slice(2);
        proveedor = resto.find(c => PROVEEDOR_SUELTO.test(c) || /^(cn|oml|artista|producci[oó]n)$/i.test(c)) ?? null;
        const notas = resto.filter(c => c !== proveedor);
        if (notas.length) descripcion += ` (${notas.join(", ")})`;
      } else if (cols.length >= 2) {
        const iNum = cols.findIndex((c, i) => i > 0 && /^(x\s*)?\d{1,3}(\s*x)?$/i.test(c));
        const desc = cols.find((c, i) => i !== iNum && letras(c) >= 2);
        if (!desc) return false;
        descripcion = desc;
        cantidad = iNum > 0 ? Number(cols[iNum]!.replace(/\D/g, "")) : separarCantidad(desc).cantidad;
        if (iNum < 0) descripcion = separarCantidad(desc).descripcion;
        explicita = iNum > 0 || separarCantidad(desc).descripcion !== desc;
        const resto = cols.filter((c, i) => i !== iNum && c !== desc);
        principal = descripcion;
        proveedor = resto.find(c => PROVEEDOR.test(c)) ?? null;
        const notas = resto.filter(c => c !== proveedor);
        if (notas.length) descripcion += ` (${notas.join(", ")})`;
      } else {
        // "Snare stand 2 CN" cuando el OCR juntó las columnas
        // Si el renglón ya empieza con la cantidad ("2 ROLAND JC 120 JAZZ CHORUS", "1 MEINL CORTINA 27 BARRAS"),
        // el número del medio es del modelo y lo último no es un proveedor.
        const junta = /^\d{1,3}\s*\p{L}/u.test(t) ? null : t.match(/^(.+?\p{L}.*?)\s+(\d{1,3})\s+(CN|OML|BACKLINE(?: COP)?|[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ]{1,15}(?: [A-ZÁÉÍÓÚÑ]{2,15})?)$/u);
        const conCat = t.match(/^([\p{L}][\p{L}\s/&]{1,40}):\s*(.+)$/u); // "Platillos: 1 ride, 2 crash"
        if (junta && letras(junta[1]!) >= 3 && !/\s(de|del|con|para|a|of|with|for)$/i.test(junta[1]!)) {
          descripcion = junta[1]!; cantidad = +junta[2]!; proveedor = junta[3]!; explicita = true;
        } else {
          const cuerpo = conCat && categorizar(conCat[1]!) !== "Otro" ? conCat[2]! : t;
          const s = separarCantidad(cuerpo);
          descripcion = s.descripcion; cantidad = s.cantidad; explicita = s.descripcion !== cuerpo;
          if (conCat && cuerpo !== t) descripcion = `${conCat[1]}: ${descripcion}`;
        }
      }
      descripcion = descripcion.replace(/^[\s•·*-]+/, "").replace(/[\s:,;.·•●▪|–—-]+$/, "").trim()
        // "2 (dos) Fender Hot Rod…": la cantidad escrita en letras ya está en el número.
        .replace(/^\((?:uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|one|two|three|four|five|six|seven|eight|nine|ten)\)\s*/i, "")
        // "2 SNARE DRUM 14” X 5” WITH" (lo que sigue quedó en otro ítem): sin la palabra colgando.
        .replace(/\s+(with|w\/|con|y|and|para|for|de|of)$/i, "");
      if (!explicita && /:$/.test(t)) return false; // "BASS ASI:" es un encabezado, no un ítem
      // Sin cantidad, más de 8 palabras es una frase del rider ("Cada equipo deberá estar en perfectas condiciones…"),
      // salvo una lista de modelos ("Ampeg SVT Classic/SVT PRO 3/ SVT PRO 4 + Ampeg SVT810E, Fender Rumble 500 o Aguilar AG700").
      const palabras = descripcion.replace(/\([^)]*\)/g, " ").split(/\s+/).filter(w => letras(w) > 0).length;
      const deFrase = /\b(debe|deber[aá]n?|deben|estar|est[eé]n|ser[aá]n?|tener|tengan|cada|todos?|todas?|necesitamos|requerimos|solicitamos|favor|que|cuando|must|should|will|please|each|every)\b/i;
      if (!explicita && opcion === null && palabras > 8 && (deFrase.test(descripcion) || !/\d/.test(descripcion))) return false;
      // "TOMS 10”, 12”" son dos toms. "TOMS 12”, 14” Y 16” O 16” 18”": tres; lo que va después de "O" es la alternativa.
      if (!explicita && /^toms?\b/i.test(descripcion)) {
        const medidas = descripcion.split(/\s+(?:o|or|u)\s+/i)[0]!.match(/\b\d{1,2}\s*(?:["”″]|pulg)/g) ?? [];
        if (medidas.length >= 2) cantidad = medidas.length;
      }
      if ((letras(descripcion) < 3 && categorizar(`${descripcion} ${grupo ?? ""}`) === "Otro") || descripcion.replace(/\s*\([^)]*\)/g, "").length > (explicita || opcion !== null ? 140 : 90)) return false; // las opciones entre paréntesis no cuentan
      const categoria: Categoria = categorizar(`${principal ?? descripcion} ${grupo ?? ""}`);
      if (NO_BACKLINE.test(descripcion) && categorizar(principal ?? descripcion) === "Otro") return true; // radios, pilas, cinta: se lee pero no es backline
      // "3 LIDER IEM": la mezcla de in ear de un músico, no un equipo. En la sección de in ears sí cuenta.
      if (["In ears", "Consolas"].includes(categoria) && !equipoDeAudio(descripcion) && !(grupo === "In ears" || grupo === "Consolas")) return true;
      if (CONSUMIBLE.test(descripcion)) return true; // "ORANGE GAFFER TAPE": la marca de un ampli no lo vuelve backline
      if (noEsBackline(descripcion, grupo)) return true; // risers, pedestales de mic, DI, cables y corriente: se piden con el backline pero no lo son
      // Sin cantidad explícita solo es ítem si se reconoce el equipo por su nombre
      // (salvo lo que la banda dice que trae: "Gaita hembra" también cuenta).
      const loTraeLaBanda = proveedorActual === "ARTISTA" && !proveedor && descripcion.split(" ").length <= 4 && !/[.?!]$/.test(t);
      if (!explicita && opcion === null && categorizar(descripcion) === "Otro" && !loTraeLaBanda) return false;
      const sinNotas = descripcion.replace(/\([^)]*\)/g, "");
      if (!explicita && sinNotas.split(",").length >= 3 && !/\d/.test(sinNotas)) return false; // "Ampeg, Markbass, Fender o equivalente": marcas, no equipo
      if (!explicita && /[.?!]$/.test(descripcion) && descripcion.split(" ").length > 6) return false; // una frase del correo
      if (!proveedor && proveedorActual) proveedor = proveedorActual;
      // "OPCIÓN #1" es lo preferido; desde la 2 son alternativas que no suman.
      const alternativa = (opcion !== null && opcion !== "1") || modoAlternativa;
      if (!artista) { ext.avisos.push(`${doc.nombre}: "${t}" parece backline pero no se sabe de qué artista. Indica el artista y vuelve a leer.`); return true; }
      const deOcr = l.confianza !== undefined;
      const baja = deOcr && l.confianza! < CONFIANZA_MINIMA;
      const sinCantidad = deOcr && !explicita;
      const notas = [
        baja ? `lectura dudosa (${l.confianza}%)` : sinCantidad ? "cantidad no leída en la foto" : "",
        alternativa ? `alternativa aceptada${opcion ? ` (opción ${opcion})` : ""}: no suma` : "",
        redactado ? "tomado de una frase del rider; revisar" : "",
      ].filter(Boolean);
      ext.items.push({
        artista, fecha, grupo, descripcion, cantidad: Math.max(0, cantidad), categoria,
        proveedor: proveedor ? proveedor.toUpperCase() : null, dudoso: baja || sinCantidad || alternativa || redactado,
        nota: notas.length ? notas.join(" · ") : null,
      });
      return true;
    }

    /** "Nota: los parches deben ser REMO" → se guarda como requisito, no como ítem. */
    function nota(t: string): boolean {
      // "Sugerimos: Tama Star Classic, Yamaha recording custom o similares." es el modelo que prefieren, sin cantidad.
      const m = t.match(/^(?:nota|note|nb|observaci[oó]n|importante|sugerimos|sugerido|sugerencia|sugerida|preferiblemente|preferible|preferido|preferida|recomendado|recomendamos|suggested|preferred|recommended)\s*[:.-]\s*(.+)$/i);
      if (!m) return false;
      if (artista) ext.requisitos.push({ artista, tema: "otro", texto: m[1]!.trim() });
      return true;
    }

    /** "BAJO (Omar)", "CUARTETO DE CUERDAS": encabezado en mayúsculas en un rider que no está todo en mayúsculas. */
    function encabezadoFuerte(t: string, l: Linea): boolean {
      if (!artistaFijo || docEnMayusculas || l.confianza !== undefined) return false;
      const base = t.replace(/\s*\([^)]*\)\s*$/, "").trim();
      if (/\d/.test(base) || letras(base) < 3 || base.split(/\s+/).length > 6 || /[.?!,;]/.test(base)) return false;
      return base === base.toUpperCase();
    }

    /** true: empieza un bloque de alternativas; false: vuelve lo preferido; undefined: la línea no dice. */
    function marcaAlternativa(t: string): boolean | undefined {
      const corta = t.split(/\s+/).length <= 5;
      if (!corta) return undefined;
      if (/^(sustituciones|sustitutos?|alternativas?|opci[oó]n alternativa|opciones alternativas|equivalentes? aceptables?)\b/i.test(t)) return true;
      // "Bajo spare", "Guitarras spare": el instrumento de repuesto también es backline y suma (lo definió el usuario).
      if (/^(spare|.*\bspares?)\b/i.test(t)) return false;
      if (/^opci[oó]n preferida\b|^preferid[oa]s?\b|^instrumentos? solicitados?\b|^instrumentos?$|^amplificaci[oó]n$|^configuraci[oó]n$/i.test(t)) return false;
      return undefined;
    }

    function diaDeLinea(t: string): boolean {
      let f = buscarFecha(t, anio);
      if (!f) {
        // "Sábado 12" sin mes: se completa con un día del evento que coincida.
        const n = buscarDiaSemana(t);
        const d = n ? base?.dias.find(x => +x.fecha.slice(8) === n) : undefined;
        if (d) f = { fecha: d.fecha, resto: "" };
      }
      if (!f || letras(f.resto) > 25) return false;
      fecha = f.fecha;
      const nombre = t.replace(/\s+/g, " ").trim();
      if (!ext.dias.some(d => d.fecha === f!.fecha)) {
        ext.dias.push({ fecha: f.fecha, nombre: nombrePropio(nombre), tipo: /prueba|soundcheck|montaje|ensayo/i.test(t) ? "pruebas" : "show" });
      }
      return true;
    }

    function lineaEscenario(t: string): boolean {
      const m = t.match(ESCENARIO);
      if (!m || t.length > 70) return false;
      const partes = t.split(/\s+[-–·|]\s+/);
      const nombreEsc = nombrePropio(partes.find(p => ESCENARIO.test(p)) ?? m[0]);
      escenario = escenariosBase.find(e => clave(e).includes(clave(m[2]!)) || clave(nombreEsc).includes(clave(e))) ?? nombreEsc;
      if (!ext.escenarios.includes(escenario)) ext.escenarios.push(escenario);
      const otro = partes.filter(p => !ESCENARIO.test(p)).join(" - ");
      if (otro && !ext.evento) tituloEvento(otro);
      return true;
    }

    function encabezado(t: string): boolean {
      const limpio = t.replace(/[:\s]+$/, "");
      const palabras = limpio.split(/\s+/);
      if (palabras.length > 7 || /[.?!,;]/.test(limpio) || letras(limpio) < 2) return false;
      if (EVENTO.test(limpio) || /\b20\d\d\b/.test(limpio)) return false;
      const mayus = limpio === limpio.toUpperCase() && letras(limpio) >= 3;
      const titulo = palabras.every(p => !/^\p{L}/u.test(p) || /^\p{Lu}/u.test(p) || /^(de|del|la|las|los|y|e|el)$/.test(p));
      if (!mayus && !titulo && !t.endsWith(":")) return false;
      if (categorizar(limpio) !== "Otro") { ponerGrupo(nombrePropio(limpio)); return true; }
      if (artistaFijo || letras(limpio) < 4) return false;
      artista = registrarArtista(limpio);
      ponerGrupo(null);
      return true;
    }

    function esEncabezadoArtistaConocido(t: string): boolean {
      return conocidos.has(clave(t.replace(/[:\s]+$/, ""))) && t.length <= 60;
    }
  }

  // Si el documento no traía días explícitos pero sí horario/ítems con fecha, los días salen de ahí.
  for (const f of new Set([...ext.bloques.map(b => b.fecha), ...ext.items.map(i => i.fecha).filter((x): x is string => !!x)])) {
    if (!ext.dias.some(d => d.fecha === f)) ext.dias.push({ fecha: f, nombre: f, tipo: "show" });
  }
  ext.dias.sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (ext.evento && !ext.evento.desde && ext.dias.length) { ext.evento.desde = ext.dias[0]!.fecha; ext.evento.hasta = ext.dias.at(-1)!.fecha; }
  return ext;

  function registrarArtista(nombre: string): string {
    nombre = nombre.replace(/^[\s•·*\-–]+/, "").trim();   // "· LOS RAYOS": sin la viñeta
    const k = clave(nombre);
    const ya = conocidos.get(k) ?? ext.artistas.find(a => clave(a) === k);
    const n = ya ?? nombrePropio(nombre);
    if (!conocidos.has(k)) conocidos.set(k, n);
    if (!ext.artistas.includes(n)) ext.artistas.push(n);
    return n;
  }

  function tituloEvento(t: string): boolean {
    if (!EVENTO.test(t) && !/\b20\d\d\b/.test(t)) return false;
    if (buscarFecha(t, 2000) || t.length > 160) return false;
    let candidato = t.replace(/^(re|fw|rv|fwd):\s*/i, "");
    // En una frase ("Te comparto la programación del Festival X 2026.") se toma solo el nombre.
    const frase = /^\p{Lu}?\p{Ll}+\s+\p{Ll}/u.test(candidato) || /[.,;!?]/.test(candidato);
    if (frase) {
      // Sin bandera "i": con ella \p{Lu} también acepta minúsculas y se traga la frase.
      const m = candidato.match(/((?:\p{Lu}[\p{L}\d]*\s+)*(?:[Ff]estival|FESTIVAL|[Ff]est|[Cc]oncierto|[Tt]emporada|[Tt]our|[Gg]ira|[Ff]eria|[Cc]arnaval)\b(?:\s+(?:(?:de|del|la|las|los|y|al|el)\s+)?[\p{Lu}\d][\p{L}\d]*)*|(?:\p{Lu}\p{L}*\s+)+al\s+[Pp]arque(?:\s+20\d\d)?)/u);
      if (!m) return false;
      candidato = m[1]!;
    }
    const partes = candidato.split(/\s+[-–·|]\s+/).filter(p => !ESCENARIO.test(p));
    const nombre = nombrePropio((partes.find(p => EVENTO.test(p)) ?? partes[0] ?? candidato).trim());
    if (!EVENTO.test(nombre) && !/\b20\d\d\b/.test(nombre)) return false;
    if (nombre.split(/\s+/).length > 8) return false;
    ext.evento = { nombre: nombre.charAt(0).toUpperCase() + nombre.slice(1), lugar: null, ciudad: null, desde: null, hasta: null };
    return true;
  }
}

/** "1 Ampeg SVT Classic + 8x10" → ["1 Ampeg SVT Classic", "1 Caja 8x10"]; null si no es cabezal + caja. */
export function cabezalYCaja(t: string): string[] | null {
  if (!t.includes("+")) return null;
  const m = t.match(/^\s*(\d{1,2})\s*(?:x\s+)?(?=\p{L})/u);
  const cant = m ? m[1]! : "1";
  const partes = (m ? t.slice(m[0].length) : t).split(/\s*\+\s*/).map(p => p.trim()).filter(Boolean);
  if (partes.length < 2) return null;
  const esCaja = (p: string) => CAJA_AMPLI.test(p);
  const esAmpli = (p: string) => ["Ampli bajo", "Ampli guitarra"].includes(categorizar(p)) || /\b(head|cabezal|amp)\b/i.test(p);
  if (!partes.some(esCaja) || !partes.some(p => esAmpli(p) && !esCaja(p))) return null;
  // Una caja escrita solo con la medida ("8x10") se nombra: "Caja 8x10".
  return partes.map(p => `${cant} ${/^[\d\s x×"”]+$/i.test(p) ? `Caja ${p}` : p}`);
}

/* Renglones que el documento partió en dos:
 *   - un paréntesis que se cierra abajo: "TOMS 10” (Remo" + "Pinstripe)"
 *   - una frase que sigue en minúscula: "Cada equipo deberá…" + "condiciones de…"
 *   - una lista corrida: "4 Boom Stand 3" + "Snare Stand 1 Hi" + "Hat Stand 1 Kick"
 *     → "4 Boom Stand", "3 Snare Stand", "1 Hi Hat Stand", "1 Kick …" */
/** Un renglón que termina en preposición, conjunción o coma sigue en el próximo. */
const COLGADO = /(\b(para|de|del|con|sin|y|e|o|u|la|el|los|las|en|por|tipo|for|of|with|and|or|the|to)|,)$/i;

export function unirRenglones(lineas: Linea[]): Linea[] {
  const out: Linea[] = [];
  const conf = (a: Linea, b: Linea) => a.confianza === undefined && b.confianza === undefined ? undefined : Math.min(a.confianza ?? 100, b.confianza ?? 100);
  const juntar = (a: Linea, b: Linea): Linea => ({ texto: `${a.texto.trimEnd()} ${b.texto.trim()}`, confianza: conf(a, b) });
  const abiertos = (t: string) => (t.match(/\(/g) ?? []).length - (t.match(/\)/g) ?? []).length;
  const encabezado = (t: string) => GRUPOS.test(t.replace(/[\s:·|–—-]+$/, "")) || !!seccionDe(t);
  for (let i = 0; i < lineas.length; i++) {
    let actual = lineas[i]!;
    const t = actual.texto.trim();
    // Lista corrida: "1 Bombo 22" 1 Redoblante" + "14" 2 Toms 10" y 12" 1" + "Tom de piso 16"…",
    // o "4 Boom Stand 3" + "Snare Stand 1 Hi" + "Hat Stand 1 Kick". Se junta todo y se corta en cada cantidad.
    // "Plato efecto Zildjian k 16" no cuelga: el 16 es la medida (platillo o tambor en el renglón y 10 o más).
    const medida = (x: string) => /\b(crash|ride|splash|china|hi-?hats?|hit hats?|platos?|platillos?|cymbals?|toms?|bombo|kick|snare|tambor|redoblante|zildjian|sabian|paiste|meinl)\b/i.test(x) && /\s(1\d|2\d)$/.test(x.trim());
    const colgando = (x: string) => /\s\d{1,2}(\s+\p{Lu}\p{L}*)?$/u.test(x.trim()) && !medida(x);
    if (!/\s{3}/.test(t) && (marcas(t) >= 2 || (/^\d{1,2}\s+\p{Lu}/u.test(t) && colgando(t)))) {
      let j = i;
      while (j + 1 < lineas.length) {
        const sig = lineas[j + 1]!.texto.trim();
        // "…, 1 Base para" + "Teclados, 2 Mesas de percusión. Especial atención…": colgó en una preposición o coma.
        const colgado = COLGADO.test(actual.texto.trim()) && !/\s{3}/.test(sig) && !encabezado(sig) && !esTituloGenerico(sig);
        if (!colgado && (encabezado(sig) || /\s{3}/.test(sig) || sig.split(/\s+/).length > 10)) break;
        const sigue = colgado || marcas(sig) >= 1 && !/^\d{1,2}\s+\p{Lu}/u.test(sig) || /^\d{1,2}\s*["”″]/.test(sig) || /^\p{Ll}/u.test(sig) || colgando(actual.texto);
        if (!sigue) break;
        actual = juntar(actual, lineas[j + 1]!); j++;
      }
      const partes = cortar(actual.texto);
      if (partes.length >= 2) {
        for (const parte of partes) out.push({ ...actual, texto: parte });
        i = j; continue;
      }
      actual = lineas[i]!;
    }
    while (i + 1 < lineas.length) {
      const sig = lineas[i + 1]!.texto.trim();
      const cerrar = abiertos(actual.texto) > 0 && abiertos(sig) < 0 && sig.split(/\s+/).length <= 4;
      const sigue = /^\p{Ll}/u.test(sig) && !/[.:;]$/.test(actual.texto.trim()) && actual.texto.trim().split(/\s+/).length >= 3 && !/\s{3}/.test(actual.texto) && !/^(x\s*\d|o\s)/i.test(sig);
      // "1 Ampeg SVT con caja" + "8x10": la medida que quedó sola abajo.
      // "1 AMPEG" + "8 X 10“ ENCLOSURE": también con una o dos palabras más, si arriba quedó corto.
      const medida = /^\d{1,2}\s*[x×]\s*\d{1,2}\b/i.test(sig) && /\p{L}$/u.test(actual.texto.trim())
        && (sig.split(/\s+/).length <= 2 || (sig.replace(/^\d{1,2}\s*[x×]\s*\d{1,2}\S*/i, "").trim().split(/\s+/).length <= 2 && actual.texto.trim().split(/\s+/).length <= 3));
      // "…1 Base para" + "Teclados, 2 Mesas…": el renglón quedó colgando en una preposición o una coma.
      const a = actual.texto.trim();
      const prosa = !/\s{3}/.test(a) && !/\s{3}/.test(sig) && a.split(/\s+/).length >= 2 && !encabezado(sig) && !esTituloGenerico(sig);
      const colgado = prosa && COLGADO.test(a);
      // "…Fender Rumble" + "500 o Aguilar AG700.": un número que no puede ser cantidad de backline, sin punto antes.
      const n = sig.match(/^(\d+)\s+(\S+)/);
      const noEsCantidad = prosa && !!n && !/[.:;]$/.test(a) && a.split(/\s+/).length >= 3 && (Number(n[1]) > 50 || /^(o|y|u|or|and)$/i.test(n[2]!));
      if (!cerrar && !sigue && !medida && !colgado && !noEsCantidad) break;
      actual = juntar(actual, lineas[i + 1]!); i++;
    }
    // Una frase partida que resultó ser lista corrida ("3 Congas LP con sus bases 2 Timbales con base 1 Mesa…").
    const partes = /\s{3}/.test(actual.texto) ? [actual.texto] : cortar(actual.texto);
    for (const parte of partes) out.push({ ...actual, texto: parte });
  }
  return out;
}

/* Familia de instrumento de un título: "DRUMS/BATERIA", "CYMBALS SET" y "STANDS DE PLATOS" son la batería. */
const FAMILIAS: ReadonlyArray<readonly [string, RegExp]> = [
  ["bateria", /\b(drums?|drum ?kit|bater[ií]as?|hardware|cymbals?|platillos|platos|snare|redoblante|kick|bombo|toms?)\b/i],
  ["percusion", /percu/i],
  ["bajo", /\b(bass|bajo)\b/i],
  ["guitarra", /\b(guitars?|guitarras?|gtr)\b/i],
  ["teclado", /\b(keys|keyboards?|teclados?|pianos?|synths?)\b/i],
  ["vientos", /\b(vientos|brass|horns?|saxo?s?|trompetas?)\b/i],
  ["voces", /\b(vocals?|voces|voz)\b/i],
  ["dj", /\bdj\b/i],
];
export function familiaDe(t: string): string | null {
  return FAMILIAS.find(([, re]) => re.test(t))?.[0] ?? null;
}
const SUBTITULO = /^(no\s+(hay\s+)?)?(options?|opciones?|opci[oó]n)\b|^(type|tipo)s?\b|^(accessor|accesor)|^parches|^(drum\s+)?heads?\b|^(stands?|soportes?)\b|^(amps?|amplificador(es)?|amplificaci[oó]n)\b|^(cabinets?|cajas?)\b|^instrument|^sizes?\b|^medidas|^marcas?\b|^brands?\b|^configuraci|^set ?up\b|^(cymbals?\s+set|set\s+de\s+platos)|^hardware\b|^(kick\s+drum\s+)?pedal(es|s)?$/i;
/** "OPTIONS/OPCIONES EN ORDEN DE PRIORIDAD", "Type/ Tipo": subtítulo corto, sin cantidades. */
function esSubtitulo(t: string): boolean {
  // "Amplificador Fender Twin Reverb o similar" nombra una marca: es una pieza, no el subtítulo "AMPLIFICADORES".
  const conMarca = /^(amps?|amplificador(es)?|amplificaci[oó]n|cabinets?|cajas?)\b/i.test(t) && t.split(/\s+/).slice(1).some(w => MARCA_EQUIPO.test(w));
  return SUBTITULO.test(t) && !conMarca && !/\d/.test(t) && t.split(/\s+/).length <= 9 && !/[.?!]$/.test(t);
}
/** "BASS AMPS" dentro del bloque de guitarra sí es otro instrumento; "STANDS CYMBALS" no. */
function otraFamilia(t: string): boolean {
  const f = familiaDe(t);
  return !!f && f !== "bateria" && !/^(cymbals?|stands?|soportes?|hardware|pedal|kick|amps?|amplificador|cabinets?|cajas?|instrument|options?|opciones?)/i.test(t);
}
/** "DRUMS/BATERIA * - FULANO DE TAL", "GTR/GUITARRA 1 - ANA PÉREZ": instrumento y quién lo toca.
 *  Devuelve el instrumento ("DRUMS/BATERIA", "GTR/GUITARRA 1"). */
export function grupoConMusico(t: string): string | null {
  const m = t.match(/^(.{2,40}?)\s*\*?\s+[-–—]\s+(\p{Lu}[\p{L}'’".]*(?:\s+\p{Lu}[\p{L}'’".]*){0,4})$/u);
  if (!m) return null;
  const instrumento = m[1]!.replace(/\*/g, "").trim();
  const sinNumero = instrumento.replace(/\s+\d+$/, "");
  if (/\d/.test(sinNumero)) return null;
  if (!sinNumero.split(/\s*\/\s*/).every(p => GRUPOS.test(p) || /^gtr$/i.test(p) || familiaDe(p))) return null;
  return instrumento;
}

/** "3.1.- DRUMS: …", "5.1 TARIMA": número de capítulo (dos niveles) y su título. "4. SOUNDCHECK" (un nivel)
 *  solo cuenta en un rider con capítulos y si lo que sigue es un título en mayúsculas, porque "1. DW" también
 *  puede ser la primera de unas opciones. */
export function capituloDe(t: string, conCapitulos: boolean): { numero: number; titulo: string } | null {
  const dos = t.match(/^(\d{1,2})\s*\.\s*\d{1,2}\s*\.?\s*[-–]?\s*(?=\p{L})(.*)$/u);
  if (dos) return { numero: Number(dos[1]), titulo: dos[2]!.trim() };
  if (!conCapitulos) return null;
  const uno = t.match(/^(\d{1,2})\s*\.\s*[-–]?\s*(?=\p{L})(.*)$/u);
  if (!uno) return null;
  const titulo = uno[2]!.trim();
  if (titulo !== titulo.toUpperCase() || /\d/.test(titulo) || titulo.split(/\s+/).length > 8) return null;
  return { numero: Number(uno[1]), titulo };
}

/** "DRUMS", "ELECTRIC GUITAR TOMÁS", "KEYBOARDS ANA": empieza por el instrumento y lo demás
 *  (hasta tres palabras) es el músico. */
export function esTituloDeInstrumento(titulo: string): boolean {
  if (/\d/.test(titulo) || titulo.length > 50) return false;
  const palabras = sinTildes(titulo).toLowerCase().split(/[\s/&+,()-]+/).filter(Boolean);
  const k = palabras.findIndex(p => !PALABRAS_TITULO.has(p) && !CONECTORES_TITULO.has(p));
  return GRUPOS.test(titulo) || esTituloGenerico(titulo) || (k > 0 && palabras.length - k <= 3 && !palabras.slice(0, k).every(p => CONECTORES_TITULO.has(p)));
}

/** "DRUMS: DW COLLECTOR, YAMAHA STAGE CUSTOM, PEARL MASTER CUSTOM" → el título y las opciones;
 *  "KEYBOARDS ANA: SUJETO A MODIFICACIÓN" → el título y la nota. Sin cantidad adelante. */
export function tituloConNota(t: string): { titulo: string; nota: string; opciones: string[] } | null {
  const m = t.match(/^([^:\d][^:]{1,50}?)\s*:\s*(\S.*)$/);
  if (!m) return null;
  const titulo = m[1]!.trim(), nota = m[2]!.trim().replace(/[.;]$/, "");
  if (!esTituloDeInstrumento(titulo) || /^\d/.test(nota)) return null;
  const opciones = nota.split(/\s*(?:,|\/|\s+o\s+|\s+or\s+|\s+u\s+)\s*/i).map(o => o.trim()).filter(o => letras(o) >= 2);
  return { titulo, nota, opciones };
}

/* Lo que sigue a "RIDER TÉCNICO" cuando el nombre de la banda es un logo: saludos e índices, no bandas. */
const SALUDO = /^(hola|hello|hi|buen[oa]s|bienvenid|welcome|estimad|dear|saludos|[ií]ndice|index|contenidos?|contents?|introducci[oó]n|presentaci[oó]n|informaci[oó]n( general)?)\b/i;

/** El nombre en mayúsculas que el rider repite después de "para", "por", "de"…:
 *  "Sistemas In Ears para LUNA ROJA son", "Consola sugerida por LUNA ROJA".
 *  Hace falta que salga al menos dos veces. */
export function nombreRepetido(lineas: ReadonlyArray<{ texto: string }>): string | null {
  const PAL = "[A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ'&.]*";
  const re = new RegExp(`(?:^|\\s)(?:[Pp]ara|[Pp]or|[Dd]el?|[Ff]or|[Bb]y|[Oo]f)\\s+(${PAL}(?:\\s+${PAL}){0,3})(?=$|[\\s:.,;)])`, "gu");
  const cuenta = new Map<string, number>();
  for (const l of lineas) {
    if (l.texto === l.texto.toUpperCase()) continue; // en un renglón todo en mayúsculas no se distingue el nombre
    for (const m of l.texto.matchAll(re)) {
      const nombre = m[1]!.replace(/[.']+$/, "");
      if (nombre !== nombre.toUpperCase() || letras(nombre) < 4) continue;
      // "sistema de CCTV", "red de WIFI": siglas técnicas, no el nombre de la banda.
      if (/^(CCTV|WI-?FI|LED|DMX|USB|HDMI|SDI|AUDIO|VIDEO|FOH|IEM|RF|UPS|AC|DC)$/.test(nombre)) continue;
      cuenta.set(nombre, (cuenta.get(nombre) ?? 0) + 1);
    }
  }
  const [mejor] = [...cuenta].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length);
  if (mejor && mejor[1] >= 2) return mejor[0];
  return nombreEnElTexto(lineas);
}

/** "LOS RAYOS - BACKLINE 2026.pdf" → "Los Rayos", si el texto del documento también lo nombra. */
export function nombreDelArchivo(archivo: string, lineas: ReadonlyArray<{ texto: string }>): string | null {
  const partes = archivo.replace(/\.[a-z0-9]{2,4}$/i, "").split(/\s+[-–—_]\s+|_/)
    .map(p => p.replace(/\b(rider|t[eé]cnico|technical|backline|tech|v\d+|(19|20)\d\d)\b/gi, "").replace(/\([^)]*\)/g, "").trim())
    .filter(p => letras(p) >= 3);
  const texto = sinTildes(lineas.map(l => l.texto).join(" ")).toLowerCase();
  const nombre = partes.find(p => texto.includes(sinTildes(p).toLowerCase()));
  return nombre ? nombrePropio(nombre) : null;
}

/** Palabras de contrato y de rider que van con mayúscula sin ser el nombre de la banda. */
const GENERICO = new Set(("el la los las the rider tecnico technical artista artist contratante contratista promotor promoter productor produccion " +
  "production manager management equipo equipos audio video sonido sound iluminacion luces lighting lights escenario stage backline nota notas " +
  "informacion datos festival evento show tour gira prueba soundcheck monitores monitor consola sistema power input output list plot camerino " +
  "camerinos catering hotel transporte set pagina page anexo cliente organizacion organizador musicos band banda grupo agrupacion hospitality").split(" "));

/** El nombre de la banda escrito en mayúsculas y minúsculas que el rider repite en sus frases:
 *  "el show de Los Rayos", "Los Rayos no se presentarán…". Si la página web
 *  o el correo del documento lo contienen (www.losrayosmusica.com), con dos veces basta; si no,
 *  tiene que repetirse tres. Las palabras del contrato ("El Artista", "El Contratante") no cuentan. */
export function nombreEnElTexto(lineas: ReadonlyArray<{ texto: string }>): string | null {
  const PAL = "\\p{Lu}[\\p{Ll}'’]+";
  const re = new RegExp(`${PAL}(?:\\s+(?:(?:y|e|&|de|del|of|and)\\s+)?${PAL}){1,4}`, "gu");
  const webs = new Set<string>();
  for (const l of lineas) {
    for (const m of l.texto.matchAll(/([\w.-]+)@([\w-]+)\.|(?:www\.|https?:\/\/)([\w-]+)\./gi)) {
      for (const h of [m[1], m[3], m[2] && !/^(gmail|hotmail|yahoo|outlook|live|icloud|msn|me)$/i.test(m[2]) ? m[2] : undefined]) if (h) webs.add(sinTildes(h).toLowerCase().replace(/[^a-z]/g, ""));
    }
  }
  const claveNombre = (n: string) => sinTildes(n.replace(/^(los|las|la|el|the)\s+/i, "")).toLowerCase().replace(/[^a-z]/g, "");
  const enLaWeb = (n: string) => claveNombre(n).length >= 5 && [...webs].some(w => w.includes(claveNombre(n)));
  // "Att: Ana Pérez" al final del rider y el correo anaperez…@: quien firma es la banda. Sin esa
  // coincidencia no se toma (suele firmar el productor o el mánager).
  const FIRMA = /^(att|atte|atentamente|cordialmente|saludos|regards|best regards|sincerely)\b[.:,]*\s*(.*)$/i;
  for (let i = 0; i < lineas.length; i++) {
    const m = lineas[i]!.texto.trim().match(FIRMA);
    if (!m) continue;
    const nombre = (m[2] || lineas[i + 1]?.texto || "").split(/\s*[,|–—]\s*|\s+-\s+/)[0]!.trim();
    if (/^\p{Lu}/u.test(nombre) && /^[\p{L}' .&]+$/u.test(nombre) && nombre.split(/\s+/).length <= 5 && enLaWeb(nombre)) return nombre;
  }
  const cuenta = new Map<string, number>();
  for (const l of lineas) {
    if (l.texto === l.texto.toUpperCase()) continue;
    const enEsteRenglon = new Set<string>();
    for (const m of l.texto.matchAll(re)) {
      const palabras = m[0].split(/\s+/);
      if (palabras.every(p => GENERICO.has(sinTildes(p).toLowerCase()) || /^(y|e|&|de|del|of|and)$/i.test(p))) continue;
      enEsteRenglon.add(m[0]);
    }
    for (const n of enEsteRenglon) cuenta.set(n, (cuenta.get(n) ?? 0) + 1);
  }
  const [mejor] = [...cuenta]
    .filter(([n, c]) => c >= (enLaWeb(n) ? 2 : 3))
    .sort((a, b) => Number(enLaWeb(b[0])) - Number(enLaWeb(a[0])) || b[1] - a[1] || b[0].length - a[0].length);
  return mejor ? mejor[0] : null;
}

/* Riders que repiten una página entera (la misma tabla de batería en la página 3 y en la 4):
 * un bloque de 3 o más renglones iguales a uno anterior se lee una sola vez. Los renglones
 * sueltos repetidos ("4 STAND CON BOOM" en batería y en percusión) sí cuentan. */
export function sinRepetidos(lineas: Linea[]): Linea[] {
  // Sin espacios: la misma página repetida puede venir con "61STAND" en una y "61 STAND" en otra.
  const norm = (l: Linea | undefined) => (l?.texto ?? "").replace(/\s+/g, "").toUpperCase();
  const claves = lineas.map(norm);
  const vistos = new Map<string, number[]>();
  const fuera = new Set<number>();
  let j = -1; // renglón anterior que el bloque repetido va siguiendo
  for (let i = 0; i < lineas.length; i++) {
    const k = claves[i]!;
    if (j >= 0 && j + 1 < i && claves[j + 1] === k) { j++; fuera.add(i); }
    else {
      j = -1;
      if (letras(k) >= 3) {
        const antes = (vistos.get(k) ?? []).find(a => a + 2 < i && claves[a + 1] === claves[i + 1] && claves[a + 2] === claves[i + 2] && letras(claves[a + 1]!) >= 2);
        if (antes !== undefined) { j = antes; fuera.add(i); }
      }
    }
    if (!vistos.has(k)) vistos.set(k, []);
    vistos.get(k)!.push(i);
  }
  return lineas.filter((_, i) => !fuera.has(i));
}

/** "PERCUSSIONS PERCUSION", "PERCUSIONPERCUSSIONS", "DRUMS / BATERÍA": títulos de grupo repetidos o pegados. */
function variosGrupos(t: string): string | null {
  const G = /^(drums?|drum ?kit|bater[ií]as?|percusi[oó]n|percussions?|bass|bajos?|guitars?|guitarras?|keys|keyboards?|teclados?|cymbals?|platillos|hardware)/i;
  let resto = t.replace(/[\s/|·–-]+/g, "");
  if (!resto || /\d/.test(resto)) return null;
  const primero = resto.match(G)?.[0] ?? null;
  let n = 0;
  while (resto && G.test(resto)) { resto = resto.replace(G, ""); n++; }
  return resto === "" && n >= 2 ? primero : null;
}

/** Cantidades seguidas de un nombre con mayúscula: "1 Bombo", "2 Toms" (no "3 head" ni "88 keys"). */
/* Cantidad (1 a 24) seguida de un nombre con mayúscula: "1 Bombo", "2 Toms". No cuenta "3 head"
 * ni "88 keys" (minúscula o medida), ni "16 CH" / "4 RETORNOS" (unidades). */
const MARCA_LISTA = /(?:^|\s)((?:0?[1-9]|1\d|2[0-4])\s+(?!["”″])(\p{Lu}[\p{L}]*))/gu;
// "8 X 10" es una medida, no otra cantidad.
const UNIDADES = /^(ch|canales|channels|retornos|returns|w|v|mts?|cm|mm|kg|hz|ft|x|voltios|volts?|vatios|watts?|amperios|amps?)$/i;
/** Lo que sigue al número de un modelo: "SVT 4 PRO", "JCM 2000 DSL", "MK II". */
const MODELO_SUFIJO = /^(pro|plus|classic|mk\w*|ii|iii|iv|xl|xt|se|ce|ex|hd|deluxe|custom|reverb|series|dsl|tsl|vr)$/i;
function posicionesLista(t: string): number[] {
  const pos: number[] = [];
  for (const m of t.matchAll(MARCA_LISTA)) {
    if (UNIDADES.test(m[2]!)) continue;
    // "Jazz Bass 5 Strings", "bajo de 6 cuerdas": las cuerdas del instrumento, no otra pieza.
    if (/^(strings?|cuerdas?)$/i.test(m[2]!)) continue;
    // "Crash 14 Zildjian", "Ride 20 Zildjian": el número después del tipo de platillo o tambor es la medida.
    if (/\b(crash|ride|splash|china|hi-?hats?|hit hats?|platos?|platillos?|toms?|bombo|kick|snare|tambor|redoblante|floor)\s+$/i.test(t.slice(0, m.index! + m[0].length - m[1]!.length))) continue;
    const antes = t.slice(0, m.index! + m[0].length - m[1]!.length);
    // "1 Fan / 1 Ventilador": la traducción, no otro ítem. "AMPEG SVT 3 Pro": el 3 es del modelo.
    if (/\/\s*$/.test(antes) || (/\p{Ll}/u.test(t) && /\b[A-Z]{2,4}\s+$/.test(antes))) continue;
    // "AMPEG SVT 4 PRO" en un renglón todo en mayúsculas: el 4 sigue siendo del modelo (SVT-4 PRO, un cabezal).
    if (/\b[A-Z]{2,4}\s+$/.test(antes) && MODELO_SUFIJO.test(m[2]!)) continue;
    // "NORD STAGE 2 MODEL SW73 OR HA76": lo que sigue al número es el modelo, no otro ítem.
    if (/^(model|modelo|version|versi[oó]n|series|serie|edition|edici[oó]n)$/i.test(m[2]!)) continue;
    // "YAMAHA MOTIF 8 XF": número y código corto del modelo (XF8) detrás del nombre del equipo. Los códigos
    // van sin vocales (XF, CS, MX); "2 STANDS 1 HI HAT" sí son dos ítems.
    if (/^[B-DF-HJ-NP-TV-Z]{1,3}$/.test(m[2]!) && /\b[A-ZÁÉÍÓÚÑ]{3,}\s+$/.test(antes)) continue;
    pos.push(m.index! + m[0].length - m[1]!.length);
  }
  return pos;
}
const marcas = (x: string) => posicionesLista(x).length;
function cortar(t: string): string[] {
  const pos = posicionesLista(t);
  if (pos.length < 2) return [t];
  const partes = [0, ...pos].filter((p, n, a) => n === 0 || p !== a[n - 1]).map((p, n, a) => t.slice(p, a[n + 1] ?? t.length).trim()).filter(Boolean);
  // "2 SNARE DRUM 14” X 5” WITH 2 STANDS": los stands son del redoblante; que lo diga.
  return partes.map((p, n) => {
    const antes = partes[n - 1];
    if (!antes || !/\s(with|w\/|con)$/i.test(antes) || p.split(/\s+/).length > 3 || !/\b(stands?|soportes?|bases?|holders?|clamps?)$/i.test(p)) return p;
    const de = antes.replace(/^\d{1,3}\s+/, "").replace(/\s(with|w\/|con)$/i, "").trim();
    return `${p} PARA ${de}`;
  });
}

/** "Hardware: 2x soportes de caja, 1x soporte charles, 11x soportes…" → una línea por ítem. */
function dividirLista(l: Linea): Linea[] {
  // "1 Fan / 1 Ventilador de piso": inglés / español, es un solo ítem; se deja el segundo.
  const bilingue = l.texto.match(/^[\s•·*-]*(\d{1,3})\s+(.+?)\s*\/\s*\1\s+(\p{L}.+)$/u);
  if (bilingue) return [{ ...l, texto: `${bilingue[1]} ${bilingue[3]}` }];
  // "Sizes KD 22” - Rack Toms 8” - 10”- 12” - Floor tom 16” - Snare 14” x 6”": una pieza por parte.
  const tam = l.texto.match(/^(?:sizes?|medidas|tama[ñn]os?)\s*:?\s+(.+)$/i);
  if (tam && /\d\s*["”″]/.test(tam[1]!)) {
    return tam[1]!.split(/\s+[-–]\s+(?=\p{L})|,\s*(?=\p{L})/u).map(p => p.trim()).filter(p => letras(p) >= 2).flatMap(p => {
      const n = (p.replace(/x\s*\d+(?:[.,]\d+)?\s*["”″]/gi, "").match(/\d+(?:[.,]\d+)?\s*["”″]/g) ?? []).length;
      const texto = `${Math.max(1, n)} ${p}`;
      // "Rack Toms 8” - 10”- 12”": una pieza por medida.
      const piezas = cortarRenglon(texto);
      return piezas ? piezas.map(x => ({ ...l, texto: `${x.cantidad ?? 1} ${x.texto}` })) : [{ ...l, texto }];
    });
  }
  // De izquierda a derecha: "TOMS 10”, 12” Y 14”", "2 CRASH DE 16” Y 18”, RIDE 20”", "· 1 22” Bass drum · 1 …".
  // "SET DE PLATOS: SABIAN AAX: 1 CHINA 16”, …": lo de antes de los dos puntos queda como título.
  // Con columnas ("2 Toms 10” y 12”   Montados en el bombo") la fila es de una tabla: no se corta aquí.
  if (!l.texto.includes("+") && !/\t|\s{3,}/.test(l.texto.trim())) {
    const iDos = l.texto.lastIndexOf(": ");
    const cabeza = iDos > 0 && !/\d/.test(l.texto.slice(0, iDos)) ? l.texto.slice(0, iDos) : null;
    const piezas = cortarRenglon(cabeza ? l.texto.slice(iDos + 2) : l.texto);
    if (piezas) return [...(cabeza ? [{ ...l, texto: cabeza + ":" }] : []), ...piezas.map(p => ({ ...l, texto: p.cantidad !== null ? `${p.cantidad} ${p.texto}` : p.texto }))];
  }
  const marca = /(?:^|(?<!\d)[,;]|\s(?:y|and|e|\+))\s*(?:x\s*)?\(?\d{1,3}\)?\s*x?\s+(?!(?:cm|mm|mts?|m|kg|w|v|ft|in|hz|k)\b)\p{L}/giu;
  if ((l.texto.match(marca) ?? []).length < 2) return dividirEnumeracion(l);
  const [cabeza, ...resto] = l.texto.split(/:\s+(?=(?:x\s*)?\(?\d{1,3}\)?\s*x?\s+\p{L})/iu);
  const cuerpo = resto.length ? resto.join(": ") : cabeza!;
  const partes = cuerpo.split(/(?:(?<!\d)[,;]\s*|\s+(?:y|and|e|\+)\s+)(?=(?:x\s*)?\(?\d{1,3}\)?\s*x?\s+(?!(?:cm|mm|mts?|m|kg|w|v|ft|in|hz|k)\b)\p{L})/iu).map(t => t.trim()).filter(Boolean);
  const lineas = partes.map(texto => ({ ...l, texto }));
  return resto.length ? [{ ...l, texto: cabeza! + ":" }, ...lineas] : lineas;
}

/** "Quinto, conga, Tumba, bongos con sus bases, cortina" → un ítem por parte, si casi todas se reconocen como equipo. */
function dividirEnumeracion(l: Linea): Linea[] {
  if (/:\s/.test(l.texto) || /\d\s*["”″]/.test(l.texto) || /\bequivalente|sugerid|\bmarcas?\b|\bo\s+\p{Lu}/iu.test(l.texto)) return [l];
  const partes = l.texto.split(/,\s*/).map(t => t.trim()).filter(Boolean);
  if (partes.length < 3) return [l];
  const reconocidas = partes.filter(p => categorizar(p) !== "Otro").length;
  if (reconocidas < partes.length * 0.75) return [l];
  return partes.map(texto => ({ ...l, texto: texto.replace(/^(y|and|e)\s+/i, "") }));
}

/** Quién pone lo que sigue: "ARTISTA" si lo trae la banda, null si lo pone la producción; undefined si la línea no dice. */
function quienPone(t: string): string | null | undefined {
  const artista = /\b(agrupaci[oó]n|banda|artista|artist|band|grupo|viaja(?:mos)?)\b.{0,25}\b(lleva|llevamos|trae|traemos|viaja con|supplies|provides|brings|propio)\b|\bviaja con su backline\b|\bartist supplies\b/iu;
  const produccion = /\b(festival|purchaser|promotor|producci[oó]n|contratante|empresa|proveedor)\b.{0,30}\b(suministra|provee|will furnish|will provide|provides|debe suministrar|aporta)\b|\bse requiere lo siguiente\b|\brequerimos\b|\bsolicitamos\b|\bel siguiente es listado\b/iu;
  const a = t.search(artista), p = t.search(produccion);
  if (a < 0 && p < 0) return undefined;
  return a > p ? "ARTISTA" : null;
}

function limpiar(t: string): string {
  return t.replace(/[   ]/g, " ").replace(/[|¦]{2,}/g, " ").replace(/\*\*/g, "").replace(/^\s*(?:[-–•·*●▪■➢✓>○◦]+\s*|o\s+|\.\s+(?=\d))(?=[\p{L}\d(])/u, "").replace(/\s+$/, "").trim()
    .replace(/^(\d{1,3})\s*\((?:un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|one|two|three|four|five|six)\)\s*/i, "$1 ") // "2 (dos) SNARE STANDS"
    // "4 4 Cymbal Stands": la columna de cantidad y la cantidad del texto dicen lo mismo.
    .replace(/^(\d{1,3})\s+\1\s+(?=\p{L})/u, "$1 ")
    // "2.4O": una O pegada a un número con decimales es un cero.
    .replace(/(\d[.,]\d*)[Oo]\b/g, "$10");
}
