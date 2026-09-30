/* Endpoints de extracción para el servidor de desarrollo (npm run dev).
 * La clave de la API vive solo aquí, en el proceso de Node; el navegador
 * envía los archivos y recibe el resultado ya integrado para revisarlo.
 *
 *   POST /api/extraer  { eventoId?: string, archivos: [{ nombre, tipo, base64 }] }
 *                      → { resumen, paquete }      (no guarda nada)
 *   POST /api/guardar  { paquete }                 → { ok, id }  (escribe data/<id>.json)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import { z } from "zod";
import { PaqueteEvento } from "../dominio";
import { extraer } from "./extraer-contexto";

const MAX_CUERPO = 40 * 1024 * 1024;

const PeticionExtraer = z.object({
  eventoId: z.string().regex(/^[a-z0-9-]+$/).optional(),
  archivos: z.array(z.object({ nombre: z.string().min(1).max(200), tipo: z.string().max(100), base64: z.string() })).min(1).max(20),
});
const PeticionGuardar = z.object({ paquete: PaqueteEvento, nuevo: z.boolean() });

function leerCuerpo(req: IncomingMessage): Promise<unknown> {
  return new Promise((ok, mal) => {
    let tam = 0;
    const partes: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      tam += c.length;
      if (tam > MAX_CUERPO) { mal(new Error("Los archivos pesan demasiado (máximo 30 MB en total)")); req.destroy(); return; }
      partes.push(c);
    });
    req.on("end", () => { try { ok(JSON.parse(Buffer.concat(partes).toString("utf8"))); } catch { mal(new Error("Petición inválida")); } });
    req.on("error", mal);
  });
}

function responder(res: ServerResponse, estado: number, cuerpo: unknown) {
  res.statusCode = estado;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(cuerpo));
}

export function crearManejadores(dirData: string) {
  const ruta = (id: string) => join(dirData, `${id}.json`);
  const cargar = (id: string) => {
    if (!existsSync(ruta(id))) throw new Error(`No existe el evento ${id}`);
    return PaqueteEvento.parse(JSON.parse(readFileSync(ruta(id), "utf8")));
  };

  async function manejarExtraer(req: IncomingMessage, res: ServerResponse) {
    try {
      const p = PeticionExtraer.parse(await leerCuerpo(req));
      const base = p.eventoId ? cargar(p.eventoId) : null;
      const r = await extraer(p.archivos, base);
      responder(res, 200, r);
    } catch (err) {
      responder(res, err instanceof z.ZodError ? 400 : 500, { error: mensaje(err) });
    }
  }

  async function manejarGuardar(req: IncomingMessage, res: ServerResponse) {
    try {
      const { paquete, nuevo } = PeticionGuardar.parse(await leerCuerpo(req));
      if (nuevo && existsSync(ruta(paquete.evento.id))) throw new Error(`Ya existe el evento ${paquete.evento.id}; elígelo como destino.`);
      writeFileSync(ruta(paquete.evento.id), JSON.stringify(paquete, null, 1) + "\n");
      responder(res, 200, { ok: true, id: paquete.evento.id });
    } catch (err) {
      responder(res, err instanceof z.ZodError ? 400 : 500, { error: mensaje(err) });
    }
  }

  return { manejarExtraer, manejarGuardar };
}

function mensaje(err: unknown): string {
  if (err instanceof z.ZodError) return `Datos inválidos: ${err.issues.slice(0, 3).map(i => `${i.path.join(".")} ${i.message}`).join("; ")}`;
  return err instanceof Error ? err.message : String(err);
}
