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
import { categorizar } from "../dominio/categorias";
import type { Categoria, PaqueteEvento } from "../dominio/entidades";
import { separarCantidad } from "../dominio/lista";
import type { Documento, Linea } from "./documento";
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
const SECCION_AUDIO = /^(input(s| list)?|channel list|lista(do)? de canales|patch|output(s| list| mix)?|monitor(es|eo)?|monitor mix|monitor world|mezclas?( de monitores)?|iem|in ?ears?|pa\b|p\.\s?a\.?|sistema de (sonido|pa)|sonido|audio|foh|front of house|consolas?|control (foh|monitor(es|s)?)|microfon[ií]a|micr[oó]fonos|microphones?|mic (list|packages?)|stands? de mic(r[oó]fonos?)?|mic stands?|microphone stands?|cue monitor|arreglo principal|(sub ?)?snakes?|multipares?|wireless|inal[aá]mbricos|rf\b)/i;
const SECCION_OTRA = /^(stage$|stage plot|planta de escenario|ground support|stage ?hands|power( generators)?|generadores?|moving heads|follow ?spots?|fx$|efectos|led screens?|pantallas led|pronters|prompters?|teleprompters?|quick change|accesorios (artista|ballet|mariachi|staff|producci[oó]n)|alimentos|bebidas|comida|cena|iluminaci[oó]n|planta de iluminaci[oó]n|lighting|luces|lista de materiales|video|pantallas|screens?|led\b|catering|camerinos?|camarines?|dressing ?rooms?|hospitality|alimentaci[oó]n|comidas?|bebidas|hotel(es)?|hospedaje|alojamiento|estad[ií]a|transporte|traslados?|viajes?|vuelos?|seguridad|security|contactos?|contact|comunicaci[oó]n|prensa|grabaci[oó]n|fotograf[ií]a|merch(andising)?|pagos?|contrato|rigging|estructura|energ[ií]a el[eé]ctrica|planta el[eé]ctrica|generador(es)?|radios?|handies|walkie|motorola|intercom|backstage|pre-?show|after-?show|medidas|dimensiones|especiales|control\b|barricada|vallas?|credenciales|acreditaciones|invitaciones|guest ?list)/i;
/* Lo que no es backline aunque aparezca con cantidad dentro de la lista. */
const NO_BACKLINE = /\b(handies?|radios?|walkie|motorola|pilas?|cintas?|gaf+er|toallas?|agua|hielo|bebidas?|personas|habitaci[oó]n(es)?|suburban|vans?|guardias?|sillones?|espejos?|percheros?|(sub ?)?snakes?|multipar(es)?|retornos?|returns|canales|channels|pronters?|prompters?)\b/i;
/* Renglón de input list: canal, instrumento y micrófono ("27  SNARE 2  SM 57  SHORT BOOM"). */
const CANAL = /^\d{1,2}\s+.*\b(sm ?\d{2}|beta ?\d{2}|e ?9\d{2}|e ?6\d{2}|md ?4\d{2}|d ?box|di\b|ksm|c ?414|re ?20|m ?88|psm ?\d+|xlr|phantom|short boom|tall boom|claw)\b/i;

