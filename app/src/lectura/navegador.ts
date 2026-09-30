/* Lectores para el navegador: todo desde la propia app, sin internet. */
import type { Lectores } from "./leer";
import { crearOcr, type Ocr } from "./ocr";
import type { LibPdf, PaginaPdf } from "./pdf";
import workerPdf from "pdfjs-dist/build/pdf.worker.min.mjs?url";

interface PaginaRenderizable extends PaginaPdf {
  getViewport(o: { scale: number }): { width: number; height: number };
  render(o: { canvasContext: CanvasRenderingContext2D; viewport: unknown; canvas: HTMLCanvasElement }): { promise: Promise<void> };
}

let ocr: Promise<Ocr> | null = null;

export function lectoresNavegador(): Lectores {
  const base = (r: string) => new URL(r, document.baseURI).href;
  return {
    pdf: async () => {
      const lib = await import("pdfjs-dist");
      lib.GlobalWorkerOptions.workerSrc = workerPdf;
      return lib as unknown as LibPdf;
    },
    ocr: () => (ocr ??= crearOcr({
      langPath: base("ocr/lang"),
      workerPath: base("ocr/worker.min.js"),
      corePath: base("ocr/core"),
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
