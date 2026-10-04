/* Lo que se leyó de un archivo, como Markdown, ANTES de interpretar: sirve
 * para confirmar que el texto salió bien (páginas, columnas, OCR) y para
 * señalar un renglón por su número cuando algo se lee mal.
 *
 *   - Cada página (o foto, correo, hoja de Excel) va en un bloque de código:
 *     se ve igual en la terminal y en un visor de Markdown, renglón por renglón.
 *   - Los renglones van numerados de corrido en todo el archivo.
 *   - "│" es donde el lector vio otra columna (tres espacios o más).
 *   - "⟨62 %⟩" es un renglón de OCR con poca confianza.
 * No decide nada: no hay secciones, ítems ni bandas aquí. */
import type { Documento, Linea } from "./documento";
import { CONFIANZA_MINIMA } from "./interpretar";
import { tapadas, type Hoja, type Libro } from "./xlsx";

const COLUMNA = /\s{3,}/g;

export function renglon(l: Linea): string {
  const t = l.texto.trim().replace(COLUMNA, " │ ");
  return l.confianza !== undefined && l.confianza < CONFIANZA_MINIMA ? `${t}  ⟨${l.confianza} %⟩` : t;
}

/** Los documentos que salieron de UN archivo (un correo trae su cuerpo y luego sus adjuntos). */
export function documentosAMarkdown(docs: Documento[]): string {
  if (!docs.length) return "";
  const [primero, ...resto] = docs;
  const numerar = numerador(docs.reduce((n, d) => n + d.lineas.length, 0));
  const out = [documento(primero!, 1, numerar)];
  for (const adj of primero!.tipo === "correo" ? resto : []) out.push(documento(adj, 2, numerar, "Adjunto: "));
  if (primero!.tipo !== "correo") for (const d of resto) out.push(documento(d, 1, numerar));
  return out.join("\n\n") + "\n";
}

export function libroAMarkdown(libro: Libro, nombre: string): string {
  const out = [`# ${nombre}`, `Excel · ${plural(libro.hojas.length, "hoja")}`];
  for (const h of libro.hojas) out.push("", ...hojaAMarkdown(h));
  return out.join("\n") + "\n";
}

/* ---------------------------------------------------------------------- */

type Numerador = (lineas: Linea[]) => string[];

function documento(d: Documento, nivel: number, numerar: Numerador, prefijo = ""): string {
  const h = "#".repeat(nivel);
  const out = [`${h} ${prefijo}${d.nombre}`, resumen(d)];
  for (const a of d.avisos) out.push(`> ⚠ ${a}`);

  if (d.tipo === "pdf" && d.paginas?.length) {
    for (const p of d.paginas) {
      const suyas = d.lineas.filter(l => l.pagina === p.numero);
      const como = p.origen === "ocr" ? " · escaneada, leída con OCR" : p.origen === "sin-leer" ? " · escaneada, sin leer (aquí no hay OCR)" : "";
      out.push("", `${h}# Página ${p.numero}${como}`);
      if (p.origen !== "sin-leer") out.push(suyas.length ? bloque(numerar(suyas)) : "_(sin texto)_");
    }
  } else if (d.lineas.length) {
    out.push("", bloque(numerar(d.lineas)));
  }
  return out.join("\n");
}

function resumen(d: Documento): string {
  const partes: string[] = [];
  const ocr = d.lineas.filter(l => l.confianza !== undefined);
  const dudosos = ocr.filter(l => l.confianza! < CONFIANZA_MINIMA).length;
  if (d.tipo === "pdf") {
    partes.push("PDF", plural(d.paginas?.length ?? 0, "página"));
    const escaneadas = d.paginas?.filter(p => p.origen !== "texto").length ?? 0;
    if (escaneadas) partes.push(`${escaneadas} escaneada${escaneadas === 1 ? "" : "s"}`);
  }
  if (d.tipo === "imagen") partes.push("Foto", "leída con OCR");
  if (d.tipo === "texto") partes.push("Texto");
  if (d.tipo === "correo") {
    partes.push("Correo");
    if (d.asunto) partes.push(`Asunto: ${d.asunto}`);
    if (d.fechaReferencia) partes.push(`Fecha: ${d.fechaReferencia}`);
  }
  partes.push(plural(d.lineas.filter(l => l.texto.trim()).length, "renglón", "renglones"));
  if (dudosos) partes.push(`${dudosos} con poca confianza`);
  return partes.join(" · ");
}

