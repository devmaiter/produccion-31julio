/* El desglose de producción (.xlsx): un libro con hojas por día y por tema,
 * cada una con una fila por banda:
 *   Backline Day n   → el rider (texto) → ítems de backline
 *   Risers Day n     → sobretarimas con medidas → zonas
 *   IO List Day n    → canal, instrumento, micrófono, base, ubicación → canales
 *   Power / Crew     → requisitos (texto tal cual)
 *   Stage Plots Day n → una imagen por banda → plano guardado + OCR → puestos y zonas
 *   BACKLINE <iniciales> → el backline de esa banda en filas Qty | ítem
 * Lo que las fuentes dicen distinto sale en avisos.
 */
import { slug } from "../datos/slug";
import type { RolPuesto } from "../dominio/entidades";
import { lineasDeTexto, type Documento } from "./documento";
import type { CanalExtraido, Extraccion, ZonaExtraida } from "./esquema";
import { interpretar, nombrePropio, type ContextoLectura } from "./interpretar";
import type { Lectores } from "./leer";
import { buscarMedidas } from "./medidas";
import { clave, emparejar } from "./nombres";
import { leerPlano, musicosDesdeCanales } from "./plano";
import { leerTablas } from "./tabla";
import { leerLibro, type Hoja } from "./xlsx";

export interface ImagenPlano {
  artista: string;
  archivo: string;
  bytes: Uint8Array;
  extension: string;
}

export interface LecturaDesglose {
  extraccion: Extraccion;
  /** Los planos, para guardarlos donde diga `archivo`. */
  imagenes: ImagenPlano[];
}

export interface ContextoDesglose extends ContextoLectura {
  /** Fecha de cada "Day n"; si no, los días de show del evento base, en orden. */
  fechas?: Record<number, string>;
  /** Con OCR se leen los planos; sin lectores solo se guardan las imágenes. */
  lectores?: Lectores;
  /** Para nombrar los archivos de los planos: stage-plots/<evento>/<artista>.png */
  eventoId?: string;
}

const DIA = /day\s*(\d+)|d[ií]a\s*(\d+)/i;

