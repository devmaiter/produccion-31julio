/* "Así lo leí": el texto que sale de cada documento, sin interpretar (el
 * mismo Markdown que `npm run texto` en el lector), para revisarlo antes de
 * buscar el backline. Todo se lee en el navegador, sin internet. */
import pdfWorker from "../../lector/node_modules/pdfjs-dist/build/pdf.worker.min.mjs?url";
import { documentosAMarkdown, hojaAMarkdown, leerArchivo, leerLibro, libroAMarkdown, type Libro } from "../../lector/src/lectura";
import { lectoresNavegador } from "../../lector/src/lectura/navegador";
import { hojaHtml } from "./hoja";

const lectores = lectoresNavegador({ pdfWorker, ocr: "ocr/" });
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Un Excel trae además el libro, para dibujar la hoja al lado del texto. */
interface Leido { nombre: string; md: string; error: string | null; libro?: Libro; hoja: number }
let leidos: Leido[] = [];

/* ---- entrada ---- */
const zona = $("zona"), input = $<HTMLInputElement>("archivos");
$("elegir").addEventListener("click", () => input.click());
zona.addEventListener("click", ev => { if (ev.target === zona || (ev.target as HTMLElement).tagName === "P") input.click(); });
zona.addEventListener("keydown", ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); input.click(); } });
input.addEventListener("change", () => { void leer([...(input.files ?? [])]); input.value = ""; });
for (const ev of ["dragenter", "dragover"]) zona.addEventListener(ev, e => { e.preventDefault(); zona.classList.add("encima"); });
for (const ev of ["dragleave", "drop"]) zona.addEventListener(ev, e => { e.preventDefault(); zona.classList.remove("encima"); });
zona.addEventListener("drop", e => void leer([...((e as DragEvent).dataTransfer?.files ?? [])]));
// Soltar fuera de la zona no debe abrir el archivo en el navegador.
for (const ev of ["dragover", "drop"]) window.addEventListener(ev, e => e.preventDefault());
document.addEventListener("paste", e => {
  const archivos = [...(e.clipboardData?.files ?? [])];
  const texto = e.clipboardData?.getData("text/plain") ?? "";
  if (archivos.length) void leer(archivos);
  else if (texto.trim()) void leer([new File([texto], "texto pegado.txt", { type: "text/plain" })]);
});
document.querySelectorAll<HTMLButtonElement>("[data-muestra]").forEach(b => b.addEventListener("click", async () => {
  const ruta = b.dataset.muestra!;
  const r = await fetch(ruta);
  if (!r.ok) { aviso(`No se encontró la muestra ${ruta}.`); return; }
  await leer([new File([await r.blob()], ruta.split("/").pop()!)]);
}));

/* ---- lectura ----
 * Los archivos se leen en fila, uno a la vez, aunque se suelten mientras otro
 * se está leyendo; cada uno tiene su renglón de progreso. */
let fila: Promise<void> = Promise.resolve();
let contador = 0;

function leer(archivos: File[]): Promise<void> {
  if (!archivos.length) return fila;
  const progreso = $("progreso");
  progreso.hidden = false;
  const ids = archivos.map(f => {
    const id = `a-${++contador}`;
    progreso.insertAdjacentHTML("beforeend", `<div class="archivo" id="${id}"><span>${esc(f.name)}</span><span class="estado">en cola</span></div>`);
    return id;
  });
  return (fila = fila.then(() => leerEnOrden(archivos, ids)));
}

