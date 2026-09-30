import Anthropic from "@anthropic-ai/sdk";
import type { PaqueteEvento } from "../dominio";
import { extraer as extraerFuentes } from "./extraer";
import { fuenteDesdeBytes } from "./fuentes";
import { contextoDe, integrar } from "./integrar";



/** Archivos subidos → extracción → integración con el evento base. */
export async function extraer(archivos: Array<{ nombre: string; tipo: string; base64: string }>, base: PaqueteEvento | null) {
  const fuentes = await Promise.all(archivos.map(a => fuenteDesdeBytes(a.nombre, Buffer.from(a.base64, "base64"), a.tipo)));
  try {
    const ext = await extraerFuentes(fuentes, { contexto: base ? contextoDe(base) : undefined });
    return { extraccion: ext, ...integrar(ext, base, fuentes.map(f => f.nombre).join(", ")) };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new Error("Falta la clave de la API o no es válida (ANTHROPIC_API_KEY en el servidor).");
    if (err instanceof Anthropic.RateLimitError) throw new Error("Límite de uso de la API alcanzado; intenta en un momento.");
    if (err instanceof Anthropic.APIError) throw new Error(`Error de la API (${err.status}): ${err.message}`);
    if (err instanceof Anthropic.AnthropicError) throw new Error("El servidor no tiene credenciales de la API: define ANTHROPIC_API_KEY antes de npm run dev.");
    throw err;
  }
}
