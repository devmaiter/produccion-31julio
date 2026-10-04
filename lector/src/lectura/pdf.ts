import type { Linea } from "./documento";

/* Texto de un PDF digital, línea por línea, conservando las columnas: dos
 * fragmentos separados por un espacio grande quedan separados por tres
 * espacios, que es lo que el intérprete entiende como "otra columna".
 * La librería (pdfjs) se inyecta: en el navegador va con su worker y en Node
 * con la versión "legacy". */

export interface PaginaPdf {
  getTextContent(): Promise<{ items: unknown[] }>;
}
export interface DocumentoPdf {
  numPages: number;
  getPage(n: number): Promise<PaginaPdf>;
}
export interface LibPdf {
  getDocument(src: { data: Uint8Array }): { promise: Promise<DocumentoPdf> };
}
/** Convierte una página sin texto (escaneada) en imagen para pasarla por OCR. */
export type RenderizarPagina = (pagina: PaginaPdf) => Promise<Blob | Uint8Array>;

interface Fragmento { str: string; transform: number[]; width: number; height: number }

export interface PaginaLeida { numero: number; lineas: Linea[]; escaneada: boolean; pagina: PaginaPdf }

export async function leerPdf(lib: LibPdf, datos: Uint8Array): Promise<PaginaLeida[]> {
  const doc = await lib.getDocument({ data: datos }).promise;
  const out: PaginaLeida[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const pagina = await doc.getPage(n);
    const { items } = await pagina.getTextContent();
    const lineas = agruparLineas(items.filter((i): i is Fragmento => typeof (i as Fragmento).str === "string"));
    const texto = lineas.map(l => l.texto).join("").replace(/\s/g, "");
    out.push({ numero: n, lineas, escaneada: texto.length < 10, pagina });
  }
  return out;
}

interface Segmento { x: number; texto: string }
interface Fila { y: number; alto: number; segs: Segmento[] }

export function agruparLineas(fragmentos: Fragmento[]): Linea[] {
  const utiles = fragmentos.filter(f => f.str.trim());
  // Agrupar por altura (y), con tolerancia de medio renglón.
  const grupos: Array<{ y: number; alto: number; frags: Fragmento[] }> = [];
  for (const f of utiles) {
    const y = f.transform[5]!, alto = Math.abs(f.transform[3]!) || f.height || 10;
    const fila = grupos.find(r => Math.abs(r.y - y) < Math.max(r.alto, alto) * 0.5);
    if (fila) fila.frags.push(f); else grupos.push({ y, alto, frags: [f] });
  }
  grupos.sort((a, b) => b.y - a.y); // PDF: y crece hacia arriba
  // Cada fila en segmentos: un hueco grande (más de 1,5 renglones) separa columnas.
  const filas: Fila[] = grupos.map(r => {
    r.frags.sort((a, b) => a.transform[4]! - b.transform[4]!);
    const segs: Segmento[] = [];
    let finAnterior: number | null = null;
    for (const f of r.frags) {
      const x = f.transform[4]!;
      const hueco = finAnterior === null ? Infinity : x - finAnterior;
      const ult = segs.at(-1);
      if (!ult || hueco > r.alto * 1.5) segs.push({ x, texto: f.str });
      else ult.texto += hueco > r.alto * 0.15 && !ult.texto.endsWith(" ") && !f.str.startsWith(" ") ? " " + f.str : f.str;
      finAnterior = x + f.width;
    }
    return { y: r.y, alto: r.alto, segs: segs.map(s => ({ x: s.x, texto: s.texto.trim() })).filter(s => s.texto) };
  });
  return enColumnas(filas).map(texto => ({ texto }));
}

/* Páginas a dos o tres columnas ("TRANSPORTE | ESTADÍA", "DRUMS | GUITAR | radios"):
 * sin esto cada renglón junta las columnas y "BD 22" queda pegado a "Ampeg SVT".
 * Una zona de columnas son renglones seguidos con dos o más trozos de texto
 * corrido; sus columnas son los x donde esos trozos empiezan una y otra vez.
 * Dentro de la zona se lee una columna completa y luego la siguiente. Las tablas
 * de backline ("Snare stand | 2 | CN") no son zona: la cantidad y el proveedor
 * no son texto corrido. */
