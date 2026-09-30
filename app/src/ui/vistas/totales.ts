import { totalesPorReferencia } from "../../dominio";
import type { Ui } from "../contexto";
import { esc } from "../util";

export function pintarTotales(ui: Ui): string {
  const e = ui.tienda.estado(ui.eventoId);
  if (!e) return "";
  const tot = totalesPorReferencia(e.paquete.items, e.verificaciones);
  if (!tot.length) return "<p>Este evento aún no tiene backline cargado.</p>";
  const dias = e.paquete.dias.filter(d => tot.some(t => d.id in t.porDia));
  return `<p><small>Dentro de un día se suma; entre días se toma el máximo (es el mismo equipo que se vuelve a montar).</small></p>
  <div class="tabla-scroll"><table><thead><tr><th>Referencia</th><th>Categoría</th>${dias.map(d => `<th class="n">${esc(d.nombre)}</th>`).join("")}<th class="n">A tener</th><th class="n">De terceros</th></tr></thead>
  <tbody>${tot.map(t => `<tr><td>${esc(t.referencia)}</td><td>${esc(t.categoria)}</td>${dias.map(d => `<td class="n">${t.porDia[d.id] ?? ""}</td>`).join("")}<td class="n"><b>${t.aTener}</b></td><td class="n">${t.deTerceros || ""}</td></tr>`).join("")}</tbody></table></div>`;
}