async function leerEnOrden(archivos: File[], ids: string[]): Promise<void> {
  const estado = (i: number, texto: string, clase = "") => {
    const el = document.getElementById(ids[i]!);
    if (!el) return; // se borró la lista mientras leía
    el.className = `archivo ${clase}`;
    el.querySelector(".estado")!.textContent = texto;
  };
  for (const [i, f] of archivos.entries()) {
    const foto = f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp|tiff?)$/i.test(f.name);
    estado(i, foto ? "leyendo con OCR, puede tardar…" : /\.xlsx$/i.test(f.name) ? "leyendo el Excel…" : "leyendo…");
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const libro = /\.xlsx$/i.test(f.name) ? await leerLibro(bytes) : undefined;
      const md = libro ? libroAMarkdown(libro, f.name) : documentosAMarkdown(await leerArchivo(f.name, bytes, f.type, lectores));
      leidos.push({ nombre: f.name, md, error: null, libro, hoja: 0 });
      estado(i, `listo · ${(md.match(/^\s*\d+ {2}/gm) ?? []).length} renglones`, "listo");
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      leidos.push({ nombre: f.name, md: "", error, hoja: 0 });
      estado(i, `no se pudo leer: ${error}`, "error");
    }
    pintar();
  }
}

/* ---- salida ---- */
function pintar(): void {
  $("resultado").hidden = !leidos.length;
  $("salida").innerHTML = leidos.map((l, i) => `<article class="doc" id="doc-${i}">${documento(l, i)}</article>`).join("");
}

function documento(l: Leido, i: number): string {
  if (l.error) return `<h2>${esc(l.nombre)}</h2><p class="error">No se pudo leer: ${esc(l.error)}</p>`;
  if (!l.libro) return html(l.md);
  // Excel: pestañas por hoja, barra de fórmulas, la hoja como en Excel y el texto al lado.
  const h = l.libro.hojas[l.hoja];
  const pestanas = l.libro.hojas.map((x, k) =>
    `<button type="button" class="pestana" role="tab" data-doc="${i}" data-hoja="${k}" aria-selected="${k === l.hoja}">${esc(x.nombre)}</button>`).join("");
  if (!h) return `<h2>${esc(l.nombre)}</h2><p class="resumen-doc">Excel sin hojas.</p>`;
  const [titulo, ...resto] = hojaAMarkdown(h);
  return `<h2>${esc(l.nombre)}</h2>
    <p class="resumen-doc">Excel · ${l.libro.hojas.length} hoja${l.libro.hojas.length === 1 ? "" : "s"} · ${esc(titulo!.replace(/^## /, ""))}</p>
    <div class="pestanas" role="tablist">${pestanas}</div>
    <div class="formula" data-doc="${i}"><b class="ref">—</b><span class="valor">Toca una celda para ver todo su contenido.</span></div>
    <div class="comparar">
      <div class="panel-hoja"><h4>La hoja (como en Excel)</h4><div class="grid-scroll" data-doc="${i}">${hojaHtml(h)}</div></div>
      <div class="panel-texto"><h4>Así lo leí</h4><div class="texto-scroll" data-doc="${i}">${html(resto.join("\n"))}</div></div>
    </div>`;
}

/* Tocar una celda o un renglón marca la misma fila en los dos lados. */
$("salida").addEventListener("click", ev => {
  const t = ev.target as HTMLElement;
  const pestana = t.closest<HTMLElement>(".pestana");
  if (pestana) {
    const i = Number(pestana.dataset.doc), l = leidos[i];
    if (!l) return;
    l.hoja = Number(pestana.dataset.hoja);
    $(`doc-${i}`).innerHTML = documento(l, i);
    return;
  }
  const doc = t.closest<HTMLElement>("article.doc");
  if (!doc) return;
  const td = t.closest<HTMLTableCellElement>("table.xl td");
  if (td) {
    const fila = Number(td.closest("tr")!.dataset.fila);
    marcar(doc, fila, td);
    return;
  }
  const r = t.closest<HTMLElement>(".texto-scroll .r[data-fila]");
  if (r) marcar(doc, Number(r.dataset.fila), null, true);
});

