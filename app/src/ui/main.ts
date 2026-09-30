/* Interfaz funcional mínima sobre el dominio. Sin trabajo de diseño todavía:
   su objetivo es mostrar que el modelo nuevo cubre lo que hacían los dos
   prototipos (lista por banda, conteo en cancha, totales, horario). */
import {
  CATEGORIAS, avance, estadoDe, etiquetaPropietario, parsearLista, referenciaDe, totalesPorReferencia,
  cantidadEsperada, type ItemBackline, type PaqueteEvento, type Verificacion,
} from "../dominio";
import { EVENTOS } from "../datos/eventos";
import { fichasDelDia, minutosShow } from "../datos/consultas";
import { RepositorioLocal } from "../datos/repositorio";

type Vista = "backline" | "totales" | "horario" | "lista" | "importar";

const repo = new RepositorioLocal(window.localStorage);
const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

let paquete: PaqueteEvento = EVENTOS[0]!;
let diaId = "";
let vista: Vista = "backline";
let verif = new Map<string, Verificacion>();
const toMin = (h: string) => { const [a, b] = h.split(":").map(Number) as [number, number]; return a * 60 + b; };

async function elegirEvento(id: string) {
  paquete = EVENTOS.find(e => e.evento.id === id) ?? EVENTOS[0]!;
  verif = await repo.todas(paquete.evento.id);
  const conItems = paquete.dias.find(d => paquete.items.some(i => i.diaId === d.id));
  diaId = (conItems ?? paquete.dias[0])?.id ?? "";
  render();
}

