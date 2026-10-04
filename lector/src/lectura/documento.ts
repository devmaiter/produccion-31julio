/** Una línea de texto leída de un archivo. `confianza` (0–100) solo existe
 *  cuando la línea salió de OCR; las de PDF o correo son exactas. */
export interface Linea {
  texto: string;
  confianza?: number;
  /** Página del PDF de donde salió (1-based); solo en PDF. */
  pagina?: number;
}

/** Cómo se leyó cada página de un PDF: su texto, OCR (escaneada) o nada. */
export interface PaginaDocumento {
  numero: number;
  origen: "texto" | "ocr" | "sin-leer";
}

/** Lo que se pudo leer de un archivo, ya como texto. */
export interface Documento {
  nombre: string;
  tipo: "correo" | "pdf" | "imagen" | "texto";
  lineas: Linea[];
  /** Fecha del correo (AAAA-MM-DD), para deducir el año cuando el texto no lo trae. */
  fechaReferencia?: string;
  /** Asunto del correo: a veces es lo único que nombra el evento o la banda. */
  asunto?: string;
  /** Solo en PDF. */
  paginas?: PaginaDocumento[];
  avisos: string[];
}

export const lineasDeTexto = (t: string): Linea[] => t.split(/\r?\n/).map(texto => ({ texto }));
