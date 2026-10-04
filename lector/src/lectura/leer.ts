/* Archivo (correo, PDF, foto, texto) → Documento(s) de texto. Todo corre en
 * el dispositivo. Un correo devuelve su cuerpo y un documento por adjunto. */
import PostalMime from "postal-mime";
import { lineasDeTexto, type Documento, type Linea } from "./documento";
import type { Ocr } from "./ocr";
import { leerPdf, type LibPdf, type RenderizarPagina } from "./pdf";

export interface Lectores {
  /** Se crea solo si hace falta (una foto o un PDF escaneado): pesa varios MB. */
  ocr?: () => Promise<Ocr>;
  pdf?: () => Promise<LibPdf>;
  renderizarPagina?: RenderizarPagina;
  /** Amplía una imagen (PNG/JPEG) y la devuelve como PNG con su tamaño nuevo: los planos se leen 3×. */
  ampliarImagen?: (bytes: Uint8Array, extension: string, factor: number) => Promise<{ bytes: Uint8Array; ancho: number; alto: number }>;
}

const EXT_IMAGEN = /\.(jpe?g|png|webp|gif|bmp|tiff?)$/i;
const EXT_TEXTO = /\.(txt|md|csv|tsv)$/i;
const MAX_BYTES = 40 * 1024 * 1024;

export async function leerArchivo(nombre: string, datos: Uint8Array, mime: string, lectores: Lectores): Promise<Documento[]> {
  if (datos.length > MAX_BYTES) return [vacio(nombre, "texto", `${nombre} pesa más de 40 MB; no se leyó.`)];
  const m = mime.toLowerCase();

  if (/\.eml$/i.test(nombre) || m === "message/rfc822") return leerCorreo(nombre, datos, lectores);
  if (/\.pdf$/i.test(nombre) || m === "application/pdf") return [await leerPdfComoDocumento(nombre, datos, lectores)];
  if (EXT_IMAGEN.test(nombre) || m.startsWith("image/")) {
    if (!lectores.ocr) return [vacio(nombre, "imagen", `${nombre}: la lectura de fotos no está disponible aquí.`)];
    const ocr = await lectores.ocr();
    const lineas = await ocr.reconocer(datos);
    return [{ nombre, tipo: "imagen", lineas, avisos: [] }];
  }
  if (EXT_TEXTO.test(nombre) || m.startsWith("text/")) {
    return [{ nombre, tipo: "texto", lineas: lineasDeTexto(new TextDecoder().decode(datos)), avisos: [] }];
  }
  return [vacio(nombre, "texto", `${nombre}: formato no soportado (se aceptan .eml, .pdf, fotos y .txt).`)];
}

async function leerCorreo(nombre: string, datos: Uint8Array, lectores: Lectores): Promise<Documento[]> {
  const c = await PostalMime.parse(datos);
  const cuerpo = c.text ?? (c.html ? c.html.replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ") : "");
  const fecha = c.date && !Number.isNaN(Date.parse(c.date)) ? new Date(c.date).toISOString().slice(0, 10) : undefined;
  const principal: Documento = {
    nombre, tipo: "correo", lineas: lineasDeTexto(cuerpo), avisos: [],
    asunto: c.subject ?? undefined, fechaReferencia: fecha,
  };
  const docs = [principal];
  for (const adj of c.attachments) {
    const n = adj.filename ?? `adjunto-${docs.length}`;
    const bytes = typeof adj.content === "string" ? new TextEncoder().encode(adj.content) : new Uint8Array(adj.content);
    for (const d of await leerArchivo(n, bytes, adj.mimeType ?? "", lectores)) {
      d.fechaReferencia ??= fecha;
      d.asunto ??= principal.asunto;
      docs.push(d);
    }
  }
  return docs;
}

async function leerPdfComoDocumento(nombre: string, datos: Uint8Array, lectores: Lectores): Promise<Documento> {
  if (!lectores.pdf) return vacio(nombre, "pdf", `${nombre}: la lectura de PDF no está disponible aquí.`);
  const doc: Documento = { nombre, tipo: "pdf", lineas: [], paginas: [], avisos: [] };
  const deLaPagina = (lineas: Linea[], n: number) => lineas.map(l => ({ ...l, pagina: n }));
  for (const p of await leerPdf(await lectores.pdf(), datos)) {
    if (!p.escaneada) {
      doc.lineas.push(...deLaPagina(p.lineas, p.numero));
      doc.paginas!.push({ numero: p.numero, origen: "texto" });
    } else if (lectores.ocr && lectores.renderizarPagina) {
      const ocr = await lectores.ocr();
      doc.lineas.push(...deLaPagina(await ocr.reconocer(await lectores.renderizarPagina(p.pagina)), p.numero));
      doc.paginas!.push({ numero: p.numero, origen: "ocr" });
    } else {
      doc.avisos.push(`${nombre}, página ${p.numero}: es una imagen escaneada y aquí no hay OCR; súbela como foto.`);
      doc.paginas!.push({ numero: p.numero, origen: "sin-leer" });
    }
  }
  return doc;
}

function vacio(nombre: string, tipo: Documento["tipo"], aviso: string): Documento {
  return { nombre, tipo, lineas: [], avisos: [aviso] };
}
