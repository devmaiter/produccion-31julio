import type { ItemBackline, Verificacion } from "./entidades";

export type Estado = "pendiente" | "ok" | "falta" | "sobra";

export function cantidadEsperada(item: ItemBackline, v?: Verificacion): number {
  return v?.cantidadCorregida ?? item.cantidad;
}

/** Estado de un ítem en cancha: sin conteo vale el chulo "listo"; con conteo
 *  se compara contra la cantidad esperada (la corregida si la hay). */
export function estadoDe(item: ItemBackline, v?: Verificacion): Estado {
  if (!v || v.contado === null || v.contado === undefined) return v?.listo ? "ok" : "pendiente";
  const esperada = cantidadEsperada(item, v);
  if (v.contado === esperada) return "ok";
  return v.contado < esperada ? "falta" : "sobra";
}

export interface Avance {
  total: number;
  ok: number;
  falta: number;
  sobra: number;
  pendiente: number;
  porcentaje: number;
}

export function avance(items: readonly ItemBackline[], verif: ReadonlyMap<string, Verificacion>): Avance {
  const a: Avance = { total: items.length, ok: 0, falta: 0, sobra: 0, pendiente: 0, porcentaje: 0 };
  for (const it of items) a[estadoDe(it, verif.get(it.id))]++;
  a.porcentaje = a.total ? Math.round((a.ok / a.total) * 100) : 0;
  return a;
}