function render() {
  $("#dias").innerHTML = vista === "totales" || vista === "lista" || vista === "importar" ? "" : paquete.dias
    .map(d => `<button data-dia="${d.id}" aria-pressed="${d.id === diaId}">${esc(d.nombre)}</button>`).join("");
  document.querySelectorAll<HTMLButtonElement>("#vistas button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.vista === vista)));
  const a = avance(paquete.items, verif);
  $("#resumen").textContent = `${paquete.evento.lugar} · ${paquete.dias.length} días · ${paquete.artistas.length} artistas · ${a.total} ítems — verificado ${a.ok}/${a.total} (${a.porcentaje}%)` + (a.falta + a.sobra ? ` · ${a.falta + a.sobra} con diferencia` : "");
  const c = $("#contenido");
  if (vista === "backline") c.innerHTML = vistaBackline();
  if (vista === "totales") c.innerHTML = vistaTotales();
  if (vista === "horario") c.innerHTML = vistaHorario();
  if (vista === "lista") c.innerHTML = vistaLista();
  if (vista === "importar") c.innerHTML = vistaImportar();
}

function filaItem(it: ItemBackline): string {
  const v = verif.get(it.id);
  const e = estadoDe(it, v);
  return `<tr class="${e}" data-item="${it.id}">
    <td>${esc(it.descripcion)}${it.porConfirmar ? ` <span class="aviso">confirmar cantidad</span>` : ""}${it.chuleadoEnHoja ? ` <span class="chip">✓ hoja</span>` : ""}
      <br><small>${esc(it.categoria)} · ${esc(etiquetaPropietario(it.propietario))}</small></td>
    <td class="n">${cantidadEsperada(it, v)}</td>
    <td class="n"><input type="number" min="0" inputmode="numeric" value="${v?.contado ?? ""}" data-contado aria-label="Contado"></td>
    <td class="n"><input type="checkbox" ${v?.listo ? "checked" : ""} data-listo aria-label="Listo"></td>
    <td class="${e}">${e}</td>
  </tr>`;
}

function vistaBackline(): string {
  const todas = fichasDelDia(paquete, diaId);
  const fichas = todas.filter(f => f.itemsPorDia.has(diaId) || f.stagePlot);
  const sin = todas.filter(f => !fichas.includes(f));
  if (!todas.length) return "<p>Sin artistas este día.</p>";
  const nota = sin.length ? `<p><small>Sin backline cargado este día: ${sin.map(f => esc(f.nombre)).join(", ")}.</small></p>` : "";
  return fichas.map(f => {
    const items = f.itemsPorDia.get(diaId) ?? [];
    const bloques = f.bloques.filter(b => b.diaId === diaId).sort((x, y) => toMin(x.inicio) - toMin(y.inicio)).map(b => `${b.inicio}–${b.fin} ${esc(b.titulo)}`).join(" · ");
    const a = avance(items, verif);
    return `<details ${items.length ? "" : "data-vacio"}>
      <summary>${esc(f.nombre)} <small>${bloques}</small>${items.length ? ` <span class="chip">${a.ok}/${a.total}</span>` : ` <span class="chip">sin backline</span>`}</summary>
      ${items.length ? `<div class="tabla-scroll"><table><thead><tr><th>Ítem</th><th class="n">Esperado</th><th class="n">Contado</th><th class="n">Listo</th><th>Estado</th></tr></thead>
        <tbody>${items.map(filaItem).join("")}</tbody></table></div>` : ""}
      ${f.stagePlot ? `<p><img class="plot" loading="lazy" src="${esc(f.stagePlot)}" alt="Stage plot de ${esc(f.nombre)}"></p>` : ""}
    </details>`;
  }).join("") + nota;
}

function vistaTotales(): string {
  const tot = totalesPorReferencia(paquete.items, verif);
  if (!tot.length) return "<p>Este evento aún no tiene backline cargado.</p>";
  const dias = paquete.dias.filter(d => tot.some(t => d.id in t.porDia));
  return `<p><small>Dentro de un día se suma; entre días se toma el máximo (es el mismo equipo que se vuelve a montar).</small></p>
  <div class="tabla-scroll"><table><thead><tr><th>Referencia</th><th>Categoría</th>${dias.map(d => `<th class="n">${esc(d.nombre)}</th>`).join("")}<th class="n">A tener</th><th class="n">De terceros</th></tr></thead>
  <tbody>${tot.map(t => `<tr><td>${esc(t.referencia)}</td><td>${esc(t.categoria)}</td>${dias.map(d => `<td class="n">${t.porDia[d.id] ?? ""}</td>`).join("")}<td class="n"><b>${t.aTener}</b></td><td class="n">${t.deTerceros || ""}</td></tr>`).join("")}</tbody></table></div>`;
}

function vistaHorario(): string {
  const nombre = new Map(paquete.artistas.map(a => [a.id, a.nombre]));
  const bloques = paquete.bloques.filter(b => b.diaId === diaId);
  return paquete.escenarios.map(e => {
    const del = bloques.filter(b => b.escenarioId === e.id)
      .sort((a, b) => (a.tipo === "show" ? minutosShow(a.inicio) : toMin(a.inicio)) - (b.tipo === "show" ? minutosShow(b.inicio) : toMin(b.inicio)));
    if (!del.length) return "";
    return `<h3>${esc(e.nombre)}</h3><table><tbody>${del.map(b => `<tr><td class="n">${b.inicio}–${b.fin}</td><td>${esc(b.artistaId ? nombre.get(b.artistaId) : "")}</td><td>${esc(b.titulo)}</td><td><small>${b.tipo}</small></td></tr>`).join("")}</tbody></table>`;
  }).join("") || "<p>Sin horario este día.</p>";
}

function vistaLista(): string {
  return `<p>Pega el rider como llega por WhatsApp o correo. Una línea por ítem; “Categoría: detalle” fija la categoría.</p>
  <textarea id="pegado" placeholder="Platillos: 1 ride, 1 crash 18&#10;2 Snare stand&#10;1 HotRod Deville&#10;Base de redoblante x2"></textarea>
  <div id="resultado"></div>
  <p><small>Categorías: ${CATEGORIAS.join(" · ")}</small></p>`;
}

function renderLista(texto: string) {
  const r = parsearLista(texto);
  $("#resultado").innerHTML = r.length ? `<table><thead><tr><th class="n">Cant.</th><th>Descripción</th><th>Categoría</th><th>Referencia</th></tr></thead><tbody>${r.map(l => `<tr><td class="n">${l.cantidad}</td><td>${esc(l.descripcion)}</td><td>${esc(l.categoria)}</td><td>${esc(referenciaDe(l.descripcion))}</td></tr>`).join("")}</tbody></table>` : "";
}

/* ---------- Importar: correo, PDF o foto → entidades ---------- */
interface Conteo { nuevos: number; actualizados: number; iguales: number }
interface RespuestaExtraer {
  error?: string;
  paquete: PaqueteEvento;
  resumen: { evento: { id: string; nuevo: boolean }; avisos: string[]; itemsTocados: string[] } & Record<"escenarios" | "dias" | "artistas" | "bloques" | "items", Conteo>;
}
let pendiente: RespuestaExtraer | null = null;

function vistaImportar(): string {
  return `<p>Sube lo que llegó de producción: correos (.eml, con sus adjuntos), riders en PDF, fotos de las hojas de backline u horarios, o texto. Claude los lee y la app los convierte en días, artistas, horario y backline. Nada se guarda hasta que lo revises.</p>
  <p><label>Destino <select id="imp-evento"><option value="">Evento nuevo (según los archivos)</option>${EVENTOS.map(e => `<option value="${e.evento.id}" ${e.evento.id === paquete.evento.id ? "selected" : ""}>${esc(e.evento.nombre)}</option>`).join("")}</select></label></p>
  <p><input type="file" id="imp-archivos" multiple accept=".eml,.pdf,.jpg,.jpeg,.png,.webp,.gif,.txt,.csv,message/rfc822,application/pdf,image/*,text/plain"></p>
  <p><button id="imp-extraer">Extraer</button> <span id="imp-estado"></span></p>
  <div id="imp-resultado"></div>`;
}

const base64 = (f: File) => new Promise<string>((ok, mal) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).replace(/^data:[^,]*,/, ""));
  r.onerror = () => mal(r.error);
  r.readAsDataURL(f);
});