export async function leerDesglose(bytes: Uint8Array, nombreArchivo: string, ctx: ContextoDesglose = {}): Promise<LecturaDesglose> {
  const libro = await leerLibro(bytes);
  const ext: Extraccion = { evento: null, escenarios: [], dias: [], artistas: [], bloques: [], items: [], avisos: [], zonas: [], puestos: [], canales: [], requisitos: [], planos: [] };
  const imagenes: ImagenPlano[] = [];
  const base = ctx.base ?? null;
  const eventoId = ctx.eventoId ?? base?.evento.id ?? "evento";

  /* ---- Días: "Day 1" → fecha ------------------------------------------ */
  const diasShow = (base?.dias ?? []).filter(d => d.tipo === "show").sort((a, b) => a.fecha.localeCompare(b.fecha));
  const fechaDe = (n: number): string | null => ctx.fechas?.[n] ?? diasShow[n - 1]?.fecha ?? null;
  const numeroDia = (h: Hoja): number | null => {
    const m = h.nombre.match(DIA);
    return m ? Number(m[1] ?? m[2]) : null;
  };
  for (const n of [...new Set(libro.hojas.map(numeroDia).filter((x): x is number => x !== null))].sort()) {
    const f = fechaDe(n);
    if (!f) ext.avisos.push(`${nombreArchivo}: habla del "Día ${n}" y no sé qué fecha es. Elige el evento o indica las fechas.`);
    else if (!ext.dias.some(d => d.fecha === f)) ext.dias.push({ fecha: f, nombre: `Día ${n}`, tipo: "show" });
  }

  /* ---- Artistas: el mismo nombre escrito distinto es el mismo artista --- */
  const registrados = base?.artistas.map(a => a.nombre) ?? [];
  const artista = (nombre: string): string => {
    const n = nombre.replace(/\s+/g, " ").trim();
    const canon = emparejar(n, registrados) ?? emparejar(n, ext.artistas) ?? nombrePropio(n);
    if (!ext.artistas.includes(canon)) ext.artistas.push(canon);
    return canon;
  };
  const porIniciales = (iniciales: string): string | null => {
    const k = iniciales.toLowerCase();
    return registrados.find(r => r.split(/\s+/).map(p => p[0]?.toLowerCase() ?? "").join("") === k) ?? null;
  };

  /* ---- Hojas por banda: Backline, Risers, Power, Crew ------------------ */
  for (const h of libro.hojas) {
    const n = numeroDia(h);
    const fecha = n ? fechaDe(n) : null;
    const tema = /backline/i.test(h.nombre) ? "backline" : /riser|tarima/i.test(h.nombre) ? "risers" : /power|energ/i.test(h.nombre) ? "corriente" : /crew/i.test(h.nombre) ? "crew" : null;
    if (!tema || n === null) continue;

    for (const { banda, texto, nota } of filasPorBanda(h)) {
      const a = artista(banda);
      if (/^(n\/?a|tbc|tbd|check|pendiente|-)$/i.test(texto)) {
        if (/tbc|tbd|pendiente/i.test(texto)) ext.avisos.push(`${a}: ${tema} del Día ${n} está por confirmar (${texto}).`);
        continue;
      }
      ext.requisitos.push({ artista: a, tema, texto });
      if (nota && !/^check$/i.test(nota)) ext.avisos.push(`${a}: nota en la hoja ${h.nombre}: "${nota}"`);

      if (tema === "backline") {
        const doc: Documento = { nombre: `${h.nombre} · ${banda}`, tipo: "texto", lineas: lineasDeTexto(texto), avisos: [] };
        const parcial = interpretar([doc], { base, artista: a, fecha: fecha ?? undefined, anio: ctx.anio });
        ext.items.push(...parcial.items);
        ext.requisitos.push(...parcial.requisitos);
        ext.avisos.push(...parcial.avisos);
      }
      if (tema === "risers") {
        ext.zonas.push(...risersDesde(texto, a));
        // La columna de notas a veces trae lo que producción decidió montar de verdad.
        const deProduccion = nota && !/^check$/i.test(nota) ? risersDesde(nota, a).map(z => ({ ...z, nombre: `${z.nombre} (producción)`, nota: [z.nota, "anotado por producción"].filter(Boolean).join(" · ") })) : [];
        ext.zonas.push(...deProduccion);
      }
    }
  }

  /* ---- "BACKLINE KG": el backline de una banda por sus iniciales -------- */
  for (const h of libro.hojas) {
    const m = h.nombre.match(/^backline\s+([a-z]{2,4})$/i);
    if (!m) continue;
    const a = porIniciales(m[1]!);
    if (!a) { ext.avisos.push(`La hoja "${h.nombre}" es el backline de una banda con iniciales ${m[1]!.toUpperCase()} y no sé cuál es.`); continue; }
    const lineas: string[] = [];
    for (let r = 1; r <= h.filas; r++) {
      const qty = h.celda(r, 2), t = h.celda(r, 3);
      if (!t || /^qty$/i.test(qty)) continue;
      lineas.push(/^\d+$/.test(qty) ? `${qty} ${t}` : t);
    }
    const texto = lineas.join("\n");
    ext.requisitos.push({ artista: artista(a), tema: "backline", texto });
    const parcial = interpretar([{ nombre: h.nombre, tipo: "texto", lineas: lineasDeTexto(texto), avisos: [] }], { base, artista: artista(a), anio: ctx.anio });
    ext.items.push(...parcial.items);
    ext.requisitos.push(...parcial.requisitos);
    ext.avisos.push(...parcial.avisos);
  }

  /* ---- IO List ---------------------------------------------------------- */
  for (const h of libro.hojas) {
    if (!/io\s*list|input\s*list|patch/i.test(h.nombre)) continue;
    const n = numeroDia(h);
    const { canales, avisos } = canalesDesde(h, n ? fechaDe(n) : null, artista);
    ext.canales.push(...canales);
    ext.avisos.push(...avisos);
  }

  /* ---- Planos ----------------------------------------------------------- */
  for (const h of libro.hojas) {
    if (!/stage\s*plots?|planos?/i.test(h.nombre)) continue;
    const n = numeroDia(h);
    for (const im of h.imagenes) {
      const banda = pieDeFoto(h, im.filaHasta, im.filaDesde);
      if (!banda) { ext.avisos.push(`${h.nombre}: hay un plano sin nombre de banda (filas ${im.filaDesde}-${im.filaHasta}).`); continue; }
      const a = artista(banda);
      const archivo = `stage-plots/${eventoId}/${slug(a)}${n && n > 1 ? `-dia${n}` : ""}.${im.extension}`;
      imagenes.push({ artista: a, archivo, bytes: im.bytes, extension: im.extension });
      ext.planos.push({ artista: a, archivo });

      if (!ctx.lectores) continue;
      const canalesA = ext.canales.filter(c => c.artista === a);
      const risersA = ext.zonas.filter(z => z.artista === a && z.ancho !== null && z.fondo !== null).map(z => ({ ancho: z.ancho!, fondo: z.fondo! }));
      try {
        const lectura = await leerPlano(im.bytes, im.extension, { artista: a, musicos: musicosDesdeCanales(canalesA), risers: risersA }, ctx.lectores);
        if (!lectura) continue;
        ext.puestos.push(...lectura.puestos);
        for (const z of lectura.zonas) {
          const ya = ext.zonas.find(x => x.artista === a && claveZona(x.nombre) === claveZona(z.nombre));
          if (ya) { ya.x = z.x; ya.y = z.y; ya.lado ??= z.lado; ya.profundidad ??= z.profundidad; }
          else ext.zonas.push(z);
        }
        ext.avisos.push(...lectura.avisos);
        const sueltas = lectura.tomas.length - lectura.puestos.filter(p => p.corriente).length;
        if (sueltas > 0) ext.avisos.push(`${a}: el plano marca ${lectura.tomas.length} toma(s) de corriente; ${sueltas} no quedaron junto a ningún puesto.`);
      } catch (err) {
        ext.avisos.push(`${a}: no se pudo leer el plano con OCR (${err instanceof Error ? err.message : String(err)}); queda guardado para marcarlo a mano.`);
      }
    }
  }

  /* ---- Cualquier otra hoja con tablas "Cant | descripción" -------------- */
  const conocida = (h: Hoja) => numeroDia(h) !== null && /backline|riser|tarima|power|energ|crew|io\s*list|input\s*list|patch|stage\s*plots?|planos?/i.test(h.nombre) || /^backline\s+[a-z]{2,4}$/i.test(h.nombre);
  const tablas = leerTablas(libro, { artista: ctx.artista, fecha: ctx.fecha, anio: ctx.anio ?? (base ? Number(base.evento.desde?.slice(0, 4)) : undefined), emparejar: artista, omitir: conocida });
  for (const k of ["items", "requisitos", "avisos"] as const) (ext[k] as unknown[]).push(...tablas[k]);
  for (const e of tablas.escenarios) if (!ext.escenarios.includes(e)) ext.escenarios.push(e);
  for (const d of tablas.dias) if (!ext.dias.some(x => x.fecha === d.fecha)) ext.dias.push(d);
  if (!ext.items.length && !ext.zonas.length && !ext.canales.length && !ext.planos.length) {
    ext.avisos.push(`${nombreArchivo}: no encontré hojas del desglose ni tablas con una columna de cantidad. Hojas: ${libro.hojas.map(h => h.nombre).join(", ")}.`);
  }

  /* ---- Cruces entre fuentes --------------------------------------------- */
  for (const a of ext.artistas) {
    const zonasA = ext.zonas.filter(z => z.artista === a).map(z => claveZona(z.nombre));
    const enIO = new Set(ext.canales.filter(c => c.artista === a && c.ubicacion).map(c => riserEn(c.ubicacion!)).filter((x): x is string => !!x));
    for (const r of enIO) {
      if (zonasA.length && !zonasA.some(z => z === claveZona(r) || z.includes(claveZona(r).replace("riser", "")))) {
        ext.avisos.push(`${a}: el IO List ubica canales en "${r}", que no aparece en la hoja de risers ni en el plano.`);
      }
    }
    const pide = ext.items.filter(i => i.artista === a && /mesa de percusi|percussion table/i.test(i.descripcion)).reduce((s, i) => s + i.cantidad, 0);
    const percusionistas = ext.puestos.filter(p => p.artista === a && p.rol === "percusion").length;
    if (pide && percusionistas && pide > percusionistas + 1) {
      ext.avisos.push(`${a}: el rider pide ${pide} mesas de percusión y el plano dibuja ${percusionistas} puesto(s) de percusión.`);
    }
  }

  return { extraccion: ext, imagenes };
}