function marcar(doc: HTMLElement, fila: number, celda: HTMLTableCellElement | null, desdeTexto = false): void {
  doc.querySelectorAll(".marcada").forEach(e => e.classList.remove("marcada"));
  doc.querySelectorAll(".sel").forEach(e => e.classList.remove("sel"));
  const tr = doc.querySelector<HTMLElement>(`table.xl tr[data-fila="${fila}"]`);
  const r = doc.querySelector<HTMLElement>(`.texto-scroll .r[data-fila="${fila}"]`);
  tr?.classList.add("marcada");
  r?.classList.add("marcada");
  // Desde el texto se elige la primera celda con algo de esa fila.
  celda ??= tr ? [...tr.querySelectorAll<HTMLTableCellElement>("td")].find(c => c.textContent) ?? null : null;
  celda?.classList.add("sel");
  const barra = doc.querySelector<HTMLElement>(".formula");
  if (barra) {
    barra.querySelector(".ref")!.textContent = celda?.dataset.ref ?? `fila ${fila}`;
    barra.querySelector(".valor")!.textContent = celda?.textContent || (r ? "" : "Esta fila no salió en el texto (está vacía).");
  }
  if (desdeTexto) (celda ?? tr)?.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
  else r?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

/** El Markdown de `texto.ts` (títulos, avisos, listas y bloques de texto) en HTML. */
function html(md: string): string {
  const out: string[] = [];
  let bloque: string[] | null = null;
  for (const l of md.split("\n")) {
    if (/^(```|~~~~)/.test(l)) {
      if (bloque) { out.push(`<pre>${renglones(bloque)}</pre>`); bloque = null; } else bloque = [];
      continue;
    }
    if (bloque) { bloque.push(l); continue; }
    if (!l.trim()) continue;
    const h = l.match(/^(#{1,3}) (.*)$/);
    if (h) { const n = h[1]!.length + 1; out.push(`<h${n}>${esc(h[2]!)}</h${n}>`); continue; }
    if (l.startsWith("> ")) { out.push(`<p class="alerta">${esc(l.slice(2))}</p>`); continue; }
    if (l.startsWith("- ")) { out.push(`<ul><li>${esc(l.slice(2))}</li></ul>`); continue; }
    if (/^_.*_$/.test(l)) { out.push(`<p><em>${esc(l.slice(1, -1))}</em></p>`); continue; }
    out.push(`<p class="resumen-doc">${esc(l)}</p>`);
  }
  return out.join("\n");
}

/** Cada renglón con su número (en Excel, la fila) para enlazarlo con la hoja;
 *  los renglones de abajo de una celda larga son de la última fila numerada. */
function renglones(lineas: string[]): string {
  let fila = 0;
  return lineas.map(l => {
    const n = l.match(/^\s*(\d+) {2}/);
    if (n) fila = Number(n[1]);
    return `<span class="r"${fila ? ` data-fila="${fila}"` : ""}>${renglon(l) || " "}</span>`;
  }).join("");
}

function renglon(l: string): string {
  return esc(l)
    .replace(/^(\s*\d+)( {2})/, '<span class="n">$1</span>$2')
    .replace(/│/g, '<span class="col">│</span>')
    .replace(/⟨\d+ %⟩/g, m => `<span class="duda">${m}</span>`);
}

const todo = () => leidos.filter(l => !l.error).map(l => l.md).join("\n");

function aviso(t: string): void {
  $("aviso").textContent = t;
  setTimeout(() => { if ($("aviso").textContent === t) $("aviso").textContent = ""; }, 3000);
}

$("copiar").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(todo()); aviso("Copiado."); }
  catch { aviso("No se pudo copiar; usa Descargar .md."); }
});
$("descargar").addEventListener("click", () => {
  const nombre = leidos.length === 1 ? `${leidos[0]!.nombre}.md` : "asi-lo-lei.md";
  const url = URL.createObjectURL(new Blob([todo()], { type: "text/markdown;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: nombre });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
});
$("limpiar").addEventListener("click", () => { leidos = []; $("progreso").innerHTML = ""; $("progreso").hidden = true; pintar(); });
