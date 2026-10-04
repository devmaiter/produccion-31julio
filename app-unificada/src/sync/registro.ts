/* El registro de operaciones del portátil del evento: la copia maestra.
 * Se guarda como un archivo de líneas JSON (una operación por línea) que
 * solo crece: si el portátil se apaga, nada se pierde. */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname } from "node:path";
import { Op } from "./ops";
import type { RespuestaSync } from "./sincronizador";

const MAX_RESPUESTA_BYTES = 8_000_000;

export class RegistroOps {
  private ops: Op[] = [];
  private ids = new Set<string>();
  readonly dispositivos = new Map<string, number>();
  /** Identifica este registro: si un celular viene de otro portátil (u otro
   *  registro), se entera y reenvía todo lo que tiene. */
  readonly instancia: string;

  constructor(private archivo: string | null) {
    if (!archivo) { this.instancia = randomUUID(); return; }
    mkdirSync(dirname(archivo), { recursive: true });
    const archivoId = `${archivo}.id`;
    if (!existsSync(archivoId)) writeFileSync(archivoId, randomUUID());
    this.instancia = readFileSync(archivoId, "utf8").trim();
    if (!existsSync(archivo)) return;
    for (const linea of readFileSync(archivo, "utf8").split("\n")) {
      if (!linea.trim()) continue;
      try {
        const r = Op.safeParse(JSON.parse(linea));
        if (r.success && !this.ids.has(r.data.id)) { this.ops.push(r.data); this.ids.add(r.data.id); }
      } catch { /* línea cortada por un apagón: se ignora */ }
    }
  }

  get total(): number { return this.ops.length; }
  todas(): readonly Op[] { return this.ops; }

  sincronizar(peticion: unknown): RespuestaSync {
    const p = (peticion ?? {}) as { dispositivo?: unknown; cursor?: unknown; ops?: unknown; servidor?: unknown };
    const mismo = p.servidor === this.instancia;
    const cursor = mismo ? Math.max(0, Math.min(Number(p.cursor) || 0, this.ops.length)) : 0;
    if (typeof p.dispositivo === "string") this.dispositivos.set(p.dispositivo.slice(0, 64), Date.now());

    let rechazadas = 0;
    const recibidas = new Set<string>();
    for (const o of Array.isArray(p.ops) ? p.ops : []) {
      const r = Op.safeParse(o);
      if (!r.success) { rechazadas++; continue; }
      recibidas.add(r.data.id);
      if (this.ids.has(r.data.id)) continue;
      this.ops.push(r.data);
      this.ids.add(r.data.id);
      if (this.archivo) appendFileSync(this.archivo, JSON.stringify(r.data) + "\n");
    }

    // Lo que el dispositivo no tiene, en lotes acotados (las fotos pesan).
    const salida: Op[] = [];
    let bytes = 0, i = cursor;
    for (; i < this.ops.length; i++) {
      const op = this.ops[i]!;
      if (recibidas.has(op.id)) continue;
      const n = JSON.stringify(op).length;
      if (salida.length && bytes + n > MAX_RESPUESTA_BYTES) break;
      salida.push(op);
      bytes += n;
    }
    return { servidor: this.instancia, cursor: i, ops: salida, ahora: Date.now(), mas: i < this.ops.length, rechazadas };
  }
}
