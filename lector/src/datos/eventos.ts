/* Eventos guardados en data/*.json, validados al cargar (Node). */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PaqueteEvento } from "../dominio/entidades";

export const DIR_DATA = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "data");

export function cargarEventos(dir = DIR_DATA): PaqueteEvento[] {
  return readdirSync(dir)
    .filter(f => f.endsWith(".json"))
    .map(f => PaqueteEvento.parse(JSON.parse(readFileSync(join(dir, f), "utf8"))))
    .sort((a, b) => b.evento.desde.localeCompare(a.evento.desde));
}

export function cargarEvento(id: string, dir = DIR_DATA): PaqueteEvento | null {
  return cargarEventos(dir).find(p => p.evento.id === id) ?? null;
}

/** Más recientes primero. */
export const EVENTOS: PaqueteEvento[] = cargarEventos();
