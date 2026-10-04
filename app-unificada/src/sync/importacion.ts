import type { PaqueteEvento } from "../dominio/entidades";
import type { OpNueva } from "./ops";

/** Lo que una importación cambió, como operaciones: la estructura del evento
 *  (solo si cambió) y cada ítem nuevo o actualizado. */
export function opsDeImportacion(antes: PaqueteEvento | null, despues: PaqueteEvento, itemsTocados: readonly string[]): OpNueva[] {
  const eventoId = despues.evento.id;
  const estructura = (p: PaqueteEvento) => ({
    evento: p.evento, escenarios: p.escenarios, dias: p.dias, artistas: p.artistas, bloques: p.bloques, stagePlots: p.stagePlots,
  });
  const ops: OpNueva[] = [];
  if (!antes || JSON.stringify(estructura(antes)) !== JSON.stringify(estructura(despues))) {
    ops.push({ tipo: "estructura", eventoId, datos: structuredClone(estructura(despues)) });
  }
  const tocados = new Set(itemsTocados);
  for (const it of despues.items) if (tocados.has(it.id)) ops.push({ tipo: "item.guardar", eventoId, datos: it });
  return ops;
}
