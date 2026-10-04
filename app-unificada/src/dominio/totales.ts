import type { Categoria, ItemBackline, Verificacion } from "./entidades";
import { cantidadEsperada } from "./verificacion";

export interface TotalReferencia {
  referencia: string;
  categoria: Categoria;
  /** Lo que pide cada día (suma de todos los artistas de ese día). */
  porDia: Record<string, number>;
  /** Lo que hay que tener: el máximo entre días. */
  aTener: number;
  /** Cuánto de lo que hay que tener es de terceros (el día que más pide). */
  deTerceros: number;
  artistas: string[];
}

/** Totales por referencia.
 *  Dentro de un día se SUMA: las bandas montan en paralelo o se cambian sin
 *  tiempo para mover equipo. Entre días se toma el MÁXIMO: es el mismo equipo
 *  que se desmonta y se vuelve a montar. */
export function totalesPorReferencia(
  items: readonly ItemBackline[],
  verif: ReadonlyMap<string, Verificacion> = new Map(),
): TotalReferencia[] {
  const porRef = new Map<string, { categoria: Categoria; dias: Map<string, { total: number; terceros: number }>; artistas: Set<string> }>();
  for (const it of items) {
    let r = porRef.get(it.referencia);
    if (!r) porRef.set(it.referencia, (r = { categoria: it.categoria, dias: new Map(), artistas: new Set() }));
    const d = r.dias.get(it.diaId) ?? { total: 0, terceros: 0 };
    const n = cantidadEsperada(it, verif.get(it.id));
    d.total += n;
    if (it.propietario.tipo === "tercero") d.terceros += n;
    r.dias.set(it.diaId, d);
    r.artistas.add(it.artistaId);
  }
  const out: TotalReferencia[] = [];
  for (const [referencia, r] of porRef) {
    let aTener = 0, deTerceros = 0;
    const porDia: Record<string, number> = {};
    for (const [dia, d] of r.dias) {
      porDia[dia] = d.total;
      if (d.total > aTener) { aTener = d.total; deTerceros = d.terceros; }
    }
    out.push({ referencia, categoria: r.categoria, porDia, aTener, deTerceros, artistas: [...r.artistas].sort() });
  }
  return out.sort((a, b) => a.categoria.localeCompare(b.categoria) || b.aTener - a.aTener || a.referencia.localeCompare(b.referencia));
}
