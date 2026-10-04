/* Varias extracciones (una por archivo) → una sola, sin repetir artistas ni días. */
import type { Extraccion } from "./esquema";

export function extraccionVacia(): Extraccion {
  return { evento: null, escenarios: [], dias: [], artistas: [], bloques: [], items: [], avisos: [], zonas: [], puestos: [], canales: [], requisitos: [], planos: [], comparaciones: [] };
}

export function unirExtracciones(lista: Extraccion[]): Extraccion {
  const out = extraccionVacia();
  for (const e of lista) {
    out.evento ??= e.evento;
    for (const k of ["escenarios", "artistas"] as const) for (const x of e[k]) if (!out[k].includes(x)) out[k].push(x);
    for (const d of e.dias) if (!out.dias.some(x => x.fecha === d.fecha)) out.dias.push(d);
    for (const k of ["bloques", "items", "avisos", "zonas", "puestos", "canales", "requisitos", "planos", "comparaciones"] as const) (out[k] as unknown[]).push(...e[k]);
  }
  out.dias.sort((a, b) => a.fecha.localeCompare(b.fecha));
  return out;
}
