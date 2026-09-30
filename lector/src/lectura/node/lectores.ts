/* Lectores para Node (terminal y pruebas): pdfjs "legacy" y el OCR con los
 * idiomas de lector/ocr (npm run preparar). Sin internet. */
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { ampliarImagen } from "../imagen";
import type { Lectores } from "../leer";
import { crearOcr, type Ocr } from "../ocr";
import type { LibPdf } from "../pdf";

const LANG = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "ocr", "lang"); // npm run preparar

export function lectoresNode(cachePath?: string): Lectores & { cerrar(): Promise<void> } {
  let ocr: Promise<Ocr> | null = null;
  return {
    pdf: async () => (await import("pdfjs-dist/legacy/build/pdf.mjs")) as unknown as LibPdf,
    ocr: () => (ocr ??= crearOcr({ langPath: LANG, cachePath: cachePath ?? join(tmpdir(), "backline-ocr") })),
    ampliarImagen: async (bytes, extension, factor) => ampliarImagen(bytes, extension, factor),
    async cerrar() { if (ocr) await (await ocr).terminar(); },
  };
}