/* ---- Hojas con una fila por banda: B = banda, C = texto, D = nota --------- */
function filasPorBanda(h: Hoja): Array<{ banda: string; texto: string; nota: string }> {
  const out: Array<{ banda: string; texto: string; nota: string }> = [];
  for (let r = 1; r <= h.filas; r++) {
    const banda = h.celda(r, 2), texto = h.celda(r, 3);
    if (!banda || !texto || /^band\s+requi/i.test(texto) || /^requerimiento/i.test(texto)) continue;
    out.push({ banda, texto, nota: h.celda(r, 4) });
  }
  return out;
}

/* ---- Risers: una zona por línea con medidas -------------------------------- */
const NOMBRE_RISER = /\b(?:rolling\s+)?(?:risers?|sobre\s*tarimas?|tarimas?|plataformas?|platforms?)\s*-?\s*([A-D]|\d)(?![\d.,])(?:\s*(?:y|and|&|,|\/)\s*([A-D]|\d)(?![\d.,]))?\b/i;
const RISER_DE = /\b(drum|drums|keyboard|keys|amplifier|amp|string quartet|strings|percussion|bass|dj|brass|horns)\s+(riser|platform)/i;

export function risersDesde(texto: string, artista: string): ZonaExtraida[] {
  const out: ZonaExtraida[] = [];
  let sinNombre = 0;
  // "Rolling Risers" o "Tarimas con ruedas:" como título: todas las de abajo llevan ruedas.
  const todasConRuedas = texto.split(/\r?\n/).some(l => /rolling|ruedas/i.test(l) && !buscarMedidas(l));
  for (const cruda of texto.split(/\r?\n/)) {
    const linea = cruda.replace(/\s+/g, " ").trim();
    // "Debe poder dividirse en módulos de 4 × 3 + 3 × 3": son partes del riser anterior, no otro riser.
    if (/^\d+\s*[x×]\s*\d/.test(linea)) continue;
    const m = buscarMedidas(linea);
    if (!m) continue;
    const antes = linea.slice(0, m.desde), despues = linea.slice(m.hasta);
    if (/(m[oó]dulos?|secciones|dividirse|partes)\s+(de|en)\s*$/i.test(antes)) continue;
    const cantidad = Number(antes.match(/(?:^|\s|\()\s*[xX]?\s*0?(\d{1,2})\)?\s*(?:[xX]|-|:|\s)/)?.[1] ?? antes.match(/\bx\s*(\d{1,2})\b/i)?.[1] ?? 1) || 1;
    const conLetra = linea.match(NOMBRE_RISER), conUso = antes.match(RISER_DE);
    const proposito = despues.match(/^\s*\(([^)]{2,40})\)/)?.[1];
    let nombre: string;
    // "RISER C Y D – X2 …": dos zonas iguales, una por letra.
    if (conLetra?.[1] && conLetra[2]) {
      for (const letra of [conLetra[1], conLetra[2]]) {
        out.push({ artista, nombre: `Riser ${letra.toUpperCase()}`, tipo: "riser", ancho: m.ancho, fondo: m.fondo, alto: m.alto, cantidad: 1, ruedas: todasConRuedas || /rolling|rueda/i.test(linea) ? true : null, lado: null, profundidad: null, x: null, y: null, dudoso: false, nota: proposito ?? null });
      }
      continue;
    }
    if (conLetra?.[1] && /[A-D]/i.test(conLetra[1])) nombre = `Riser ${conLetra[1].toUpperCase()}`;
    else if (conUso) nombre = nombrePropio(`${conUso[1]} ${conUso[2]}`);
    else if (conLetra?.[1]) nombre = `Riser ${conLetra[1]}`;
    else if (proposito && proposito.split(/\s+/).length <= 5) nombre = nombrePropio(proposito);
    else if (/sobre\s*escenario|escenario/i.test(antes)) nombre = "Sobre escenario";
    else nombre = `Riser ${++sinNombre}`;
    const nota = [proposito && !nombre.includes(nombrePropio(proposito)) ? proposito : "", despues.replace(/^\s*\([^)]*\)/, "").replace(/^[\s,.+-]+/, "").trim()].filter(Boolean).join(" · ").slice(0, 140) || null;
    out.push({
      artista, nombre, tipo: "riser",
      ancho: m.ancho, fondo: m.fondo, alto: m.alto, cantidad,
      ruedas: todasConRuedas || /rolling|rueda/i.test(linea) ? true : null,
      lado: null, profundidad: null, x: null, y: null,
      dudoso: !conLetra && !conUso && !proposito,
      nota,
    });
  }
  return out;
}

