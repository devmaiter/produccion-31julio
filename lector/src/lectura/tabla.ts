/* Tablas de backline en Excel que no son el desglose: cualquier hoja con una
 * columna de cantidad ("Cant", "Cantidad", "Qty") seguida de la descripción.
 *
 *   Cant | Requerimiento | Cant | Propuesta      ← un bloque por banda, lado a lado
 *   01 x | Bombo 22"     | 1    | Bombo 22"
 *        | BAJO          |      | BAJO           ← fila sin cantidad y corta: grupo
 *
 * El nombre de la banda se busca encima del encabezado ("Los Rayos | Backline
 * Stage 4 | 12/09"), igual que la fecha y el escenario. Cuando una banda trae
 * "Requerimiento" (lo que pide el rider) y "Propuesta" (lo que se le va a
 * poner), los ítems salen de la propuesta y el requerimiento queda como
 * requisito, para no contar el equipo dos veces.
 */
import { categorizar, noEsBackline } from "../dominio/categorias";
import type { Extraccion, FilaComparada } from "./esquema";
import { nombrePropio } from "./interpretar";
import { extraccionVacia } from "./unir";
import type { Hoja, Libro } from "./xlsx";

export interface ContextoTabla {
  /** Todo lo leído es de esta banda (si la hoja no lo dice). */
  artista?: string;
  /** Fecha por defecto (AAAA-MM-DD). */
  fecha?: string;
  /** Año para fechas "12/09". */
  anio?: number;
  /** Nombres registrados, para escribir la banda como está en el evento. */
  emparejar?: (nombre: string) => string;
  /** Hojas que ya leyó otro lector (desglose): se saltan. */
  omitir?: (hoja: Hoja) => boolean;
}