/** Una hoja: título, imágenes y sus filas en un bloque (el número de cada renglón es el de la fila). */
export function hojaAMarkdown(h: Hoja): string[] {
  const out = [`## Hoja «${h.nombre}» · ${plural(h.filas, "fila")} × ${plural(h.columnas, "columna")}`];
  for (const im of h.imagenes) {
    out.push(`- Imagen (${im.extension}) en ${letra(im.colDesde)}${im.filaDesde}:${letra(im.colHasta)}${im.filaHasta}`);
  }
  // Una celda combinada se muestra una vez, en su primera celda: exceljs la copia en todo el rango.
  const tapada = tapadas(h.combinadas);
  const filas: Array<{ f: number; celdas: string[] }> = [];
  for (let f = 1; f <= h.filas; f++) {
    const celdas = Array.from({ length: h.columnas }, (_, c) => (tapada.has(`${f},${c + 1}`) ? "" : h.celda(f, c + 1)));
    while (celdas.length && !celdas.at(-1)) celdas.pop();
    if (celdas.length) filas.push({ f, celdas });
  }
  if (!filas.length) { out.push("_(vacía)_"); return out; }
  // Las columnas vacías de la izquierda solo estorban: se empieza en la primera con algo.
  const desde = Math.min(...filas.map(r => r.celdas.findIndex(Boolean)));
  if (desde > 0) out.push(`_Desde la columna ${letra(desde + 1)}._`);
  // En Excel el número de renglón es el de la fila: así se ubica en el libro.
  const ancho = String(filas.at(-1)!.f).length;
  const sangria = " ".repeat(ancho + 4);
  out.push(bloque(filas.flatMap(({ f, celdas }) => {
    const suyas = celdas.slice(desde);
    // Una celda con varios renglones (un rider entero) va debajo, renglón por renglón;
    // en la fila queda "↓ D" para saber de qué columna son.
    const largas = suyas.map((t, c) => (t.includes("\n") ? c : -1)).filter(c => c >= 0);
    const fila = suyas.map((t, c) => (largas.includes(c) ? `↓ ${letra(desde + c + 1)}` : t)).join(" │ ");
    const debajo = largas.flatMap(c => suyas[c]!.split(/\r?\n/).map(t => t.trim()).filter(Boolean).map(t => sangria + t));
    return [`${String(f).padStart(ancho)}  ${fila}`, ...debajo];
  })));
  return out;
}

/** Numera de corrido en todo el archivo; los renglones vacíos no llevan número. */
function numerador(total: number): Numerador {
  let n = 0;
  const ancho = String(Math.max(total, 1)).length;
  return lineas => lineas.map(l => {
    const t = renglon(l);
    return t ? `${String(++n).padStart(ancho)}  ${t}` : "";
  });
}

function bloque(lineas: string[]): string {
  // Sin vacíos repetidos ni al principio o al final.
  const limpias = lineas.filter((l, i) => l || (i > 0 && lineas[i - 1])).join("\n").replace(/^\n+|\n+$/g, "");
  const cerca = limpias.includes("```") ? "~~~~" : "```";
  return `${cerca}text\n${limpias}\n${cerca}`;
}

const plural = (n: number, uno: string, varios = `${uno}s`) => `${n} ${n === 1 ? uno : varios}`;

function letra(col: number): string {
  let s = "";
  for (let c = col; c > 0; c = Math.floor((c - 1) / 26)) s = String.fromCharCode(65 + ((c - 1) % 26)) + s;
  return s;
}