/* ---- IO List: bloques de columnas, uno por banda --------------------------- */
function canalesDesde(h: Hoja, fecha: string | null, artista: (n: string) => string): { canales: CanalExtraido[]; avisos: string[] } {
  const canales: CanalExtraido[] = [];
  const avisos: string[] = [];
  let filaCab = 0;
  for (let r = 1; r <= Math.min(h.filas, 12) && !filaCab; r++) {
    for (let c = 1; c <= h.columnas; c++) if (/^ch$/i.test(h.celda(r, c))) { filaCab = r; break; }
  }
  if (!filaCab) { avisos.push(`${h.nombre}: no encontré la fila con "CH"; no leí canales.`); return { canales, avisos }; }

  const columnasCH: number[] = [];
  for (let c = 1; c <= h.columnas; c++) if (/^ch$/i.test(h.celda(filaCab, c))) columnasCH.push(c);

  for (const [i, c] of columnasCH.entries()) {
    const fin = columnasCH[i + 1] ? columnasCH[i + 1]! - 1 : h.columnas;
    let colBanda = 0;
    for (let k = c + 1; k <= Math.min(c + 3, fin); k++) if (h.celda(filaCab, k)) { colBanda = k; break; }
    if (!colBanda) continue;
    const a = artista(h.celda(filaCab, colBanda));
    const titulos = new Map<number, string>();
    for (let k = colBanda + 1; k <= fin; k++) { const t = h.celda(filaCab, k); if (t) titulos.set(k, t.toLowerCase()); }

    let r = filaCab + 1, vacias = 0, modo: "entrada" | "salida" = "entrada", colNum = c, colNombre = colBanda;
    while (r <= h.filas && vacias < 3) {
      const numero = h.celda(r, colNum), nombre = h.celda(r, colNombre);
      if (modo === "entrada" && /^(output|salida|mix)s?(\s+list)?$/i.test(nombre)) {
        // Empieza el bloque de salidas: OUTPUT | NOMBRE | TIPO | NOTAS, corrido dos columnas.
        modo = "salida"; colNum = colBanda; colNombre = colBanda + 1; r++; vacias = 0; continue;
      }
      if (!numero && !nombre) { vacias++; r++; continue; }
      vacias = 0;
      if (numero && nombre && !/^(ch|output)$/i.test(numero)) {
        // "1 - RACK": el número de canal y, pegado, el rack o subsnake.
        const partido = numero.match(/^(\d{1,3})\s*[-–:/]\s*(.+)$/);
        const canal: CanalExtraido = { artista: a, fecha, tipo: modo, numero: partido ? partido[1]! : numero, instrumento: nombre, microfono: null, base: null, snake: partido ? partido[2]!.trim() : null, ubicacion: null, nota: null };
        if (modo === "entrada") {
          for (const [k, t] of titulos) {
            const v = h.celda(r, k);
            if (!v) continue;
            if (/^mic/.test(t)) canal.microfono = v;
            else if (/^stand|^base|^pedestal|^mount/.test(t)) canal.base = v;
            else if (/location|position|ubicaci|posici/.test(t)) canal.ubicacion = v;
            else if (/snake|stage ?box|patch|^sub/.test(t)) { if (pareceLugar(v)) canal.ubicacion = v; else canal.snake = v; }
            else if (/observ|note|nota|comment/.test(t)) canal.nota = v;
          }
        } else {
          const tipo = h.celda(r, colNombre + 1), notas = h.celda(r, colNombre + 2);
          canal.microfono = tipo || null;
          canal.nota = notas || null;
          if (/mon|foh|sr|sl|stage/i.test(notas) && notas.length <= 12) canal.ubicacion = notas;
        }
        canales.push(canal);
      }
      r++;
    }
    if (!canales.some(x => x.artista === a)) avisos.push(`${h.nombre}: la columna de ${a} no tiene canales legibles.`);
  }
  return { canales, avisos };
}

