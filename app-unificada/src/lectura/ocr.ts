import type { Linea } from "./documento";

/* OCR local con Tesseract (WebAssembly): no usa internet ni servicios pagos.
 * El idioma (español + inglés, porque los riders mezclan los dos), el motor y
 * el worker se sirven desde la propia app (public/ocr/), así funciona en
 * modo evento. El modo "columna" (PSM 4) conserva las columnas de las hojas
 * de backline ("Snare stand      2      CN") y rotateAuto endereza la foto.
 * Límite conocido: en tablas con bordes, un dígito solo en su celda a veces
 * no se lee; el intérprete marca esos ítems para confirmar la cantidad. */

export interface Ocr {
  reconocer(imagen: Blob | Uint8Array): Promise<Linea[]>;
  terminar(): Promise<void>;
}

export interface OpcionesOcr {
  /** Carpeta con spa.traineddata.gz y eng.traineddata.gz. */
  langPath: string;
  workerPath?: string;
  corePath?: string;
  cachePath?: string;
}

interface LineaTesseract { text: string; confidence: number }
interface BloqueTesseract { paragraphs: Array<{ lines: LineaTesseract[] }> }

export async function crearOcr(op: OpcionesOcr): Promise<Ocr> {
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker(["spa", "eng"], 1, {
    langPath: op.langPath,
    ...(op.workerPath ? { workerPath: op.workerPath } : {}),
    ...(op.corePath ? { corePath: op.corePath } : {}),
    ...(op.cachePath ? { cachePath: op.cachePath } : {}),
  });
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_COLUMN, preserve_interword_spaces: "1" });
  return {
    async reconocer(imagen) {
      // Node lee Buffer; el navegador, Blob.
      const entrada = imagen instanceof Uint8Array
        ? (typeof Buffer !== "undefined" ? Buffer.from(imagen) : new Blob([imagen as BlobPart]))
        : imagen;
      const r = await worker.recognize(entrada as Parameters<typeof worker.recognize>[0], { rotateAuto: true }, { blocks: true, text: true });
      const bloques = (r.data.blocks ?? []) as BloqueTesseract[];
      const lineas = bloques.flatMap(b => b.paragraphs.flatMap(p => p.lines));
      if (lineas.length) return lineas.map(l => ({ texto: l.text.replace(/\n$/, ""), confianza: Math.round(l.confidence) }));
      return (r.data.text ?? "").split("\n").map(texto => ({ texto, confianza: Math.round(r.data.confidence) }));
    },
    terminar: () => worker.terminate().then(() => undefined),
  };
}
