/* Lectores para el navegador. La app le dice dónde sirve el worker de PDF y
 * la carpeta del OCR (la que deja `npm run preparar`), así el lector no
 * depende de ningún empaquetador. Todo se lee sin internet. */
import type { Lectores } from "./leer";
import { crearOcr, type Ocr } from "./ocr";
import type { LibPdf, PaginaPdf } from "./pdf";

export interface RutasNavegador {
  /** URL del worker de pdfjs (`pdfjs-dist/build/pdf.worker.min.mjs`). */
  pdfWorker: string;
  /** Carpeta servida con `worker.min.js`, `core/` y `lang/` (lo que genera `npm run preparar`). */
  ocr: string;
}

interface PaginaRenderizable extends PaginaPdf {
  getViewport(o: { scale: number }): { width: number; height: number };
  render(o: { canvasContext: CanvasRenderingContext2D; viewport: unknown; canvas: HTMLCanvasElement }): { promise: Promise<void> };
}

let ocr: Promise<Ocr> | null = null;

export function lectoresNavegador(rutas: RutasNavegador): Lectores {
  const base = (r: string) => new URL(r, document.baseURI).href;
  const dirOcr = rutas.ocr.replace(/\/+$/, "");
  return {
    pdf: async () => {
      const lib = await import("pdfjs-dist");
      lib.GlobalWorkerOptions.workerSrc = rutas.pdfWorker;
      return lib as unknown as LibPdf;
    },
    ocr: () => (ocr ??= crearOcr({
      langPath: base(`${dirOcr}/lang`),
      workerPath: base(`${dirOcr}/worker.min.js`),
      corePath: base(`${dirOcr}/core`),
    }).catch(err => { ocr = null; throw err; })),
    async renderizarPagina(pagina) {
      const p = pagina as PaginaRenderizable;
      const viewport = p.getViewport({ scale: 2.5 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await p.render({ canvasContext: canvas.getContext("2d")!, viewport, canvas }).promise;
      return new Promise<Blob>((ok, mal) => canvas.toBlob(b => (b ? ok(b) : mal(new Error("No se pudo convertir la página"))), "image/png"));
    },
  };
}