/** "Amplifier Riser", "AMP RISER" y "amp riser" son la misma zona. */
export function claveZona(nombre: string): string {
  return clave(nombre.toLowerCase().replace(/amplifier|amplificador/g, "amp").replace(/keyboards?|keys?\b|teclados?/g, "key").replace(/drums?\b|bater[ií]a/g, "drum").replace(/platform|plataforma|sobre\s*tarima|tarima/g, "riser").replace(/\(producci[oó]n\)/g, ""));
}

const pareceLugar = (v: string) => /riser|stage|world|\b(sr|sl|us|ds|dsl|dsr|usl|usr|cs|mon|foh)\b/i.test(v);

/** "DRUMS - SR RISER" → "SR Riser"; "RISER A" → "Riser A"; "DJ RISER UC" → "DJ Riser". */
function riserEn(ubicacion: string): string | null {
  const m = ubicacion.match(/\b(riser\s*[a-d]\b|[a-z]+\s+riser)\b/i);
  return m ? nombrePropio(m[1]!) : null;
}

/** El nombre de la banda escrito bajo (o sobre) la imagen. */
function pieDeFoto(h: Hoja, filaHasta: number, filaDesde: number): string | null {
  const candidatas = [filaHasta, filaHasta - 1, filaHasta + 1, filaHasta - 2, filaHasta + 2, filaDesde - 1, filaDesde];
  for (const r of candidatas) {
    if (r < 1) continue;
    for (let c = 1; c <= h.columnas; c++) {
      const t = h.celda(r, c);
      if (t && /\p{L}{3,}/u.test(t) && t.length <= 40) return t;
    }
  }
  return null;
}

export type { RolPuesto };