function seccionDe(t: string): { tipo: "backline" | "audio" | "otra" } | null {
  const h = t.replace(/^[\s•·*\d.)-]+(?=\p{L})/u, "").trim();
  // "P.A." es abreviatura, no fin de frase.
  if (h.length > 70 || h.split(/\s+/).length > 9 || (/[.?!]$/.test(h) && h.split(/\s+/).length > 2)) return null;
  if (SECCION_BACKLINE.test(h)) return { tipo: "backline" };
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
  const ext: Extraccion = { evento: null, escenarios: [], dias: [], artistas: [], bloques: [], items: [], avisos: [], zonas: [], puestos: [], canales: [], requisitos: [], planos: [] };
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
    // "La agrupación lleva…" → lo que sigue lo pone el artista; "El festival suministra…" → lo pone la producción.
    let proveedorActual: string | null = null;
    // "Sustituciones aceptables:", "Guitarras spare", "Opción 2 …" → lo que sigue es alternativa, no suma.
    let modoAlternativa = false;
    // En qué sección del rider va la lectura: "fuera" = audio, luces, catering…; ahí no se leen ítems.
    let seccion: "neutra" | "backline" | "audio" | "otra" = "neutra";
    // "RIDER TÉCNICO / DREAD MAR I 2026": el rider es de una sola banda y su nombre ya no cambia.
    let artistaFijo = !!ctx.artista, esperarArtista = false;
    const sinInterpretar: string[] = [];
    // Un rider escrito todo en mayúsculas no distingue encabezados de ítems por las mayúsculas.
    const conLetras = doc.lineas.filter(l => letras(l.texto) >= 3);
    const docEnMayusculas = conLetras.length > 0 && conLetras.filter(l => l.texto === l.texto.toUpperCase()).length / conLetras.length > 0.5;

    if (doc.asunto) tituloEvento(doc.asunto);

    const renglones = sinRepetidos(unirRenglones(doc.lineas)).flatMap(dividirLista);
    // ¿Lo que sigue es un input list? Canal + instrumento + micrófono en 2 de los próximos 4 renglones.
    const MIC = /\b(mic|sm ?\d{2}|beta ?\d{2}|d ?box|di\b|e ?9\d{2}|e ?6\d{2}|md ?4\d{2}|ksm|akg|shure|sennheiser|neumann|audix|re ?20|c ?414)\b/i;
    const siguenCanales = (n: number) => renglones.slice(n + 1, n + 5).filter(x => CANAL.test(x.texto) || (/^\d{1,2}\s+\S/.test(x.texto.trim()) && MIC.test(x.texto))).length >= 2;
    for (let n = 0; n < renglones.length; n++) {
      const l = renglones[n]!;
      const texto = limpiar(l.texto);
      if (!texto || letras(texto) + (texto.match(/\d/g) ?? []).length < 2) continue;
      const anotar = (etiqueta: Etiqueta, motivo: string, item: number | null = null) =>
        ctx.traza?.push({ documento: doc.nombre, texto, etiqueta, motivo, seccion, grupo, item });
      if (riderDe(texto)) { anotar("banda", "nombre del rider"); continue; }
      const sec = usarSecciones ? seccionDe(texto.replace(/[\s:·|–—-]+$/, "")) : null;
      if (sec) {
        const comoGrupo = sec.tipo === "backline" && GRUPOS.test(texto.replace(/[\s:·|–—-]+$/, "")) && !SECCION_BACKLINE.test(texto);
        // "DRUMS" dentro del input list es un grupo de canales, no el backline.
        if (!(comoGrupo && seccion === "audio" && siguenCanales(n))) { seccion = sec.tipo; grupo = null; modoAlternativa = false; }
        if (sec.tipo === "backline" && !comoGrupo) { anotar("seccion", "empieza el backline"); continue; }
        if (sec.tipo !== "backline") { anotar("seccion", sec.tipo === "audio" ? "empieza una sección de audio (no es backline)" : "empieza una sección que no es backline"); continue; }
      }
      if (seccion === "audio" || seccion === "otra") {
        const sinColaF = texto.replace(/[\s:·|–—-]+$/, "");
        // "DRUMS" después de la sección de audio: es el backline, salvo que debajo vengan canales con micrófono.
        if (GRUPOS.test(sinColaF) && !SECCION_BACKLINE.test(sinColaF) && (seccion === "otra" || !siguenCanales(n))) { seccion = "backline"; grupo = nombrePropio(sinColaF); anotar("grupo", "título de instrumento: vuelve el backline"); continue; }
        anotar("no-backline", seccion === "audio" ? "está en una sección de audio" : "está en una sección que no es backline");
        continue;
      }
      if (CANAL.test(texto)) { anotar("no-backline", "canal del input list (instrumento + micrófono)"); continue; }
      // "IMAGEN DE EJEMPLO" (debajo de una foto) y "2 SETS DE BATERÍAS IGUALES" (la tabla ya trae las cantidades).
      if (/^(imagen|foto|image|picture)s? (de )?(ejemplo|referencia|example|reference)\b/i.test(texto)) { anotar("nota", "pie de foto"); continue; }
      if (/\bsets? de (bater[ií]as?|drums?)\b|\biguales\b|\bidentical\b/i.test(texto) && texto.split(/\s+/).length <= 7) { anotar("nota", "dice cuántos sets; las cantidades vienen en la tabla"); continue; }
      const quien = quienPone(texto);
      if (quien !== undefined) { proveedorActual = quien; if (letras(texto) > 40 || texto.split(/\s+/).length <= 5) { anotar("nota", quien ? "lo que sigue lo trae la banda" : "lo que sigue lo pone la producción"); continue; } }

      if (!artistaFijo && esEncabezadoArtistaConocido(texto)) { artista = conocidos.get(clave(texto))!; grupo = null; anotar("banda", "banda conocida del evento"); continue; }
      if (PROVEEDOR_SUELTO.test(texto)) { anotar("nota", "proveedor suelto"); continue; } // columna de proveedor que el OCR separó de su fila
      if (nota(texto)) { anotar("nota", "nota del rider"); continue; }
      const sinCola = texto.replace(/[\s:·|–—-]+$/, "");
      const pegados = variosGrupos(sinCola);
      if (GRUPOS.test(sinCola) || pegados) { grupo = nombrePropio(pegados ?? sinCola); modoAlternativa = false; anotar("grupo", "título de instrumento"); continue; }
      if (encabezadoFuerte(sinCola, l)) { grupo = nombrePropio(sinCola); modoAlternativa = false; anotar("grupo", "título en mayúsculas"); continue; }
      const sola = sinCola.match(/^opci[oó]n\s*#?\s*(\d)$/i);
      if (sola) { modoAlternativa = Number(sola[1]) > 1; anotar("nota", "opción"); continue; }
      const alt = marcaAlternativa(sinCola);
      if (alt !== undefined) { modoAlternativa = alt; if (letras(sinCola) < 4 || /^(opci[oó]n|sustitu|alternativa|spare|.*\bspare)/i.test(sinCola) && sinCola.split(/\s+/).length <= 4) { anotar("nota", alt ? "empiezan alternativas" : "vuelve lo preferido"); continue; } }
      if (bloqueHorario(texto)) { anotar("horario", "hora de un bloque"); continue; }
      const antes = ext.items.length, artistaAntes = artista;
      if (item(texto, l)) {
        if (ext.items.length > antes) anotar("item", "equipo con cantidad o reconocido", ext.items.length - 1);
        else anotar("no-backline", artistaAntes ? "radios, pilas, cinta… no son backline" : "parece backline pero no se sabe de qué banda");
        continue;
      }
      if (!ctx.fecha && diaDeLinea(texto)) { anotar("dia", "fecha"); continue; }
      if (lineaEscenario(texto)) { anotar("escenario", "nombre del escenario"); continue; }
      const artistaPrevio = artista;
      if (encabezado(texto)) { anotar(artista !== artistaPrevio ? "banda" : "grupo", artista !== artistaPrevio ? "título que parece nombre de banda" : "título de grupo"); continue; }
      if (!ext.evento && tituloEvento(texto)) { anotar("evento", "nombre del evento"); continue; }
      anotar("sin-interpretar", "no lo entendí");
      sinInterpretar.push(texto);
    }

    // Subtítulos cortos ("Instrumento", "Amplificación", "Configuración:") no hace falta revisarlos.
    const subtitulo = (t: string) => t.split(/\s+/).length <= 3 && !/\d/.test(t) && /^\p{Lu}/u.test(t) && categorizar(t) === "Otro";
    const utiles = sinInterpretar.filter(t => letras(t) >= 4 && t.length <= 120 && !subtitulo(t));
    if (utiles.length && doc.tipo !== "correo") {
      ext.avisos.push(`${doc.nombre}: ${utiles.length} línea(s) sin interpretar, p. ej. "${utiles.slice(0, 3).join('", "')}".`);
    }

    /* ---- reglas, en el orden en que se prueban ---- */

    /** "RIDER TÉCNICO" y en el renglón siguiente "DREAD MAR I 2026": esa es la banda de todo el documento. */
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
        const saludo = SALUDO.test(nombre);
        if (!saludo && letras(nombre) >= 3 && nombre.split(/\s+/).length <= 6 && !/[.?!,;]/.test(nombre)) { fijar(nombre); return true; }
        // El nombre venía en un logo (imagen) y lo siguiente es "HOLA": se busca el nombre que el rider repite.
        const repetido = nombreRepetido(doc.lineas);
        if (repetido) fijar(repetido);
        return saludo;
      }
      return false;
    }
    function fijar(nombre: string) { artista = registrarArtista(nombre); artistaFijo = true; grupo = null; }

    function bloqueHorario(t: string): boolean {
      const rango = new RegExp(`(${HORA})\\s*(?:-|–|—|a|al|hasta|to)?\\s*(${HORA})?`, "i");
      const m = t.match(rango);
      if (!m) return false;
      const inicio = normalizarHora(m[1]!);
      if (!inicio) return false;
      if (/^\s*["”″´'x×]/.test(t.slice(m.index! + m[0].length))) return false; // 12.50" es una medida, no una hora
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
        if (primera && primera.split(" ").length <= 12 && categorizar(primera) !== "Otro" && !/^\d/.test(primera) && !arranque.test(primera)) {
          t = primera; redactado = resto.length > 0;
        }
      }
      let cols = t.split(/\t|\s{2,}|\s+\|\s+/).map(c => c.trim()).filter(Boolean);
      // "CONGA HI | QUINTO | LP559X | CLASIC": tabla sin cantidad cuya primera columna es el equipo;
      // el resto son medida, marca y modelo.
      const primera = cols.length >= 2 ? separarCantidad(cols[0]!) : null;
      if (primera && !cols.some((c, i) => i > 0 && (/^(x\s*)?\d{1,3}(\s*x)?$/i.test(c) || PROVEEDOR_SUELTO.test(c) || /^(cn|oml|artista|producci[oó]n)$/i.test(c))) && categorizar(primera.descripcion) !== "Otro" && letras(primera.descripcion) >= 3) {
        t = `${cols[0]} (${cols.slice(1).join(", ")})`; cols = [t];
      }
      // "Fender  Deville 2x12": dos espacios de más no son columnas si ninguna es cantidad ni proveedor.
      if (cols.length >= 2 && !cols.some((c, i) => /^(x\s*)?\d{1,3}(\s*x)?$/i.test(c) && (i > 0 || cols.length >= 3)) && !cols.some(c => PROVEEDOR_SUELTO.test(c) || /^(cn|oml|artista|producci[oó]n)$/i.test(c))) {
        cols = [cols.join(" ")];
      }
      let descripcion: string, cantidad: number, proveedor: string | null = null, explicita = false;
      let principal: string | null = null; // la descripción sin las notas de otras columnas

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
        const junta = t.match(/^(.+?\p{L}.*?)\s+(\d{1,3})\s+(CN|OML|BACKLINE(?: COP)?|[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ]{1,15}(?: [A-ZÁÉÍÓÚÑ]{2,15})?)$/u);
        const conCat = t.match(/^([\p{L}][\p{L}\s/&]{1,30}):\s*(.+)$/u); // "Platillos: 1 ride, 2 crash"
        if (junta && letras(junta[1]!) >= 3) {
          descripcion = junta[1]!; cantidad = +junta[2]!; proveedor = junta[3]!; explicita = true;
        } else {
          const cuerpo = conCat && categorizar(conCat[1]!) !== "Otro" ? conCat[2]! : t;
          const s = separarCantidad(cuerpo);
          descripcion = s.descripcion; cantidad = s.cantidad; explicita = s.descripcion !== cuerpo;
          if (conCat && cuerpo !== t) descripcion = `${conCat[1]}: ${descripcion}`;
        }
      }
      descripcion = descripcion.replace(/^[\s•·*-]+/, "").replace(/[\s:,;.·|–—-]+$/, "").trim();
      if (!explicita && /:$/.test(t)) return false; // "BASS ASI:" es un encabezado, no un ítem
      // Sin cantidad, más de 8 palabras es una frase del rider ("Cada equipo deberá estar en perfectas condiciones…").
      const palabras = descripcion.replace(/\([^)]*\)/g, " ").split(/\s+/).filter(w => letras(w) > 0).length;
      if (!explicita && palabras > 8) return false;
      // "TOMS 10”, 12”" son dos toms.
      if (!explicita && /^toms?\b/i.test(descripcion)) {
        const medidas = descripcion.match(/\b\d{1,2}\s*(?:["”″]|pulg)/g) ?? [];
        if (medidas.length >= 2) cantidad = medidas.length;
      }
      if ((letras(descripcion) < 3 && categorizar(`${descripcion} ${grupo ?? ""}`) === "Otro") || descripcion.length > (explicita ? 140 : 90)) return false;
      const categoria: Categoria = categorizar(`${principal ?? descripcion} ${grupo ?? ""}`);
      if (NO_BACKLINE.test(descripcion) && categorizar(principal ?? descripcion) === "Otro") return true; // radios, pilas, cinta: se lee pero no es backline
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
      const m = t.match(/^(?:nota|note|nb|observaci[oó]n|importante)\s*[:.-]\s*(.+)$/i);
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
      if (/^(sustituciones|sustitutos?|alternativas?|opci[oó]n alternativa|opciones alternativas|equivalentes? aceptables?|spare|.*\bspares?)\b/i.test(t)) return true;
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
      if (categorizar(limpio) !== "Otro") { grupo = nombrePropio(limpio); return true; }
      if (artistaFijo || letras(limpio) < 4) return false;
      artista = registrarArtista(limpio);
      grupo = null;
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

/* Renglones que el documento partió en dos:
 *   - un paréntesis que se cierra abajo: "TOMS 10” (Remo" + "Pinstripe)"
 *   - una frase que sigue en minúscula: "Cada equipo deberá…" + "condiciones de…"
 *   - una lista corrida: "4 Boom Stand 3" + "Snare Stand 1 Hi" + "Hat Stand 1 Kick"
 *     → "4 Boom Stand", "3 Snare Stand", "1 Hi Hat Stand", "1 Kick …" */
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
    const colgando = (x: string) => /\s\d{1,2}(\s+\p{Lu}\p{L}*)?$/u.test(x.trim());
    if (!/\s{3}/.test(t) && (marcas(t) >= 2 || (/^\d{1,2}\s+\p{Lu}/u.test(t) && colgando(t)))) {
      let j = i;
      while (j + 1 < lineas.length) {
        const sig = lineas[j + 1]!.texto.trim();
        if (encabezado(sig) || /\s{3}/.test(sig) || sig.split(/\s+/).length > 10) break;
        const sigue = marcas(sig) >= 1 && !/^\d{1,2}\s+\p{Lu}/u.test(sig) || /^\d{1,2}\s*["”″]/.test(sig) || /^\p{Ll}/u.test(sig) || colgando(actual.texto);
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
      const medida = /^\d{1,2}\s*[x×]\s*\d{1,2}\b/i.test(sig) && sig.split(/\s+/).length <= 2 && /\p{L}$/u.test(actual.texto.trim());
      if (!cerrar && !sigue && !medida) break;
      actual = juntar(actual, lineas[i + 1]!); i++;
    }
    // Una frase partida que resultó ser lista corrida ("3 Congas LP con sus bases 2 Timbales con base 1 Mesa…").
    const partes = /\s{3}/.test(actual.texto) ? [actual.texto] : cortar(actual.texto);
    for (const parte of partes) out.push({ ...actual, texto: parte });
  }
  return out;
}

/* Lo que sigue a "RIDER TÉCNICO" cuando el nombre de la banda es un logo: saludos e índices, no bandas. */
const SALUDO = /^(hola|hello|hi|buen[oa]s|bienvenid|welcome|estimad|dear|saludos|[ií]ndice|index|contenidos?|contents?|introducci[oó]n|presentaci[oó]n|informaci[oó]n( general)?)\b/i;

/** El nombre en mayúsculas que el rider repite después de "para", "por", "de"…:
 *  "Sistemas In Ears para DIAMANTE ELÉCTRICO son", "Consola sugerida por DIAMANTE ELÉCTRICO".
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
      cuenta.set(nombre, (cuenta.get(nombre) ?? 0) + 1);
    }
  }
  const [mejor] = [...cuenta].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length);
  return mejor && mejor[1] >= 2 ? mejor[0] : null;
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
const MARCA_LISTA = /(?:^|\s)((?:[1-9]|1\d|2[0-4])\s+(?!["”″])(\p{Lu}[\p{L}]*))/gu;
const UNIDADES = /^(ch|canales|channels|retornos|returns|w|v|mts?|cm|mm|kg|hz|ft)$/i;
function posicionesLista(t: string): number[] {
  const pos: number[] = [];
  for (const m of t.matchAll(MARCA_LISTA)) if (!UNIDADES.test(m[2]!)) pos.push(m.index! + m[0].length - m[1]!.length);
  return pos;
}
const marcas = (x: string) => posicionesLista(x).length;
function cortar(t: string): string[] {
  const pos = posicionesLista(t);
  if (pos.length < 2) return [t];
  return [0, ...pos].filter((p, n, a) => n === 0 || p !== a[n - 1]).map((p, n, a) => t.slice(p, a[n + 1] ?? t.length).trim()).filter(Boolean);
}

/** "Hardware: 2x soportes de caja, 1x soporte charles, 11x soportes…" → una línea por ítem. */
function dividirLista(l: Linea): Linea[] {
  const marca = /(?:^|[,;]|\s(?:y|and|e|\+))\s*(?:x\s*)?\(?\d{1,3}\)?\s*x?\s+(?!(?:cm|mm|mts?|m|kg|w|v|ft|in|hz|k)\b)\p{L}/giu;
  if ((l.texto.match(marca) ?? []).length < 2) return dividirEnumeracion(l);
  const [cabeza, ...resto] = l.texto.split(/:\s+(?=(?:x\s*)?\(?\d{1,3}\)?\s*x?\s+\p{L})/iu);
  const cuerpo = resto.length ? resto.join(": ") : cabeza!;
  const partes = cuerpo.split(/(?:[,;]\s*|\s+(?:y|and|e|\+)\s+)(?=(?:x\s*)?\(?\d{1,3}\)?\s*x?\s+(?!(?:cm|mm|mts?|m|kg|w|v|ft|in|hz|k)\b)\p{L})/iu).map(t => t.trim()).filter(Boolean);
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
  return t.replace(/[   ]/g, " ").replace(/[|¦]{2,}/g, " ").replace(/\*\*/g, "").replace(/^\s*(?:[-–•·*●▪■➢✓>]+\s*|o\s+)(?=[\p{L}\d(])/u, "").replace(/\s+$/, "").trim();
}
