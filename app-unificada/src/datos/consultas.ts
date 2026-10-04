import type { Bloque, ItemBackline, PaqueteEvento } from "../dominio";

/** Vista de un artista dentro de un evento: sus bloques y su backline por día. */
export interface FichaArtista {
  artistaId: string;
  nombre: string;
  bloques: Bloque[];
  itemsPorDia: Map<string, ItemBackline[]>;
  stagePlot?: string;
}

export function fichasDelDia(p: PaqueteEvento, diaId: string): FichaArtista[] {
  const ids = new Set<string>();
  for (const it of p.items) if (it.diaId === diaId) ids.add(it.artistaId);
  for (const b of p.bloques) if (b.diaId === diaId && b.artistaId) ids.add(b.artistaId);
  return [...ids].map(id => ficha(p, id)).sort((a, b) => primerInicio(a, diaId).localeCompare(primerInicio(b, diaId)));
}

export function ficha(p: PaqueteEvento, artistaId: string): FichaArtista {
  const artista = p.artistas.find(a => a.id === artistaId);
  const itemsPorDia = new Map<string, ItemBackline[]>();
  for (const it of p.items) {
    if (it.artistaId !== artistaId) continue;
    if (!itemsPorDia.has(it.diaId)) itemsPorDia.set(it.diaId, []);
    itemsPorDia.get(it.diaId)!.push(it);
  }
  return {
    artistaId,
    nombre: artista?.nombre ?? artistaId,
    bloques: p.bloques.filter(b => b.artistaId === artistaId),
    itemsPorDia,
    stagePlot: p.stagePlots.find(s => s.artistaId === artistaId)?.archivo,
  };
}

/** Hora de un show en minutos: un show que empieza antes de las 06:00 es de
 *  la noche anterior y va después de los de la noche. Solo sirve para shows:
 *  los montajes y pruebas sí arrancan de madrugada (load in a las 04:00). */
export function minutosShow(hora: string): number {
  const [h, m] = hora.split(":").map(Number) as [number, number];
  return (h < 6 ? h + 24 : h) * 60 + m;
}

function minutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number) as [number, number];
  return h * 60 + m;
}

/** Clave de orden de un artista en un día: la hora de su show; si ese día no
 *  tiene show (día de pruebas), su primer bloque. Sin horario, al final. */
function primerInicio(f: FichaArtista, diaId: string): string {
  const del = f.bloques.filter(x => x.diaId === diaId);
  const show = del.find(b => b.tipo === "show");
  const clave = show ? minutosShow(show.inicio) : Math.min(...del.map(b => minutos(b.inicio)));
  return Number.isFinite(clave) ? String(clave).padStart(4, "0") : "9999";
}
