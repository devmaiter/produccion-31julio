import type { Propietario } from "./entidades";

/** Interpreta la columna de observaciones de la hoja de backline.
 *  "CN" = equipo propio; cualquier otro nombre (OML, BACKLINE COP, una persona)
 *  = tercero. Si la observación trae varios, gana el primero. */
export function propietarioDe(observacion: string | undefined): Propietario {
  const obs = (observacion ?? "").trim();
  if (!obs) return { tipo: "sin-definir" };
  const primero = obs.split(/[\/,]/)[0]!.trim();
  if (/^cn$/i.test(primero)) return { tipo: "propio" };
  return { tipo: "tercero", nombre: primero.toUpperCase() };
}

export function etiquetaPropietario(p: Propietario): string {
  switch (p.tipo) {
    case "propio": return "Propio (CN)";
    case "tercero": return p.nombre;
    case "sin-definir": return "Sin definir";
  }
}
