import type { Linea } from "./documento";

/* OCR local con Tesseract (WebAssembly): no usa internet ni servicios pagos.
 * El idioma (español + inglés, porque los riders mezclan los dos), el motor y
 * el worker se sirven desde la app (la carpeta que deja `npm run preparar`), así funciona en
 * modo evento. El modo "columna" (PSM 4) conserva las columnas de las hojas
 * de backline ("Snare stand      2      CN") y rotateAuto endereza la foto.
 * Límite conocido: en tablas con bordes, un dígito solo en su celda a veces
 * no se lee; el intérprete marca esos ítems para confirmar la cantidad. */

export interface LineaOcr {
  texto: string;
  confianza: number;
  /** Caja en píxeles de la imagen que se le pasó. */
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

export interface Ocr {
  /** Texto en líneas, respetando columnas (hojas, riders). */
  reconocer(imagen: Blob | Uint8Array): Promise<Linea[]>;
  /** Etiquetas sueltas con su posición (planos, diagramas). */
  etiquetas(imagen: Blob | Uint8Array): Promise<LineaOcr[]>;
  terminar(): Promise<void>;
}

export interface OpcionesOcr {
  /** Carpeta con spa.traineddata.gz y eng.traineddata.gz. */
  langPath: string;
  /** Si el servidor no puede servir .traineddata.gz (p. ej. un artefacto), URL por idioma con
   *  cualquier extensión; se descargan aquí y se le pasan a Tesseract como datos. */
  idiomas?: Record<string, string>;
  workerPath?: string;
  corePath?: string;
  cachePath?: string;
}

interface LineaTesseract { text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } }
interface BloqueTesseract { paragraphs: Array<{ lines: LineaTesseract[] }> }

export async function crearOcr(op: OpcionesOcr): Promise<Ocr> {
  const { createWorker, PSM } = await import("tesseract.js");
  if (op.idiomas) {
    // Tesseract mira primero su caché (IndexedDB, idb-keyval) antes de descargar
    // `${langPath}/${idioma}.traineddata.gz`: se deja ahí lo descargado desde las URL dadas.
    await Promise.all(["spa", "eng"].map(async code => {
      const url = op.idiomas![code];
      if (!url) return;
      const r = await fetch(url);
      if (!r.ok) throw new Error(`No se pudo descargar el idioma ${code} del OCR (${r.status})`);
      await guardarEnCacheTesseract(`${op.cachePath ?? "."}/${code}.traineddata`, new Uint8Array(await r.arrayBuffer()));
    }));
  }
  const worker = await createWorker(["spa", "eng"], 1, {
    langPath: op.langPath,
    ...(op.workerPath ? { workerPath: op.workerPath } : {}),
    ...(op.corePath ? { corePath: op.corePath } : {}),
    ...(op.cachePath ? { cachePath: op.cachePath } : {}),
  });
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_COLUMN, preserve_interword_spaces: "1" });
  const entrada = (imagen: Blob | Uint8Array) =>
    // Node lee Buffer; el navegador, Blob.
    (imagen instanceof Uint8Array
      ? (typeof Buffer !== "undefined" ? Buffer.from(imagen) : new Blob([imagen as BlobPart]))
      : imagen) as Parameters<typeof worker.recognize>[0];
  return {
    async reconocer(imagen) {
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_COLUMN });
      const r = await worker.recognize(entrada(imagen), { rotateAuto: true }, { blocks: true, text: true });
      const bloques = (r.data.blocks ?? []) as BloqueTesseract[];
      const lineas = bloques.flatMap(b => b.paragraphs.flatMap(p => p.lines));
      if (lineas.length) return lineas.map(l => ({ texto: l.text.replace(/\n$/, ""), confianza: Math.round(l.confidence) }));
      return (r.data.text ?? "").split("\n").map(texto => ({ texto, confianza: Math.round(r.data.confidence) }));
    },
    async etiquetas(imagen) {
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
      const r = await worker.recognize(entrada(imagen), {}, { blocks: true });
      const bloques = (r.data.blocks ?? []) as BloqueTesseract[];
      return bloques.flatMap(b => b.paragraphs.flatMap(p => p.lines)).map(l => ({
        texto: l.text.replace(/\n$/, "").trim(), confianza: Math.round(l.confidence),
        x: l.bbox.x0, y: l.bbox.y0, ancho: l.bbox.x1 - l.bbox.x0, alto: l.bbox.y1 - l.bbox.y0,
      })).filter(l => l.texto);
    },
    terminar: () => worker.terminate().then(() => undefined),
  };
}


/** Misma base y almacén que usa idb-keyval (la caché de tesseract.js en el navegador). */
function guardarEnCacheTesseract(clave: string, datos: Uint8Array): Promise<void> {
  return new Promise((ok, mal) => {
    const req = indexedDB.open("keyval-store");
    req.onupgradeneeded = () => req.result.createObjectStore("keyval");
    req.onerror = () => mal(req.error ?? new Error("IndexedDB no disponible"));
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("keyval")) { db.close(); mal(new Error("la caché del OCR no tiene el almacén keyval")); return; }
      const tx = db.transaction("keyval", "readwrite");
      tx.objectStore("keyval").put(datos, clave);
      tx.oncomplete = () => { db.close(); ok(); };
      tx.onerror = () => { db.close(); mal(tx.error ?? new Error("no se pudo guardar el idioma en la caché")); };
    };
  });
}
