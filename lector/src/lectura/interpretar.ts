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
}

/** Líneas de OCR por debajo de esta confianza se marcan "confirmar". */
export const CONFIANZA_MINIMA = 75;

const GRUPOS = /^(drums?|drum ?kit|bater[ií]a|hardware|cymbals?|set cymbals|platillos|percussion|percusi[oó]n|bass|bajo|guitars?|guitarras?|keys|keyboards?|teclados?|dj( set)?|misc(elaneous)?|varios|otros|backline|equipos?|stage|tarima|amps?|amplificadores?|vientos|brass|horns|strings|cuerdas|vocals?|voces|power|energ[ií]a|cables|accesorios)$/i;
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
const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const clave = (s: string) => sinTildes(s).toLowerCase().replace(/[^a-z0-9]+/g, "");
const letras = (s: string) => (s.match(/\p{L}/gu) ?? []).length;

/** "LA TROVA NUEVA" → "La Trova Nueva"; respeta lo que ya viene en mayúsculas y minúsculas. */
export function nombrePropio(s: string): string {
  const t = s.replace(/\s+/g, " ").replace(/[:\-–·|]+$/, "").trim();
  if (t !== t.toUpperCase()) return t;
  return t.toLowerCase().split(" ").map((p, i) =>
    i > 0 && /^(de|del|la|las|los|y|e|el|en|con)$/.test(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

export function interpretar(docs: Documento[], ctx: ContextoLectura = {}): Extraccion {
  const ext: Extraccion = { evento: null, escenarios: [], dias: [], artistas: [], bloques: [], items: [], avisos: [] };
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
    const sinInterpretar: string[] = [];

    if (doc.asunto) tituloEvento(doc.asunto);

    for (const l of doc.lineas) {
      const texto = limpiar(l.texto);
      if (!texto || letras(texto) + (texto.match(/\d/g) ?? []).length < 2) continue;

      if (!ctx.artista && esEncabezadoArtistaConocido(texto)) { artista = conocidos.get(clave(texto))!; grupo = null; continue; }
      if (PROVEEDOR_SUELTO.test(texto)) continue; // columna de proveedor que el OCR separó de su fila
      if (GRUPOS.test(texto.replace(/[:\s]+$/, ""))) { grupo = nombrePropio(texto.replace(/[:\s]+$/, "")); continue; }
      if (bloqueHorario(texto)) continue;
      if (item(texto, l)) continue;
      if (!ctx.fecha && diaDeLinea(texto)) continue;
      if (lineaEscenario(texto)) continue;
      if (encabezado(texto)) continue;
      if (!ext.evento && tituloEvento(texto)) continue;
      sinInterpretar.push(texto);
    }

    const utiles = sinInterpretar.filter(t => letras(t) >= 4 && t.length <= 120);
    if (utiles.length && doc.tipo !== "correo") {
      ext.avisos.push(`${doc.nombre}: ${utiles.length} línea(s) sin interpretar, p. ej. "${utiles.slice(0, 3).join('", "')}".`);
    }

    /* ---- reglas, en el orden en que se prueban ---- */

    function bloqueHorario(t: string): boolean {
      const rango = new RegExp(`(${HORA})\\s*(?:-|–|—|a|al|hasta|to)?\\s*(${HORA})?`, "i");
      const m = t.match(rango);
      if (!m) return false;
      const inicio = normalizarHora(m[1]!);
      if (!inicio) return false;
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
      const cols = t.split(/\t|\s{2,}|\s+\|\s+/).map(c => c.trim()).filter(Boolean);
      let descripcion: string, cantidad: number, proveedor: string | null = null, explicita = false;

      if (cols.length >= 2) {
        const iNum = cols.findIndex((c, i) => i > 0 && /^(x\s*)?\d{1,3}(\s*x)?$/i.test(c));
        const desc = cols.find((c, i) => i !== iNum && letras(c) >= 2);
        if (!desc) return false;
        descripcion = desc;
        cantidad = iNum > 0 ? Number(cols[iNum]!.replace(/\D/g, "")) : separarCantidad(desc).cantidad;
        if (iNum < 0) descripcion = separarCantidad(desc).descripcion;
        explicita = iNum > 0 || separarCantidad(desc).descripcion !== desc;
        const resto = cols.filter((c, i) => i !== iNum && c !== desc);
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
      descripcion = descripcion.replace(/^[\s•·*-]+/, "").trim();
      if (letras(descripcion) < 2 || descripcion.length > 90) return false;
      const categoria: Categoria = categorizar(`${descripcion} ${grupo ?? ""}`);
      // Sin cantidad explícita solo es ítem si se reconoce el equipo por su nombre.
      if (!explicita && categorizar(descripcion) === "Otro") return false;
      if (/[.?!]$/.test(descripcion) && descripcion.split(" ").length > 6) return false; // una frase del correo
      if (!artista) { ext.avisos.push(`${doc.nombre}: "${t}" parece backline pero no se sabe de qué artista. Indica el artista y vuelve a leer.`); return true; }
      const deOcr = l.confianza !== undefined;
      const baja = deOcr && l.confianza! < CONFIANZA_MINIMA;
      const sinCantidad = deOcr && !explicita;
      ext.items.push({
        artista, fecha, grupo, descripcion, cantidad: Math.max(0, cantidad), categoria,
        proveedor: proveedor ? proveedor.toUpperCase() : null, dudoso: baja || sinCantidad,
        nota: baja ? `lectura dudosa (${l.confianza}%)` : sinCantidad ? "cantidad no leída en la foto" : null,
      });
      return true;
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
      if (ctx.artista || letras(limpio) < 4) return false;
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

function limpiar(t: string): string {
  return t.replace(/[   ]/g, " ").replace(/[|¦]{2,}/g, " ").replace(/^\s*[-•·*]\s+/, "").replace(/\s+$/, "").trim();
}
