/* Una hoja de Excel dibujada como en Excel (letras de columna, números de
 * fila, anchos, celdas combinadas y dónde hay imágenes), para compararla con
 * el archivo real. Misma idea que la hoja de prototipos/estado. */
import { tapadas, type Hoja } from "../../lector/src/lectura";

/** Más de esto no se dibuja: la hoja se vuelve lenta y el texto de al lado sigue completo. */
const MAX_FILAS = 1500;

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function letra(col: number): string {
  let s = "";
  for (let c = col; c > 0; c = Math.floor((c - 1) / 26)) s = String.fromCharCode(65 + ((c - 1) % 26)) + s;
  return s;
}

/** Ancho de Excel (caracteres) → píxeles, como lo hace Excel con su letra por defecto. */
function px(ancho: number | undefined): number {
  if (ancho === 0) return 6; // columna oculta
  if (ancho === undefined) return 64;
  return Math.min(420, Math.max(22, Math.round(ancho * 7 + 5)));
}

export function hojaHtml(h: Hoja): string {
  const filas = Math.min(h.filas, MAX_FILAS);
  const cols = Math.max(h.columnas, 1);
  const anchos = Array.from({ length: cols }, (_, c) => px(h.anchos[c]));

  const tapada = tapadas(h.combinadas);
  const span = new Map(h.combinadas.map(r => [`${r.filaDesde},${r.colDesde}`, r]));
  // Celdas bajo una imagen: en Excel la imagen flota encima; aquí se marcan.
  const conImagen = new Map<string, number>();
  h.imagenes.forEach((im, i) => {
    for (let f = im.filaDesde; f <= im.filaHasta; f++) for (let c = im.colDesde; c <= im.colHasta; c++) conImagen.set(`${f},${c}`, i + 1);
  });

  let html = `<table class="xl" style="width:${36 + anchos.reduce((a, b) => a + b, 0)}px"><colgroup><col style="width:36px">${anchos.map(w => `<col style="width:${w}px">`).join("")}</colgroup>`;
  html += `<thead><tr><th></th>${anchos.map((_, c) => `<th>${letra(c + 1)}</th>`).join("")}</tr></thead><tbody>`;
  for (let f = 1; f <= filas; f++) {
    html += `<tr data-fila="${f}"><th>${f}</th>`;
    for (let c = 1; c <= cols; c++) {
      if (tapada.has(`${f},${c}`)) continue;
      const r = span.get(`${f},${c}`);
      const ref = `${letra(c)}${f}${r ? `:${letra(r.colHasta)}${r.filaHasta}` : ""}`;
      const v = h.celda(f, c);
      const img = conImagen.get(`${f},${c}`);
      const clases = [v.includes("\n") ? "multi" : "", img ? "img" : ""].filter(Boolean).join(" ");
      const atributos = [
        r ? `rowspan="${r.filaHasta - r.filaDesde + 1}" colspan="${r.colHasta - r.colDesde + 1}"` : "",
        clases ? `class="${clases}"` : "",
        `data-ref="${ref}"`,
        `title="${esc(ref + (v ? ` · ${v}` : img ? ` · imagen ${img}` : ""))}"`,
      ].filter(Boolean).join(" ");
      html += `<td ${atributos}>${esc(v)}</td>`;
    }
    html += "</tr>";
  }
  html += "</tbody></table>";
  if (h.filas > filas) html += `<p class="mini">Se dibujan las primeras ${MAX_FILAS} de ${h.filas} filas; el texto de al lado las trae todas.</p>`;
  return html;
}