async function importar() {
  const archivos = [...($("#imp-archivos") as HTMLInputElement).files ?? []];
  const estado = $("#imp-estado");
  if (!archivos.length) { estado.textContent = "Elige al menos un archivo."; return; }
  const eventoId = ($("#imp-evento") as HTMLSelectElement).value || undefined;
  ($("#imp-extraer") as HTMLButtonElement).disabled = true;
  estado.textContent = `Leyendo ${archivos.length} archivo(s)… puede tardar un par de minutos.`;
  $("#imp-resultado").innerHTML = "";
  try {
    const cuerpo = { eventoId, archivos: await Promise.all(archivos.map(async f => ({ nombre: f.name, tipo: f.type, base64: await base64(f) }))) };
    const res = await fetch("api/extraer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
    if (res.status === 404) throw new Error("La extracción solo funciona con el servidor (npm run dev).");
    const r = await res.json() as RespuestaExtraer;
    if (!res.ok || r.error) throw new Error(r.error ?? `Error ${res.status}`);
    pendiente = r;
    estado.textContent = "";
    $("#imp-resultado").innerHTML = resultadoImportar(r);
  } catch (err) {
    estado.textContent = err instanceof Error ? err.message : String(err);
  } finally {
    ($("#imp-extraer") as HTMLButtonElement).disabled = false;
  }
}

function resultadoImportar(r: RespuestaExtraer): string {
  const p = r.paquete, s = r.resumen;
  const fila = (n: string, c: Conteo) => `<tr><td>${n}</td><td class="n">${c.nuevos}</td><td class="n">${c.actualizados}</td><td class="n">${c.iguales}</td></tr>`;
  const nombre = new Map(p.artistas.map(a => [a.id, a.nombre]));
  const dia = new Map(p.dias.map(d => [d.id, d.nombre]));
  const tocados = new Set(s.itemsTocados);
  const recientes = p.items.filter(i => tocados.has(i.id));
  return `<h3>${s.evento.nuevo ? "Evento nuevo" : "Se sumará a"}: ${esc(p.evento.nombre)}</h3>
  <div class="tabla-scroll"><table><thead><tr><th></th><th class="n">Nuevos</th><th class="n">Actualizados</th><th class="n">Ya estaban</th></tr></thead><tbody>
  ${fila("Escenarios", s.escenarios)}${fila("Días", s.dias)}${fila("Artistas", s.artistas)}${fila("Horario", s.bloques)}${fila("Backline", s.items)}</tbody></table></div>
  ${s.avisos.length ? `<h4>Para revisar</h4><ul>${s.avisos.map(a => `<li class="aviso">${esc(a)}</li>`).join("")}</ul>` : ""}
  ${recientes.length ? `<h4>Backline extraído</h4><div class="tabla-scroll"><table><thead><tr><th>Artista</th><th>Día</th><th class="n">Cant.</th><th>Ítem</th><th>Categoría</th><th>Propietario</th></tr></thead><tbody>
    ${recientes.map(i => `<tr><td>${esc(nombre.get(i.artistaId))}</td><td>${esc(dia.get(i.diaId))}</td><td class="n">${i.cantidad}</td><td>${esc(i.descripcion)}${i.porConfirmar ? ` <span class="aviso">confirmar</span>` : ""}</td><td>${esc(i.categoria)}</td><td>${esc(etiquetaPropietario(i.propietario))}</td></tr>`).join("")}
  </tbody></table></div>` : ""}
  <p><button id="imp-guardar">Guardar en ${esc(p.evento.nombre)}</button> <button id="imp-descartar">Descartar</button></p>`;
}

async function guardarImportacion() {
  if (!pendiente) return;
  const estado = $("#imp-estado");
  try {
    const res = await fetch("api/guardar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paquete: pendiente.paquete, nuevo: pendiente.resumen.evento.nuevo }) });
    const r = await res.json() as { error?: string; id?: string };
    if (!res.ok || r.error) throw new Error(r.error ?? `Error ${res.status}`);
    // El servidor de desarrollo recarga la página con el evento nuevo o actualizado.
    try { sessionStorage.setItem("backline:evento", r.id!); } catch { /* sin almacenamiento */ }
    estado.textContent = "Guardado.";
    pendiente = null;
    $("#imp-resultado").innerHTML = "";
  } catch (err) {
    estado.textContent = err instanceof Error ? err.message : String(err);
  }
}

async function registrar(fila: HTMLTableRowElement) {
  const itemId = fila.dataset.item!;
  const n = fila.querySelector<HTMLInputElement>("[data-contado]")!.value;
  const listo = fila.querySelector<HTMLInputElement>("[data-listo]")!.checked;
  const previa = verif.get(itemId);
  const v: Verificacion = { ...previa, itemId, contado: n === "" ? null : Math.max(0, Math.trunc(Number(n))), listo };
  await repo.guardar(paquete.evento.id, v);
  verif = await repo.todas(paquete.evento.id);
  const abiertos = [...document.querySelectorAll("details")].map(d => d.open);
  render();
  document.querySelectorAll("details").forEach((d, i) => (d.open = abiertos[i] ?? false));
}

$("#evento").innerHTML = EVENTOS.map(e => `<option value="${e.evento.id}">${esc(e.evento.nombre)}</option>`).join("");
$("#evento").addEventListener("change", e => void elegirEvento((e.target as HTMLSelectElement).value));
$("#vistas").addEventListener("click", e => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-vista]");
  if (b) { vista = b.dataset.vista as Vista; render(); }
});
$("#dias").addEventListener("click", e => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-dia]");
  if (b) { diaId = b.dataset.dia!; render(); }
});
$("#contenido").addEventListener("change", e => {
  const fila = (e.target as HTMLElement).closest<HTMLTableRowElement>("tr[data-item]");
  if (fila) void registrar(fila);
});
$("#contenido").addEventListener("click", e => {
  const id = (e.target as HTMLElement).id;
  if (id === "imp-extraer") void importar();
  if (id === "imp-guardar") void guardarImportacion();
  if (id === "imp-descartar") { pendiente = null; $("#imp-resultado").innerHTML = ""; }
});
$("#contenido").addEventListener("input", e => {
  if ((e.target as HTMLElement).id === "pegado") renderLista((e.target as HTMLTextAreaElement).value);
});

let inicial = EVENTOS[0]!.evento.id;
try { inicial = sessionStorage.getItem("backline:evento") ?? inicial; sessionStorage.removeItem("backline:evento"); } catch { /* sin almacenamiento */ }
($("#evento") as HTMLSelectElement).value = inicial;
void elegirEvento(inicial);
