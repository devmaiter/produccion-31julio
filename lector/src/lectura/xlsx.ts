/* Un libro de Excel como hojas de texto más sus imágenes (con la fila y
 * columna donde están ancladas). Sobre exceljs, que funciona en Node y en
 * el navegador. */
import ExcelJS from "exceljs";

export interface ImagenHoja {
  bytes: Uint8Array;
  extension: string;
  /** Filas y columnas (1-based) que cubre la imagen. */
  filaDesde: number;
  filaHasta: number;
  colDesde: number;
  colHasta: number;
}

/** Un rango de celdas combinadas (1-based, inclusivo). */
export interface Rango {
  filaDesde: number;
  filaHasta: number;
  colDesde: number;
  colHasta: number;
}

export interface Hoja {
  nombre: string;
  filas: number;
  columnas: number;
  /** Texto de la celda (fila y columna 1-based); "" si está vacía.
   *  Ojo: en una celda combinada, exceljs devuelve el valor de la primera en
   *  TODAS las del rango; `combinadas` dice cuáles son copias. */
  celda(fila: number, col: number): string;
  imagenes: ImagenHoja[];
  combinadas: Rango[];
  /** Ancho de cada columna en caracteres, como en Excel (índice 0 = columna A); undefined = el de siempre. */
  anchos: Array<number | undefined>;
}

export interface Libro {
  hojas: Hoja[];
  hoja(patron: RegExp): Hoja | undefined;
}

export async function leerLibro(bytes: Uint8Array): Promise<Libro> {
  const wb = new ExcelJS.Workbook();
  // En Node exceljs quiere un Buffer; en el navegador acepta el ArrayBuffer.
  const entrada = typeof Buffer !== "undefined" ? Buffer.from(bytes) : bytes.buffer;
  await wb.xlsx.load(entrada as never);
  const hojas: Hoja[] = wb.worksheets.map(ws => {
    const cache = new Map<string, string>();
    return {
      nombre: ws.name,
      filas: ws.rowCount,
      columnas: ws.columnCount,
      celda(fila, col) {
        const k = `${fila},${col}`;
        let v = cache.get(k);
        if (v === undefined) { v = texto(ws.getRow(fila).getCell(col).value); cache.set(k, v); }
        return v;
      },
      imagenes: ws.getImages().map(im => {
        const media = wb.getImage(Number(im.imageId));
        const tl = im.range.tl, br = im.range.br ?? im.range.tl;
        return {
          bytes: new Uint8Array(media.buffer as ArrayBufferLike as ArrayBuffer),
          extension: String(media.extension).toLowerCase().replace("jpeg", "jpg"),
          filaDesde: Math.floor(tl.row) + 1,
          filaHasta: Math.floor(br.row) + 1,
          colDesde: Math.floor(tl.col) + 1,
          colHasta: Math.floor(br.col) + 1,
        };
      }),
      combinadas: (ws.model.merges ?? []).map(rango),
      anchos: Array.from({ length: ws.columnCount }, (_, c) => {
        const col = ws.getColumn(c + 1);
        return col.hidden ? 0 : col.width;
      }),
    };
  });
  return { hojas, hoja: patron => hojas.find(h => patron.test(h.nombre)) };
}

/** "B2:D3" (o "B2") → rango 1-based. */
export function rango(ref: string): Rango {
  const [a, b = a] = ref.toUpperCase().split(":");
  const celdaDe = (r: string) => {
    const m = r.match(/^\$?([A-Z]+)\$?(\d+)$/);
    if (!m) throw new Error(`Rango inválido: ${ref}`);
    return { col: [...m[1]!].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0), fila: Number(m[2]) };
  };
  const ini = celdaDe(a!), fin = celdaDe(b!);
  return {
    filaDesde: Math.min(ini.fila, fin.fila), filaHasta: Math.max(ini.fila, fin.fila),
    colDesde: Math.min(ini.col, fin.col), colHasta: Math.max(ini.col, fin.col),
  };
}

/** Celdas que una combinación tapa (todas las del rango menos la primera), como "fila,col". */
export function tapadas(combinadas: readonly Rango[]): Set<string> {
  const out = new Set<string>();
  for (const r of combinadas) {
    for (let f = r.filaDesde; f <= r.filaHasta; f++) {
      for (let c = r.colDesde; c <= r.colHasta; c++) if (f !== r.filaDesde || c !== r.colDesde) out.add(`${f},${c}`);
    }
  }
  return out;
}

/** Lo que haya en la celda, como texto: números, fechas, texto enriquecido, fórmulas (su resultado). */
function texto(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("richText" in v && Array.isArray(v.richText)) return v.richText.map(t => t.text).join("").trim();
    if ("result" in v) return texto(v.result as ExcelJS.CellValue);
    if ("text" in v && typeof v.text === "string") return v.text.trim();
    if ("hyperlink" in v) return String((v as { text?: unknown }).text ?? v.hyperlink).trim();
    if ("error" in v) return "";
  }
  return String(v).trim();
}