const CANTIDAD = /^(cant(idad)?\.?|qty|quantity|cantidades|n[°º.]?|#)$/i;
const NO_ES_BANDA = /^(cat|rider|set\s+[a-z]|stage\s*\d*|escenario|cant|d[ií]a|fecha|hoja|sheet|equipo|backline|total|https?:)/i;
const REQUERIMIENTO = /requerimiento|rider|solicit|pide|request/i;
const PROPUESTA = /propuesta|propone|oml|equipo|backline|suministr|entrega|proposal/i;

interface FilaBloque { fila: number; cantidad: number | null; texto: string; extras: string[] }
interface Bloque { hoja: Hoja; fila: number; col: number; fin: number; titulo: string; banda: string | null; fecha: string | null; escenario: string | null; filas: FilaBloque[] }

export function leerTablas(libro: Libro, ctx: ContextoTabla = {}): Extraccion {
  const ext = extraccionVacia();
  const bloques: Bloque[] = [];
  for (const h of libro.hojas) {
    if (ctx.omitir?.(h)) continue;
    for (let r = 1; r <= h.filas; r++) {
      for (let c = 1; c < h.columnas; c++) {
        if (!CANTIDAD.test(h.celda(r, c).trim()) || !h.celda(r, c + 1).trim()) continue;
        // El bloque va de la columna de cantidad hasta la siguiente columna de cantidad.
        let fin = h.columnas;
        for (let k = c + 2; k <= h.columnas; k++) if (CANTIDAD.test(h.celda(r, k).trim())) { fin = k - 1; break; }
        bloques.push(leerBloque(h, r, c, fin, ctx));
      }
    }
  }
  if (!bloques.length) return ext;
  // "Cant | Requerimiento | Cant | Propuesta": el nombre de la banda está una sola vez
  // sobre el primer bloque; los bloques pegados a su derecha en la misma fila lo heredan.
  for (const b of bloques) {
    if (b.banda) continue;
    const izq = bloques.find(o => o.hoja === b.hoja && o.fila === b.fila && o.fin + 1 === b.col);
    if (izq?.banda) { b.banda = izq.banda; b.fecha ??= izq.fecha; b.escenario ??= izq.escenario; }
  }

  // Por banda: si hay propuesta y requerimiento, los ítems salen de la propuesta.
  const porBanda = new Map<string, Bloque[]>();
  for (const b of bloques) {
    const nombre = b.banda ?? ctx.artista ?? nombrePropio(b.hoja.nombre);
    (porBanda.get(nombre) ?? porBanda.set(nombre, []).get(nombre)!).push(b);
  }
  for (const [nombre, suyos] of porBanda) {
    const artista = ctx.emparejar?.(nombre) ?? nombre;
    if (!ext.artistas.includes(artista)) ext.artistas.push(artista);
    const hayPropuesta = suyos.some(b => PROPUESTA.test(b.titulo)) && suyos.some(b => REQUERIMIENTO.test(b.titulo));
    // Ninguna banda encima de la tabla ni dada por quien la sube: es un listado general, no el rider de una banda.
    const sinBanda = !suyos.some(b => b.banda) && !ctx.artista;
    for (const b of suyos) {
      if (b.escenario && !ext.escenarios.includes(b.escenario)) ext.escenarios.push(b.escenario);
      const fecha = b.fecha ?? ctx.fecha ?? null;
      if (fecha && !ext.dias.some(d => d.fecha === fecha)) ext.dias.push({ fecha, nombre: fecha, tipo: "show" });
      if (hayPropuesta && REQUERIMIENTO.test(b.titulo)) {
        const texto = b.filas.map(f => (f.cantidad !== null ? `${f.cantidad} ${f.texto}` : f.texto)).join("\n");
        ext.requisitos.push({ artista, tema: "backline", texto: `${b.titulo} (${b.hoja.nombre}):\n${texto}` });
        // Y fila por fila contra la propuesta que tiene a su derecha, para verlos lado a lado.
        const propuesta = suyos.filter(o => o !== b && o.hoja === b.hoja && o.fila === b.fila && o.col > b.col && PROPUESTA.test(o.titulo))
          .sort((x, y) => x.col - y.col)[0];
        if (propuesta) ext.comparaciones.push({ artista, fecha, hoja: b.hoja.nombre, filas: comparar(b, propuesta) });
        continue;
      }
      for (const { grupo, ...f } of recorrer(b)) {
        if (noEsBackline(f.texto, grupo)) continue; // risers, pedestales de mic, DI, cables y corriente no son backline
        const sinCantidad = f.cantidad === null;
        const item: Extraccion["items"][number] = {
          artista, fecha, grupo, descripcion: f.texto, cantidad: sinCantidad ? 1 : f.cantidad!,
          categoria: categorizar(`${f.texto} ${grupo ?? ""}`), proveedor: null,
          dudoso: sinCantidad, nota: [sinCantidad ? "sin cantidad en la hoja" : "", ...f.extras].filter(Boolean).join(" · ") || null,
          ...(sinBanda ? { sinBanda: true } : {}),
        };
        ext.items.push(item);
      }
    }
    if (sinBanda) ext.avisos.push(`${suyos[0]!.hoja.nombre}: la tabla no dice de qué banda es; quedó como "${artista}".`);
  }
  return ext;
}

function leerBloque(h: Hoja, fila: number, col: number, fin: number, ctx: ContextoTabla): Bloque {
  const titulo = h.celda(fila, col + 1).trim();
  // Encima del encabezado: banda, escenario y fecha.
  let banda: string | null = null, fecha: string | null = null, escenario: string | null = null;
  for (let r = fila - 1; r >= Math.max(1, fila - 8) && !banda; r--) {
    for (let c = col; c <= fin; c++) {
      const t = h.celda(r, c).trim();
      if (!t) continue;
      const f = fechaDe(t, ctx.anio);
      if (f && !fecha) fecha = f;
      const e = t.match(/\b(stage|escenario|tarima)\s*(\d+|[A-Z]\b)/i);
      if (e && !escenario) escenario = nombrePropio(`${e[1]} ${e[2]}`);
      if (banda || /^\d{4}-\d{2}-\d{2}/.test(t) || (t.match(/\p{L}/gu) ?? []).length < 3) continue;
      const partes = t.split(/\s*\|\s*/).map(p => p.trim()).filter(Boolean);
      const candidata = partes.find(p => !NO_ES_BANDA.test(p) && !/^\d/.test(p) && p.length <= 60);
      if (candidata) {
        banda = nombrePropio(candidata.replace(/\s*[-–]\s*(backline|rider).*$/i, ""));
        for (const p of partes) { const ff = fechaDe(p, ctx.anio); if (ff) fecha = ff; const ee = p.match(/\b(stage|escenario)\s*(\d+)/i); if (ee) escenario = nombrePropio(`${ee[1]} ${ee[2]}`); }
      }
    }
  }
  // Extras: columnas del bloque más allá de la descripción, con su título.
  const extras: Array<[number, string]> = [];
  for (let c = col + 2; c <= fin; c++) { const t = h.celda(fila, c).trim(); if (t) extras.push([c, t]); }

  const filas: Bloque["filas"] = [];
  let vacias = 0;
  for (let r = fila + 1; r <= h.filas && vacias < 3; r++) {
    const q = h.celda(r, col).trim(), t = h.celda(r, col + 1).trim();
    if (CANTIDAD.test(q)) break; // otro bloque debajo
    if (!q && !t) { vacias++; continue; }
    vacias = 0;
    if (!t) continue;
    const n = q.match(/\d+([.,]\d+)?/);
    const cantidad = n ? Math.round(Number(n[0].replace(",", "."))) : (q && !/x/i.test(q) ? null : null);
    filas.push({ fila: r, cantidad, texto: t.replace(/\s+/g, " "), extras: extras.map(([c, tit]) => { const v = h.celda(r, c).trim(); return v ? `${tit.toLowerCase()}: ${v}` : ""; }).filter(Boolean) });
  }
  return { hoja: h, fila, col, fin, titulo, banda, fecha, escenario, filas };
}

/** Las filas de un bloque sin los encabezados de grupo, cada una con su grupo. */
function recorrer(b: Bloque): Array<FilaBloque & { grupo: string | null }> {
  const out: Array<FilaBloque & { grupo: string | null }> = [];
  let grupo: string | null = null, anteriorFueGrupo = false;
  for (const f of b.filas) {
    // "DRUM" y debajo "PEARL MASTER CUSTOM": dos filas seguidas sin cantidad, la segunda es el modelo, no otro grupo.
    if (f.cantidad === null && esGrupo(f.texto) && !anteriorFueGrupo) { grupo = nombrePropio(f.texto.replace(/[:\s]+$/, "")); anteriorFueGrupo = true; continue; }
    anteriorFueGrupo = false;
    out.push({ ...f, grupo });
  }
  return out;
}

/** Requerimiento y propuesta por fila de la hoja, como se ven en el Excel. Cada lado
 *  lleva su categoría (la de la propuesta es la misma que la de su ítem). */
function comparar(pide: Bloque, propone: Bloque): FilaComparada[] {
  const lado = (f: (FilaBloque & { grupo: string | null }) | undefined) => f
    ? { cantidad: f.cantidad, texto: f.texto, grupo: f.grupo, categoria: categorizar(`${f.texto} ${f.grupo ?? ""}`) }
    : null;
  const p = new Map(recorrer(pide).map(f => [f.fila, f]));
  const q = new Map(recorrer(propone).map(f => [f.fila, f]));
  const filas = [...new Set([...p.keys(), ...q.keys()])].sort((a, b) => a - b);
  return filas.map(fila => ({ fila, pide: lado(p.get(fila)), propone: lado(q.get(fila)) }));
}

/** "BATERÍA", "Hardware", "SAX / PERCUSIÓN", "Teclados:" — corto, sin números y sin marca. */
function esGrupo(t: string): boolean {
  const limpio = t.replace(/[:\s]+$/, "");
  if (/\d/.test(limpio) || limpio.split(/\s+/).length > 4 || limpio.length > 40) return false;
  if (limpio === limpio.toUpperCase()) return true;
  return categorizar(limpio) !== "Otro" && limpio.split(/\s+/).length <= 2;
}

function fechaDe(t: string, anio?: number): string | null {
  const iso = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dm = t.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (dm) {
    const y = dm[3] ? (dm[3].length === 2 ? 2000 + Number(dm[3]) : Number(dm[3])) : (anio ?? new Date().getFullYear());
    return `${y}-${dm[2]!.padStart(2, "0")}-${dm[1]!.padStart(2, "0")}`;
  }
  return null;
}
