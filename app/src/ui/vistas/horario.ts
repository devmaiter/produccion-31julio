import { minutosShow } from "../../datos/consultas";
import type { Ui } from "../contexto";
import { esc, minutos } from "../util";

export function pintarHorario(ui: Ui): string {
  const e = ui.tienda.estado(ui.eventoId);
  if (!e) return "";
  const p = e.paquete;
  const nombre = new Map(p.artistas.map(a => [a.id, a.nombre]));
  const clave = (b: (typeof p.bloques)[number]) => (b.tipo === "show" ? minutosShow(b.inicio) : minutos(b.inicio));
  const bloques = p.bloques.filter(b => b.diaId === ui.diaId);
  return p.escenarios.map(esc_ => {
    const del = bloques.filter(b => b.escenarioId === esc_.id).sort((a, b) => clave(a) - clave(b));
    if (!del.length) return "";
    return `<h3>${esc(esc_.nombre)}</h3><div class="tabla-scroll"><table><tbody>${del.map(b => `<tr><td class="n">${b.inicio}–${b.fin}</td><td>${esc(b.artistaId ? nombre.get(b.artistaId) : "")}</td><td>${esc(b.titulo)}</td><td><small>${b.tipo}</small></td></tr>`).join("")}</tbody></table></div>`;
  }).join("") || "<p>Sin horario este día.</p>";
}
