/* Convierte los archivos que llegan (correo, PDF, foto, texto) en bloques de
 * contenido para Claude. Un correo .eml se abre: el cuerpo va como texto y
 * sus adjuntos (PDF, fotos) como documentos/imágenes, igual que si llegaran
 * sueltos. */
import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { simpleParser } from "mailparser";

type Bloque = Anthropic.Beta.BetaContentBlockParam;

const IMAGENES: Record<string, "image/jpeg" | "image/png" | "image/gif" | "image/webp"> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp",
};
const TEXTO = new Set([".txt", ".md", ".csv", ".tsv"]);
const MAX_BYTES = 30 * 1024 * 1024; // la petición entera no puede pasar de 32 MB

export interface Fuente {
  nombre: string;
  tipo: "correo" | "pdf" | "imagen" | "texto";
  bloques: Bloque[];
}

export async function leerFuente(ruta: string): Promise<Fuente> {
  const datos = await readFile(ruta);
  return fuenteDesdeBytes(basename(ruta), datos);
}

export async function fuenteDesdeBytes(nombre: string, datos: Buffer, mime = ""): Promise<Fuente> {
  if (datos.length > MAX_BYTES) throw new Error(`${nombre} pesa ${(datos.length / 1e6).toFixed(1)} MB; el máximo es 30 MB`);
  const ext = extname(nombre).toLowerCase();

  if (ext === ".pdf" || mime === "application/pdf") {
    return { nombre, tipo: "pdf", bloques: [encabezado(nombre), documentoPdf(nombre, datos)] };
  }
  const img = IMAGENES[ext] ?? Object.values(IMAGENES).find(m => m === mime);
  if (img) {
    return { nombre, tipo: "imagen", bloques: [encabezado(nombre), { type: "image", source: { type: "base64", media_type: img, data: datos.toString("base64") } }] };
  }
  if (ext === ".eml" || mime === "message/rfc822") return leerCorreo(nombre, datos);
  if (TEXTO.has(ext) || mime.startsWith("text/")) {
    return { nombre, tipo: "texto", bloques: [{ type: "text", text: `<archivo nombre="${nombre}">\n${datos.toString("utf8")}\n</archivo>` }] };
  }
  throw new Error(`No sé leer ${nombre}: se aceptan .eml, .pdf, .jpg, .png, .webp, .gif, .txt, .csv`);
}

async function leerCorreo(nombre: string, datos: Buffer): Promise<Fuente> {
  const correo = await simpleParser(datos);
  const cuerpo = correo.text ?? (typeof correo.html === "string" ? correo.html.replace(/<[^>]+>/g, " ") : "");
  const bloques: Bloque[] = [{
    type: "text",
    text: `<correo archivo="${nombre}">\nDe: ${correo.from?.text ?? ""}\nFecha: ${correo.date?.toISOString() ?? ""}\nAsunto: ${correo.subject ?? ""}\n\n${cuerpo.trim()}\n</correo>`,
  }];
  for (const adj of correo.attachments) {
    const n = adj.filename ?? `adjunto-${bloques.length}`;
    try {
      const f = await fuenteDesdeBytes(n, adj.content, adj.contentType);
      bloques.push(...f.bloques);
    } catch {
      bloques.push({ type: "text", text: `(Adjunto ${n} de tipo ${adj.contentType} omitido: formato no soportado)` });
    }
  }
  return { nombre, tipo: "correo", bloques };
}

function encabezado(nombre: string): Bloque {
  return { type: "text", text: `Archivo: ${nombre}` };
}

function documentoPdf(nombre: string, datos: Buffer): Bloque {
  return { type: "document", title: nombre, source: { type: "base64", media_type: "application/pdf", data: datos.toString("base64") } };
}
