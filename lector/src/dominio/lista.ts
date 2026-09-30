import { categorizar } from "./categorias";
import type { Categoria } from "./entidades";

export interface LineaLista {
  categoria: Categoria;
  descripcion: string;
  cantidad: number;
}

const CANTIDAD_INICIAL = /^(\d{1,3})\s*(?:x\s+)?(?=\D)/i;
const CANTIDAD_FINAL = /\s+x\s*(\d{1,3})$/i;

/** Separa "2 Snare stand" o "Snare stand x2" en cantidad y descripción.
 *  Sin número explícito la cantidad es 1. No confunde medidas ("14\" Snare"). */
export function separarCantidad(texto: string): { cantidad: number; descripcion: string } {
  const t = texto.trim();
  const ini = t.match(CANTIDAD_INICIAL);
  if (ini && !/^\d+\s*["”']/.test(t)) return { cantidad: Number(ini[1]), descripcion: t.slice(ini[0].length).trim() };
  const fin = t.match(CANTIDAD_FINAL);
  if (fin) return { cantidad: Number(fin[1]), descripcion: t.slice(0, fin.index).trim() };
  return { cantidad: 1, descripcion: t };
}

/** Convierte un bloque de texto pegado (WhatsApp, correo, rider) en ítems.
 *  - Cada línea no vacía es un ítem; se ignoran viñetas.
 *  - "Categoría: detalle" usa esa categoría si es una de las conocidas;
 *    si no, la categoría se adivina por palabras clave.
 *  - Se ignora la línea de encabezado con el nombre del artista. */
export function parsearLista(texto: string, nombreArtista = ""): LineaLista[] {
  const encabezado = nombreArtista.trim().toLowerCase();
  const out: LineaLista[] = [];
  for (const cruda of texto.split(/\r?\n/)) {
    const linea = cruda.replace(/^\s*(?:[-•*·]|\d+[.)])\s+/, "").trim();
    if (!linea) continue;
    if (encabezado && linea.replace(/:\s*$/, "").toLowerCase() === encabezado) continue;

    const i = linea.indexOf(":");
    const pref = i === -1 ? "" : linea.slice(0, i).trim();
    const resto = i === -1 ? linea : linea.slice(i + 1).trim();
    const cuerpo = resto || pref;
    const { cantidad, descripcion } = separarCantidad(cuerpo);
    if (!descripcion) continue;

    const explicita = pref && resto ? categoriaConocida(pref) : undefined;
    out.push({ categoria: explicita ?? categorizar(`${descripcion} ${pref}`), descripcion, cantidad });
  }
  return out;
}

function categoriaConocida(texto: string): Categoria | undefined {
  const c = categorizar(texto);
  return c === "Otro" ? undefined : c;
}
