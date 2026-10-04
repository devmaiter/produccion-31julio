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

export function agruparLineas(fragmentos: Fragmento[]): Linea[] {
  const utiles = fragmentos.filter(f => f.str.trim());
  // Agrupar por altura (y), con tolerancia de medio renglón.
  const filas: Array<{ y: number; alto: number; frags: Fragmento[] }> = [];
  for (const f of utiles) {
    const y = f.transform[5]!, alto = Math.abs(f.transform[3]!) || f.height || 10;
    const fila = filas.find(r => Math.abs(r.y - y) < Math.max(r.alto, alto) * 0.5);
    if (fila) fila.frags.push(f); else filas.push({ y, alto, frags: [f] });
  }
  filas.sort((a, b) => b.y - a.y); // PDF: y crece hacia arriba
  return filas.map(r => {
    r.frags.sort((a, b) => a.transform[4]! - b.transform[4]!);
    let texto = "", finAnterior: number | null = null;
    for (const f of r.frags) {
      const x = f.transform[4]!;
      if (finAnterior !== null) {
        const hueco = x - finAnterior;
        texto += hueco > r.alto * 1.5 ? "   " : hueco > r.alto * 0.15 && !texto.endsWith(" ") && !f.str.startsWith(" ") ? " " : "";
      }
      texto += f.str;
      finAnterior = x + f.width;
    }
    return { texto: texto.trim() };
  });
}
