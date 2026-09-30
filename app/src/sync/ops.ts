/* Modo evento: cada cambio es una OPERACIÓN (contar, editar un ítem, subir
 * una foto, importar un rider). Las operaciones se guardan en el dispositivo
 * y se sincronizan con el portátil del evento cuando hay red local.
 *
 * El estado de un evento = su base (data/*.json) + todas las operaciones,
 * aplicadas en orden (fecha, dispositivo, id). Como el orden es el mismo en
 * todos lados, todos los dispositivos que tengan las mismas operaciones ven
 * exactamente lo mismo, sin importar en qué orden les llegaron.
 * Si dos personas cambian lo mismo, gana el cambio más reciente.
 */
import { z } from "zod";
import { Artista, Bloque, Dia, Escenario, Evento, ItemBackline, StagePlot, Verificacion, type PaqueteEvento } from "../dominio/entidades";

const Id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/);

export const Foto = z.object({
  id: Id,
  artistaId: Id,
  diaId: Id.optional(),
  /** JPEG reducido (≈1280 px) como data URL. */
  dataUrl: z.string().startsWith("data:image/").max(3_000_000),
  autor: z.string().max(60).optional(),
});
export type Foto = z.infer<typeof Foto>;

const Comun = { id: z.string().min(8).max(64), eventoId: Id, ts: z.number().int().positive(), dispositivo: z.string().min(1).max(64), autor: z.string().max(60).optional() };

export const Op = z.discriminatedUnion("tipo", [
  /** Estructura del evento (días, artistas, horario…): la escribe una importación. */
  z.object({ ...Comun, tipo: z.literal("estructura"), datos: z.object({ evento: Evento, escenarios: z.array(Escenario), dias: z.array(Dia), artistas: z.array(Artista), bloques: z.array(Bloque), stagePlots: z.array(StagePlot) }) }),
  z.object({ ...Comun, tipo: z.literal("item.guardar"), datos: ItemBackline }),
  z.object({ ...Comun, tipo: z.literal("item.borrar"), datos: z.object({ itemId: Id }) }),
  z.object({ ...Comun, tipo: z.literal("verificacion"), datos: Verificacion }),
  z.object({ ...Comun, tipo: z.literal("foto.agregar"), datos: Foto }),
  z.object({ ...Comun, tipo: z.literal("foto.borrar"), datos: z.object({ fotoId: Id }) }),
]);
export type Op = z.infer<typeof Op>;
export type OpNueva = Op extends infer T ? T extends Op ? Omit<T, "id" | "ts" | "dispositivo"> : never : never;

export interface EstadoEvento {
  paquete: PaqueteEvento;
  verificaciones: Map<string, Verificacion>;
  fotos: Foto[];
  /** Quién cambió qué por última vez: itemId → autor/dispositivo y hora. */
  ultimoCambio: Map<string, { quien: string; ts: number }>;
}

export const ordenOps = (a: Op, b: Op) => a.ts - b.ts || a.dispositivo.localeCompare(b.dispositivo) || a.id.localeCompare(b.id);

/** Aplica las operaciones sobre las bases. Función pura: mismo resultado en todos los dispositivos. */
export function reducir(bases: readonly PaqueteEvento[], ops: readonly Op[]): Map<string, EstadoEvento> {
  const estados = new Map<string, EstadoEvento>();
  for (const b of bases) estados.set(b.evento.id, nuevo(structuredClone(b)));

  for (const op of [...ops].sort(ordenOps)) {
    let e = estados.get(op.eventoId);
    if (!e) {
      if (op.tipo !== "estructura") continue; // operación de un evento que este dispositivo no conoce
      e = nuevo({ ...op.datos, items: [] });
      estados.set(op.eventoId, e);
    }
    const quien = { quien: op.autor || op.dispositivo, ts: op.ts };
    const p = e.paquete;
    switch (op.tipo) {
      case "estructura":
        Object.assign(p, structuredClone(op.datos));
        break;
      case "item.guardar": {
        const i = p.items.findIndex(x => x.id === op.datos.id);
        if (i >= 0) p.items[i] = op.datos; else p.items.push(op.datos);
        e.ultimoCambio.set(op.datos.id, quien);
        break;
      }
      case "item.borrar":
        p.items = p.items.filter(x => x.id !== op.datos.itemId);
        e.verificaciones.delete(op.datos.itemId);
        break;
      case "verificacion":
        e.verificaciones.set(op.datos.itemId, op.datos);
        e.ultimoCambio.set(op.datos.itemId, quien);
        break;
      case "foto.agregar":
        if (!e.fotos.some(f => f.id === op.datos.id)) e.fotos.push(op.datos);
        break;
      case "foto.borrar":
        e.fotos = e.fotos.filter(f => f.id !== op.datos.fotoId);
        break;
    }
  }
  return estados;
}

function nuevo(paquete: PaqueteEvento): EstadoEvento {
  return { paquete, verificaciones: new Map(), fotos: [], ultimoCambio: new Map() };
}