const letrasDe = (t: string) => (t.match(/\p{L}/gu) ?? []).length;
const corrido = (t: string) => letrasDe(t) >= 12 || (letrasDe(t) >= 7 && t.trim().split(/\s+/).length >= 2);

export function enColumnas(filas: Fila[]): string[] {
  const unir = (f: Fila) => f.segs.map(s => s.texto).join("   ");
  const multi = filas.map(f => f.segs.filter(s => corrido(s.texto)).length >= 2);
  const out: string[] = [];
  let i = 0;
  while (i < filas.length) {
    if (!multi[i]) { out.push(unir(filas[i]!)); i++; continue; }
    // La zona sigue mientras no haya más de 3 renglones seguidos de una sola columna.
    let fin = i;
    for (let k = i + 1; k < filas.length && k - fin <= 4; k++) if (multi[k]) fin = k;
    // El renglón de títulos justo encima ("TRANSPORTE   ESTADÍA") también es de la zona.
    let ini = i;
    while (ini > 0 && i - ini < 2 && filas[ini - 1]!.segs.length >= 2 && out.length) { ini--; out.pop(); }
    const columnas = anclas(filas.slice(ini, fin + 1).filter((_, k) => multi[ini + k]), filas[i]!.alto);
    // Una tabla "Cant | Equipo | Observación" también tiene dos columnas de texto, pero cada
    // renglón empieza con la cantidad: es una fila de tabla y se deja entera.
    const conMulti = filas.slice(ini, fin + 1).filter((_, k) => multi[ini + k]);
    const deTabla = conMulti.filter(f => /^(x\s*)?\d{1,3}(\s*x)?$/i.test(f.segs[0]!.texto)).length >= conMulti.length * 0.6;
    if (columnas.length < 2 || deTabla) { filas.slice(ini, fin + 1).forEach(f => out.push(unir(f))); i = fin + 1; continue; }
    const tol = Math.max(8, filas[i]!.alto);
    // Sigue mientras aparezcan renglones con dos o más trozos que caen en las columnas
    // ("1 16” Hybrid   funcionamiento y con…" no es texto corrido a la izquierda, pero es de la zona).
    const alineado = (x: number) => columnas.some(a => Math.abs(a - x) <= tol * 2);
    for (let k = fin + 1; k < filas.length && k - fin <= 4; k++) {
      const segs = filas[k]!.segs;
      if (segs.length >= 2 && segs.every(sg => alineado(sg.x))) fin = k;
    }
    // Y la cola de una columna larga ("1 China", "1 FX 16”"): renglones sueltos con la misma
    // letra y el mismo interlineado; un título que sigue (otra letra o más aire) no entra.
    const altoZona = filas[i]!.alto;
    while (fin + 1 < filas.length) {
      const f = filas[fin + 1]!, prev = filas[fin]!;
      const mismaLetra = Math.abs(f.alto - altoZona) <= altoZona * 0.15;
      const pegado = prev.y - f.y <= Math.max(prev.alto, f.alto) * 2.2;
      if (f.segs.length === 1 && alineado(f.segs[0]!.x) && mismaLetra && pegado) fin++; else break;
    }
    const zona = filas.slice(ini, fin + 1);
    const col = (x: number) => { let c = 0; columnas.forEach((a, k) => { if (a <= x + tol) c = k; }); return c; };
    for (let c = 0; c < columnas.length; c++) {
      for (const f of zona) {
        const suyos = f.segs.filter(s => col(s.x) === c);
        if (suyos.length) out.push(suyos.map(s => s.texto).join("   "));
      }
    }
    i = fin + 1;
  }
  return out.map(t => t.trim()).filter(Boolean);
}

/** x donde empiezan las columnas: inicios de trozos de texto corrido que se repiten. */
function anclas(filas: Fila[], alto: number): number[] {
  const xs = filas.flatMap(f => f.segs.filter(s => corrido(s.texto)).map(s => s.x)).sort((a, b) => a - b);
  const tol = Math.max(10, alto * 1.5);
  const grupos: number[][] = [];
  for (const x of xs) { const g = grupos.at(-1); if (g && x - g.at(-1)! <= tol) g.push(x); else grupos.push([x]); }
  const minimo = Math.max(2, Math.ceil(filas.length * 0.25));
  return grupos.filter(g => g.length >= minimo).map(g => Math.min(...g));
}
